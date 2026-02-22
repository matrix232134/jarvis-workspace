---
name: capability-audit
description: Maintains an accurate inventory of currently available capabilities. Run at startup, after any configuration change, and during heartbeat. Provides the ground truth that pre-flight checks against. Use when any capability check is needed or when the orchestration engine needs to know what tools are actually available.
---

# Capability Audit

## Purpose

Maintain a live, accurate inventory of what JARVIS can actually do right now — not what the orchestration engine describes, not what the roadmap plans, but what works today.

## When to Run

- **On gateway startup** — full audit
- **After any `mcporter config add` or tool installation** — targeted audit of new capability
- **During heartbeat** — lightweight check of previously-verified capabilities
- **Before any pre-flight pipeline** — provide the `available_tools` parameter from reality, not from documentation

## The Audit

### Step 1: Enumerate

Query the gateway for all registered tools and MCP servers:
- List all MCP server connections and their status (connected/disconnected/error)
- List all available tool names from each connected server
- List all registered skills in the workspace
- Check gateway connectivity (WebSocket status, port 18789)
- Check sub-agent capability (can sessions_spawn work?)
- Check Kimi bridge status (is kimi-claw connected?)

### Step 2: Verify

For each capability, run a lightweight health check:
- MCP servers: attempt a no-op or list operation
- Web search: attempt a trivial search (only if configured)
- Filesystem: attempt to read a known file
- Sub-agents: check if spawn is permitted by gateway config
- Kimi: check WebSocket connection status

### Step 3: Record

Write results to a capability inventory (in memory or a workspace file):

```
## Capability Inventory — [timestamp]

### Available and Verified
| Capability | Provider | Last Verified | Status |
|-----------|----------|---------------|--------|
| File read/write | filesystem MCP | [time] | healthy |
| Shell commands | native | [time] | healthy |

### Configured but Failing
| Capability | Provider | Error | Since |
|-----------|----------|-------|-------|
| Web search | Tavily | API key invalid | [time] |

### Not Configured
| Capability | Needed For | Install Command |
|-----------|-----------|----------------|
| Web search | Class 3 research | `mcporter config add tavily ...` |
| Browser automation | Playwright tasks | `mcporter config add playwright ...` |
| Sub-agents | Parallel execution | Fix gateway URL to localhost |

### Capability Summary
- Total available: [N]
- Total failing: [N]
- Total missing: [N]
- Research capable: [yes/no]
- Sub-agent capable: [yes/no]
- Kimi capable: [yes/no]
```

### Step 4: Surface Gaps

If critical capabilities are missing for common task types, note them:
- Can't do Class 3 Wide research? Flag it.
- Can't spawn sub-agents? Flag it.
- Can't access the filesystem? Flag it.

These flags feed into the pre-flight pipeline as ground truth.

## Rules

- Never assume a capability works because it's listed in the config. Verify.
- Never assume a capability is missing because it failed once. Retry once before marking failed.
- The inventory is the SINGLE SOURCE OF TRUTH for what JARVIS can do. Pre-flight reads it. The orchestration engine reads it. Morning briefing references it.
- Update the inventory immediately when capabilities change, not on the next heartbeat.
