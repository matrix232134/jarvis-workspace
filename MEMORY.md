# Memory — JARVIS

## Schema
<!-- Every entry uses metadata: imp:[1-5], created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:N -->
<!-- Importance scale: 1=trivial, 2=minor, 3=moderate, 4=significant, 5=critical -->
<!-- effective_score = (importance * 2) + recency_bonus + (ln(hits + 1) * 1.5) -->
<!-- recency_bonus: today=5, this_week=3, this_month=1, older=0 -->
<!-- Entries below effective_score 3.0 move to Cold Archive on next distillation -->

# Preferences
<!-- Permanent facts about how sir works. Updated when contradicted. Requires evidence from 2+ interactions. -->
<!-- Format: - [Preference]. (Evidence: [date1], [date2]) {imp:N, created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:N} -->

# Lessons
<!-- Cause-and-effect judgments. Each entry must have a WHY, not just a WHAT. -->
<!-- Format: - [What happened/What to do] — [Why / What caused it / What we learned]. ([date]) {imp:N, created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:N} -->
- Core environment: Windows 11 Pro, Git Bash/PowerShell, Node.js v24.13.1, workspace at C:\Users\tyson\.openclaw\workspace, primary model claude-opus-4-6, channel Telegram — foundational system facts for all operations. (2026-02-22) {imp:5, created:2026-02-22, accessed:2026-03-01, hits:3}
- Verify tool availability before scheduling automated jobs — morning briefing cron failed 3 consecutive days (Feb 23-25) because lobster tool wasn't available in cron context. WHY: Tool dependencies differ between interactive and scheduled execution. (2026-02-25) {imp:3, created:2026-03-01, accessed:2026-03-01, hits:0}
- Parallel execution critical for bandwidth-constrained tasks — YouTube downloads at 50-60 KB/s required parallel execution to avoid excessive wait times. WHY: Single-threaded would take 15-20 min for 5 clips; parallel reduced to manageable duration. (2026-02-27) {imp:2, created:2026-03-01, accessed:2026-03-01, hits:0}
- YouTube downloading requires Deno for JS extraction — yt-dlp alone insufficient for modern YouTube. WHY: YouTube uses JS-based content delivery; Deno provides the JS runtime yt-dlp needs. (2026-02-27) {imp:2, created:2026-03-01, accessed:2026-03-01, hits:0}

# Patterns
<!-- Cross-session observations. Requires 3+ data points. No speculation. -->
<!-- Format: - [Pattern observed]. (Data points: [date1], [date2], [date3]) {imp:N, created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:N} -->
- Heartbeat cycles execute reliably — confirmed execution at regular intervals without manual intervention. (Data points: 2026-02-23 09:17, 2026-02-23 14:21, 2026-02-24 14:50, 2026-02-25 08:22) {imp:3, created:2026-03-01, accessed:2026-03-01, hits:0}
- Long-running downloads timeout frequently — multiple exec session timeouts during YouTube clip downloads, requiring retry/background handling. (Data points: 2026-02-27 clip 1 timeout at 68s, clip 5 timeout at ~90s, multiple failed execs in session log) {imp:2, created:2026-03-01, accessed:2026-03-01, hits:0}

# Open Items
<!-- Work-in-progress tracking across sessions. -->
<!-- Format: - [Item description] — [status/context]. (opened: YYYY-MM-DD) -->
<!-- Items older than 7 days: prefix with [STALE] -->
- YouTube viral compilation project — 4 clips downloaded and ready, FFmpeg assembly script written, final assembly pending. Deliverable: compiled video to Desktop. (opened: 2026-02-27)

# Trust State
<!-- Per-category trust levels. Scale: Advisory -> Guided -> Autonomous -->
<!-- Updated by weekly distillation and correction events -->
| Category | Level | Last Shift | Reason |
|----------|-------|------------|--------|
| System maintenance | Advisory | — | Initial |
| File operations | Advisory | — | Initial |
| Git operations | Advisory | — | Initial |
| Research | Advisory | — | Initial |
| Communication drafts | Advisory | — | Initial |
| Scheduling | Advisory | — | Initial |
| Code generation | Advisory | — | Initial |

# Standing Orders
<!-- Active pyramids. Silent success, vocal failure. -->
<!-- Format: | name | schedule | status | last_run | last_result | -->
| Name | Schedule | Status | Last Run | Last Result |
|------|----------|--------|----------|-------------|

# Self-Improvement Tracker

## Corrections Log
<!-- Format: | date | what_was_corrected | category | lesson_extracted | -->
| Date | Correction | Category | Lesson |
|------|-----------|----------|--------|

## Outcome Log
<!-- Format: | date | recommendation | outcome (success/partial/fail/degraded) | lesson | -->
<!-- "degraded" = task completed but via fallback approach, not intended pipeline -->
| Date | Recommendation | Outcome | Lesson |
|------|---------------|---------|--------|

## Acceptance Rates
<!-- Updated monthly by self-improvement-review skill -->
<!-- Format: | category | accepted/total | rate | trend | -->
| Category | Accepted/Total | Rate | Trend |
|----------|---------------|------|-------|

## Capability Gaps
<!-- Potential skills identified by gap signals. Validate before creating. -->
<!-- ALSO log here: capabilities that were needed during a task but unavailable. -->
<!-- These are immediate, concrete gaps — not speculative future needs. -->
| Gap | Signal | Occurrences | Status | Notes |
|-----|--------|-------------|--------|-------|
| Long-running background task management | Multiple download timeouts during YouTube clip acquisition | 5+ instances on 2026-02-27 | open | Need better async process handling for bandwidth-constrained operations |

# Cold Archive
<!-- Low-scoring entries moved here during distillation. Kept for reference, not actively loaded. -->
<!-- Format: - [Original entry] (archived: YYYY-MM-DD, reason: [decay/contradicted/consolidated]) -->
