"use client"

import { useState } from "react"
import type { ArtifactRef } from "@/lib/types"

export default function ArtifactRefInline({
  artifact,
  onClick,
}: {
  artifact: ArtifactRef
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-2.5 self-start cursor-pointer"
      style={{
        backgroundColor: hovered ? "rgba(29,78,216,0.09)" : "var(--accent-faint)",
        border: hovered ? "0.5px solid rgba(29,78,216,0.15)" : "0.5px solid rgba(29,78,216,0.08)",
        borderRadius: 10,
        padding: "9px 14px",
        boxShadow: hovered ? "0 2px 12px var(--accent-glow)" : "none",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Type label */}
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--accent)",
        }}
      >
        {artifact.type}
      </span>

      {/* Hairline separator */}
      <span
        style={{
          width: 0.5,
          height: 14,
          backgroundColor: "rgba(29,78,216,0.12)",
        }}
      />

      {/* Title */}
      <span
        className="font-sans"
        style={{
          fontSize: 13,
          fontWeight: 450,
          color: "var(--ink)",
        }}
      >
        {artifact.title}
      </span>

      {/* Chevron */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}
