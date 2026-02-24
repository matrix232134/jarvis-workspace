"use client"

import { useEffect, useRef } from "react"
import Presence from "../presence"
import type { Service, Device, CronJob, TrustEntry } from "@/lib/types"

const TRUST_COLORS: Record<TrustEntry["level"], string> = {
  Advisory: "var(--ink-faint)",
  Guided: "var(--accent)",
  Autonomous: "var(--j-green)",
}

export default function SystemDrawer({
  services,
  devices,
  crons,
  trust,
  skills,
  model,
  heartbeat,
  onClose,
}: {
  services: Service[]
  devices: Device[]
  crons: CronJob[]
  trust: TrustEntry[]
  skills: string[]
  model?: string
  heartbeat?: string
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)

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

  const onlineCount = services.filter((s) => s.online).length

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
          <Presence state="idle" size={7} />
          <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            System
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-ghost)" }}>
            MINIPC-HWLMX
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
            aria-label="Close system drawer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Services */}
        <SectionLabel label="SERVICES" detail={`${onlineCount}/${services.length}`} />
        <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
          {services.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor: s.online ? "var(--j-green)" : "var(--j-red)",
                }}
              />
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 430, color: "var(--ink)" }}>
                {s.name}
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                {s.detail}
              </span>
            </div>
          ))}
        </div>

        {/* Devices (Tailscale) */}
        <SectionLabel label="DEVICES" detail={`${devices.filter((d) => d.online).length}/${devices.length} online`} />
        <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2.5"
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                backgroundColor: d.primary ? "var(--accent-faint)" : "transparent",
                border: d.primary
                  ? "0.5px solid var(--accent-ring)"
                  : "0.5px solid var(--border)",
              }}
            >
              {/* Online dot */}
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor: d.online ? "var(--j-green)" : "var(--ink-ghost)",
                }}
              />
              {/* Device icon by OS */}
              {d.os === "iOS" ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-faint)" }}>
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-faint)" }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              )}
              <span className="font-sans" style={{ fontSize: 11, fontWeight: d.primary ? 600 : 400, color: d.online ? "var(--ink)" : "var(--ink-faint)" }}>
                {d.name}
              </span>
              {d.primary && (
                <span
                  className="font-sans uppercase"
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "0.04em",
                  }}
                >
                  THIS DEVICE
                </span>
              )}
              <div className="flex-1" />
              {d.ip && (
                <span className="font-mono" style={{ fontSize: 9, color: "var(--ink-ghost)" }}>
                  {d.ip}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Scheduled */}
        <SectionLabel label="SCHEDULED" detail={`${crons.length} active`} />
        <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
          {crons.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor:
                    c.ok === true
                      ? "var(--j-green)"
                      : c.ok === false
                      ? "var(--j-red)"
                      : "var(--ink-ghost)",
                }}
              />
              <span className="font-sans" style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                {c.name}
              </span>
              <div className="flex-1" />
              <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                {c.next}
              </span>
            </div>
          ))}
        </div>

        {/* Trust Calibration */}
        <SectionLabel label="TRUST CALIBRATION" />
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 20 }}>
          {trust.map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="font-sans" style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                {t.category}
              </span>
              <span
                className="font-sans"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: TRUST_COLORS[t.level],
                }}
              >
                {t.level}
              </span>
            </div>
          ))}
        </div>

        {/* Skills */}
        <SectionLabel label={`SKILLS \u00B7 ${skills.length}`} />
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 20 }}>
          {skills.map((s, i) => (
            <span
              key={i}
              className="font-mono"
              style={{
                fontSize: 9,
                color: "var(--ink-faint)",
                backgroundColor: "var(--bg)",
                border: "0.5px solid var(--border-light)",
                borderRadius: 6,
                padding: "3px 8px",
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            borderTop: "0.5px solid var(--border-light)",
            paddingTop: 14,
          }}
        >
          <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            {model || "claude-opus-4-6"}
          </span>
          <span className="font-sans" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            Heartbeat {heartbeat || "15min"}
          </span>
        </div>
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
