"use client"

import Presence from "./presence"
import type { JarvisState } from "@/lib/types"

export default function ContextBar({
  state,
  agentCount,
  onToggleAgents,
  onOpenSystem,
}: {
  state: JarvisState
  agentCount: number
  onToggleAgents: () => void
  onOpenSystem: () => void
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-5"
      style={{
        height: 48,
        zIndex: 50,
        background: "linear-gradient(to bottom, var(--bg) 55%, rgba(250,250,249,0.6) 80%, transparent)",
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
