---
name: standing-order-manager
description: Standing order (pyramid) lifecycle management — creation, execution, reporting, and retirement. Use when the owner asks to monitor something ongoing, when creating a recurring check, when reviewing active standing orders, or when the heartbeat detects a standing order needs attention.
---

# Standing Order Manager

## What Standing Orders Are

Recurring automated tasks that run on schedule without being asked. They are the pyramids — silent infrastructure that keeps things running.

Rule: **Silent success, vocal failure.**

## Lifecycle

### Create

Standing orders are created when:
- User explicitly requests one: "Monitor the SSL cert every day"
- JARVIS suggests one after 3+ repeated manual requests: "You've checked disk space three days running, sir. Standing order?"
- A new MCP server or integration makes a new check possible

**Definition format** (added to MEMORY.md Standing Orders table):
| Name | Schedule | Status | Last Run | Last Result |
|------|----------|--------|----------|-------------|
| [name] | [cron expression or frequency] | active | — | — |

Each order also has an implicit definition:
- **Check/Action**: What to do (e.g., "ping gateway on port 18789")
- **Success criteria**: What "normal" looks like (e.g., "connection succeeds in <500ms")
- **Failure action**: What to do on failure (e.g., "alert Tier 2, attempt restart")

### Execute

During each heartbeat cycle:
1. Check which standing orders are due based on their schedule
2. Run the check or action defined for each due order
3. Log the result to today's memory/YYYY-MM-DD.md
4. Update the Standing Orders table in MEMORY.md: set `last_run` to now, `last_result` to outcome

### Report

- **Success**: Log only. Never announce. The house is clean without being asked.
- **Failure**: Alert based on tier assignment (most standing order failures = Tier 2)
- **Repeated failure**: If the same order fails 3+ consecutive times:
  - Escalate to Tier 1
  - Suggest investigation: "Sir, the gateway health check has failed three times running. Worth investigating."
  - Log the pattern for distillation

### Retire

Standing orders are not permanent. Retire when:
- The order hasn't triggered anything useful in 30+ days
- The underlying system it monitors no longer exists
- A better monitoring solution has replaced it

**Retirement process**:
1. Suggest retirement: "The SSL cert monitor hasn't flagged anything in a month, sir. Auto-renew appears solid. Retire the standing order?"
2. User confirms → move from Standing Orders to Cold Archive with note
3. User declines → keep active, reset the 30-day counter

Never retire without asking. Standing orders are sir's intent made persistent.

## Default Standing Orders

Activate these when relevant tools and integrations are connected:

| Order | Trigger | Check | Threshold |
|-------|---------|-------|-----------|
| Gateway health | Every heartbeat | Test port 18789 | Connection refused = Tier 1 |
| Disk space trend | Daily | Check C: free space | >85% full = Tier 2 |
| Memory trend | Every heartbeat | Check RAM usage | >90% used = Tier 2 |
| SSL cert expiry | Daily | Check cert dates | <14 days = Tier 2 |

## Rules

- **Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily execution logs go in `memory/YYYY-MM-DD.md`. Never create or write a MEMORY.md inside the `memory/` directory.
- Never automate irreversible actions without explicit permission from sir
- Standing orders respect presence state — failures queue if sir is away/sleep (except Tier 1)
- Each order has a clear owner (JARVIS) and a clear escalation path (sir)
- Standing orders are tracked in MEMORY.md and survive across sessions
- The weekly standing-order-review cron job checks health of all orders
- Suggest new orders sparingly. One suggestion per session maximum.
