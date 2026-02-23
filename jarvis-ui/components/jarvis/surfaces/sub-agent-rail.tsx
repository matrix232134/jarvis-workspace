"use client"

import type { SubAgent } from "@/lib/types"

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_COLORS: Record<SubAgent["status"], string> = {
  running: "var(--accent)",
  completed: "var(--j-green)",
  failed: "var(--j-red)",
  queued: "var(--j-amber)",
}

export default function SubAgentRail({ agents }: { agents: SubAgent[] }) {
  if (agents.length === 0) return null

  const activeCount = agents.filter((a) => a.status === "running").length
  const allDone = activeCount === 0

  return (
    <div
      className="fixed flex flex-col gap-2"
      style={{
        right: 16,
        top: 56,
        width: 220,
        zIndex: 35,
        animation: "j-slide-left 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--ink-ghost)",
          letterSpacing: "0.16em",
          paddingLeft: 2,
        }}
      >
        {allDone
          ? "Agents complete"
          : `${activeCount} agent${activeCount !== 1 ? "s" : ""} active`}
      </span>

      {/* Agent cards */}
      {agents.map((agent) => (
        <div
          key={agent.id}
          style={{
            backgroundColor: "var(--surface)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            padding: "10px 14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
            transition: "box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"
            e.currentTarget.style.transform = "translateY(0)"
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-full"
              style={{
                width: 5,
                height: 5,
                backgroundColor: STATUS_COLORS[agent.status],
              }}
            />
            <span
              className="font-sans flex-1 truncate"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ink)",
                maxWidth: 130,
              }}
            >
              {agent.label}
            </span>
            <span
              className="font-mono shrink-0"
              style={{
                fontSize: 9,
                color: "var(--ink-faint)",
              }}
            >
              {formatElapsed(agent.elapsed)}
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="overflow-hidden"
            style={{
              height: 2,
              backgroundColor: "var(--border-light)",
              borderRadius: 1,
              marginTop: 8,
            }}
          >
            {agent.status === "running" ? (
              <div
                style={{
                  width: "40%",
                  height: "100%",
                  backgroundColor: STATUS_COLORS[agent.status],
                  borderRadius: 1,
                  animation: "j-indeterminate 2s ease-in-out infinite",
                }}
              />
            ) : agent.status === "completed" ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: STATUS_COLORS[agent.status],
                  borderRadius: 1,
                }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
