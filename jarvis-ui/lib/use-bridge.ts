"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Message } from "@/components/jarvis/message-stream"
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
const CHAT_TIMEOUT_MS = 120_000

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

export function useBridge({ url, pairingToken, deviceName, onVoiceFrame, onBinaryFrame }: UseBridgeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [messages, setMessages] = useState<Message[]>([
    { type: "separator", label: "Today", id: "sep-today" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingResolver>>(new Map())
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

  function handleError(frame: BridgeFrame) {
    const resolver = pendingRef.current.get(frame.id)
    if (resolver) {
      pendingRef.current.delete(frame.id)
      resolver.reject(new Error(frame.payload.message as string))
    }
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

  const sendChat = useCallback(async (text: string): Promise<string | null> => {
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

        // Timeout
        setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id)
            reject(new Error("Response timed out (2m)"))
          }
        }, CHAT_TIMEOUT_MS)
      })

      // Parse and add JARVIS response
      const parsed = parseJarvisResponse(content)
      const jarvisMsg: Message = {
        type: "jarvis",
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Australia/Adelaide",
        }),
        voice: parsed.voice,
        displays: parsed.displays,
      }
      setMessages((prev) => [...prev, jarvisMsg])
      return parsed.voice?.text ?? null
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
      return null
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
