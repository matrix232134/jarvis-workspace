"use client"

/**
 * Browser voice hook — mic capture + optional wake word + streaming voice pipeline.
 *
 * Captures mic audio via Web Audio API, feeds frames to:
 * 1. Porcupine Web (if available) for local "JARVIS" wake word detection
 * 2. Bridge binary frames when streaming (after wake word or mic button)
 *
 * Plays received TTS audio through Web Audio API.
 * Falls back to mic-button-only mode if Porcupine is unavailable.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import type { BridgeFrame } from "./use-bridge"
import type { Message } from "@/lib/types"
import { parseJarvisResponse } from "./parse-response"

// Binary frame header: [36-byte sessionId ASCII][1-byte direction][PCM audio]
const AUDIO_HEADER_LENGTH = 37
const SESSION_ID_LENGTH = 36
const MIC_SAMPLE_RATE = 16000
const MIC_FRAME_LENGTH = 512

export type VoiceStatus = "unavailable" | "initializing" | "ready" | "listening" | "streaming" | "playing"

interface UseVoiceOptions {
  accessKey: string
  enabled: boolean
  sendFrame: (frame: BridgeFrame) => void
  sendBinary: (data: ArrayBuffer) => void
  onAddMessage?: (msg: Message) => void
  onShowArtifact?: (artifact: { type: string; title: string; content: string; language?: string }) => void
}

export function useVoice({ accessKey, enabled, sendFrame, sendBinary, onAddMessage, onShowArtifact }: UseVoiceOptions) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("unavailable")
  const [transcript, setTranscript] = useState("")
  const [hasPorcupine, setHasPorcupine] = useState(false)

  const statusRef = useRef<VoiceStatus>("unavailable")
  const sessionIdRef = useRef<string | null>(null)
  const textOnlySessionRef = useRef(false)
  const porcupineRef = useRef<any>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playContextRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAudioTimeRef = useRef(0) // Date.now() of last binary audio chunk received
  const speechCompleteRef = useRef(false) // true once voice.speech_complete arrives
  const mountedRef = useRef(true)

  // Stable refs for callbacks used in audio processing
  const sendBinaryRef = useRef(sendBinary)
  sendBinaryRef.current = sendBinary
  const sendFrameRef = useRef(sendFrame)
  sendFrameRef.current = sendFrame
  const onAddMessageRef = useRef(onAddMessage)
  onAddMessageRef.current = onAddMessage
  const onShowArtifactRef = useRef(onShowArtifact)
  onShowArtifactRef.current = onShowArtifact

  const makeTimestamp = useCallback(() =>
    new Date().toLocaleTimeString("en-AU", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Australia/Adelaide",
    }), [])

  const setStatusSync = useCallback((s: VoiceStatus) => {
    statusRef.current = s
    setVoiceStatus(s)
  }, [])

  // --- Chime generation via Web Audio API ---
  const playChime = useCallback((type: "listening" | "sessionEnd" | "proactive") => {
    try {
      const ctx = new AudioContext()
      const freqs = type === "listening" ? [880, 1100] :
                    type === "proactive" ? [660, 880, 1100] :
                    [880, 660]
      const noteDur = type === "listening" ? 0.08 : 0.06
      let time = ctx.currentTime + 0.01

      for (const freq of freqs) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.15, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + noteDur)
        osc.start(time)
        osc.stop(time + noteDur)
        time += noteDur + 0.02
      }
      setTimeout(() => ctx.close(), (time - ctx.currentTime) * 1000 + 200)
    } catch { /* ignore audio errors */ }
  }, [])

  // --- TTS audio playback ---
  const playAudioChunk = useCallback((pcmData: ArrayBuffer) => {
    if (pcmData.byteLength === 0) return

    if (!playContextRef.current || playContextRef.current.state === "closed") {
      playContextRef.current = new AudioContext({ sampleRate: 24000 })
      nextPlayTimeRef.current = 0
      console.log("Created playback AudioContext")
    }
    const ctx = playContextRef.current

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
      console.log("Resuming suspended AudioContext")
    }

    // Convert Int16 PCM to Float32
    const int16 = new Int16Array(pcmData)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000)
    buffer.getChannelData(0).set(float32)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now + 0.02
    }
    source.start(nextPlayTimeRef.current)
    nextPlayTimeRef.current += float32.length / 24000
  }, [])

  const stopPlayback = useCallback(() => {
    if (playContextRef.current && playContextRef.current.state !== "closed") {
      playContextRef.current.close().catch(() => {})
      playContextRef.current = null
    }
    nextPlayTimeRef.current = 0
  }, [])

  // --- Follow-up window ---
  const clearFollowUp = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current)
      followUpTimerRef.current = null
    }
  }, [])

  // --- Session lifecycle ---
  const endSession = useCallback((reason = "ended") => {
    clearFollowUp()
    const sessionId = sessionIdRef.current
    if (sessionId) {
      sendFrameRef.current({
        type: "voice.session_end",
        id: crypto.randomUUID(),
        payload: { sessionId, reason },
      })
    }
    if (!textOnlySessionRef.current) {
      playChime("sessionEnd")
    }
    sessionIdRef.current = null
    textOnlySessionRef.current = false
    stopPlayback()
    setTranscript("")
    setStatusSync("ready")
  }, [clearFollowUp, playChime, stopPlayback, setStatusSync])

  const startFollowUp = useCallback(() => {
    clearFollowUp()
    followUpTimerRef.current = setTimeout(() => {
      if (sessionIdRef.current && mountedRef.current) {
        endSession("timeout")
      }
    }, 8000)
  }, [clearFollowUp, endSession])

  const startSession = useCallback(() => {
    clearFollowUp()
    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId
    textOnlySessionRef.current = false
    setStatusSync("streaming")
    playChime("listening")

    sendFrameRef.current({
      type: "voice.session_start",
      id: crypto.randomUUID(),
      payload: { sessionId },
    })
  }, [clearFollowUp, playChime, setStatusSync])

  const handleBargeIn = useCallback(() => {
    if (!sessionIdRef.current) return
    stopPlayback()
    textOnlySessionRef.current = false
    sendFrameRef.current({
      type: "voice.barge_in",
      id: crypto.randomUUID(),
      payload: { sessionId: sessionIdRef.current, keyword: "jarvis" },
    })
    setStatusSync("streaming")
  }, [stopPlayback, setStatusSync])

  // --- Manual session toggle (mic button) ---
  const toggleSession = useCallback(() => {
    const s = statusRef.current
    if (s === "ready") {
      startSession()
    } else if (s === "streaming") {
      // User done speaking — flush STT, keep session alive for LLM response
      if (sessionIdRef.current) {
        setStatusSync("playing") // Show we're waiting for response
        sendFrameRef.current({
          type: "voice.speech_end",
          id: crypto.randomUUID(),
          payload: { sessionId: sessionIdRef.current },
        })
      }
    } else if (s === "playing") {
      handleBargeIn()
    }
  }, [startSession, setStatusSync, handleBargeIn])

  // --- Speak response text (text chat → audio) ---
  const speakResponse = useCallback((text: string) => {
    if (!text) return
    if (statusRef.current === "unavailable" || statusRef.current === "initializing") return

    // If already in a text-only session, end it first
    if (sessionIdRef.current && textOnlySessionRef.current) {
      const oldSessionId = sessionIdRef.current
      sessionIdRef.current = null
      textOnlySessionRef.current = false
      stopPlayback()
      clearFollowUp()
      sendFrameRef.current({
        type: "voice.session_end",
        id: crypto.randomUUID(),
        payload: { sessionId: oldSessionId, reason: "new_input" },
      })
    }

    // Don't interrupt an active mic voice session
    if (sessionIdRef.current) return

    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId
    textOnlySessionRef.current = true
    setStatusSync("playing")

    sendFrameRef.current({
      type: "voice.session_start",
      id: crypto.randomUUID(),
      payload: { sessionId, text },
    })
  }, [setStatusSync, stopPlayback, clearFollowUp])

  // --- Poll until playback finishes, then clean up ---
  const waitForPlaybackEnd = useCallback((sessionId: string, onDone: () => void) => {
    speechCompleteRef.current = true
    const check = () => {
      if (!mountedRef.current || sessionIdRef.current !== sessionId) return
      const ctx = playContextRef.current
      const scheduled = nextPlayTimeRef.current
      // Audio is done when: no audio scheduled, or current time past all scheduled audio,
      // and no new chunks have arrived for at least 300ms
      const timeSinceLastChunk = Date.now() - lastAudioTimeRef.current
      const audioFinished = !ctx || ctx.state === "closed" || ctx.currentTime >= scheduled - 0.05
      if (audioFinished && timeSinceLastChunk > 300) {
        onDone()
      } else {
        setTimeout(check, 200)
      }
    }
    // Start polling after a brief delay (let final chunks arrive)
    setTimeout(check, 400)
  }, [])

  // --- Voice frame handler (called by bridge) ---
  const handleVoiceFrame = useCallback((frame: BridgeFrame) => {
    const sessionId = frame.payload?.sessionId as string

    switch (frame.type) {
      case "voice.session_start": {
        if (frame.payload?.success) {
          speechCompleteRef.current = false
          console.log("Voice session confirmed")
        }
        break
      }
      case "voice.speech_complete": {
        if (sessionId === sessionIdRef.current) {
          // Parse the full LLM response to extract voice/display/artifact sections
          const responseText = frame.payload?.responseText as string | undefined
          if (responseText && onAddMessageRef.current) {
            const parsed = parseJarvisResponse(responseText)
            const jarvisMsg: Message = {
              type: "jarvis",
              id: crypto.randomUUID(),
              timestamp: makeTimestamp(),
              voice: parsed.voice,
              displays: parsed.displays,
              artifacts: parsed.artifacts,
            }
            onAddMessageRef.current(jarvisMsg)

            // If artifacts were found, show the first one in the panel
            if (parsed.artifacts && parsed.artifacts.length > 0 && onShowArtifactRef.current) {
              const a = parsed.artifacts[0]
              onShowArtifactRef.current(a)
            }
          }

          if (textOnlySessionRef.current) {
            clearFollowUp()
            waitForPlaybackEnd(sessionId, () => {
              if (sessionIdRef.current === sessionId) {
                sessionIdRef.current = null
                textOnlySessionRef.current = false
                stopPlayback()
                setStatusSync("ready")
              }
            })
          } else {
            // Voice session — wait for audio, then open mic for follow-up
            waitForPlaybackEnd(sessionId, () => {
              if (sessionIdRef.current === sessionId) {
                stopPlayback()
                setStatusSync("streaming")
                startFollowUp()
              }
            })
          }
        }
        break
      }
      case "voice.playback_stop": {
        if (sessionId === sessionIdRef.current) {
          stopPlayback()
        }
        break
      }
      case "voice.session_end": {
        if (sessionId === sessionIdRef.current) {
          sessionIdRef.current = null
          textOnlySessionRef.current = false
          clearFollowUp()
          stopPlayback()
          setTranscript("")
          setStatusSync("ready")
        }
        break
      }
      case "voice.transcript": {
        if (sessionId === sessionIdRef.current) {
          const text = frame.payload?.text as string
          const isFinal = frame.payload?.isFinal as boolean
          if (text) {
            setTranscript(text)
            // Final transcript — add user's speech to chat
            if (isFinal && onAddMessageRef.current) {
              onAddMessageRef.current({
                type: "user",
                id: crypto.randomUUID(),
                timestamp: makeTimestamp(),
                text,
              })
            }
          }
        }
        break
      }
      case "voice.display": {
        // Display content from voice pipeline — show as display card in chat
        const displayContent = frame.payload?.content as string
        if (displayContent && onAddMessageRef.current) {
          onAddMessageRef.current({
            type: "jarvis",
            id: crypto.randomUUID(),
            timestamp: makeTimestamp(),
            displays: [{ title: "Details", content: displayContent }],
          })
        }
        break
      }
      case "voice.artifact": {
        const content = frame.payload?.content as string
        const type = frame.payload?.type as string
        const title = frame.payload?.title as string
        const language = frame.payload?.language as string | undefined
        if (content && onShowArtifactRef.current) {
          onShowArtifactRef.current({ type: type ?? "code", title: title ?? "Artifact", content, language })
        }
        break
      }
      case "voice.proactive": {
        const proactiveSessionId = frame.payload?.sessionId as string
        if (proactiveSessionId && statusRef.current === "ready") {
          playChime("proactive")
          sessionIdRef.current = proactiveSessionId
          textOnlySessionRef.current = true
          setStatusSync("playing")
        }
        break
      }
    }
  }, [stopPlayback, clearFollowUp, startFollowUp, waitForPlaybackEnd, playChime, setStatusSync, makeTimestamp])

  // --- Binary frame handler (TTS audio from voice service) ---
  const handleBinaryFrame = useCallback((data: ArrayBuffer) => {
    if (data.byteLength < AUDIO_HEADER_LENGTH) return

    const headerBytes = new Uint8Array(data, 0, SESSION_ID_LENGTH)
    const sessionId = new TextDecoder().decode(headerBytes)

    if (sessionId !== sessionIdRef.current) return

    const audio = data.slice(AUDIO_HEADER_LENGTH)
    if (audio.byteLength === 0) return

    lastAudioTimeRef.current = Date.now()

    if (statusRef.current !== "playing") {
      setStatusSync("playing")
    }

    playAudioChunk(audio)
  }, [playAudioChunk, setStatusSync])

  // Expose frame handler refs for use-bridge
  const voiceFrameRef = useRef<((frame: BridgeFrame) => void) | null>(null)
  const binaryFrameRef = useRef<((data: ArrayBuffer) => void) | null>(null)
  voiceFrameRef.current = handleVoiceFrame
  binaryFrameRef.current = handleBinaryFrame

  // --- Initialize mic capture + optional Porcupine ---
  useEffect(() => {
    if (!enabled) {
      setStatusSync("unavailable")
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let porcupine: any = null

    // Step 1: Set up mic capture (required for voice to work)
    async function initMic() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: MIC_SAMPLE_RATE },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      micStreamRef.current = stream

      audioCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE })
      micContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(MIC_FRAME_LENGTH, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!mountedRef.current) return

        const float32 = e.inputBuffer.getChannelData(0)

        // Convert Float32 to Int16
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Feed to Porcupine for wake word detection (if available)
        if (porcupineRef.current) {
          try { porcupineRef.current.process(int16) } catch { /* ignore */ }
        }

        // If streaming, send audio to bridge
        if (statusRef.current === "streaming" && sessionIdRef.current) {
          const sessionBytes = new TextEncoder().encode(sessionIdRef.current)
          const header = new Uint8Array(AUDIO_HEADER_LENGTH)
          header.set(sessionBytes.subarray(0, SESSION_ID_LENGTH))
          header[SESSION_ID_LENGTH] = 0x00 // upstream

          const frame = new Uint8Array(AUDIO_HEADER_LENGTH + int16.byteLength)
          frame.set(header)
          frame.set(new Uint8Array(int16.buffer), AUDIO_HEADER_LENGTH)

          sendBinaryRef.current(frame.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)
    }

    // Step 2: Try Porcupine wake word (optional — completely isolated)
    async function initPorcupine() {
      if (!accessKey || cancelled) return
      try {
        const { PorcupineWorker } = await import("@picovoice/porcupine-web")
        if (cancelled) return

        porcupine = await PorcupineWorker.create(
          accessKey,
          [{ builtin: "Jarvis" as any, sensitivity: 0.85 }],
          (detection: { index: number; label: string }) => {
            if (!mountedRef.current) return
            console.log("Wake word detected:", detection.label)

            if (statusRef.current === "ready") {
              startSession()
            } else if (statusRef.current === "playing") {
              handleBargeIn()
            }
          },
          { publicPath: "/porcupine_params.pv", forceWrite: true }
        )

        if (cancelled) { porcupine.release(); return }
        porcupineRef.current = porcupine
        setHasPorcupine(true)
        console.log("Wake word active — say 'JARVIS'")
      } catch (err) {
        console.warn("Porcupine unavailable (use mic button):", err)
        setHasPorcupine(false)
      }
    }

    // Boot: mic first → status "ready" → then try Porcupine (fire-and-forget)
    setStatusSync("initializing")
    initMic()
      .then(() => {
        if (cancelled) return
        // Voice is functional now — mic button + text-to-speech work
        setStatusSync("ready")
        console.log("Voice ready — mic active, click mic or type to talk")
        // Porcupine is a bonus — errors here can't affect voice status
        initPorcupine().catch(() => {})
      })
      .catch((err) => {
        // Only mic failure makes voice unavailable
        console.error("Mic init failed:", err)
        if (!cancelled) setStatusSync("unavailable")
      })

    return () => {
      cancelled = true
      mountedRef.current = false

      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {})
      }
      micContextRef.current = null
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
      micStreamRef.current = null
      if (porcupine) {
        try { porcupine.release() } catch { /* ignore */ }
      }
      porcupineRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accessKey])

  // Cleanup playback on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopPlayback()
      clearFollowUp()
    }
  }, [stopPlayback, clearFollowUp])

  return {
    voiceStatus,
    transcript,
    hasPorcupine,
    voiceFrameRef,
    binaryFrameRef,
    endSession,
    toggleSession,
    speakResponse,
  }
}
