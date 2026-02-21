---
name: sleep-compute
description: Nightly memory consolidation and tomorrow-preparation. Runs at 3am. Cross-references daily entries, maintains memory metadata, prepares briefing data for the morning. Silent operation.
---

# Sleep-Compute — Nightly Consolidation

Runs during sleep hours (default 3am). This is JARVIS thinking while sir sleeps — consolidating the day's knowledge and preparing for tomorrow.

## Step 1: Cross-Reference Today's Entries

- Read today's memory file (`memory/YYYY-MM-DD.md`)
- For each logged event, search MEMORY.md for connections:
  - Does this relate to an existing Pattern? If so, note the connection.
  - Does this reinforce or contradict a Preference? Flag for next distillation.
  - Does this provide evidence for a Lesson? Note the supporting data.
  - Does this connect to an Open Item? Update the item's context.
- Write connections found to the memory file as annotations

## Step 2: Prepare Tomorrow

- Check calendar (if Google Calendar MCP is available) for tomorrow's schedule
- Check known patterns for tomorrow's day-of-week:
  - What does sir typically do on this day? (from Patterns section)
  - Any recurring tasks or check-ins?
- Check approaching deadlines:
  - Open Items with due dates within 3 days
  - Standing orders with upcoming milestones
  - Cert expiry, subscription renewals, etc.
- Check if any weekly/monthly jobs are due tomorrow

## Step 3: Memory Maintenance

- Increment `hits` on any MEMORY.md entries that were referenced in today's conversations
- Update `accessed` dates for referenced entries
- Check for entries that haven't been accessed in 30+ days — flag as decay candidates for next distillation
- Verify MEMORY.md file integrity (no broken markdown, no orphaned entries)

## Step 4: Generate Tomorrow-Prep Note

Write to `memory/YYYY-MM-DD-prep.md` (tomorrow's date):

```markdown
# Briefing Prep — [Tomorrow's Date]

## Calendar
- [Items from calendar, or "No calendar integration" if unavailable]

## Day Patterns
- [Known patterns for this day of week, or "No patterns yet"]

## Approaching Deadlines
- [Items due within 3 days]

## Connections Found
- [Cross-references discovered in Step 1]

## Memory Health
- [Entries flagged for decay: N]
- [Entries without metadata: N]
- [Duplicates found: N]
```

## Step 5: Quality Audit

Scan MEMORY.md for issues:
- Entries missing metadata (`imp`, `created`, `accessed`, `hits`) — add defaults where possible
- Duplicate entries across sections — flag for merge in next distillation
- Contradictions between entries — flag for conflict resolution
- Patterns with fewer than 3 data points that have been sitting for 14+ days — flag for pruning
- Write audit findings to tomorrow's prep file

## Rules

- **Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily logs are `memory/YYYY-MM-DD.md`. Prep notes are `memory/YYYY-MM-DD-prep.md`. Never create or write a MEMORY.md inside the `memory/` directory.
- **Silent operation.** No channel delivery. No announcements.
- Write only to `memory/` daily files and the root `MEMORY.md`.
- Do not modify MEMORY.md structure — only update metadata fields and flag items.
- Structural changes (archiving, adding, removing entries) are reserved for the weekly distillation.
- If calendar or other integrations are unavailable, skip those steps and note the gap.
- Keep the prep file concise. The morning briefing skill reads it — don't make it do extra work.
