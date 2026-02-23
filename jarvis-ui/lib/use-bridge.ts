"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Message, ArtifactRef } from "@/lib/types"
import { parseJarvisResponse } from "./parse-response"

interface UseBridgeOptions {
  url: string
  pairingToken: string
  deviceName: string
  /** Ref-based callback for voice control frames (voice.*) */
  onVoiceFrame?: React.MutableRefObject<((frame: BridgeFrame) => void) | null>
  /** Ref-based callback for binary frames (audio) */
  onBinaryFrame?: React.MutableRefObject<((data: ArrayBuffer) => void) | null>
}

export type ConnectionStatus = "connecting" | "authenticating" | "connected" | "disconnected"

type PendingResolver = {
  resolve: (content: string) => void
  reject: (err: Error) => void
}

export interface BridgeFrame {
  type: string
  id: string
  payload: Record<string, unknown>
}

const STORAGE_KEY = "jarvis-bridge-credentials"
const INITIAL_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 10_000
const KEEPALIVE_INTERVAL_MS = 20_000
const CHAT_TIMEOUT_MS = 60_000 // Time to first token — streaming keeps it alive after that

function loadCredentials(): { deviceId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveCredentials(deviceId: string, token: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId, token }))
}

function makeTimestamp(): string {
  return new Date().toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Australia/Adelaide",
  })
}

/** Extract readable voice text from streaming content, stripping pillar tags and artifact blocks. */
function extractVoicePreview(text: string): string {
  // Strip complete artifact blocks
  let cleaned = text.replace(/\[ARTIFACT\s*[^\]]*\][\s\S]*?\[\/ARTIFACT\]/gi, "")
  // Strip partial (still streaming) artifact block
  const partialArtifactIdx = cleaned.search(/\[ARTIFACT[\s\S]*$/i)
  if (partialArtifactIdx >= 0) {
    cleaned = cleaned.slice(0, partialArtifactIdx)
  }
  // Strip leading [VOICE] tag
  cleaned = cleaned.replace(/^\[VOICE\]\s*/i, "")
  // Truncate at [DISPLAY] or [ACTION] tags
  const tagIdx = cleaned.search(/\[(DISPLAY|ACTION)/i)
  if (tagIdx > 0) cleaned = cleaned.slice(0, tagIdx)
  return cleaned.trim() || "..."
}

export function useBridge({ url, pairingToken, deviceName, onVoiceFrame, onBinaryFrame }: UseBridgeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [messages, setMessages] = useState<Message[]>([
    { type: "separator", label: "Today", id: "sep-today" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingResolver>>(new Map())
  const streamingRef = useRef<Map<string, { text: string; msgId: string }>>(new Map())
  const rafRef = useRef<number | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepaliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const statusRef = useRef<ConnectionStatus>("disconnected")

  // Keep a ref in sync so callbacks always see latest status
  const setStatusSync = useCallback((s: ConnectionStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const stopKeepalive = useCallback(() => {
    if (keepaliveTimerRef.current) {
      clearInterval(keepaliveTimerRef.current)
      keepaliveTimerRef.current = null
    }
  }, [])

  const startKeepalive = useCallback(() => {
    stopKeepalive()
    keepaliveTimerRef.current = setInterval(() => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", id: "", payload: {} }))
      }
    }, KEEPALIVE_INTERVAL_MS)
  }, [stopKeepalive])

  // Reject all pending requests (called on disconnect)
  const rejectAllPending = useCallback((reason: string) => {
    const pending = pendingRef.current
    if (pending.size === 0) return
    const err = new Error(reason)
    for (const [id, resolver] of pending) {
      resolver.reject(err)
      pending.delete(id)
    }
  }, [])

  /** Send a JSON frame through the bridge */
  const sendFrame = useCallback((frame: BridgeFrame) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame))
    }
  }, [])

  /** Send a binary frame through the bridge */
  const sendBinary = useCallback((data: ArrayBuffer) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    // Close any existing connection cleanly
    if (wsRef.current) {
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
    }

    setStatusSync("connecting")

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
      ws.binaryType = "arraybuffer" // Enable binary frame support
    } catch {
      // URL parse error etc — schedule retry
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      backoffRef.current = INITIAL_BACKOFF_MS
      setStatusSync("authenticating")

      // Send auth with voice + screen capabilities
      const creds = loadCredentials()
      let payload: Record<string, unknown>
      if (creds) {
        payload = { deviceId: creds.deviceId, token: creds.token, capabilities: ["voice", "screen"] }
      } else {
        payload = { pairingToken, deviceName, capabilities: ["voice", "screen"] }
      }

      ws.send(JSON.stringify({
        type: "auth",
        id: crypto.randomUUID(),
        payload,
      }))
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return

      // Binary frame — route to voice handler
      if (event.data instanceof ArrayBuffer) {
        console.log("Bridge: binary frame received,", event.data.byteLength, "bytes")
        onBinaryFrame?.current?.(event.data)
        return
      }

      let frame: BridgeFrame
      try {
        frame = JSON.parse(event.data)
      } catch {
        return
      }

      // Route voice control frames
      if (frame.type.startsWith("voice.")) {
        onVoiceFrame?.current?.(frame)
        return
      }

      switch (frame.type) {
        case "auth":
          handleAuth(frame)
          break
        case "chat.response":
          handleChatResponse(frame)
          break
        case "chat.token":
          handleChatToken(frame)
          break
        case "chat.done":
          handleChatDone(frame)
          break
        case "error":
          handleError(frame)
          break
        case "pong":
          // Keepalive acknowledged
          break
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      stopKeepalive()
      setStatusSync("disconnected")
      rejectAllPending("Connection lost")
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pairingToken, deviceName])

  function handleAuth(frame: BridgeFrame) {
    if (frame.payload.success) {
      // Save credentials if new pairing
      if (frame.payload.paired) {
        saveCredentials(
          frame.payload.deviceId as string,
          frame.payload.token as string
        )
      }
      setStatusSync("connected")
      startKeepalive()
    } else {
      // Auth failed — clear stored creds and retry with pairing
      localStorage.removeItem(STORAGE_KEY)
      wsRef.current?.close()
    }
  }

  function handleChatResponse(frame: BridgeFrame) {
    const resolver = pendingRef.current.get(frame.id)
    if (resolver) {
      pendingRef.current.delete(frame.id)
      resolver.resolve(frame.payload.content as string)
    }
  }

  function handleChatToken(frame: BridgeFrame) {
    const token = frame.payload.token as string
    const stream = streamingRef.current.get(frame.id)

    if (stream) {
      // Accumulate token into ref (no re-render)
      stream.text += token

      // Schedule a batched UI update via requestAnimationFrame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          // Single state update for all tokens received since last frame
          const updates = new Map<string, string>()
          for (const [, s] of streamingRef.current) {
            updates.set(s.msgId, extractVoicePreview(s.text))
          }
          if (updates.size > 0) {
            setMessages((prev) =>
              prev.map((m) => {
                const preview = updates.get(m.id)
                return preview && m.type === "jarvis"
                  ? { ...m, voice: { text: preview } }
                  : m
              })
            )
          }
        })
      }
    } else {
      // First token — create a streaming JARVIS message immediately
      const msgId = crypto.randomUUID()
      streamingRef.current.set(frame.id, { text: token, msgId })
      const preview = extractVoicePreview(token)
      const msg: Message = {
        type: "jarvis",
        id: msgId,
        timestamp: makeTimestamp(),
        voice: { text: preview },
      }
      setMessages((prev) => [...prev, msg])
      setIsProcessing(false)
    }
  }

  function handleChatDone(frame: BridgeFrame) {
    const content = frame.payload.content as string
    const stream = streamingRef.current.get(frame.id)
    const parsed = parseJarvisResponse(content)

    if (stream) {
      // Replace streaming message with final parsed version
      setMessages((prev) =>
        prev.map((m) =>
          m.id === stream.msgId && m.type === "jarvis"
            ? {
                ...m,
                voice: parsed.voice,
                displays: parsed.displays,
                artifacts: parsed.artifacts,
              }
            : m
        )
      )
      streamingRef.current.delete(frame.id)
    } else {
      // Fallback: no streaming was active, add as new message
      const jarvisMsg: Message = {
        type: "jarvis",
        id: crypto.randomUUID(),
        timestamp: makeTimestamp(),
        voice: parsed.voice,
        displays: parsed.displays,
        artifacts: parsed.artifacts,
      }
      setMessages((prev) => [...prev, jarvisMsg])
    }

    // Resolve the pending promise so sendChat can return
    const resolver = pendingRef.current.get(frame.id)
    if (resolver) {
      pendingRef.current.delete(frame.id)
      resolver.resolve(content)
    }
    setIsProcessing(false)
  }

  function handleError(frame: BridgeFrame) {
    const resolver = pendingRef.current.get(frame.id)
    if (resolver) {
      pendingRef.current.delete(frame.id)
      resolver.reject(new Error(frame.payload.message as string))
    }
    // Clean up any streaming state
    streamingRef.current.delete(frame.id)
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return
    const delay = backoffRef.current
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      connect()
    }, delay)
    backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
  }

  const sendChat = useCallback(async (text: string): Promise<{ voiceText: string | null; artifacts?: ArtifactRef[] }> => {
    // Add user message immediately
    const userMsg: Message = {
      type: "user",
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Australia/Adelaide",
      }),
      text,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsProcessing(true)

    try {
      // Wait for connection if we're reconnecting (up to 5s)
      if (statusRef.current !== "connected") {
        await waitForConnection(5000)
      }

      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to bridge")
      }

      const id = crypto.randomUUID()
      const content = await new Promise<string>((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject })

        ws.send(JSON.stringify({
          type: "chat",
          id,
          payload: {
            messages: [{ role: "user", content: text }],
          },
        }))

        // Timeout — only for time-to-first-token; streaming keeps alive after that
        const timeoutId = setTimeout(() => {
          if (pendingRef.current.has(id) && !streamingRef.current.has(id)) {
            pendingRef.current.delete(id)
            reject(new Error("No response from JARVIS"))
          }
        }, CHAT_TIMEOUT_MS)

        // Clear timeout once streaming starts or completes
        const checkStreaming = setInterval(() => {
          if (!pendingRef.current.has(id)) {
            clearTimeout(timeoutId)
            clearInterval(checkStreaming)
          }
        }, 1000)
      })

      // Message already displayed by handleChatDone — just extract results
      const parsed = parseJarvisResponse(content)
      return { voiceText: parsed.voice?.text ?? null, artifacts: parsed.artifacts }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      const errorMsg: Message = {
        type: "jarvis",
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Australia/Adelaide",
        }),
        voice: { text: `Request failed: ${detail}` },
      }
      setMessages((prev) => [...prev, errorMsg])
      return { voiceText: null }
    } finally {
      setIsProcessing(false)
    }
  }, [])

  // Helper: wait for status === "connected" with timeout
  function waitForConnection(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (statusRef.current === "connected") {
        resolve()
        return
      }
      const interval = setInterval(() => {
        if (statusRef.current === "connected") {
          clearInterval(interval)
          clearTimeout(timeout)
          resolve()
        }
      }, 200)
      const timeout = setTimeout(() => {
        clearInterval(interval)
        reject(new Error("Connection timeout — bridge unreachable"))
      }, timeoutMs)
    })
  }

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      stopKeepalive()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect, stopKeepalive])

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  return { status, messages, isProcessing, sendChat, sendFrame, sendBinary, addMessage, wsRef, statusRef }
}
