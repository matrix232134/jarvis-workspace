import type {
  Message,
  SubAgent,
  OpenItem,
  Service,
  Device,
  CronJob,
  TrustEntry,
} from "./types"

export const mockMessages: Message[] = [
  {
    id: "sep-1",
    type: "separator",
    label: "Today",
  },
  {
    id: "briefing-1",
    type: "briefing",
    text: "Good morning, sir. All systems nominal. The gateway processed 2,847 requests overnight with a 99.97% success rate. Three standing orders executed without incident. The Cartesia TTS endpoint showed a brief latency spike at 03:14 ACDT but self-corrected within ninety seconds. Your SSL certificates for the primary domain renew in eleven days. I have compiled the cost report for the past billing cycle\u2014compute spend is down 12% month-over-month following the model routing optimisation we implemented Tuesday.",
    date: "Sunday, 23 February 2026",
    timestamp: "07:00",
  },
  {
    id: "user-1",
    type: "user",
    text: "How's the gateway?",
    timestamp: "09:14",
  },
  {
    id: "jarvis-1",
    type: "jarvis",
    voice: {
      text: "The gateway is running well, sir. All four core services are online. Here are the current metrics:",
    },
    displays: [
      {
        title: "Gateway Health",
        content:
          "Service          Status    Latency    Uptime\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nOpenClaw API     Online     42ms      99.97%\nBridge WS        Online     12ms      100.0%\nVoice Pipeline   Online     89ms      99.91%\nTelegram Bot     Online     31ms      99.99%\n\nRequests (24h):   2,847\nErrors (24h):         1\nAvg Response:      47ms",
      },
    ],
    timestamp: "09:14",
  },
  {
    id: "user-2",
    type: "user",
    text: "Run pre-flight on voice integration",
    timestamp: "09:16",
  },
  {
    id: "jarvis-2",
    type: "jarvis",
    voice: {
      text: "Initiating pre-flight sequence for voice integration. I will assess each dependency in order:",
    },
    pipeline: {
      name: "Pre-Flight: Voice Integration",
      steps: [
        { label: "Check Deepgram STT connection", done: true, active: false },
        { label: "Validate Cartesia TTS endpoint", done: true, active: false },
        { label: "Test streaming orchestrator", done: false, active: true },
        { label: "Verify audio codec pipeline", done: false, active: false },
        { label: "End-to-end latency benchmark", done: false, active: false },
      ],
    },
    timestamp: "09:16",
  },
  {
    id: "user-3",
    type: "user",
    text: "What's in memory from last session?",
    timestamp: "09:22",
  },
  {
    id: "jarvis-3",
    type: "jarvis",
    voice: {
      text: "From yesterday's session I retained the following. The pattern recognition engine identified a recurring preference for abbreviated status reports during morning interactions.",
    },
    memory: {
      preferences: 34,
      lessons: 18,
      patterns: 7,
      openItems: 3,
    },
    timestamp: "09:22",
  },
  {
    id: "user-4",
    type: "user",
    text: "Draft the integration plan",
    timestamp: "09:25",
  },
  {
    id: "jarvis-4",
    type: "jarvis",
    voice: {
      text: "I have drafted an initial integration plan and spawned a research agent to gather current Cartesia API documentation. The plan is available for your review.",
    },
    artifacts: [
      {
        type: "diagram",
        title: "Voice Integration Plan",
        language: "mermaid",
        content:
          "graph TD\n  A[Deepgram STT] -->|Stream| B[Orchestrator]\n  B -->|Text| C[OpenClaw Gateway]\n  C -->|Response| D[Cartesia TTS]\n  D -->|Audio Stream| E[Client Playback]\n  B -->|Fallback| F[Whisper Local]\n  C -->|Cache| G[Redis Layer]",
      },
    ],
    actions: [
      { text: "spawn: research-agent \u2014 Cartesia API documentation" },
      { text: "draft: voice-integration-plan.md" },
    ],
    timestamp: "09:25",
  },
]

export const mockSubAgents: SubAgent[] = [
  {
    id: "agent-1",
    label: "Cartesia API Research",
    status: "running",
    elapsed: 127,
  },
  {
    id: "agent-2",
    label: "Integration Plan Draft",
    status: "running",
    elapsed: 43,
  },
]

export const mockOpenItems: OpenItem[] = []

export const mockServices: Service[] = [
  { name: "OpenClaw Gateway", detail: ":18789", online: true },
  { name: "JARVIS Bridge", detail: ":19300", online: true },
  { name: "Voice Service", detail: ":19400", online: true },
  { name: "Telegram Bot", detail: ":19500", online: true },
]

export const mockDevices: Device[] = [
  { id: "dev-1", name: "ThinkPad", online: true, primary: true },
  { id: "dev-2", name: "Pixel 9", online: true, primary: false },
]

export const mockCronJobs: CronJob[] = [
  { name: "Morning Briefing", next: "21h 36m", ok: true },
  { name: "Daily Backup", next: "16h 46m", ok: true },
  { name: "Memory Distill", next: "6d 4h", ok: null },
]

export const mockTrustEntries: TrustEntry[] = [
  { category: "System Maintenance", level: "Autonomous" },
  { category: "File Operations", level: "Guided" },
  { category: "Git Operations", level: "Guided" },
  { category: "Research", level: "Autonomous" },
  { category: "Code Generation", level: "Advisory" },
]

export const mockSkills: string[] = [
  "memory-distill",
  "orchestration-engine",
  "self-expansion",
  "system-health",
  "observation-engine",
  "standing-order-manager",
  "sleep-compute",
  "morning-briefing",
  "self-improvement-review",
]
