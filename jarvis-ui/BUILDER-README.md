# JARVIS Workspace UI — Builder Handoff

## What This Is

The frontend interface for JARVIS — a 24/7 AI entity that controls remote devices, monitors systems, has persistent memory, and speaks with a British AI butler personality. This is the web-based workspace UI that runs on any connected device (Deep Node) and communicates with JARVIS Core through the Bridge service.

This is NOT a chatbot interface. It's a command workspace for a multi-device AI system.

## Architecture Context

```
┌─────────────────────────────────────────────────────────┐
│ JARVIS Machine (MINIPC-HWLMX, 100.64.0.1)              │
│                                                         │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ OpenClaw Gateway  │  │ JARVIS Bridge (:19300)      │  │
│  │ (localhost:18789) │◄─┤ - WebSocket server          │  │
│  │ THE BRAIN         │  │ - Routes chat to/from Core  │  │
│  └──────────────────┘  │ - Proxies MCP tool calls    │  │
│                         │ - Manages device registry   │  │
│                         └──────────┬──────────────────┘  │
│                                    │ Tailscale Network   │
└────────────────────────────────────┼─────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────┐
          │                          │                  │
    ┌─────▼─────┐            ┌──────▼──────┐    ┌──────▼──────┐
    │ ThinkPad  │            │  Pixel 9    │    │ Pi Cluster  │
    │ Deep Node │            │  Deep Node  │    │  Headless   │
    │           │            │             │    │             │
    │ ┌───────┐ │            │ ┌─────────┐ │    │ No UI       │
    │ │THIS UI│ │            │ │ THIS UI │ │    │ SSH only    │
    │ └───────┘ │            │ └─────────┘ │    └─────────────┘
    └───────────┘            └─────────────┘
```

This UI runs on the Device Agent (port 19222) on each Deep Node. It connects to the Bridge via WebSocket over the Tailscale mesh network. See GATEWAY.md for the full specification.

## Quick Start

```bash
cd jarvis-ui
npm install
npm run dev
```

Opens at `http://localhost:19222` (change port in next.config if needed).

## Project Structure

```
jarvis-ui/
├── app/
│   ├── globals.css          # All CSS — theme tokens, glass variables, animations
│   ├── layout.tsx           # Root layout, dark mode, Geist fonts
│   └── page.tsx             # Renders <JarvisWorkspace />
├── components/
│   └── jarvis/
│       ├── workspace.tsx    # Root component — ambient glow, layout shell
│       ├── sidebar.tsx      # Device list, activity feed, clock
│       ├── top-bar.tsx      # Processing indicator, voice bars
│       ├── message-stream.tsx  # Conversation stream with all message types
│       ├── input-bar.tsx    # Text/voice input, status strip
│       └── orb.tsx          # JARVIS presence indicator
├── lib/
│   └── utils.ts             # cn() helper (clsx + tailwind-merge)
└── package.json
```

## Component Hierarchy

```
<JarvisWorkspace>
  ├── Ambient glow backgrounds (CSS, not components)
  ├── <JarvisSidebar>
  │   ├── <JarvisOrb size="md" />
  │   ├── Device cards (from Bridge registry)
  │   ├── Recent activity feed (from Bridge events)
  │   └── Clock (ACDT timezone)
  ├── <TopBar>
  │   ├── Sidebar toggle
  │   ├── Processing indicator (with mini <JarvisOrb />)
  │   └── Voice activity bars
  ├── <MessageStream>
  │   ├── <BriefingCard />      — morning briefing, daily ritual
  │   ├── <DateSep />           — "Today" separator
  │   ├── <UserBubble />        — user messages (right-aligned, blue)
  │   ├── <JarvisResponse />    — three-pillar: voice + display + action
  │   ├── <ProactiveCard />     — JARVIS-initiated alerts (amber/red)
  │   └── <TypingIndicator />   — bouncing dots while processing
  └── <InputBar>
      ├── Mic button (voice input toggle)
      ├── Text input with glow-on-focus
      ├── Send button (activates when text entered)
      └── Status strip (primary device, voice state, trust level)
```

## Design System

### Theme

Dark-only. Near-black background with a blue ambient glow at the top suggesting JARVIS's presence. All surfaces are frosted glass (backdrop-blur + low-opacity backgrounds). One accent color: blue (#60a5fa in oklch space).

### Glass Treatment

Every panel uses the glass pattern:
- `backdrop-blur-2xl` (or `backdrop-blur-xl` for lighter surfaces)
- Background: white at 3-6% opacity (via `--glass` CSS variable)
- Border: white at 8% opacity (via `--glass-border`)
- Hover: border brightens to `--glass-border-high`

### Typography Hierarchy

Using Geist (sans) and Geist Mono:
- **JARVIS name**: 24px, extrabold, 0.14em tracking, gradient text (metallic)
- **Section labels**: 9-10px, semibold, uppercase, 0.25em tracking, very dim
- **Body/messages**: 15px, normal weight, -0.01em tracking
- **Timestamps**: 10px, dim
- **Clock**: 30px, extralight, tabular-nums
- **Metrics**: 20px, semibold, monospace

### Color Usage

| Token | Usage |
|-------|-------|
| `primary` (blue) | JARVIS orb, active indicators, input focus, display card titles |
| `emerald-400` | Online status dots, completion checkmarks |
| `amber-400/500` | Warning-level proactive alerts |
| `red-400/500` | Critical alerts, low battery |
| `foreground/90` | Primary text |
| `muted-foreground/40` | Secondary text, metadata |
| `muted-foreground/25` | Timestamps, barely-there text |

### Animations

All animations are slow, smooth, deliberate. No bouncing or playfulness.

| Animation | Element | Duration | Notes |
|-----------|---------|----------|-------|
| `orb-breathe` | JARVIS orb | 5s | Scale 1→1.1, opacity pulse. The soul. |
| `orb-glow` | JARVIS orb | 5s | Box-shadow pulse with triple glow layers |
| `ambient-glow` | Background | 8s | Subtle opacity cycle on background gradient |
| `pulse-dot` | Status dots | 3s | Opacity + glow pulse for online devices |
| `processing` | Top bar dot | 2.5s | Scale + opacity for thinking state |
| `stagger-fade-up` | Lists | 0.6s | Cascading entrance with blur→clear |
| `card-reveal` | Glass cards | 0.5s | Slide + scale + blur entrance |
| `bubble-pop-right` | User msgs | 0.5s | Pop in from right with slight overshoot |
| `slide-in-left` | JARVIS msgs | 0.55s | Slide in from left |
| `shimmer-sweep` | Glass surfaces | 3s | Light sweep across surface |
| `scan-line` | Display cards | 4s | Blue line sweeps down card |
| `glow-ring-pulse` | Input focus | 2.5s | Blue glow ring when typing |
| `alert-pulse` | Warnings | 2.5s | Amber glow pulse |
| `metric-pop` | Metric values | 0.45s | Scale pop for numbers |
| `progress-fill` | Progress bars | 1.2s | Width animation |
| `typing-bounce` | Typing dots | 1.4s | Staggered bounce |

## Integration Points

### 1. WebSocket Connection to Bridge

Replace the sample data with live WebSocket connection to the Bridge service.

```typescript
// Connection to JARVIS Bridge
const ws = new WebSocket("ws://100.64.0.1:19300")

// Authenticate
ws.send(JSON.stringify({
  type: "auth",
  token: storedToken || null,  // null for first-time pairing
  device: {
    name: hostname,
    type: "deep",
    capabilities: ["screen_capture", "type_text", "click", ...]
  }
}))

// Receive messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  switch (msg.type) {
    case "response":         // JARVIS response — add to message stream
    case "tool_call":        // Execute local tool — return result
    case "primary_changed":  // Update primary indicator
    case "ping":             // Respond with pong
  }
}

// Send user message
ws.send(JSON.stringify({
  type: "chat",
  text: inputText,
  context: { active_app, screen_visible }
}))
```

### 2. Message Types → Components

The Bridge sends JARVIS responses with three pillars:

```typescript
interface JarvisResponse {
  type: "response"
  voice_text: string          // → JarvisResponse voice bubble
  display?: DisplayContent[]  // → JarvisResponse display cards
  actions?: ActionLog[]       // → JarvisResponse action indicators
  cartesia_params?: object    // → Pass to local TTS engine
}
```

Map these directly to the `JarvisMessage` type in `message-stream.tsx`.

### 3. Device Registry → Sidebar

The Bridge maintains a device registry. On connection, request the current state:

```typescript
// Bridge pushes device updates
{ type: "device_update", devices: Device[] }

// Pass to sidebar
<JarvisSidebar devices={liveDevices} activity={liveActivity} />
```

### 4. Voice Pipeline

The input bar has a mic button. Wire this to:
1. Start recording (browser MediaRecorder API)
2. Run STT (Deepgram WebSocket or local Whisper)
3. Send transcript as chat message
4. Receive response with `cartesia_params`
5. Call Cartesia API locally → play audio

### 5. Proactive Messages

The Bridge pushes proactive messages when JARVIS speaks unprompted:

```typescript
{ type: "proactive", severity: "warning", voice_text: "...", timestamp: "..." }
```

These render as `ProactiveCard` in the message stream.

### 6. Trust Level

The input bar displays the current trust level. This comes from the Bridge's device registry for the current device. Trust levels: `autonomous`, `standard`, `restricted`, `observer`.

## Build Notes

- **Dark mode only** — the `html` element has `className="dark"` hardcoded. No theme toggle.
- **Geist fonts** — loaded via `next/font/google`. If fonts don't load, the CSS falls back to system-ui.
- **No external UI libraries** — just Tailwind + custom CSS. The shadcn/ui components directory from v0 is included but the JARVIS components don't depend on them. Use them for future modal/dialog/dropdown needs.
- **All animations are CSS** — no animation libraries. Keeps the bundle small and the performance smooth.
- **The orb is the soul** — if you change nothing else, make sure the orb looks alive. It's the single element that communicates "there's an intelligence here."

## Ports

| Service | Port | Notes |
|---------|------|-------|
| OpenClaw Gateway | 18789 | JARVIS brain, localhost only |
| JARVIS Bridge | 19300 | WebSocket, Tailscale network |
| Bridge MCP | 19301 | MCP proxy endpoint |
| **Agent UI (this)** | **19222** | **This workspace, local to device** |

## What Comes Next

1. **WebSocket integration** — Replace sample data with live Bridge connection
2. **Voice pipeline** — Mic recording → STT → chat → TTS playback
3. **MCP tool execution** — Handle tool_call messages from Bridge, execute locally, return results
4. **Event pushing** — Send app switches, battery changes, screen locks to Bridge
5. **Display card library** — Build more display card types (code blocks, file trees, charts, image displays)
6. **Settings panel** — Trust level management, device name, voice preferences
7. **Mobile optimization** — The sidebar collapses, but the full mobile experience needs refinement
