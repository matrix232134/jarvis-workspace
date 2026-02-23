"use client"

import type { AttentionItem } from "@/lib/types"

const SEVERITY_STYLES = {
  info: {
    bg: "rgba(29,78,216,0.03)",
    border: "rgba(29,78,216,0.08)",
    iconColor: "var(--accent)",
  },
  warning: {
    bg: "var(--amber-faint)",
    border: "rgba(180,83,9,0.1)",
    iconColor: "var(--j-amber)",
  },
  critical: {
    bg: "var(--red-faint)",
    border: "rgba(185,28,28,0.1)",
    iconColor: "var(--j-red)",
  },
}

export default function AttentionBanners({
  items,
  onDismiss,
}: {
  items: AttentionItem[]
  onDismiss: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div
      className="fixed flex flex-col gap-2"
      style={{
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 55,
        width: "100%",
        maxWidth: 480,
      }}
    >
      {items.map((item, i) => {
        const s = SEVERITY_STYLES[item.severity]
        return (
          <div
            key={item.id}
            className="flex items-center gap-2.5"
            style={{
              backgroundColor: s.bg,
              border: `0.5px solid ${s.border}`,
              borderRadius: 12,
              padding: "10px 14px",
              animation: `j-banner-in 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
            }}
          >
            {/* Alert icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={s.iconColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>

            <span
              className="font-sans flex-1"
              style={{
                fontSize: 13,
                color: "var(--ink)",
              }}
            >
              {item.text}
            </span>

            <button
              onClick={() => onDismiss(item.id)}
              className="shrink-0 flex items-center justify-center cursor-pointer"
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                backgroundColor: "transparent",
                border: "none",
                color: "var(--ink-faint)",
              }}
              aria-label="Dismiss alert"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
