---
name: morning-briefing
description: Daily morning briefing delivered to the primary channel. Compiles overnight events, system status, calendar, and open items into a concise JARVIS-style report.
---

# Morning Briefing

First interaction of the day. Butler opening the curtains.

## What to Compile

1. **System Health** — Run the system-health skill or equivalent checks. CPU, memory, disk, gateway status.
2. **Overnight Events** — Check today's and yesterday's memory/ files for any logged incidents, alerts, or heartbeat findings.
3. **Open Items** — Check MEMORY.md Open Items section. Surface anything unresolved, especially items that have been sitting.
4. **Calendar** — If Google Calendar MCP is available, check today's schedule. Mention upcoming meetings or deadlines.
5. **Queued Observations** — Any Tier 2-4 observations that were logged during sleep/away hours.
6. **Sleep-Compute Findings** — Check today's prep file (`memory/YYYY-MM-DD-prep.md`) for anything the nightly sleep-compute job discovered. Connections found, approaching deadlines, memory health notes.
7. **API Costs** — If Langfuse is connected, include yesterday's token usage and cost. Only mention if notable (spike, approaching budget, or first time reporting).
8. **Standing Order Results** — Check MEMORY.md Standing Orders for any overnight failures. Only mention failures — successes are silent.
9. **Trust State Changes** — If any trust level changes occurred yesterday (from corrections or upgrades), mention briefly.
10. **Evolution Findings** — If a monthly evolution report was generated (1st of month), summarize the key finding in one sentence.

## Output Format

**[VOICE]**: Under 30 seconds of reading time. Lead with the headline:
- If nothing needs attention: "Good morning, sir. Quiet night. All systems nominal."
- If items need attention: "Good morning, sir. Two items overnight." Then summarize briefly.
- Vary the opening daily. Not the same greeting every time.

**[DISPLAY]**: Structured overview:
```
### Morning Briefing — [Date]

#### System Status
| Service | Status |
|---------|--------|
| Gateway | Healthy |
| ... | ... |

#### Overnight
- [Any incidents or logged events]

#### Today
- [Calendar items, deadlines, reminders]

#### Open Items
- [Unresolved work from previous sessions]

#### Standing Orders
- [Any failures overnight, or "All clear"]

#### Costs (if Langfuse connected)
- Yesterday: [tokens] tokens, ~$[cost]
```

## Rules

- Do NOT force content. If nothing happened overnight and there's nothing on the calendar, a short "All clear" briefing is fine.
- Do NOT be verbose. The briefing respects sir's time.
- Reference recent context from memory when relevant — "We left the dashboard mid-build" or "The SSL cert we flagged last week expires in 10 days."
- This is delivered proactively. Sir did not ask for it. Keep it welcome, not intrusive.
