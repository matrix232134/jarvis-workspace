"use client"

/**
 * Browser voice hook — mic capture + optional wake word + streaming voice pipeline.
 *
 * Captures mic audio via Web Audio API, feeds frames to:
 * 1. OpenWakeWord (ONNX-based) for local "hey jarvis" wake word detection
 * 2. Bridge binary frames when streaming (after wake word or mic button)
 *
 * Plays received TTS audio through Web Audio API.
 * Falls back to mic-button-only mode if wake word models fail to load.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import type { BridgeFrame } from "./use-bridge"
import type { Message } from "@/lib/types"
import { parseJarvisResponse } from "./parse-response"
import { OpenWakeWordDetector } from "./open-wake-word"

// Binary frame header: [36-byte sessionId ASCII][1-byte direction][PCM audio]
const AUDIO_HEADER_LENGTH = 37
const SESSION_ID_LENGTH = 36
const MIC_SAMPLE_RATE = 16000
const MIC_FRAME_LENGTH = 512

export type VoiceStatus = "unavailable" | "initializing" | "ready" | "listening" | "streaming" | "playing"

interface UseVoiceOptions {
  enabled: boolean
  sendFrame: (frame: BridgeFrame) => void
  sendBinary: (data: ArrayBuffer) => void
  onAddMessage?: (msg: Message) => void
  onShowArtifact?: (artifact: { type: string; title: string; content: string; language?: string }) => void
}

export function useVoice({ enabled, sendFrame, sendBinary, onAddMessage, onShowArtifact }: UseVoiceOptions) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("unavailable")
  const [transcript, setTranscript] = useState("")
  const [hasWakeWord, setHasWakeWord] = useState(false)

  const statusRef = useRef<VoiceStatus>("unavailable")
  const sessionIdRef = useRef<string | null>(null)
  const textOnlySessionRef = useRef(false)
  const wakeWordRef = useRef<OpenWakeWordDetector | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playContextRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAudioTimeRef = useRef(0) // Date.now() of last binary audio chunk received
  const speechCompleteRef = useRef(false) // true once voice.speech_complete arrives
  const isNewResponseRef = useRef(true) // true until first chunk of a response schedules
  const processingCueRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null)
  const processingCueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const loggedStreamingRef = useRef(false)

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

  // --- Chime generation via Web Audio API (layered synthesis) ---
  const playChime = useCallback((type: "listening" | "sessionEnd" | "proactive") => {
    try {
      const ctx = new AudioContext()
      const now = ctx.currentTime + 0.01

      // Layered synthesis: dual slightly-detuned sine waves + triangle undertone.
      // Frequencies in the vocal overtone range (392-523Hz), not UI ping range (880Hz+).
      const configs: Record<string, Array<{
        freq: number; detune: number; start: number; dur: number; gain: number;
        undertoneFreq?: number; undertoneGain?: number;
      }>> = {
        listening: [
          // Ascending minor third — "I'm here"
          { freq: 440, detune: 2, start: 0, dur: 0.06, gain: 0.10, undertoneFreq: 220, undertoneGain: 0.03 },
          { freq: 523, detune: 3, start: 0.07, dur: 0.07, gain: 0.08, undertoneFreq: 262, undertoneGain: 0.025 },
        ],
        proactive: [
          // Two-note ascending — gentle "ahem"
          { freq: 392, detune: 2, start: 0, dur: 0.06, gain: 0.12, undertoneFreq: 196, undertoneGain: 0.04 },
          { freq: 494, detune: 3, start: 0.09, dur: 0.08, gain: 0.10, undertoneFreq: 247, undertoneGain: 0.03 },
        ],
        sessionEnd: [
          // Single descending note — presence withdrawing, very quiet
          { freq: 494, detune: 1, start: 0, dur: 0.05, gain: 0.04 },
          { freq: 415, detune: 1, start: 0.04, dur: 0.04, gain: 0.025 },
        ],
      }

      const notes = configs[type]
      for (const note of notes) {
        // Primary oscillator (sine)
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = "sine"
        osc1.frequency.value = note.freq
        osc1.connect(gain1)
        gain1.connect(ctx.destination)

        const t = now + note.start
        gain1.gain.setValueAtTime(0, t)
        gain1.gain.linearRampToValueAtTime(note.gain, t + 0.005)
        gain1.gain.setValueAtTime(note.gain, t + note.dur - 0.015)
        gain1.gain.exponentialRampToValueAtTime(0.001, t + note.dur)
        osc1.start(t)
        osc1.stop(t + note.dur + 0.02)

        // Detuned second oscillator (sine, +N cents) — creates warmth
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = "sine"
        osc2.frequency.value = note.freq
        osc2.detune.value = note.detune
        osc2.connect(gain2)
        gain2.connect(ctx.destination)

        gain2.gain.setValueAtTime(0, t)
        gain2.gain.linearRampToValueAtTime(note.gain * 0.7, t + 0.005)
        gain2.gain.setValueAtTime(note.gain * 0.7, t + note.dur - 0.015)
        gain2.gain.exponentialRampToValueAtTime(0.001, t + note.dur)
        osc2.start(t)
        osc2.stop(t + note.dur + 0.02)

        // Triangle undertone (optional, one octave below) — adds body
        if (note.undertoneFreq && note.undertoneGain) {
          const osc3 = ctx.createOscillator()
          const gain3 = ctx.createGain()
          osc3.type = "triangle"
          osc3.frequency.value = note.undertoneFreq
          osc3.connect(gain3)
          gain3.connect(ctx.destination)

          gain3.gain.setValueAtTime(0, t)
          gain3.gain.linearRampToValueAtTime(note.undertoneGain, t + 0.008)
          gain3.gain.setValueAtTime(note.undertoneGain, t + note.dur - 0.02)
          gain3.gain.exponentialRampToValueAtTime(0.001, t + note.dur)
          osc3.start(t)
          osc3.stop(t + note.dur + 0.02)
        }
      }

      const totalDur = Math.max(...notes.map(n => n.start + n.dur))
      setTimeout(() => ctx.close(), (totalDur + 0.3) * 1000)
    } catch { /* ignore audio errors */ }
  }, [])

  // --- Processing audio cue: subtle tone during LLM latency ---
  const stopProcessingCue = useCallback(() => {
    if (processingCueTimerRef.current) {
      clearTimeout(processingCueTimerRef.current)
      processingCueTimerRef.current = null
    }
    if (processingCueRef.current) {
      processingCueRef.current.stop()
      processingCueRef.current = null
    }
  }, [])

  const startProcessingCue = useCallback(() => {
    if (processingCueRef.current) return

    // Wait 600ms before starting — short responses won't need it
    processingCueTimerRef.current = setTimeout(() => {
      try {
        const ctx = new AudioContext()
        const now = ctx.currentTime

        // Two sine waves slowly drifting in frequency — "systems working"
        // Very quiet: gain 0.015-0.02. Barely there. More felt than heard.
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        const gain2 = ctx.createGain()

        osc1.type = "sine"
        osc1.frequency.setValueAtTime(180, now)
        osc1.frequency.linearRampToValueAtTime(195, now + 4)  // slow drift up

        osc2.type = "sine"
        osc2.frequency.setValueAtTime(183, now)               // 3Hz beat frequency
        osc2.frequency.linearRampToValueAtTime(192, now + 4)   // converges then diverges

        osc1.connect(gain1)
        osc2.connect(gain2)
        gain1.connect(ctx.destination)
        gain2.connect(ctx.destination)

        // Fade in over 200ms
        gain1.gain.setValueAtTime(0, now)
        gain1.gain.linearRampToValueAtTime(0.018, now + 0.2)
        gain2.gain.setValueAtTime(0, now)
        gain2.gain.linearRampToValueAtTime(0.015, now + 0.2)

        osc1.start(now)
        osc2.start(now)

        const stop = () => {
          const t = ctx.currentTime
          // Fade out over 150ms
          gain1.gain.cancelScheduledValues(t)
          gain2.gain.cancelScheduledValues(t)
          gain1.gain.setValueAtTime(gain1.gain.value, t)
          gain2.gain.setValueAtTime(gain2.gain.value, t)
          gain1.gain.linearRampToValueAtTime(0, t + 0.15)
          gain2.gain.linearRampToValueAtTime(0, t + 0.15)
          setTimeout(() => {
            osc1.stop()
            osc2.stop()
            ctx.close().catch(() => {})
          }, 200)
        }

        processingCueRef.current = { ctx, stop }
      } catch { /* ignore */ }
    }, 600)
  }, [])

  // --- TTS audio playback ---
  const playAudioChunk = useCallback((pcmData: ArrayBuffer) => {
    if (pcmData.byteLength === 0) return

    if (!playContextRef.current || playContextRef.current.state === "closed") {
      playContextRef.current = new AudioContext({ sampleRate: 24000 })
      nextPlayTimeRef.current = 0
    }
    const ctx = playContextRef.current

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
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
    const timeSinceLastChunk = Date.now() - lastAudioTimeRef.current

    if (nextPlayTimeRef.current < now) {
      if (isNewResponseRef.current) {
        // First chunk of a new response — jitter buffer: schedule 100ms ahead.
        // Server-side sentence ordering guarantees chunk order; 100ms absorbs
        // network jitter while keeping time-to-first-audio minimal.
        nextPlayTimeRef.current = now + 0.1
        isNewResponseRef.current = false
      } else {
        nextPlayTimeRef.current = now + 0.02
      }
    }

    // Inter-sentence jitter: if gap between chunks suggests a sentence boundary,
    // add a tiny random pause (20-60ms). Creates natural speech rhythm.
    if (timeSinceLastChunk > 80 && lastAudioTimeRef.current > 0) {
      const jitterMs = 20 + Math.random() * 40  // 20-60ms
      nextPlayTimeRef.current += jitterMs / 1000
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

  /** Reset play position without destroying the AudioContext (used between exchanges) */
  const resetPlayPosition = useCallback(() => {
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
    stopProcessingCue()
    const sessionId = sessionIdRef.current
    console.log("Voice session ending, reason:", reason, "id:", sessionId?.slice(0, 8) || "none")
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
    loggedStreamingRef.current = false
    stopPlayback()
    setTranscript("")
    setStatusSync("ready")
  }, [clearFollowUp, playChime, stopPlayback, stopProcessingCue, setStatusSync])

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
    isNewResponseRef.current = true
    setStatusSync("streaming")
    playChime("listening")

    // Processing cue will start after 600ms if no audio arrives
    startProcessingCue()

    // Pre-create playback AudioContext so it's ready when TTS audio arrives
    if (!playContextRef.current || playContextRef.current.state === "closed") {
      playContextRef.current = new AudioContext({ sampleRate: 24000 })
      nextPlayTimeRef.current = 0
    }

    console.log("Voice session starting, id:", sessionId.slice(0, 8))
    sendFrameRef.current({
      type: "voice.session_start",
      id: crypto.randomUUID(),
      payload: { sessionId },
    })
  }, [clearFollowUp, playChime, startProcessingCue, setStatusSync])

  const handleBargeIn = useCallback(() => {
    if (!sessionIdRef.current) return
    stopPlayback()
    stopProcessingCue()
    textOnlySessionRef.current = false
    sendFrameRef.current({
      type: "voice.barge_in",
      id: crypto.randomUUID(),
      payload: { sessionId: sessionIdRef.current, keyword: "jarvis" },
    })
    setStatusSync("streaming")
  }, [stopPlayback, stopProcessingCue, setStatusSync])

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
    isNewResponseRef.current = true
    setStatusSync("playing")

    sendFrameRef.current({
      type: "voice.session_start",
      id: crypto.randomUUID(),
      payload: { sessionId, text },
    })
  }, [setStatusSync, stopPlayback, clearFollowUp])

  // --- Wait until scheduled playback finishes, then clean up ---
  const waitForPlaybackEnd = useCallback((sessionId: string, onDone: () => void) => {
    speechCompleteRef.current = true
    const check = () => {
      if (!mountedRef.current || sessionIdRef.current !== sessionId) return
      const ctx = playContextRef.current
      if (!ctx || ctx.state === "closed") { onDone(); return }

      const remaining = nextPlayTimeRef.current - ctx.currentTime
      if (remaining <= 0.05) {
        // All scheduled audio has played
        onDone()
      } else {
        // Schedule check right when audio should finish (+ 50ms margin, max 500ms)
        setTimeout(check, Math.min(remaining * 1000 + 50, 500))
      }
    }
    // Brief delay for final TTS chunks to arrive before first check
    setTimeout(check, 150)
  }, [])

  // --- Voice frame handler (called by bridge) ---
  const handleVoiceFrame = useCallback((frame: BridgeFrame) => {
    const sessionId = frame.payload?.sessionId as string
    console.log("Voice frame received:", frame.type, sessionId?.slice(0, 8) || "")

    switch (frame.type) {
      case "voice.session_start": {
        if (frame.payload?.success) {
          speechCompleteRef.current = false
          console.log("Voice session confirmed")
        } else {
          console.warn("Voice session start failed:", frame.payload)
        }
        break
      }
      case "voice.speech_complete": {
        if (sessionId === sessionIdRef.current) {
          // Cancel any stale follow-up timer from a previous exchange
          clearFollowUp()

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
            // Keep AudioContext alive (don't call stopPlayback) — destroying/recreating causes choppy audio
            waitForPlaybackEnd(sessionId, () => {
              if (sessionIdRef.current === sessionId) {
                nextPlayTimeRef.current = 0
                isNewResponseRef.current = true // next exchange gets fresh jitter buffer
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
          if (speechCompleteRef.current) {
            // Already waiting for scheduled audio to finish playing —
            // don't kill playback, let waitForPlaybackEnd handle cleanup.
            // Just clear the follow-up timer and transcript.
            clearFollowUp()
            setTranscript("")
          } else {
            // No speech was playing — clean up immediately
            sessionIdRef.current = null
            textOnlySessionRef.current = false
            clearFollowUp()
            stopPlayback()
            setTranscript("")
            setStatusSync("ready")
          }
        }
        break
      }
      case "voice.transcript": {
        if (sessionId === sessionIdRef.current) {
          // User is speaking or has spoken — cancel any follow-up timeout
          // (the response may take seconds to process through LLM + TTS)
          clearFollowUp()

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

    // New audio arriving means a response is active — cancel any follow-up timeout
    clearFollowUp()

    if (statusRef.current !== "playing") {
      // Transitioning from streaming/other → playing = new response starting
      isNewResponseRef.current = true
      setStatusSync("playing")
    }

    // First audio chunk arrived — kill the processing cue
    stopProcessingCue()

    playAudioChunk(audio)
    // Update AFTER playAudioChunk so waitForPlaybackEnd timing is correct
    lastAudioTimeRef.current = Date.now()
  }, [playAudioChunk, stopProcessingCue, setStatusSync, clearFollowUp])

  // Expose frame handler refs for use-bridge
  const voiceFrameRef = useRef<((frame: BridgeFrame) => void) | null>(null)
  const binaryFrameRef = useRef<((data: ArrayBuffer) => void) | null>(null)
  voiceFrameRef.current = handleVoiceFrame
  binaryFrameRef.current = handleBinaryFrame

  // --- Initialize mic capture + optional wake word ---
  useEffect(() => {
    if (!enabled) {
      setStatusSync("unavailable")
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null

    // Shared handler for mic audio frames (Int16Array, 512 samples)
    function handleMicFrame(int16: Int16Array) {
      if (!mountedRef.current) return

      // Feed to OpenWakeWord for wake word detection (if available)
      if (wakeWordRef.current?.initialized) {
        try { wakeWordRef.current.processFrame(int16) } catch { /* ignore */ }
      }

      // If streaming, send audio to bridge
      if (statusRef.current === "streaming" && sessionIdRef.current && !loggedStreamingRef.current) {
        console.log("Streaming mic audio to bridge...")
        loggedStreamingRef.current = true
      }
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

    // Step 1: Set up mic capture (required for voice to work)
    async function initMic() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: MIC_SAMPLE_RATE },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false, // off — browser NS kills quiet/distant speech
          autoGainControl: true,
        },
      })
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      micStreamRef.current = stream

      audioCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE })
      micContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)

      // Try AudioWorkletNode first, fall back to ScriptProcessorNode
      let usedWorklet = false
      try {
        await audioCtx.audioWorklet.addModule("/mic-processor.js")
        const workletNode = new AudioWorkletNode(audioCtx, "mic-processor")
        workletNodeRef.current = workletNode

        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          handleMicFrame(new Int16Array(e.data))
        }

        source.connect(workletNode)
        usedWorklet = true
      } catch {
        // AudioWorklet unavailable — fall back to ScriptProcessorNode
      }

      if (!usedWorklet) {
        const processor = audioCtx.createScriptProcessor(MIC_FRAME_LENGTH, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0)
          const int16 = new Int16Array(float32.length)
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]))
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          handleMicFrame(int16)
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
      }
    }

    // Step 2: Try OpenWakeWord (optional — completely isolated)
    async function initWakeWord() {
      if (cancelled) return
      try {
        const detector = new OpenWakeWordDetector()
        await detector.init("/openwakeword/models", 0.3, () => {
          if (!mountedRef.current) return
          const status = statusRef.current
          console.log(`Wake word detected: hey jarvis (status=${status})`)

          if (status === "ready") {
            startSession()
          } else if (status === "playing") {
            handleBargeIn()
          } else {
            console.log(`Wake word ignored — status is "${status}", need "ready" or "playing"`)
          }
        })

        if (cancelled) { detector.release(); return }

        if (!detector.initialized) {
          console.warn("Wake word unavailable: ONNX models failed to initialize")
          setHasWakeWord(false)
          return
        }

        wakeWordRef.current = detector
        setHasWakeWord(true)
        console.log("Wake word active — say 'Hey JARVIS'")
      } catch (err) {
        console.warn("Wake word unavailable (use mic button):", err)
        setHasWakeWord(false)
      }
    }

    // Boot: mic + wake word in parallel for fastest startup.
    // ONNX model loading starts immediately while browser shows mic permission prompt.
    // handleMicFrame already checks wakeWordRef.current?.initialized, so wake word
    // naturally activates as soon as models finish — no synchronization needed.
    setStatusSync("initializing")

    // Start ONNX model loading immediately (doesn't need mic permission)
    initWakeWord().catch(() => {})

    // Start mic capture in parallel
    initMic()
      .then(() => {
        if (cancelled) return
        setStatusSync("ready")
        console.log("Voice ready — mic active, click mic or type to talk")
      })
      .catch((err) => {
        console.error("Mic init failed:", err)
        if (!cancelled) setStatusSync("unavailable")
      })

    return () => {
      cancelled = true
      mountedRef.current = false

      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect()
        workletNodeRef.current = null
      }
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
      if (wakeWordRef.current) {
        try { wakeWordRef.current.release() } catch { /* ignore */ }
      }
      wakeWordRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Cleanup playback on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopPlayback()
      stopProcessingCue()
      clearFollowUp()
    }
  }, [stopPlayback, stopProcessingCue, clearFollowUp])

  return {
    voiceStatus,
    transcript,
    hasWakeWord,
    voiceFrameRef,
    binaryFrameRef,
    endSession,
    toggleSession,
    speakResponse,
  }
}
