import type { MemoryStats } from "@/lib/types"

const LABELS = [
  { key: "preferences" as const, label: "PREFERENCES" },
  { key: "lessons" as const, label: "LESSONS" },
  { key: "patterns" as const, label: "PATTERNS" },
  { key: "openItems" as const, label: "OPEN" },
]

export default function MemoryGlimpse({ stats }: { stats: MemoryStats }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        backgroundColor: "rgba(124,58,237,0.04)",
        border: "0.5px solid rgba(124,58,237,0.08)",
        borderRadius: 10,
        padding: "12px 16px",
        animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Brain icon */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--j-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
        <path d="M9 21h6" />
        <path d="M10 17v4" />
        <path d="M14 17v4" />
      </svg>

      {/* Stats */}
      <div className="flex items-center gap-5">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            <span
              className="font-mono"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
              }}
            >
              {stats[key]}
            </span>
            <span
              className="font-sans uppercase"
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: "var(--ink-faint)",
                letterSpacing: "0.12em",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
