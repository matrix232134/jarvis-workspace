# Environment Notes

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

## Not Yet Installed — Future Services

These are planned but NOT currently available. Do not attempt to query these.

### Langfuse (LLM Observability)
- URL: http://localhost:3000 (when configured)
- Tracks: token usage, costs per session, latency, prompt performance
- API: Langfuse Node SDK
- Used by: morning-briefing (daily cost report), self-improvement-review (monthly analysis)

### Uptime-Kuma (Service Monitoring)
- URL: http://localhost:3001 (when configured)
- Monitors: gateway health, MCP server availability, external API endpoints
- Alerts: webhook to OpenClaw gateway for integration with heartbeat cycle
- Used by: heartbeat (gather observations step), system-health skill
