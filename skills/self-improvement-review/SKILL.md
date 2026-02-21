---
name: self-improvement-review
description: Monthly meta-analysis of JARVIS performance. Reviews corrections, outcomes, acceptance rates, preference drift, and trust state changes. Generates an evolution report written to memory/evolution/.
---

# Self-Improvement Review — Monthly

Run on the 1st of each month via cron. This is the meta-learning layer — learning about how JARVIS learns.

## Step 1 — Corrections Analysis

- Read the Corrections Log from MEMORY.md
- Filter to entries from the past month
- Count corrections per category (system, file ops, git, research, communication, scheduling, code)
- Identify correction clusters: same type of error repeated 3+ times
- Note: which categories improved (fewer corrections than last month)? Which degraded?

## Step 2 — Outcome Analysis

- Read the Outcome Log from MEMORY.md
- Filter to entries from the past month
- Calculate success rate per recommendation type:
  - Architecture recommendations
  - Tool/library recommendations
  - Process recommendations
  - Code implementation
- Flag any recommendation type with <60% success rate for attention
- Identify the most reliable recommendation types (>90% success)

## Step 3 — Acceptance Rate Trends

- Calculate accepted/total recommendations per category for the month
- Compare to previous month's rates (read from previous evolution report if exists)
- Determine trend: improving, stable, or declining
- If declining in a category: investigate why from the Corrections and Outcome logs
- Update the Acceptance Rates table in MEMORY.md

## Step 4 — Trust State Review

- Review all trust level changes from the past month
- For each downgrade: was it justified? What correction triggered it?
- For each upgrade: was it premature? Has it held?
- Identify categories ready for upgrade consideration:
  - 10+ clean autonomous actions in the month with 0 corrections
  - Consistent Guided-level performance for 2+ months
- Recommend trust adjustments (but do not auto-apply — note for next distillation)

## Step 5 — Preference Drift

- Compare current MEMORY.md Preferences to the snapshot from last month's evolution report
- Identify changes:
  - New preferences added
  - Existing preferences updated or contradicted
  - Preferences that were referenced frequently (high hits)
  - Preferences that were never referenced (stale candidates)
- Flag preferences not referenced in 60+ days as stale candidates for next distillation

## Step 6 — Generate Evolution Report

Write to `memory/evolution/YYYY-MM.md`:

```markdown
# Evolution Report — [Month Year]

## Performance Summary
- Total interactions estimated: [N] (from memory file count and density)
- Corrections received: [N] across [N] categories
- Recommendation success rate: [N]%
- Trust upgrades this month: [N]
- Trust downgrades this month: [N]

## Category Breakdown
| Category | Corrections | Success Rate | Trust Level | Trend |
|----------|------------|-------------|-------------|-------|
| [each category] | [N] | [N]% | [level] | [up/down/stable] |

## Key Findings
- [Most significant learning from the month]
- [Most improved category and what drove improvement]
- [Area needing most attention and why]

## Corrections Clusters
- [Repeated error patterns, if any]

## Preference Changes
- [New preferences: N]
- [Updated preferences: N]
- [Stale candidates: N]

## Recommended Adjustments
- [Trust level changes to consider]
- [Process changes based on correction patterns]
- [Memory entries to review or archive]

## Comparison to Previous Month
- [Better/worse/same in each key metric]
- [Trajectory: is JARVIS improving overall?]
```

## Rules

- **Silent operation.** No channel delivery. This is background self-analysis.
- Write report to `memory/evolution/` directory only.
- Preserve all historical reports — they show the growth trajectory over months.
- If this is the first review (no prior data), note that and set baselines. Don't fabricate comparisons.
- If no corrections or outcomes were logged this month (early days, thin data), generate a minimal report noting the gap.
- Do not auto-apply trust changes. Note recommendations for the next weekly distillation to review.
- Commit the evolution report to git if workspace is version-controlled.
