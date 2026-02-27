// === JARVIS State ===

export type JarvisState = "idle" | "processing" | "listening" | "speaking" | "disconnected"

// === Message Types ===

export type Message =
  | SeparatorMessage
  | BriefingMessage
  | UserMessage
  | JarvisVoiceMessage
  | ProactiveMessage

export interface SeparatorMessage {
  id: string
  type: "separator"
  label: string
}

export interface BriefingMessage {
  id: string
  type: "briefing"
  text: string
  date: string
  timestamp: string
}

export interface UserMessage {
  id: string
  type: "user"
  text: string
  timestamp: string
}

export interface JarvisVoiceMessage {
  id: string
  type: "jarvis"
  voice?: { text: string }
  displays?: DisplayCard[]
  actions?: ActionIndicator[]
  artifacts?: ArtifactRef[]
  pipeline?: PipelineState
  memory?: MemoryStats
  timestamp: string
}

export interface ProactiveMessage {
  id: string
  type: "proactive"
  voice: { text: string }
  severity: "info" | "warning" | "critical"
  timestamp: string
}

// === Embedded Data Types ===

export interface DisplayCard {
  title: string
  content: string
}

export interface ArtifactRef {
  type: string
  title: string
  language?: string
  content: string
}

export interface ActionIndicator {
  text: string
}

export interface PipelineState {
  name: string
  steps: Array<{
    label: string
    done: boolean
    active: boolean
  }>
}

export interface MemoryStats {
  preferences: number
  lessons: number
  patterns: number
  openItems: number
}

// === System Data Types ===

export interface SubAgent {
  id: string
  label: string
  status: "running" | "completed" | "failed" | "queued"
  elapsed: number
}

export interface OpenItem {
  text: string
  since: string
  stale: boolean
}

export interface Service {
  name: string
  detail: string
  online: boolean
}

export interface Device {
  id: string
  name: string
  online: boolean
  primary: boolean
  os?: string
  ip?: string
  capabilities?: string[]
  bridgeId?: string
  source?: "tailscale" | "bridge" | "both"
}

export interface CronJob {
  name: string
  next: string
  ok: boolean | null
  schedule: string
  enabled: boolean
  message: string
  model: string
  delivery: string
  lastRunAt: string
  lastDuration: string
  consecutiveErrors: number
}

export interface TrustEntry {
  category: string
  level: "Advisory" | "Guided" | "Autonomous"
}

export interface AttentionItem {
  id: string
  text: string
  severity: "info" | "warning" | "critical"
}

// === Bridge Device Types ===

export interface BridgeDevice {
  id: string
  name: string
  token: string
  createdAt: string
  capabilities?: string[]
  connected?: boolean
}
