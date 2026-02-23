"use client"

import { cn } from "@/lib/utils"
import { JarvisOrb } from "./orb"
import { useEffect, useRef, useState } from "react"

// ============================================================
// TYPES — matches JARVIS three-pillar output architecture
// ============================================================

interface BaseMessage {
  id: string
  timestamp: string
}

export interface UserMessage extends BaseMessage {
  type: "user"
  text: string
}

export interface JarvisVoice {
  text: string
}

export interface DisplayCard {
  title: string
  content: React.ReactNode | string
}

export interface ActionIndicator {
  text: string
}

export interface ArtifactRef {
  type: string
  title: string
  content: string
  language?: string
}

export interface JarvisMessage extends BaseMessage {
  type: "jarvis"
  voice?: JarvisVoice          // [VOICE] pillar
  displays?: DisplayCard[]     // [DISPLAY] pillar
  actions?: ActionIndicator[]  // [ACTION] pillar
  artifacts?: ArtifactRef[]    // [ARTIFACT] pillar
}

export interface ProactiveAlert extends BaseMessage {
  type: "proactive"
  voice: JarvisVoice
  severity: "info" | "warning" | "critical"
}

export interface MorningBriefing extends BaseMessage {
  type: "briefing"
  text: string
  date: string
}

export interface DateSeparator {
  type: "separator"
  label: string
  id: string
}

export type Message = UserMessage | JarvisMessage | ProactiveAlert | MorningBriefing | DateSeparator

// ============================================================
// INTERSECTION OBSERVER — triggers entrance animations on scroll
// ============================================================

function useAnimateOnView() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// ============================================================
// MESSAGE STREAM — main scrollable area
// ============================================================

interface MessageStreamProps {
  messages: Message[]
  isThinking?: boolean
  onArtifactClick?: (artifact: ArtifactRef) => void
}

export function MessageStream({ messages, isThinking = true, onArtifactClick }: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-4xl flex flex-col gap-7 animate-stagger-in">
        {messages.map((msg) => {
          switch (msg.type) {
            case "separator":
              return <DateSep key={msg.id} label={msg.label} />
            case "briefing":
              return <BriefingCard key={msg.id} msg={msg} />
            case "user":
              return <UserBubble key={msg.id} msg={msg} />
            case "jarvis":
              return <JarvisResponse key={msg.id} msg={msg} onArtifactClick={onArtifactClick} />
            case "proactive":
              return <ProactiveCard key={msg.id} msg={msg} />
          }
        })}

        {isThinking && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ============================================================
// MESSAGE COMPONENTS
// ============================================================

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 animate-slide-in-left">
      <JarvisOrb size="sm" />
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-glass-border bg-glass/60 backdrop-blur-xl">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60"
            style={{
              animation: `typing-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function DateSep({ label }: { label: string }) {
  const { ref, isVisible } = useAnimateOnView()
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-4 py-3 transition-all duration-700",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className="flex-1 h-px bg-gradient-to-r from-transparent via-glass-border/60 to-transparent transition-all duration-1000"
        style={{ transform: isVisible ? "scaleX(1)" : "scaleX(0)" }}
      />
      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/55 font-semibold">
        {label}
      </span>
      <div
        className="flex-1 h-px bg-gradient-to-r from-transparent via-glass-border/60 to-transparent transition-all duration-1000"
        style={{ transform: isVisible ? "scaleX(1)" : "scaleX(0)" }}
      />
    </div>
  )
}

function BriefingCard({ msg }: { msg: MorningBriefing }) {
  const { ref, isVisible } = useAnimateOnView()
  return (
    <div ref={ref} className={cn("transition-all duration-700", isVisible ? "animate-card-reveal" : "opacity-0")}>
      <div
        className={cn(
          "rounded-2xl p-7 border animate-border-glow animate-shimmer",
          "bg-gradient-to-br from-primary/[0.08] via-glass to-glass",
          "backdrop-blur-2xl"
        )}
      >
        <div className="flex items-center gap-4 mb-5">
          <JarvisOrb size="md" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              Morning Briefing
            </span>
            <span className="text-[10px] text-muted-foreground/55 font-medium">{msg.date}</span>
          </div>
        </div>
        <p className="text-[15px] leading-7 text-foreground/90">{msg.text}</p>
        <div className="mt-4">
          <span className="text-[10px] text-muted-foreground/35">{msg.timestamp}</span>
        </div>
      </div>
    </div>
  )
}

function UserBubble({ msg }: { msg: UserMessage }) {
  return (
    <div className="flex justify-end animate-bubble-pop-right">
      <div className="max-w-[70%]">
        <div
          className={cn(
            "rounded-2xl rounded-br-md px-5 py-4",
            "bg-gradient-to-br from-primary via-primary/90 to-primary/75",
            "shadow-xl shadow-primary/15",
            "transition-shadow duration-300 hover:shadow-primary/25"
          )}
        >
          <p className="text-[15px] text-primary-foreground leading-relaxed font-[450]">{msg.text}</p>
        </div>
        <div className="flex justify-end mt-1.5 pr-2">
          <span className="text-[10px] text-muted-foreground/40">{msg.timestamp}</span>
        </div>
      </div>
    </div>
  )
}

function JarvisResponse({ msg, onArtifactClick }: { msg: JarvisMessage; onArtifactClick?: (artifact: ArtifactRef) => void }) {
  return (
    <div className="flex flex-col gap-4 animate-slide-in-left max-w-[92%]">
      {/* [VOICE] pillar */}
      {msg.voice && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <JarvisOrb size="sm" />
          </div>
          <div
            className={cn(
              "rounded-2xl rounded-bl-md px-5 py-4",
              "border border-glass-border bg-glass/80 backdrop-blur-2xl",
              "animate-shimmer",
              "transition-all duration-300 hover:border-glass-border-high hover:bg-glass"
            )}
          >
            <p className="text-[15px] leading-7 text-foreground/95">{msg.voice.text}</p>
            <div className="mt-2">
              <span className="text-[10px] text-muted-foreground/40">{msg.timestamp}</span>
            </div>
          </div>
        </div>
      )}

      {/* [DISPLAY] pillar */}
      {msg.displays?.map((display, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border border-glass-border-high bg-glass/70 backdrop-blur-2xl p-5",
            "ml-8 animate-scan-line animate-shimmer",
            "transition-all duration-300 hover:border-primary/20 hover:bg-glass/90"
          )}
          style={{ animationDelay: `${(i + 1) * 150}ms` }}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
            {display.title}
          </h3>
          {typeof display.content === "string" ? (
            <pre className="text-[13px] leading-6 text-foreground/90 whitespace-pre-wrap font-sans">{display.content}</pre>
          ) : (
            display.content
          )}
        </div>
      ))}

      {/* [ARTIFACT] pillar — clickable reference cards */}
      {msg.artifacts?.map((artifact, i) => (
        <button
          key={i}
          onClick={() => onArtifactClick?.(artifact)}
          className={cn(
            "ml-8 rounded-2xl border border-primary/20 bg-primary/[0.06]",
            "px-5 py-4 text-left",
            "transition-all duration-300 hover:border-primary/35 hover:bg-primary/[0.1] hover:shadow-lg hover:shadow-primary/5",
            "group cursor-pointer"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {artifact.type}
            </span>
            {artifact.language && (
              <span className="text-[10px] text-muted-foreground/40 font-mono">{artifact.language}</span>
            )}
          </div>
          <span className="text-sm text-foreground/80">{artifact.title}</span>
          <span className="text-[10px] text-muted-foreground/40 ml-2 group-hover:text-primary/60 transition-colors">
            Click to view
          </span>
        </button>
      ))}

      {/* [ACTION] pillar */}
      {msg.actions && msg.actions.length > 0 && (
        <div className="flex flex-col gap-2 ml-8">
          {msg.actions.map((action, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5"
              style={{
                opacity: 0,
                animation: `action-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${600 + i * 120}ms forwards`,
              }}
            >
              <div className="h-1 w-1 rounded-full bg-primary/50" />
              <div className="h-px w-4 bg-gradient-to-r from-primary/40 to-transparent" />
              <span className="text-[11px] text-muted-foreground/60 italic font-light">
                {action.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProactiveCard({ msg }: { msg: ProactiveAlert }) {
  const colorMap = {
    info: { border: "border-primary/25", bg: "bg-primary/[0.05]", dot: "bg-primary", label: "text-primary", hover: "hover:border-primary/35" },
    warning: { border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", dot: "bg-amber-400", label: "text-amber-400", hover: "hover:border-amber-500/30" },
    critical: { border: "border-red-500/25", bg: "bg-red-500/[0.06]", dot: "bg-red-400", label: "text-red-400", hover: "hover:border-red-500/35" },
  }
  const colors = colorMap[msg.severity]

  return (
    <div className="animate-card-reveal">
      <div
        className={cn(
          "rounded-2xl px-5 py-5 border backdrop-blur-2xl",
          "transition-all duration-300",
          colors.border, colors.bg, colors.hover,
          msg.severity === "warning" && "animate-alert-pulse"
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse-dot", colors.dot)} />
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", colors.label)}>
            Proactive Alert
          </span>
        </div>
        <p className="text-[15px] leading-7 text-foreground/92">{msg.voice.text}</p>
        <div className="mt-3">
          <span className="text-[10px] text-muted-foreground/40">{msg.timestamp}</span>
        </div>
      </div>
    </div>
  )
}
