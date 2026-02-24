import type { JarvisState } from "@/lib/types"

const DOT_COLORS: Record<JarvisState, string> = {
  idle: "var(--accent)",
  processing: "var(--accent-light)",
  listening: "var(--j-green)",
  speaking: "var(--j-purple)",
  disconnected: "var(--ink-ghost)",
}

export default function Presence({
  state,
  size = 6,
  className = "",
}: {
  state: JarvisState
  size?: number
  className?: string
}) {
  const color = DOT_COLORS[state]
  const isPulsing = state === "processing" || state === "listening" || state === "speaking"
  const pulseDuration = state === "listening" ? "2.4s" : state === "speaking" ? "1.8s" : "2s"
  const isIdle = state === "idle"

  return (
    <span
      className={`relative inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: state !== "disconnected" ? `0 0 ${size * 2}px ${color}30` : "none",
        animation: isIdle ? "j-breathe 4s ease-in-out infinite" : undefined,
      }}
    >
      {isPulsing && (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: color,
            animation: `j-pulse ${pulseDuration} ease-in-out infinite`,
          }}
        />
      )}
    </span>
  )
}
