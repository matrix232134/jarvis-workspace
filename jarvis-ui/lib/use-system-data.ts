"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Service, Device, CronJob } from "@/lib/types"

const POLL_INTERVAL_MS = 30000

interface ApiSystemResponse {
  machine: string
  services: {
    gateway: boolean
    bridge: boolean
    telegram: boolean
    voiceService?: boolean
    tailscale: boolean
    tailscaleIp: string
  }
  devices: Array<{ name: string; id: string; os?: string; online?: boolean; ip?: string; isSelf?: boolean }>
  capabilities: {
    model: string
    skills: number
    skillNames?: string[]
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

function formatRelativeTime(ms: number | null): string {
  if (!ms) return "—"
  const now = Date.now()
  const diff = ms - now
  if (diff < 0) return "overdue"

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

function mapServices(api: ApiSystemResponse["services"]): Service[] {
  const services: Service[] = [
    { name: "OpenClaw Gateway", detail: ":18789", online: api.gateway },
    { name: "JARVIS Bridge", detail: ":19300", online: api.bridge },
  ]
  if (api.voiceService !== undefined) {
    services.push({ name: "Voice Service", detail: "bridge client", online: api.voiceService })
  }
  services.push({ name: "Telegram Bot", detail: "channel", online: api.telegram })
  return services
}

function mapDevices(api: ApiSystemResponse["devices"]): Device[] {
  return api.map((d) => ({
    id: d.id,
    name: d.name,
    online: d.online ?? true,
    primary: d.isSelf ?? false,
    os: d.os,
    ip: d.ip,
  }))
}

function mapCrons(api: ApiSystemResponse["cronJobs"]): CronJob[] {
  return api
    .filter((c) => c.enabled)
    .map((c) => ({
      name: c.name,
      next: formatRelativeTime(c.nextRunAtMs),
      ok: c.consecutiveErrors > 0 ? false : c.lastStatus === "ok" ? true : null,
    }))
}

export interface SystemData {
  services: Service[]
  devices: Device[]
  crons: CronJob[]
  skills: string[]
  model: string
  heartbeat: string
  loading: boolean
}

export function useSystemData(): SystemData {
  const [data, setData] = useState<SystemData>({
    services: [],
    devices: [],
    crons: [],
    skills: [],
    model: "",
    heartbeat: "",
    loading: true,
  })
  const mountedRef = useRef(true)

  const fetchSystem = useCallback(async () => {
    try {
      const res = await fetch("/api/system")
      if (!res.ok) return
      const api: ApiSystemResponse = await res.json()
      if (mountedRef.current) {
        setData({
          services: mapServices(api.services),
          devices: mapDevices(api.devices),
          crons: mapCrons(api.cronJobs),
          skills: api.capabilities.skillNames ?? [],
          model: api.capabilities.model,
          heartbeat: api.capabilities.heartbeat,
          loading: false,
        })
      }
    } catch {
      // Silently fail — will retry on next poll
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchSystem()

    const interval = setInterval(fetchSystem, POLL_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [fetchSystem])

  return data
}
