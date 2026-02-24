import { NextResponse } from "next/server"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
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

  // Count and list skills
  let skillCount = 0
  let skillNames: string[] = []
  const skillsDir = join(HOME, ".openclaw", "workspace", "skills")
  try {
    if (existsSync(skillsDir)) {
      const dirs = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
      skillCount = dirs.length
      skillNames = dirs.map((d) => d.name).sort()
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
    lastRunAtMs: number | null
    nextRunAtMs: number | null
    consecutiveErrors: number
    message: string
    model: string
    deliveryMode: string
    deliveryChannel: string
  }
  const cronJobs: CronJobInfo[] = []
  if (cronData && typeof cronData === "object" && Array.isArray((cronData as Record<string, unknown>).jobs)) {
    for (const job of (cronData as Record<string, unknown>).jobs as Array<Record<string, unknown>>) {
      const state = (job.state as Record<string, unknown>) ?? {}
      const schedule = (job.schedule as Record<string, unknown>) ?? {}
      const payload = (job.payload as Record<string, unknown>) ?? {}
      const delivery = (job.delivery as Record<string, unknown>) ?? {}
      cronJobs.push({
        name: job.name as string,
        enabled: job.enabled as boolean,
        schedule: schedule.expr as string,
        lastStatus: (state.lastStatus as string) ?? null,
        lastDurationMs: (state.lastDurationMs as number) ?? null,
        lastRunAtMs: (state.lastRunAtMs as number) ?? null,
        nextRunAtMs: (state.nextRunAtMs as number) ?? null,
        consecutiveErrors: (state.consecutiveErrors as number) ?? 0,
        message: (payload.message as string) ?? "",
        model: (payload.model as string) ?? "",
        deliveryMode: (delivery.mode as string) ?? "none",
        deliveryChannel: (delivery.channel as string) ?? "",
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

  // Get Tailscale devices (real network devices)
  interface TailscaleDevice {
    name: string
    id: string
    os: string
    online: boolean
    ip: string
    isSelf: boolean
  }
  const tailscaleDevices: TailscaleDevice[] = []
  let tailscaleOnline = false
  try {
    const raw = execSync("tailscale status --json", { timeout: 5000, encoding: "utf-8" })
    const ts = JSON.parse(raw)
    tailscaleOnline = ts.BackendState === "Running"

    // Add self
    if (ts.Self) {
      tailscaleDevices.push({
        name: ts.Self.HostName,
        id: ts.Self.ID,
        os: ts.Self.OS ?? "unknown",
        online: ts.Self.Online === true,
        ip: ts.Self.TailscaleIPs?.[0] ?? "",
        isSelf: true,
      })
    }

    // Add peers
    if (ts.Peer && typeof ts.Peer === "object") {
      for (const peer of Object.values(ts.Peer) as Array<Record<string, unknown>>) {
        tailscaleDevices.push({
          name: peer.HostName as string,
          id: peer.ID as string,
          os: (peer.OS as string) ?? "unknown",
          online: peer.Online === true,
          ip: (peer.TailscaleIPs as string[])?.[0] ?? "",
          isSelf: false,
        })
      }
    }
  } catch { /* tailscale not available */ }

  // Detect voice service from bridge devices
  let voiceServiceRegistered = false
  if (Array.isArray(devicesJson)) {
    for (const d of devicesJson) {
      if (d && typeof d === "object" && "name" in d) {
        if ((d.name as string).toLowerCase().includes("voice")) {
          voiceServiceRegistered = true
        }
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
      voiceService: voiceServiceRegistered,
      telegram: telegramEnabled,
      tailscale: tailscaleOnline,
      tailscaleIp: tailscaleDevices.find((d) => d.isSelf)?.ip ?? "",
    },
    devices: tailscaleDevices,
    capabilities: {
      model: modelDisplay,
      skills: skillCount,
      skillNames,
      mcp: mcpServerNames.length,
      mcpServers: mcpServerNames,
      heartbeat: heartbeatEvery,
    },
    cronJobs,
  })
}
