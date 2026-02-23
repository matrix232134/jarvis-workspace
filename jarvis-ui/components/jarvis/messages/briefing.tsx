import { memo } from "react"
import Presence from "../presence"
import type { BriefingMessage } from "@/lib/types"

export default memo(function Briefing({ message }: { message: BriefingMessage }) {
  return (
    <div style={{ paddingTop: 28, paddingBottom: 20, animation: "j-fade-slide 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Label row */}
      <div className="flex items-center gap-2.5" style={{ marginBottom: 14 }}>
        <Presence state="idle" size={5} />
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.14em",
          }}
        >
          Briefing
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--ink-ghost)",
          }}
        >
          {message.date}
        </span>
      </div>

      {/* Body — Newsreader serif */}
      <p
        className="font-serif"
        style={{
          fontSize: 16,
          lineHeight: 1.9,
          color: "var(--ink-secondary)",
          letterSpacing: "-0.008em",
          fontWeight: 400,
        }}
      >
        {message.text}
      </p>

      {/* Timestamp */}
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: "var(--ink-ghost)",
          marginTop: 14,
        }}
      >
        {message.timestamp}
      </div>
    </div>
  )
})
