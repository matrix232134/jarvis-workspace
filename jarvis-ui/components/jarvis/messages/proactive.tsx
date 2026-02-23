import type { ProactiveMessage } from "@/lib/types"

const SEVERITY_STYLES = {
  info: {
    bg: "rgba(29,78,216,0.03)",
    border: "rgba(29,78,216,0.08)",
    dotColor: "var(--accent)",
    labelColor: "var(--accent)",
  },
  warning: {
    bg: "var(--amber-faint)",
    border: "rgba(180,83,9,0.1)",
    dotColor: "var(--j-amber)",
    labelColor: "var(--j-amber)",
  },
  critical: {
    bg: "var(--red-faint)",
    border: "rgba(185,28,28,0.1)",
    dotColor: "var(--j-red)",
    labelColor: "var(--j-red)",
  },
}

export default function ProactiveAlert({ message }: { message: ProactiveMessage }) {
  const s = SEVERITY_STYLES[message.severity]

  return (
    <div
      style={{
        backgroundColor: s.bg,
        border: `0.5px solid ${s.border}`,
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 18,
        animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Severity header */}
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span
          className="rounded-full shrink-0"
          style={{ width: 5, height: 5, backgroundColor: s.dotColor }}
        />
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: s.labelColor,
          }}
        >
          {message.severity}
        </span>
      </div>

      {/* Body */}
      <p
        className="font-sans"
        style={{
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--ink)",
        }}
      >
        {message.voice.text}
      </p>

      {/* Timestamp */}
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: "var(--ink-ghost)",
          marginTop: 6,
        }}
      >
        {message.timestamp}
      </div>
    </div>
  )
}
