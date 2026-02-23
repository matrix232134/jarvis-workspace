import type { PipelineState } from "@/lib/types"

export default function PipelineCard({ pipeline }: { pipeline: PipelineState }) {
  return (
    <div
      style={{
        backgroundColor: "var(--accent-faint)",
        border: "0.5px solid var(--accent-ring)",
        borderRadius: 12,
        padding: "14px 18px",
        animation: "j-fade-slide 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        {/* Pipeline icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--accent)",
          }}
        >
          Pipeline
        </span>
        <span
          className="font-sans"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {pipeline.name}
        </span>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1.5">
        {pipeline.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {/* Step dot */}
            <span
              className="shrink-0 rounded-full"
              style={{
                width: 5,
                height: 5,
                backgroundColor: step.done
                  ? "var(--j-green)"
                  : step.active
                  ? "var(--accent)"
                  : "var(--ink-ghost)",
                ...(step.active
                  ? { animation: "j-pulse 2s ease-in-out infinite" }
                  : {}),
              }}
            />
            {/* Step label */}
            <span
              className="font-sans"
              style={{
                fontSize: 12,
                color: step.done
                  ? "var(--ink-tertiary)"
                  : step.active
                  ? "var(--ink)"
                  : "var(--ink-faint)",
                textDecoration: step.done ? "line-through" : "none",
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
