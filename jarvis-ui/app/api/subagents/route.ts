import { NextResponse } from "next/server"
import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from "node:fs"
import { join, dirname } from "node:path"
import { readdirSync } from "node:fs"

const HOME = process.env.USERPROFILE || process.env.HOME || ""
const SESSIONS_DIR = join(HOME, ".openclaw", "agents", "main", "sessions")
const SESSIONS_PATH = join(SESSIONS_DIR, "sessions.json")

export const dynamic = "force-dynamic"

type SubAgentStatus = "running" | "completed" | "failed" | "stalled"

interface SubAgentInfo {
  id: string
  label: string
  ageSeconds: number
  status: SubAgentStatus
}

/**
 * Read the last N bytes of a file and return the last non-empty line.
 */
function readLastLine(filePath: string, tailBytes = 4096): string | null {
  try {
    const stat = statSync(filePath)
    if (stat.size === 0) return null

    const readSize = Math.min(tailBytes, stat.size)
    const buffer = Buffer.alloc(readSize)
    const fd = openSync(filePath, "r")
    readSync(fd, buffer, 0, readSize, stat.size - readSize)
    closeSync(fd)

    const text = buffer.toString("utf-8")
    const lines = text.split("\n").filter((l) => l.trim().length > 0)
    return lines.length > 0 ? lines[lines.length - 1] : null
  } catch {
    return null
  }
}

/**
 * Determine sub-agent status by inspecting its session JSONL file.
 */
function detectStatus(sessionId: string, updatedAt: number, now: number): SubAgentStatus {
  const sessionFile = join(SESSIONS_DIR, `${sessionId}.jsonl`)

  // Check for deleted session file (failed/cleaned up)
  try {
    const files = readdirSync(SESSIONS_DIR)
    const deleted = files.find((f) => f.startsWith(`${sessionId}.jsonl.deleted`))
    if (deleted) return "failed"
  } catch { /* ignore */ }

  if (!existsSync(sessionFile)) return "failed"

  // Check file modification time for activity detection
  let fileMtimeMs: number
  try {
    const stat = statSync(sessionFile)
    fileMtimeMs = stat.mtimeMs
  } catch {
    return "failed"
  }

  // Read the last line of the JSONL to check for completion markers
  const lastLine = readLastLine(sessionFile)
  if (lastLine) {
    try {
      const entry = JSON.parse(lastLine)

      // Completion marker: cache-ttl custom event
      if (entry.type === "custom" && entry.customType === "openclaw.cache-ttl") {
        return "completed"
      }

      // Completion marker: assistant message with stopReason
      if (entry.type === "message" && entry.message?.role === "assistant" && entry.message?.stopReason === "stop") {
        return "completed"
      }
    } catch { /* not valid JSON, check second-to-last */ }
  }

  // No completion marker found — check if still actively writing
  const fileAgeMs = now - fileMtimeMs
  if (fileAgeMs < 30_000) return "running"        // file modified <30s ago
  if (fileAgeMs < 120_000) return "stalled"        // 30s-2min with no completion

  return "stalled"
}

export async function GET() {
  try {
    if (!existsSync(SESSIONS_PATH)) {
      return NextResponse.json([])
    }

    const raw = readFileSync(SESSIONS_PATH, "utf-8")
    const sessions: Record<string, { sessionId: string; updatedAt: number; spawnDepth?: number }> = JSON.parse(raw)

    const now = Date.now()
    const subagents: SubAgentInfo[] = []
    let index = 1

    for (const [key, entry] of Object.entries(sessions)) {
      if (!key.includes("subagent:")) continue

      const ageMs = now - (entry.updatedAt ?? now)
      const ageSeconds = Math.round(ageMs / 1000)

      // Only include sub-agents from the last 5 minutes
      if (ageSeconds > 300) continue

      const status = detectStatus(entry.sessionId, entry.updatedAt, now)

      // Auto-hide completed/failed agents after 2 minutes
      if ((status === "completed" || status === "failed") && ageSeconds > 120) continue

      const shortId = key.split("subagent:")[1]?.substring(0, 8) ?? ""

      subagents.push({
        id: key,
        label: `Sub-agent #${index} (${shortId})`,
        ageSeconds,
        status,
      })
      index++
    }

    // Sort: running first, then stalled, then completed/failed — each group by most recent
    const statusOrder: Record<SubAgentStatus, number> = { running: 0, stalled: 1, completed: 2, failed: 3 }
    subagents.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.ageSeconds - b.ageSeconds)

    return NextResponse.json(subagents)
  } catch {
    return NextResponse.json([])
  }
}
