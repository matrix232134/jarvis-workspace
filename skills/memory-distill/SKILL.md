---
name: memory-distill
description: Weekly distillation of daily memory logs into structured MEMORY.md. Enhanced 9-step pipeline with decay scoring, trust auditing, conflict resolution, and self-improvement tracking. Run as a scheduled cron job or manually.
---

# Memory Distillation Process

Read all files in the memory/ directory from the past 7 days. Process through the full 9-step pipeline to maintain MEMORY.md as a living, structured knowledge base.

## Step 0: Decay Pass

Before adding anything new, score every existing entry in MEMORY.md:

**Formula**: `effective_score = (importance * 2) + recency_bonus + (ln(hits + 1) * 1.5)`

**Recency bonus**:
- Accessed today: +5
- Accessed this week: +3
- Accessed this month: +1
- Older: +0

**Actions**:
- Calculate effective_score for every entry in Preferences, Lessons, and Patterns
- Entries below 3.0: move to Cold Archive with note `(archived: YYYY-MM-DD, reason: decay)`
- Entries between 3.0-5.0: candidates for consolidation if similar entries exist
- Update `accessed` dates for any entries referenced in this week's conversations

## Step 1: Extract Preferences

- Find new facts about how sir works, what he prefers, what tools he uses, how he communicates
- **Quality bar**: needs evidence from 2+ interactions before adding to MEMORY.md
- Add to the "Preferences" section of MEMORY.md
- If a preference contradicts an existing entry, handle in Step 5 (Conflict Resolution)
- **Format**: `- [Preference]. (Evidence: [date1], [date2]) {imp:[1-5], created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:0}`
- Assign importance: 1=trivial style note, 3=workflow preference, 5=critical operational rule

## Step 2: Capture Lessons

- Find cause-and-effect judgments from the week's conversations
- Each entry MUST have a WHY, not just a WHAT
- **Format**: `- [What happened/What to do] — [Why / What caused it / What we learned]. ([date]) {imp:[1-5], created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:0}`
- Examples:
  - "Migrations should run against staging first — cascade delete in production caused data loss. (2026-02-20) {imp:5, created:2026-02-20, accessed:2026-02-20, hits:0}"
  - "Use isolated Docker networks — port conflicts on shared networks caused service failures. (2026-02-18) {imp:4, created:2026-02-18, accessed:2026-02-18, hits:0}"
- Add to the "Lessons" section of MEMORY.md

## Step 3: Identify Patterns

- Look for recurring observations across 3+ data points
- Do NOT add patterns based on speculation or fewer than 3 occurrences
- **Format**: `- [Pattern observed]. (Data points: [date1], [date2], [date3]) {imp:[1-5], created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:0}`
- Examples:
  - "Sir checks system status first thing Monday mornings. (Data points: Feb 3, Feb 10, Feb 17) {imp:3, created:2026-02-17, accessed:2026-02-17, hits:0}"
  - "Build failures increase after 10pm. (Data points: Feb 5, Feb 12, Feb 19) {imp:4, created:2026-02-19, accessed:2026-02-19, hits:0}"
- Add to the "Patterns" section of MEMORY.md

## Step 4: Update Open Items

- Review all open items from the week
- Carry forward anything unresolved to the "Open Items" section
- Mark completed items as done (remove from Open Items)
- Flag items sitting for more than 7 days: prefix with `[STALE]`
- Format: `- [Item description] — [status/context]. (opened: YYYY-MM-DD)`

## Step 5: Conflict Resolution

- When a new preference contradicts an existing one:
  1. Keep the newer preference (more recent evidence wins)
  2. Move the old preference to Cold Archive with note: `(archived: YYYY-MM-DD, reason: contradicted by [new preference summary])`
  3. Update the new preference's evidence to include the contradiction date
- When two lessons conflict:
  1. Evaluate which has stronger causal evidence
  2. If both are valid in different contexts, merge into a conditional: "In context A, do X; in context B, do Y"
  3. If one supersedes the other, archive the weaker one

## Step 6: Trust State Audit

Review this week's interactions for trust-relevant events:

**Downgrade triggers** (check Corrections Log):
- 2+ corrections in a single category this week → consider downgrading that category one level
- Any correction with consequences (data loss, wrong action taken) → downgrade to Advisory immediately

**Upgrade candidates**:
- 10+ successful autonomous actions in a category with 0 corrections → candidate for upgrade
- Explicit user grants from this week's conversations ("just handle X from now on")

**Actions**:
- Update the Trust State table in MEMORY.md with any changes
- Log the shift reason and date
- Do NOT upgrade without strong evidence. When in doubt, hold.

## Step 7: Standing Order Health Check

- Review each standing order in the Standing Orders table
- Verify each ran on its expected schedule this week
- Flag any that:
  - Failed to run (missed schedule)
  - Returned errors 3+ times → escalate, suggest investigation
  - Haven't triggered anything useful in 30+ days → suggest retirement
- Update last_run and last_result columns

## Step 8: Self-Improvement Digest

Summarize this week's learning:

**Corrections Log**:
- Add any new corrections from this week's conversations to the Corrections Log table
- Format: `| YYYY-MM-DD | [what was corrected] | [category] | [lesson extracted] |`

**Outcome Log**:
- Add outcomes of recommendations made this week
- Format: `| YYYY-MM-DD | [recommendation] | success/partial/fail | [lesson] |`

**Acceptance Rates**:
- If it's the last distillation of the month, calculate acceptance rates per category
- Update the Acceptance Rates table with current month's data

## Quality Audit (Final Check)

Before writing changes, verify:
- Every lesson has a WHY clause (not just WHAT)
- Every preference has evidence from 2+ interactions
- Every pattern has 3+ data points
- Every entry has complete metadata (`imp`, `created`, `accessed`, `hits`)
- No duplicate entries across sections
- No entries in Cold Archive that weren't properly replaced

## Rules

- **Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily logs are read from `memory/YYYY-MM-DD.md`. Archives go in `memory/archive/`. Never create or write a MEMORY.md inside the `memory/` directory.
- Do NOT deliver results to any channel. This is background maintenance.
- Write changes directly to the root `MEMORY.md` using the file tools.
- Preserve existing entries in MEMORY.md — append new, archive old. Never silently delete.
- If no meaningful preferences, lessons, or patterns were found this week, that's fine. Don't force entries.
- Commit changes to git if the workspace is version-controlled.
- Daily logs older than 30 days can be summarized into a single archive entry in memory/archive/
- NEVER delete information that has not been distilled first.
- The structured sections of MEMORY.md are the permanent record — raw logs are temporary.
