"use client"

import type { OpenItem } from "@/lib/types"

export default function OpenItemsStrip({
  items,
  onDismiss,
}: {
  items: OpenItem[]
  onDismiss: () => void
}) {
  if (items.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: 12,
        padding: "12px 20px",
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        animation: "j-fade-slide 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        {/* Flag icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.1em",
          }}
        >
          Open Items
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--ink-ghost)",
          }}
        >
          {items.length}
        </span>
        <div className="flex-1" />
        <button
          onClick={onDismiss}
          className="cursor-pointer flex items-center justify-center"
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "none",
            color: "var(--ink-ghost)",
          }}
          aria-label="Dismiss open items"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="shrink-0 rounded-full"
              style={{
                width: 2,
                height: 2,
                backgroundColor: item.stale ? "var(--j-amber)" : "var(--ink-ghost)",
              }}
            />
            <span
              className="font-sans flex-1"
              style={{
                fontSize: 12,
                color: "var(--ink-secondary)",
              }}
            >
              {item.text}
            </span>
            {item.stale && (
              <span
                className="font-sans uppercase shrink-0"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "var(--j-amber)",
                }}
              >
                STALE
              </span>
            )}
            <span
              className="font-mono shrink-0"
              style={{
                fontSize: 9,
                color: "var(--ink-ghost)",
              }}
            >
              {item.since}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
