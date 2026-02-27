# Environment & Tools

## Platform
- OS: Windows 11 Pro
- Shell: PowerShell / Git Bash
- Node.js: v24.13.1

## Path Conventions
- Home: C:\Users\tyson
- Workspace: C:\Users\tyson\.openclaw\workspace
- Skills: C:\Users\tyson\.openclaw\workspace\skills

## Windows-Specific Commands
- Use `wmic` or `Get-Process` for system monitoring, not top/htop
- Use `icacls` for permissions, not chmod
- Use `netstat -ano` for port checking, not ss/netstat on Linux
- Use `tasklist` for process listing, not ps aux
- File paths use backslashes, but forward slashes work in most Node.js contexts

## Risky Commands — Require Confirmation
- `Remove-Item -Recurse -Force` — equivalent to rm -rf, use with extreme caution
- `Stop-Process -Force` — kills processes without graceful shutdown
- `Format-Volume` — destructive, never run without explicit confirmation
- Any command that deletes files, drops databases, or modifies system configuration

---

## Services

### OpenClaw Gateway
- Port: 18789 (loopback)
- Token auth enabled
- Config: ~/.openclaw/openclaw.json
- Tailscale: serve mode enabled — accessible at https://minipc-hwlmx-1.tail89fc92.ts.net

### JARVIS Bridge (Multi-Device Gateway)
- Location: C:\Users\tyson\jarvis-bridge
- Port: 19300 (WebSocket)
- Purpose: Routes chat from device agents to OpenClaw gateway
- Tailscale: exposed at wss://minipc-hwlmx-1.tail89fc92.ts.net:19300

### JARVIS UI (Workspace)
- Location: C:\Users\tyson\jarvis-ui
- Port: 19222 (Next.js)
- Tailscale: exposed at https://minipc-hwlmx-1.tail89fc92.ts.net
- Features: Canvas panel (Ctrl+,), Artifact panel, Library, System drawer

### Voice Service
- Port: 19301
- Wake word: OpenWakeWord (ONNX, browser-side)
- TTS: streaming via bridge

### Canvas Host
- Served via gateway at http://127.0.0.1:18789/__openclaw__/canvas/
- Agent can push content via canvas.a2ui.push command
- Embedded as iframe in Workspace UI right panel

---

## Plugins (OpenClaw Native)

| Plugin | Status | Purpose |
|--------|--------|---------|
| lobster | enabled | Typed workflow runtime — deterministic pipelines with YAML definitions |
| llm-task | enabled | Structured LLM calls with JSON schemas (default: claude-sonnet-4-5) |
| openclaw-tavily | enabled | Web search via Tavily API |
| telegram | enabled | Telegram bot channel for messaging |
| kimi-claw | enabled | Kimi bridge integration |
| stability | enabled | Loop detection, entropy monitoring, governance limits |
| continuity | enabled | Context budget management, session memory archival |
| openclaw-jarvis-device | enabled | Bridge device integration |

---

## MCP Servers (Available via mcporter)

### Google Workspace MCP
- **Server:** C:\Users\tyson\mcp-google-workspace\dist\server.js
- **Account:** tyson.so1122@gmail.com (OAuth2 authenticated)
- **CWD required:** C:\Users\tyson\mcp-google-workspace
- **Gmail tools:**
  - `gmail_query_emails` — search with Gmail syntax (is:unread, from:, newer_than:, etc.)
  - `gmail_get_email` — retrieve full email by ID
  - `gmail_bulk_get_emails` — batch email retrieval
  - `gmail_create_draft` — create drafts
  - `gmail_reply` — reply to emails
  - `gmail_archive` / `gmail_bulk_archive` — archive emails
- **Calendar tools:**
  - `calendar_list` — list accessible calendars
  - `calendar_get_events` — events by date range (RFC3339 format)
  - `calendar_create_event` — create events with attendees
  - `calendar_delete_event` — delete events
- **All tools require** `user_id: "tyson.so1122@gmail.com"` parameter
- **Invocation:** Run via stdio JSON-RPC (MCP protocol). From pipelines, use shell:
  ```
  cd C:\Users\tyson\mcp-google-workspace && printf '{"jsonrpc":"2.0","id":1,"method":"initialize",...}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"gmail_query_emails","arguments":{"user_id":"tyson.so1122@gmail.com","query":"is:unread","max_results":5}}}\n' | node dist/server.js
  ```

### Claude Code MCP
- **Command:** `claude mcp serve`
- **Tools:** Bash, Read, Write, Edit, Grep, Glob
- **Purpose:** Code operations for self-expansion — creating/modifying skills, workspace files
- **Max turns:** 25

### Other MCP Servers (mcporter.json)
- **filesystem** — read/write files on this machine (root: C:\Users\tyson)
- **playwright** — browser automation
- **tavily** — web search (also available as native openclaw-tavily plugin)
- **github** — GitHub API tools (PAT authenticated)

---

## Tailscale Network
- **This machine:** minipc-hwlmx-1 (100.79.59.30)
- **Tailnet:** tail89fc92.ts.net
- **Known devices:** iPhone 12 Pro (100.108.204.98)
- **Serve status:** UI on :443, Bridge on :19300
- **Check status:** `tailscale status --json`

---

## Lobster (Workflow Runtime)
- Location: C:\Users\tyson\lobster
- Globally linked: `lobster` command available
- Version: 2026.1.21-1
- Pipelines: ~/.openclaw/workspace/pipelines/*.yaml
- Active pipelines: morning-briefing, daily-backup

---

## Not Yet Installed — Future Services

These are planned but NOT currently available. Do not attempt to query these.

### Langfuse (LLM Observability)
- URL: http://localhost:3000 (when configured)
- Tracks: token usage, costs per session, latency, prompt performance

### Uptime-Kuma (Service Monitoring)
- URL: http://localhost:3001 (when configured)
- Monitors: gateway health, MCP server availability, external API endpoints
