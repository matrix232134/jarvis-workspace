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

# Patterns
<!-- Cross-session observations. Requires 3+ data points. No speculation. -->
<!-- Format: - [Pattern observed]. (Data points: [date1], [date2], [date3]) {imp:N, created:YYYY-MM-DD, accessed:YYYY-MM-DD, hits:N} -->

# Open Items
<!-- Work-in-progress tracking across sessions. -->
<!-- Format: - [Item description] — [status/context]. (opened: YYYY-MM-DD) -->
<!-- Items older than 7 days: prefix with [STALE] -->

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
<!-- Format: | date | recommendation | outcome (success/partial/fail) | lesson | -->
| Date | Recommendation | Outcome | Lesson |
|------|---------------|---------|--------|

## Acceptance Rates
<!-- Updated monthly by self-improvement-review skill -->
<!-- Format: | category | accepted/total | rate | trend | -->
| Category | Accepted/Total | Rate | Trend |
|----------|---------------|------|-------|

## Capability Gaps
<!-- Potential skills identified by gap signals. Validate before creating. -->
| Gap | Signal | Occurrences | Status | Notes |
|-----|--------|-------------|--------|-------|

# Cold Archive
<!-- Low-scoring entries moved here during distillation. Kept for reference, not actively loaded. -->
<!-- Format: - [Original entry] (archived: YYYY-MM-DD, reason: [decay/contradicted/consolidated]) -->
