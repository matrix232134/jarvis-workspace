"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import type { Artifact } from "@/lib/use-artifact"
import type { CronJob } from "@/lib/types"

const TYPE_COLORS: Record<string, string> = {
  html: "var(--j-green)",
  react: "var(--j-green)",
  code: "var(--accent)",
  mermaid: "var(--j-purple)",
  diagram: "var(--j-purple)",
  svg: "var(--j-amber)",
}

function badgeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] || "var(--ink-faint)"
}

function badgeLabel(type: string): string {
  return type.toUpperCase()
}

export default function LibraryDrawer({
  items,
  crons,
  onOpen,
  onDiscuss,
  onDiscussAutomation,
  onClose,
}: {
  items: Artifact[]
  crons: CronJob[]
  onOpen: (item: Artifact) => void
  onDiscuss: (item: Artifact) => void
  onDiscussAutomation: (cron: CronJob) => void
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [expandedCron, setExpandedCron] = useState<string | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  // Compute available type filters from items
  const availableTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.type.toLowerCase()))
    return Array.from(types).sort()
  }, [items])

  // Filter items by active filter
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items
    return items.filter((i) => i.type.toLowerCase() === activeFilter)
  }, [items, activeFilter])

  const totalCount = items.length + crons.length

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 60,
        backgroundColor: "var(--overlay-bg)",
        backdropFilter: "blur(20px)",
        animation: "j-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        ref={cardRef}
        className="absolute overflow-y-auto"
        style={{
          bottom: 88,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "70vh",
          backgroundColor: "var(--surface)",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.03)",
          animation: "j-surface-up 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5" style={{ marginBottom: 24 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            Library
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-ghost)" }}>
            {totalCount} item{totalCount !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: "transparent",
              border: "none",
              color: "var(--ink-faint)",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-active)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Close library drawer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* === CREATIONS === */}
        <SectionLabel label="CREATIONS" detail={`${items.length}`} />

        {items.length > 0 && availableTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
            <FilterChip label="All" active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
            {availableTypes.map((t) => (
              <FilterChip
                key={t}
                label={t.toUpperCase()}
                active={activeFilter === t}
                onClick={() => setActiveFilter(t)}
                color={badgeColor(t)}
              />
            ))}
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="flex flex-col gap-1" style={{ marginBottom: 24 }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-active)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Type badge */}
                <span
                  className="font-mono shrink-0"
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: badgeColor(item.type),
                    backgroundColor: `color-mix(in srgb, ${badgeColor(item.type)} 8%, transparent)`,
                    border: `0.5px solid color-mix(in srgb, ${badgeColor(item.type)} 15%, transparent)`,
                    borderRadius: 4,
                    padding: "2px 5px",
                    letterSpacing: "0.04em",
                    minWidth: 36,
                    textAlign: "center" as const,
                  }}
                >
                  {badgeLabel(item.type)}
                </span>

                {/* Title */}
                <span
                  className="font-sans flex-1 truncate"
                  style={{ fontSize: 12, fontWeight: 430, color: "var(--ink)" }}
                >
                  {item.title}
                </span>

                {/* Timestamp */}
                <span className="font-mono shrink-0" style={{ fontSize: 10, color: "var(--ink-ghost)" }}>
                  {item.timestamp}
                </span>

                {/* Actions */}
                <button
                  onClick={() => onOpen(item)}
                  className="font-sans shrink-0 cursor-pointer"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--accent)",
                    background: "none",
                    border: "none",
                    padding: "2px 6px",
                    borderRadius: 4,
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-faint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Open
                </button>
                <button
                  onClick={() => onDiscuss(item)}
                  className="font-sans shrink-0 cursor-pointer"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--ink-faint)",
                    background: "none",
                    border: "none",
                    padding: "2px 6px",
                    borderRadius: 4,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-active)"
                    e.currentTarget.style.color = "var(--ink-secondary)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent"
                    e.currentTarget.style.color = "var(--ink-faint)"
                  }}
                >
                  Discuss
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="font-sans"
            style={{
              fontSize: 12,
              color: "var(--ink-ghost)",
              padding: "12px 0",
              marginBottom: 24,
            }}
          >
            {items.length === 0
              ? "No creations yet \u2014 ask JARVIS to build something."
              : "No items match this filter."}
          </div>
        )}

        {/* === AUTOMATIONS === */}
        <SectionLabel label="AUTOMATIONS" detail={`${crons.length}`} />

        {crons.length > 0 ? (
          <div className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
            {crons.map((c, i) => {
              const isExpanded = expandedCron === c.name
              return (
                <div key={i}>
                  {/* Clickable row */}
                  <div
                    className="flex items-center gap-2.5 cursor-pointer"
                    style={{
                      padding: "8px 10px",
                      borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                      backgroundColor: isExpanded ? "var(--surface-active)" : "transparent",
                      transition: "background-color 0.15s",
                    }}
                    onClick={() => setExpandedCron(isExpanded ? null : c.name)}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "var(--surface-active)" }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent" }}
                  >
                    <span
                      className="shrink-0 rounded-full"
                      style={{
                        width: 5,
                        height: 5,
                        backgroundColor:
                          c.ok === true
                            ? "var(--j-green)"
                            : c.ok === false
                            ? "var(--j-red)"
                            : "var(--ink-ghost)",
                      }}
                    />
                    <span className="font-sans flex-1" style={{ fontSize: 12, fontWeight: 430, color: "var(--ink)" }}>
                      {c.name}
                    </span>
                    {c.ok === false && (
                      <span
                        className="font-mono uppercase shrink-0"
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          color: "var(--j-red)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        ERROR
                      </span>
                    )}
                    <span className="font-mono shrink-0" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                      {c.next}
                    </span>
                    {/* Chevron */}
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-ghost)"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div
                      style={{
                        backgroundColor: "var(--surface-active)",
                        borderRadius: "0 0 10px 10px",
                        padding: "4px 10px 12px 22px",
                        animation: "j-fade-in 0.15s cubic-bezier(0.4,0,0.2,1)",
                      }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <DetailRow label="Schedule" value={c.schedule} />
                        {c.message && (
                          <DetailRow label="Task" value={c.message.length > 120 ? c.message.slice(0, 120) + "..." : c.message} />
                        )}
                        <DetailRow label="Model" value={c.model} />
                        <DetailRow label="Delivery" value={c.delivery} />
                        <DetailRow label="Last run" value={c.lastRunAt !== "\u2014" ? `${c.lastRunAt} \u00B7 took ${c.lastDuration}` : "\u2014"} />
                        {c.consecutiveErrors > 0 && (
                          <DetailRow label="Errors" value={`${c.consecutiveErrors} consecutive`} isError />
                        )}
                      </div>
                      <div className="flex justify-end" style={{ marginTop: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDiscussAutomation(c) }}
                          className="font-sans cursor-pointer"
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--accent)",
                            background: "none",
                            border: "none",
                            padding: "3px 8px",
                            borderRadius: 4,
                            transition: "background-color 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-faint)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          Discuss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="font-sans"
            style={{
              fontSize: 12,
              color: "var(--ink-ghost)",
              padding: "12px 0",
            }}
          >
            No automations configured.
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--section-label)",
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </span>
      {detail && (
        <span className="font-mono" style={{ fontSize: 9, color: "var(--section-detail)" }}>
          {detail}
        </span>
      )}
    </div>
  )
}

function DetailRow({ label, value, isError }: { label: string; value: string; isError?: boolean }) {
  return (
    <div className="flex gap-2" style={{ fontSize: 11 }}>
      <span className="font-sans shrink-0" style={{ width: 60, color: "var(--ink-faint)", fontWeight: 500 }}>
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          color: isError ? "var(--j-red)" : "var(--ink-secondary)",
          lineHeight: 1.5,
          wordBreak: "break-word" as const,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono cursor-pointer"
      style={{
        fontSize: 9,
        fontWeight: active ? 600 : 400,
        color: active ? (color || "var(--accent)") : "var(--ink-faint)",
        backgroundColor: active ? "var(--accent-faint)" : "transparent",
        border: active ? "0.5px solid var(--accent-ring)" : "0.5px solid var(--border-light)",
        borderRadius: 6,
        padding: "3px 8px",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  )
}
