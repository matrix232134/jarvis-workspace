import type { SeparatorMessage } from "@/lib/types"

export default function TimeDivider({ message }: { message: SeparatorMessage }) {
  return (
    <div className="flex items-center gap-4" style={{ margin: "8px 0" }}>
      <div className="flex-1" style={{ height: 0.5, background: "linear-gradient(to right, var(--border-light), var(--accent-ring), var(--border-light))" }} />
      <span
        className="font-sans uppercase shrink-0"
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--ink-ghost)",
          letterSpacing: "0.18em",
        }}
      >
        {message.label}
      </span>
      <div className="flex-1" style={{ height: 0.5, background: "linear-gradient(to right, var(--border-light), var(--accent-ring), var(--border-light))" }} />
    </div>
  )
}
