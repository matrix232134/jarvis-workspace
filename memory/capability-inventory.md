# Capability Inventory — 2026-02-23 09:16

## Available and Verified
| Capability | Provider | Last Verified | Status |
|-----------|----------|---------------|--------|
| File read/write | Workspace filesystem | 2026-02-23 09:16 | healthy |
| Shell commands | Native PowerShell/Bash | 2026-02-23 09:16 | healthy |
| OpenClaw CLI | npm-installed | 2026-02-23 09:16 | healthy |

## Configured but Untested
| Capability | Provider | Status | Notes |
|-----------|----------|--------|-------|
| Web search (Brave) | Browser tool | unchecked | Available via web_search tool |
| Web search (Tavily) | Research tool | unchecked | Available via tavily_search tool |
| Web crawl/extract | Research tool | unchecked | Available via tavily_* tools |
| Browser automation | Browser tool | unchecked | Available via browser tool |
| MCP servers | via OpenClaw gateway | unchecked | Status unknown |
| Sub-agents | sessions_spawn | unchecked | Capability depends on gateway config |

## Not Configured
| Capability | Category | Install/Config Required |
|-----------|----------|------------------------|
| SMS/Text messaging | Communication | Requires provider integration |
| Voice synthesis (TTS) | Audio | Available via tts tool (unchecked) |
| Vision/Image analysis | Media | Available via image tool (unchecked) |
| PDF manipulation | Document tools | nano-pdf skill available (unchecked) |
| Camera/RTSP | Hardware integration | camsnap skill available (unchecked) |
| Device sensors | IoT | nodes tool available (unchecked) |

## Capability Summary
- **Core available:** 3/3 (filesystem, shell, CLI)
- **Research-capable:** Yes (web_search, tavily, browser tools available)
- **Sub-agent capable:** Likely yes (sessions_spawn tool available; needs gateway verification)
- **Kimi-capable:** Possibly (kimi_upload_file tool present)
- **System health:** No anomalies detected

## Verification Queue
Next heartbeat cycle: test one capability per tier (web_search, sub-agent spawn, MCP server status) to build verified inventory.

---
*Lightweight heartbeat audit. Full capability-audit skill will run on gateway startup.*
