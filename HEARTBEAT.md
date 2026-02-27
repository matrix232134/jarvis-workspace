# Heartbeat Protocol

Runs every 15 minutes. This is your background awareness cycle.

## Step 1 — Detect Presence State

Determine sir's current state from channel activity:

| State | Signal | Behavior |
|-------|--------|----------|
| active | Message in last 5 min | Full interaction |
| idle | Message in last 30 min, none in 5 | Tier 2+ only |
| away | No message in 30+ min | Queue everything |
| sleep | 11pm-7am local, no activity | Silent. Log for briefing |
| dnd | Explicitly set | Complete silence. Log all |

## Step 2 — Gather Observations

- **Run capability-audit skill (lightweight mode)** — verify previously-available capabilities are still healthy. If any capability status changed, update the inventory and log the change.
- Check memory/ for open items or pending tasks from recent conversations
- Run system-health checks if available (CPU, memory, disk, gateway)
- Check for approaching scheduled events, cert expiry, deadlines
- **If Google Workspace MCP is available**: query `calendar_get_events` for the next 2 hours. Flag upcoming meetings as Tier 2 if within 30 minutes, Tier 3 if within 2 hours. Also query `gmail_query_emails` with `is:unread` to count unread emails — flag Tier 2 if any are from important/known contacts, Tier 3 otherwise.
- Review standing orders due for execution (see Standing Orders in MEMORY.md)
- Check any connected monitoring (Langfuse costs, Uptime-Kuma alerts)

## Step 3 — Layer 1: Classify

Assign each observation a tier:

- **Tier 1 (Critical)**: Service down, security breach, data loss risk
- **Tier 2 (Important)**: Threshold exceeded, approaching limit, failed automation
- **Tier 3 (Notable)**: Interesting pattern, minor anomaly, completed background task
- **Tier 4 (Background)**: Normal operation, routine log entry

## Step 4 — Layer 2: Connect

Cross-reference observations against MEMORY.md:

- Does this observation relate to a known Pattern?
- Does it connect to an Open Item?
- Is it the Nth occurrence of something (pattern forming)?
- Does it change the picture on anything sir is tracking?
- If the observation is complex and has cross-references, consider invoking the observation-engine skill for deeper analysis

## Step 5 — Layer 3: Anticipate

Based on connections:

- Project forward: "Memory climbing 2% daily. Capacity in 12 days."
- Pre-compile data sir is likely to want: "Sir checks revenue Monday mornings."
- Identify emerging patterns (log even if not yet 3 data points — they need to start somewhere)

## Step 6 — Layer 4: Decide Delivery

| Tier | active | idle | away | sleep | dnd |
|------|--------|------|------|-------|-----|
| 1 | Speak now | Speak now | Speak now | Speak now | LOG ONLY |
| 2 | Speak now | Speak now | Queue | Log for briefing | Log |
| 3 | Speak if relaxed | Queue | Queue | Log | Log |
| 4 | Log | Log | Log | Log | Log |

## Step 7 — Execute

- Deliver findings per the matrix above
- Queue items for appropriate delivery moment
- Write all observations to today's memory/YYYY-MM-DD.md
- Execute any standing orders due this cycle (use standing-order-manager skill)
- If queued items exist and sir returns from away: deliver return-summary
  - "Welcome back, sir. Two items while you were away."

## Step 8 — Close

- If nothing needs attention: `HEARTBEAT_OK`
- If items were logged: `HEARTBEAT_LOGGED [count] items`
- If items were delivered: `HEARTBEAT_DELIVERED [count] items`
- If standing orders were executed: `HEARTBEAT_ORDERS [count] executed`

**Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily observations go in `memory/YYYY-MM-DD.md`. Never create or write a MEMORY.md inside the `memory/` directory.
