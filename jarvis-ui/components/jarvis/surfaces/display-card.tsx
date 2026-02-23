"use client"

import { useState } from "react"
import type { DisplayCard } from "@/lib/types"

export default function DisplayCardInline({
  display,
  onClick,
}: {
  display: DisplayCard
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left cursor-pointer"
      style={{
        backgroundColor: "var(--surface)",
        border: hovered ? "0.5px solid var(--border-focus)" : "0.5px solid var(--border)",
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: hovered ? "0 2px 12px var(--accent-glow)" : "none",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.1em",
          }}
        >
          {display.title}
        </span>
        {/* Expand icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-ghost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </div>

      {/* Content */}
      <pre
        className="font-mono whitespace-pre-wrap"
        style={{
          fontSize: 12,
          color: "var(--ink-secondary)",
          lineHeight: 1.75,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {display.content}
      </pre>
    </button>
  )
}
