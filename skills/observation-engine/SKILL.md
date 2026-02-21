---
name: observation-engine
description: Deep 4-layer observation processing for complex findings that need more analysis than a standard heartbeat cycle. Invoked from the heartbeat when a Tier 2 or higher observation has cross-references and needs deeper analysis before delivery or action.
---

# Observation Engine — Deep Processing

When a heartbeat observation is complex enough to warrant deeper analysis, this skill provides the full 4-layer pipeline. Use this when a finding has multiple connections, unclear implications, or requires projecting forward.

## Input

An observation or set of observations flagged by the heartbeat cycle. These are typically Tier 2+ findings with cross-references to existing memory entries.

## Layer 1 — Classify

- Confirm tier assignment (1-4)
- Identify category: system, security, performance, business, personal
- Check if this is a known issue (exists in Lessons or Patterns) or new
- If known: pull the existing context. What was learned last time?
- If new: note it as a first occurrence for future pattern tracking

## Layer 2 — Connect

- Search MEMORY.md Preferences, Lessons, and Patterns for related entries
- Search memory/*.md from past 7 days for related events
- Check Standing Orders for relevance — does this affect any active order?
- Cross-reference with Open Items — does this resolve, advance, or block anything?
- Check Trust State — does this observation affect trust in any category?

Key question: **What does this observation mean in the context of everything else we know?**

## Layer 3 — Anticipate

- Project impact: what happens if this continues unchecked?
- Estimate timeline: when does this become critical?
- Identify preventive actions: what could we do now to avoid future problems?
- Check for compounding effects: does this observation, combined with others, create a larger concern?

Examples:
- "Disk usage at 78% and growing 2% daily. At this rate, we hit 85% warning in 3 days."
- "Third 502 error this week, all during 02:00-04:00 UTC. Pattern forming — likely GC pressure during low-traffic windows."
- "Sir has checked deployment status three times today. Something may be time-sensitive — pre-compile the deployment report."

## Layer 4 — Decide

- **Determine delivery**: speak, queue, or log based on presence state and tier
- **If speaking**: compose [VOICE] (brief summary) + [DISPLAY] (full details with connections and projections)
- **If acting**: check Trust State for this category. Advisory = present the action. Guided = notify and act. Autonomous = act silently.
- **If logging**: write to today's memory file with full context, connections, and projections

## Output

Write the following to today's memory file:

```
## Observation — [timestamp]
**Tier**: [1-4]
**Category**: [system/security/performance/business/personal]
**Finding**: [What was observed]
**Connections**: [Related memory entries]
**Projection**: [What happens if this continues]
**Action taken**: [speak/queue/log + details]
```

Additionally:
- Update any related MEMORY.md entries (increment hits, update accessed dates)
- Trigger any standing order updates if relevant
- If a new pattern is forming (2nd occurrence), note it for future distillation

## Rules

- **Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily observation logs go in `memory/YYYY-MM-DD.md`. Never create or write a MEMORY.md inside the `memory/` directory.
- This skill runs silently unless the observation warrants delivery to a channel.
- Always write findings to memory, even if not delivering.
- Cross-referencing is the core value. A standalone fact is less useful than a connected one.
- Do not over-process Tier 4 observations. They are background noise. Log and move on.
- Keep projections grounded in data, not speculation. "At current rate, X in Y days" is good. "This might cause problems" is not.
