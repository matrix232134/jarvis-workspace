import type { ActionIndicator } from "@/lib/types"

export default function ActionLine({ action }: { action: ActionIndicator }) {
  return (
    <div className="flex items-center gap-2" style={{ animation: "j-fade-in 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 2,
          height: 2,
          backgroundColor: "var(--ink-ghost)",
        }}
      />
      <span
        className="font-mono"
        style={{
          fontSize: 11,
          color: "var(--ink-faint)",
        }}
      >
        {action.text}
      </span>
    </div>
  )
}
