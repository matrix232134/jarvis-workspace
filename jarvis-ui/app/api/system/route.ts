import { NextResponse } from "next/server"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createConnection } from "node:net"

const HOME = process.env.USERPROFILE || process.env.HOME || ""

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port }, () => {
      sock.destroy()
      resolve(true)
    })
    sock.on("error", () => resolve(false))
    sock.setTimeout(1500, () => {
      sock.destroy()
      resolve(false)
    })
  })
}

export const dynamic = "force-dynamic"

export async function GET() {
  // Read configs
  const openclawConfig = readJsonSafe(join(HOME, ".openclaw", "openclaw.json")) as Record<string, unknown> | null
  const devicesJson = readJsonSafe(join(HOME, "jarvis-bridge", "devices.json"))
  const mcporterConfig = readJsonSafe(join(HOME, ".mcporter", "mcporter.json"))

  // Count skills
  let skillCount = 0
  const skillsDir = join(HOME, ".openclaw", "workspace", "skills")
  try {
    if (existsSync(skillsDir)) {
      skillCount = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .length
    }
  } catch { /* ignore */ }

  // Extract MCP server names
  let mcpServerNames: string[] = []
  if (mcporterConfig && typeof mcporterConfig === "object") {
    const servers = (mcporterConfig as Record<string, unknown>).mcpServers
    if (servers && typeof servers === "object") {
      mcpServerNames = Object.keys(servers as Record<string, unknown>)
    }
  }

  // Read cron jobs
  const cronData = readJsonSafe(join(HOME, ".openclaw", "cron", "jobs.json"))
  interface CronJobInfo {
    name: string
    enabled: boolean
    schedule: string
    lastStatus: string | null
    lastDurationMs: number | null
    nextRunAtMs: number | null
    consecutiveErrors: number
  }
  const cronJobs: CronJobInfo[] = []
  if (cronData && typeof cronData === "object" && Array.isArray((cronData as Record<string, unknown>).jobs)) {
    for (const job of (cronData as Record<string, unknown>).jobs as Array<Record<string, unknown>>) {
      const state = (job.state as Record<string, unknown>) ?? {}
      const schedule = (job.schedule as Record<string, unknown>) ?? {}
      cronJobs.push({
        name: job.name as string,
        enabled: job.enabled as boolean,
        schedule: schedule.expr as string,
        lastStatus: (state.lastStatus as string) ?? null,
        lastDurationMs: (state.lastDurationMs as number) ?? null,
        nextRunAtMs: (state.nextRunAtMs as number) ?? null,
        consecutiveErrors: (state.consecutiveErrors as number) ?? 0,
      })
    }
  }

  // Extract openclaw info
  const agents = (openclawConfig?.agents as Record<string, unknown>) ?? {}
  const defaults = (agents.defaults as Record<string, unknown>) ?? {}
  const modelConfig = (defaults.model as Record<string, unknown>) ?? {}
  const primaryModel = (modelConfig.primary as string) ?? "unknown"

  const heartbeatConfig = (defaults.heartbeat as Record<string, unknown>) ?? {}
  const heartbeatEvery = (heartbeatConfig.every as string) ?? "unknown"

  const channels = (openclawConfig?.channels as Record<string, unknown>) ?? {}
  const telegram = (channels.telegram as Record<string, unknown>) ?? {}
  const telegramEnabled = telegram.enabled === true

  // Check services
  const [gatewayUp, bridgeUp] = await Promise.all([
    checkPort(18789),
    checkPort(19300),
  ])

  // Parse devices
  const devices: Array<{ name: string; id: string }> = []
  if (Array.isArray(devicesJson)) {
    for (const d of devicesJson) {
      if (d && typeof d === "object" && "name" in d && "id" in d) {
        devices.push({ name: d.name as string, id: d.id as string })
      }
    }
  }

  // Format model name
  const modelDisplay = primaryModel
    .replace("anthropic/", "")
    .replace("claude-", "Claude ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())

  return NextResponse.json({
    machine: "MINIPC-HWLMX",
    services: {
      gateway: gatewayUp,
      bridge: bridgeUp,
      telegram: telegramEnabled,
      tailscale: true, // installed and configured
      tailscaleIp: "100.79.59.30",
    },
    devices,
    capabilities: {
      model: modelDisplay,
      skills: skillCount,
      mcp: mcpServerNames.length,
      mcpServers: mcpServerNames,
      heartbeat: heartbeatEvery,
    },
    cronJobs,
  })
}
