"use client"

import { JarvisOrb } from "./orb"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

// --- Types from system API ---

interface SystemInfo {
  machine: string
  services: {
    gateway: boolean
    bridge: boolean
    telegram: boolean
    tailscale: boolean
    tailscaleIp: string
  }
  devices: Array<{ name: string; id: string }>
  capabilities: {
    model: string
    skills: number
    mcp: number
    mcpServers: string[]
    heartbeat: string
  }
  cronJobs: Array<{
    name: string
    enabled: boolean
    schedule: string
    lastStatus: string | null
    lastDurationMs: number | null
    nextRunAtMs: number | null
    consecutiveErrors: number
  }>
}

interface SidebarProps {
  collapsed: boolean
  orbState?: "idle" | "processing" | "disconnected" | "connecting"
}

export function JarvisSidebar({ collapsed, orbState = "idle" }: SidebarProps) {
  const [time, setTime] = useState<string>("")
  const [mounted, setMounted] = useState(false)
  const [system, setSystem] = useState<SystemInfo | null>(null)

  // Clock
  useEffect(() => {
    setMounted(true)
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Australia/Adelaide",
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch system info
  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const res = await fetch("/api/system")
        if (res.ok) {
          setSystem(await res.json())
        }
      } catch { /* ignore */ }
    }
    fetchSystem()
    const interval = setInterval(fetchSystem, 60000)
    return () => clearInterval(interval)
  }, [])

  if (collapsed) return null

  const serviceCount = system
    ? [system.services.gateway, system.services.bridge, system.services.telegram, system.services.tailscale].filter(Boolean).length
    : 0

  const statusText = system
    ? (system.services.gateway && system.services.bridge
        ? "All services online"
        : `${serviceCount}/4 services online`)
    : "Loading..."

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-30 flex w-72 flex-col",
        "border-r border-glass-border",
        "bg-glass backdrop-blur-2xl",
        "transition-transform duration-300 ease-out"
      )}
    >
      {/* ====== JARVIS Identity ====== */}
      <div className="flex items-center gap-4 px-6 pt-7 pb-5">
        <JarvisOrb size="lg" state={orbState} />
        <div className="flex flex-col gap-1">
          <h1
            className="text-2xl font-extrabold tracking-[0.14em] uppercase"
            style={{
              background: "linear-gradient(180deg, oklch(0.97 0 0) 0%, oklch(0.7 0 0) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            JARVIS
          </h1>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65 font-medium">
            {system?.machine ?? "..."}
          </span>
        </div>
      </div>

      <div className="h-px bg-glass-border mx-5" />

      <div className="flex-1 overflow-y-auto px-4 pt-5">
        {/* ====== Services ====== */}
        <SectionLabel label="Services" detail={statusText} />
        <div className="flex flex-col gap-1.5 mb-6 animate-stagger-in">
          <ServiceRow
            name="Gateway"
            online={system?.services.gateway ?? false}
            detail="Port 18789"
          />
          <ServiceRow
            name="Bridge"
            online={system?.services.bridge ?? false}
            detail="Port 19300"
          />
          <ServiceRow
            name="Telegram"
            online={system?.services.telegram ?? false}
            detail="Channel"
          />
          <ServiceRow
            name="Tailscale"
            online={system?.services.tailscale ?? false}
            detail={system?.services.tailscaleIp ?? ""}
          />
        </div>

        {/* ====== Sub-Agent Activity ====== */}
        <SubAgentSection />

        {/* ====== Connected Devices ====== */}
        <SectionLabel
          label="Bridge Devices"
          detail={system ? `${system.devices.length} paired` : ""}
        />
        <div className="flex flex-col gap-1.5 mb-6 animate-stagger-in">
          {system?.devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-glass-border/60 bg-glass/40"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span className="text-[12px] font-medium text-foreground/90">{d.name}</span>
            </div>
          ))}
          {system && system.devices.length === 0 && (
            <span className="text-[11px] text-muted-foreground/50 px-2.5">No devices paired</span>
          )}
        </div>

        {/* ====== Scheduled Tasks ====== */}
        <SectionLabel
          label="Scheduled Tasks"
          detail={system ? `${system.cronJobs.filter(j => j.enabled).length} active` : ""}
        />
        <div className="flex flex-col gap-1 mb-6 animate-stagger-in">
          {system?.cronJobs
            .filter(j => j.enabled)
            .sort((a, b) => (a.nextRunAtMs ?? Infinity) - (b.nextRunAtMs ?? Infinity))
            .map(job => (
              <CronRow key={job.name} job={job} />
            ))
          }
        </div>

        {/* ====== Capabilities ====== */}
        <SectionLabel label="Capabilities" />
        <div className="flex flex-col gap-2 px-2.5 animate-stagger-in">
          <CapRow label="Model" value={system?.capabilities.model ?? "..."} accent />
          <CapRow label="Skills" value={system ? `${system.capabilities.skills} active` : "..."} />
          <CapRow label="MCP" value={system ? `${system.capabilities.mcp} connected` : "..."} />
          {system?.capabilities.mcpServers && system.capabilities.mcpServers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 py-1 pl-2">
              {system.capabilities.mcpServers.map(name => (
                <span
                  key={name}
                  className="text-[9px] font-mono text-muted-foreground/50 px-1.5 py-0.5 rounded border border-glass-border/40 bg-glass/30"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          <CapRow label="Heartbeat" value={system?.capabilities.heartbeat ?? "..."} />
        </div>
      </div>

      {/* ====== Clock ====== */}
      <div className="px-6 py-5 border-t border-glass-border">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extralight tracking-wider text-foreground/85 tabular-nums">
            {mounted ? time : "--:--"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/55 font-medium">
            ACDT
          </span>
        </div>
      </div>
    </aside>
  )
}

// --- Sub-components ---

function SectionLabel({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2.5">
      <h2 className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/55">
        {label}
      </h2>
      {detail && (
        <span className="text-[9px] font-mono text-muted-foreground/40">{detail}</span>
      )}
    </div>
  )
}

function ServiceRow({ name, online, detail }: { name: string; online: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors hover:bg-glass-hover/50">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            online ? "bg-emerald-400 animate-pulse-dot" : "bg-muted-foreground/40"
          )}
        />
        <span className="text-[12px] font-medium text-foreground/90">{name}</span>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/50">{detail}</span>
    </div>
  )
}

function CronRow({ job }: { job: SystemInfo["cronJobs"][number] }) {
  const formatNextRun = (ms: number | null) => {
    if (!ms) return "—"
    const diff = ms - Date.now()
    if (diff < 0) return "overdue"
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hours >= 24) return `${Math.floor(hours / 24)}d`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return ""
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
  }

  const statusColor = !job.lastStatus
    ? "bg-muted-foreground/40"
    : job.lastStatus === "ok"
    ? "bg-emerald-400"
    : "bg-red-400"

  const displayName = job.name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors hover:bg-glass-hover/50">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-1.5 w-1.5 rounded-full", statusColor)} />
        <span className="text-[11px] font-medium text-foreground/85 truncate max-w-[120px]">
          {displayName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {job.lastDurationMs && (
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {formatDuration(job.lastDurationMs)}
          </span>
        )}
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {formatNextRun(job.nextRunAtMs)}
        </span>
      </div>
    </div>
  )
}

// --- Sub-Agent Activity ---

type SubAgentStatus = "running" | "completed" | "failed" | "stalled"

interface SubAgentInfo {
  id: string
  label: string
  ageSeconds: number
  status: SubAgentStatus
}

function SubAgentSection() {
  const [subagents, setSubagents] = useState<SubAgentInfo[]>([])

  useEffect(() => {
    const fetchSubagents = async () => {
      try {
        const res = await fetch("/api/subagents")
        if (res.ok) {
          setSubagents(await res.json())
        }
      } catch { /* ignore */ }
    }
    fetchSubagents()
    const interval = setInterval(fetchSubagents, 5000)
    return () => clearInterval(interval)
  }, [])

  if (subagents.length === 0) return null

  const runningCount = subagents.filter(s => s.status === "running").length
  const detail = runningCount > 0
    ? `${runningCount} active`
    : subagents.some(s => s.status === "stalled")
      ? "stalled"
      : "done"

  return (
    <>
      <SectionLabel
        label="Sub-Agents"
        detail={detail}
      />
      <div className="flex flex-col gap-1.5 mb-6 animate-stagger-in">
        {subagents.map((agent) => (
          <SubAgentRow key={agent.id} agent={agent} />
        ))}
      </div>
    </>
  )
}

const STATUS_DOT: Record<SubAgentStatus, string> = {
  running: "bg-primary animate-subagent-pulse",
  completed: "bg-emerald-400",
  failed: "bg-red-400",
  stalled: "bg-amber-400 animate-pulse",
}

const STATUS_BAR: Record<SubAgentStatus, { className: string; width: string }> = {
  running: { className: "bg-primary/70 animate-progress-indeterminate", width: "w-1/3" },
  completed: { className: "bg-emerald-400/60", width: "w-full" },
  failed: { className: "bg-red-400/60", width: "w-full" },
  stalled: { className: "bg-amber-400/50", width: "w-2/3" },
}

function SubAgentRow({ agent }: { agent: SubAgentInfo }) {
  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const bar = STATUS_BAR[agent.status]

  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-2 rounded-lg border border-glass-border/60 bg-glass/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[agent.status])} />
          <span className="text-[11px] font-medium text-foreground/85 truncate max-w-[140px]">
            {agent.label}
          </span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {agent.status === "failed" ? "failed" : formatAge(agent.ageSeconds)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-[2px] w-full rounded-full bg-glass-border/40 overflow-hidden">
        <div className={cn("h-full rounded-full", bar.width, bar.className)} />
      </div>
    </div>
  )
}

function CapRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground/60">{label}</span>
      <span className={cn(
        "text-[11px] font-medium",
        accent ? "text-primary" : "text-foreground/75"
      )}>
        {value}
      </span>
    </div>
  )
}
