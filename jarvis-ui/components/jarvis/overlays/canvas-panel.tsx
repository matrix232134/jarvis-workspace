"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Presence from "../presence"
import type { JarvisState, Service, Device } from "@/lib/types"

const CANVAS_URL = process.env.NEXT_PUBLIC_CANVAS_URL || "http://127.0.0.1:18789/__openclaw__/canvas/"

type PanelTab = "canvas" | "system"

export default function CanvasPanel({
  onClose,
  onSendMessage,
  isDark,
  jarvisState,
  services,
  devices,
  model,
  heartbeat,
  connectionStatus,
  displayItems,
}: {
  onClose: () => void
  onSendMessage?: (text: string) => void
  isDark: boolean
  jarvisState: JarvisState
  services: Service[]
  devices: Device[]
  model?: string
  heartbeat?: string
  connectionStatus: string
  displayItems?: Array<{ title: string; content: string }>
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [tab, setTab] = useState<PanelTab>("canvas")
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const pushedCountRef = useRef(0)

  // Sync theme to iframe
  useEffect(() => {
    if (iframeLoaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: "theme", dark: isDark }),
        "*"
      )
    }
  }, [isDark, iframeLoaded])

  // Push new [DISPLAY] content to canvas iframe
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current?.contentWindow || !displayItems) return
    // Only push items we haven't pushed yet
    const newItems = displayItems.slice(pushedCountRef.current)
    for (const item of newItems) {
      const html = `<h4 style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-faint)">${item.title}</h4><div>${item.content}</div>`
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: "a2ui.push", html }),
        "*"
      )
    }
    pushedCountRef.current = displayItems.length
  }, [displayItems, iframeLoaded])

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  // Listen for openclaw:// deep links from iframe postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return
      const match = e.data.match(/^openclaw:\/\/agent\?message=(.+)$/)
      if (match && onSendMessage) {
        onSendMessage(decodeURIComponent(match[1]))
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [onSendMessage])

  return (
    <div
      className="fixed bottom-0 right-0 flex flex-col"
      style={{
        top: 48,
        width: 360,
        backgroundColor: "var(--surface)",
        borderLeft: "0.5px solid var(--border)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.03)",
        zIndex: 55,
        animation: "j-slide-right 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 shrink-0"
        style={{
          padding: "12px 20px",
          borderBottom: "0.5px solid var(--border-light)",
        }}
      >
        <TabButton label="Canvas" active={tab === "canvas"} onClick={() => setTab("canvas")} />
        <TabButton label="System" active={tab === "system"} onClick={() => setTab("system")} />

        <span className="flex-1" />

        <button
          onClick={onClose}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: 24, height: 24, borderRadius: 6,
            backgroundColor: "transparent", border: "none",
            color: "var(--ink-faint)", transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-active)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          aria-label="Close panel"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* System tab — vital connection status only */}
      {tab === "system" && (
        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
          {/* JARVIS status */}
          <div className="flex items-center gap-2.5" style={{ marginBottom: 22 }}>
            <Presence state={jarvisState} size={7} />
            <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              JARVIS
            </span>
            <div className="flex-1" />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: connectionStatus === "connected" ? "var(--j-green)" : "var(--ink-faint)",
                letterSpacing: "0.06em",
              }}
            >
              {connectionStatus}
            </span>
          </div>

          {/* Services */}
          <SectionLabel label="SERVICES" />
          <div className="flex flex-col gap-1" style={{ marginBottom: 20 }}>
            {services.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5" style={{ padding: "4px 0" }}>
                <StatusDot online={s.online} />
                <span className="font-sans" style={{ fontSize: 12, color: "var(--ink)" }}>
                  {s.name}
                </span>
                <div className="flex-1" />
                <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                  {s.detail}
                </span>
              </div>
            ))}
          </div>

          {/* Devices */}
          <SectionLabel label="DEVICES" />
          <div className="flex flex-col gap-1" style={{ marginBottom: 20 }}>
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-2.5" style={{ padding: "4px 0" }}>
                <StatusDot online={d.online} />
                <span className="font-sans" style={{ fontSize: 12, fontWeight: d.primary ? 600 : 400, color: d.online ? "var(--ink)" : "var(--ink-faint)" }}>
                  {d.name}
                </span>
                {d.primary && (
                  <span className="font-mono uppercase" style={{ fontSize: 8, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>
                    primary
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Device Setup */}
          <SectionLabel label="DEVICE SETUP" />
          <SetupButton />

          {/* Footer */}
          <div
            className="flex items-center justify-between"
            style={{
              borderTop: "0.5px solid var(--border-light)",
              paddingTop: 12,
              marginTop: "auto",
            }}
          >
            <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
              {model || "claude-opus-4-6"}
            </span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
              HB {heartbeat || "15m"}
            </span>
          </div>
        </div>
      )}

      {/* Canvas tab */}
      {tab === "canvas" && (
        <iframe
          ref={iframeRef}
          src={CANVAS_URL}
          onLoad={() => setIframeLoaded(true)}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            backgroundColor: "var(--bg)",
          }}
        />
      )}
    </div>
  )
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: 5,
        height: 5,
        backgroundColor: online ? "var(--j-green)" : "var(--j-red)",
      }}
    />
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-sans cursor-pointer"
      style={{
        fontSize: 9, fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: active ? "var(--accent)" : "var(--ink-faint)",
        background: "none", border: "none",
        padding: "4px 0",
        borderBottom: active ? "1.5px solid var(--accent)" : "1.5px solid transparent",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--ink-tertiary)" }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = active ? "var(--accent)" : "var(--ink-faint)" }}
    >
      {label}
    </button>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 9, fontWeight: 700,
          color: "var(--section-label)",
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </span>
    </div>
  )
}

function SetupButton() {
  const [downloaded, setDownloaded] = useState(false)

  const handleClick = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase()
    const os = ua.includes("win") ? "windows" : ua.includes("mac") ? "mac" : "linux"
    const a = document.createElement("a")
    a.href = `/api/device-setup?os=${os}&name=My-Device`
    a.download = os === "windows" ? "jarvis-agent-setup.bat" : "jarvis-agent-setup.sh"
    a.click()
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }, [])

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={handleClick}
        className="font-sans cursor-pointer flex items-center gap-2"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: downloaded ? "var(--j-green)" : "var(--accent)",
          backgroundColor: downloaded ? "rgba(52, 199, 89, 0.08)" : "var(--accent-faint)",
          border: `1px solid ${downloaded ? "var(--j-green)" : "var(--accent-ring)"}`,
          borderRadius: 8,
          padding: "8px 14px",
          transition: "all 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {downloaded ? "Downloaded" : "Download Agent Installer"}
      </button>
      <div className="font-mono" style={{ fontSize: 9, color: "var(--ink-ghost)", marginTop: 5 }}>
        Run on any device to connect it to JARVIS
      </div>
    </div>
  )
}
