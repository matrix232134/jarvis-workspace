"use client"

import { useState, useRef, useEffect } from "react"
import type { JarvisState } from "@/lib/types"
import type { ConnectionStatus } from "@/lib/use-bridge"

export default function InputBar({
  state,
  onSend,
  panelOffset,
  onVoiceToggle,
  voiceReady,
  transcript,
  hasPorcupine,
  connectionStatus,
}: {
  state: JarvisState
  onSend: (text: string) => void
  panelOffset: number
  onVoiceToggle?: () => void
  voiceReady?: boolean
  transcript?: string
  hasPorcupine?: boolean
  connectionStatus?: ConnectionStatus
}) {
  const [text, setText] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hasText = text.trim().length > 0
  const isListening = state === "listening"
  const isSpeaking = state === "speaking"

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [text])

  const handleSend = () => {
    if (!hasText) return
    onSend(text.trim())
    setText("")
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMicClick = () => {
    if (onVoiceToggle) {
      onVoiceToggle()
    }
  }

  // Determine voice status label
  const voiceLabel = (() => {
    if (!voiceReady) return "Voice unavailable"
    if (isListening) return "Listening"
    if (isSpeaking) return "Speaking"
    if (hasPorcupine) return 'Say "JARVIS"'
    return "Voice ready"
  })()

  // Connection label
  const connectionLabel = (() => {
    switch (connectionStatus) {
      case "connected": return "Connected"
      case "connecting": return "Connecting..."
      case "authenticating": return "Authenticating..."
      case "disconnected": return "Disconnected"
      default: return "Connected"
    }
  })()

  return (
    <div
      className="fixed bottom-0 left-0 flex flex-col items-center pb-4"
      style={{
        right: panelOffset,
        zIndex: 40,
        background: "linear-gradient(to top, var(--bg) 65%, rgba(250,250,249,0.6) 85%, transparent)",
        paddingTop: 32,
        transition: "right 0.4s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* Transcript overlay */}
      {transcript && (isListening || isSpeaking) && (
        <div
          className="font-sans"
          style={{
            maxWidth: 620,
            width: "100%",
            padding: "0 20px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-secondary)",
              fontStyle: "italic",
              backgroundColor: "var(--surface)",
              border: "0.5px solid var(--border-light)",
              borderRadius: 12,
              padding: "8px 14px",
              animation: "j-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {transcript}
          </div>
        </div>
      )}

      <div
        className="w-full flex items-end gap-1"
        style={{
          maxWidth: 620,
          padding: "0 20px",
        }}
      >
        <div
          className="flex-1 flex items-end gap-1"
          style={{
            backgroundColor: "var(--surface)",
            border: focused ? "0.5px solid var(--border-focus)" : "0.5px solid var(--border)",
            borderRadius: 16,
            padding: "8px 12px",
            boxShadow: focused
              ? "0 0 0 3px var(--accent-ring), 0 0 20px rgba(29,78,216,0.04), 0 2px 8px rgba(0,0,0,0.02)"
              : "0 1px 4px rgba(0,0,0,0.02)",
            transition: "border-color 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Mic button */}
          <button
            onClick={handleMicClick}
            disabled={!voiceReady}
            className="shrink-0 flex items-center justify-center cursor-pointer"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: isListening ? "var(--green-faint)" : isSpeaking ? "var(--accent-faint)" : "transparent",
              color: isListening ? "var(--j-green)" : isSpeaking ? "var(--accent)" : voiceReady ? "var(--ink-ghost)" : "var(--border-light)",
              border: "none",
              transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
              opacity: voiceReady ? 1 : 0.4,
              animation: isListening ? "j-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
            aria-label={isListening ? "Stop listening" : isSpeaking ? "Interrupt" : "Start listening"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to JARVIS..."
            rows={1}
            className="flex-1 resize-none font-sans bg-transparent outline-none"
            style={{
              fontSize: 15,
              color: "var(--ink)",
              lineHeight: "24px",
              letterSpacing: "-0.006em",
              maxHeight: 120,
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!hasText}
            className="shrink-0 flex items-center justify-center cursor-pointer"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: hasText ? "var(--accent)" : "var(--surface-active)",
              color: hasText ? "#FFFFFF" : "var(--ink-ghost)",
              border: "none",
              transform: hasText ? "scale(1)" : "scale(0.92)",
              boxShadow: hasText ? "0 2px 8px rgba(29,78,216,0.2)" : "none",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
            }}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: "var(--ink-ghost)",
          marginTop: 9,
          letterSpacing: 0,
        }}
      >
        <span style={{ color: connectionStatus === "connected" ? "var(--ink-ghost)" : "var(--j-amber)" }}>
          {connectionLabel}
        </span>
        <span style={{ color: "var(--border-light)", margin: "0 6px" }}>{"·"}</span>
        {"Opus 4.6"}
        <span style={{ color: "var(--border-light)", margin: "0 6px" }}>{"·"}</span>
        <span style={{ color: isListening ? "var(--j-green)" : isSpeaking ? "var(--accent)" : "var(--ink-ghost)", transition: "color 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
          {voiceLabel}
        </span>
      </div>
    </div>
  )
}
