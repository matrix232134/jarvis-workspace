"use client"

import Presence from "./presence"
import type { JarvisState } from "@/lib/types"

export default function ContextBar({
  state,
  agentCount,
  onToggleAgents,
  onOpenLibrary,
  onOpenSystem,
  isDark,
  onToggleTheme,
  audioReactive,
  onToggleAudio,
}: {
  state: JarvisState
  agentCount: number
  onToggleAgents: () => void
  onOpenLibrary: () => void
  onOpenSystem: () => void
  isDark: boolean
  onToggleTheme: () => void
  audioReactive?: boolean
  onToggleAudio?: () => void
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-5"
      style={{
        height: 48,
        zIndex: 50,
        background: "linear-gradient(to bottom, var(--bg) 55%, var(--fade-bg) 80%, transparent)",
      }}
    >
      {/* Left: Presence + JARVIS label */}
      <div className="flex items-center gap-2.5">
        <Presence state={state} size={6} />
        <span
          className="font-sans"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-faint)",
            letterSpacing: "0.04em",
          }}
        >
          JARVIS
        </span>
      </div>

      {/* Right: State indicators + System */}
      <div className="flex items-center gap-3">
        {state === "processing" && (
          <span
            className="uppercase"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--accent)",
              letterSpacing: "0.1em",
              animation: "j-fade-slide 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            Thinking
          </span>
        )}

        {state === "listening" && (
          <span
            className="uppercase"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--j-green)",
              letterSpacing: "0.1em",
              animation: "j-fade-slide 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            Listening
          </span>
        )}

        {state === "speaking" && (
          <span
            className="uppercase"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--j-purple)",
              letterSpacing: "0.1em",
              animation: "j-fade-slide 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            Speaking
          </span>
        )}

        {agentCount > 0 && (
          <button
            onClick={onToggleAgents}
            className="font-sans cursor-pointer"
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--accent)",
              backgroundColor: "var(--accent-faint)",
              border: "0.5px solid var(--accent-ring)",
              borderRadius: 6,
              padding: "3px 8px",
              letterSpacing: "0.02em",
            }}
          >
            {agentCount} agent{agentCount !== 1 ? "s" : ""}
          </button>
        )}

        <button
          onClick={onOpenLibrary}
          className="font-sans cursor-pointer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--ink-faint)",
            background: "none",
            border: "none",
            padding: "4px 0",
            transition: "color 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-tertiary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-faint)")}
        >
          Library
        </button>

        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: audioReactive ? "var(--accent-faint)" : "transparent",
              border: audioReactive ? "0.5px solid var(--accent-ring)" : "none",
              color: audioReactive ? "var(--accent)" : "var(--ink-faint)",
              transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
            onMouseEnter={(e) => { if (!audioReactive) e.currentTarget.style.color = "var(--ink-tertiary)" }}
            onMouseLeave={(e) => { if (!audioReactive) e.currentTarget.style.color = "var(--ink-faint)" }}
            aria-label={audioReactive ? "Stop audio reactive" : "Start audio reactive waveform"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "none",
            color: "var(--ink-faint)",
            transition: "color 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-tertiary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-faint)")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          onClick={onOpenSystem}
          className="font-sans cursor-pointer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--ink-faint)",
            background: "none",
            border: "none",
            padding: "4px 0",
            transition: "color 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-tertiary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-faint)")}
        >
          System
        </button>
      </div>
    </div>
  )
}
