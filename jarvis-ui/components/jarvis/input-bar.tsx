"use client"

import { useState, useRef } from "react"
import { Mic, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface InputBarProps {
  primaryDevice?: string
  voiceStatus?: "ready" | "listening" | "speaking" | "unavailable"
  trustLevel?: "autonomous" | "standard" | "restricted" | "observer"
  onSend?: (text: string) => void | Promise<void>
  onVoiceToggle?: () => void
  transcript?: string
  hasPorcupine?: boolean
}

export function InputBar({
  primaryDevice = "ThinkPad",
  voiceStatus = "ready",
  trustLevel = "autonomous",
  onSend,
  onVoiceToggle,
  transcript,
  hasPorcupine = false,
}: InputBarProps) {
  const [text, setText] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasText = text.trim().length > 0
  const isActive = focused || hasText

  const handleSend = () => {
    if (hasText && onSend) {
      onSend(text.trim())
      setText("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const voiceStatusDisplay = {
    ready: hasPorcupine ? "Say \"JARVIS\"" : "Voice Ready",
    listening: "Listening...",
    speaking: "Speaking",
    unavailable: "Voice Off",
  }

  const trustDisplay = {
    autonomous: { label: "Autonomous", color: "text-primary" },
    standard: { label: "Standard", color: "text-foreground/65" },
    restricted: { label: "Restricted", color: "text-amber-400" },
    observer: { label: "Observer", color: "text-muted-foreground/60" },
  }

  return (
    <div className="px-6 pb-5 pt-2">
      {/* Voice transcript overlay */}
      {transcript && (voiceStatus === "listening" || voiceStatus === "speaking") && (
        <div className="mx-auto max-w-4xl mb-2 px-4 py-2 rounded-xl bg-glass/40 backdrop-blur-xl border border-primary/20">
          <p className="text-sm text-foreground/70 italic">{transcript}</p>
        </div>
      )}

      {/* Input container */}
      <div
        className={cn(
          "mx-auto max-w-4xl rounded-2xl border transition-all duration-500",
          "bg-glass/60 backdrop-blur-2xl",
          voiceStatus === "listening"
            ? "border-primary/50 animate-glow-ring"
            : isActive
            ? "border-primary/30 animate-glow-ring"
            : "border-glass-border hover:border-glass-border-high"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Mic button */}
          <button
            onClick={onVoiceToggle}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300",
              voiceStatus === "listening"
                ? "text-primary bg-primary/15 scale-110 animate-pulse"
                : voiceStatus === "speaking"
                ? "text-emerald-400 bg-emerald-400/10 scale-105"
                : "text-muted-foreground/55 hover:text-primary/75 hover:bg-primary/[0.05] active:scale-95"
            )}
            aria-label="Voice input"
          >
            <Mic className="h-5 w-5" />
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to JARVIS..."
            className={cn(
              "flex-1 bg-transparent text-[15px] text-foreground/95 placeholder:text-muted-foreground/35",
              "outline-none py-2"
            )}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300",
              hasText
                ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-100 hover:scale-105 active:scale-95"
                : "text-muted-foreground/30 bg-glass-hover/35 scale-95 cursor-default"
            )}
            disabled={!hasText}
            aria-label="Send message"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div className="mx-auto max-w-4xl flex items-center justify-center gap-2 mt-3">
        {/* Primary device with status dot */}
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            primaryDevice === "Connected" ? "bg-emerald-400/70" :
            primaryDevice === "Disconnected" ? "bg-red-400/70" :
            "bg-amber-400/70 animate-pulse"
          )} />
          <span className="text-[10px] text-muted-foreground/50 tracking-wide font-medium">
            {primaryDevice}
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground/20">·</span>

        {/* Voice status */}
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            voiceStatus === "ready" ? "bg-emerald-400/70" :
            voiceStatus === "listening" ? "bg-primary animate-pulse" :
            voiceStatus === "speaking" ? "bg-emerald-400 animate-pulse" :
            "bg-muted-foreground/30"
          )} />
          <span className="text-[10px] text-muted-foreground/50 tracking-wide font-medium">
            {voiceStatusDisplay[voiceStatus]}
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground/20">·</span>

        <span className="text-[10px] text-muted-foreground/50 tracking-wide font-mono">
          Opus 4.6
        </span>

        <span className="text-[10px] text-muted-foreground/20">·</span>

        <span className={cn("text-[10px] tracking-wide font-semibold", trustDisplay[trustLevel].color)}>
          {trustDisplay[trustLevel].label}
        </span>
      </div>
    </div>
  )
}
