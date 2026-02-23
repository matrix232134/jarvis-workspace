"use client"

import { useEffect, useRef } from "react"
import type { DisplayCard } from "@/lib/types"

export default function DisplayModal({
  display,
  onClose,
}: {
  display: DisplayCard
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 70,
        backgroundColor: "rgba(250,250,249,0.88)",
        backdropFilter: "blur(30px)",
        animation: "j-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        ref={cardRef}
        className="overflow-y-auto"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "78vh",
          backgroundColor: "var(--surface)",
          borderRadius: 20,
          padding: 36,
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.03)",
          animation: "j-surface-up-center 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <span
            className="font-sans uppercase"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent)",
              letterSpacing: "0.1em",
            }}
          >
            {display.title}
          </span>
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
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface-active)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            aria-label="Close display modal"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <pre
          className="font-mono whitespace-pre-wrap"
          style={{
            fontSize: 13,
            lineHeight: 1.85,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {display.content}
        </pre>
      </div>
    </div>
  )
}
