# Agent 3: JARVIS Integration Architecture
> Sources: Research from Agents 1 & 2, Uptime-Kuma API docs, Netdata docs, JARVIS heartbeat protocol
> Query date: 2026-02-22

---

## Architecture: How It All Connects

```
┌──────────────────────────────────────────────────┐
│                 JARVIS (OpenClaw)                 │
│                                                  │
│  ┌───────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Heartbeat │  │  Memory   │  │   Telegram    │ │
│  │  (15min)  │  │  System   │  │   Alerting    │ │
│  └─────┬─────┘  └────┬─────┘  └──────┬────────┘ │
│        │              │               │          │
│    Poll APIs    Log findings     Deliver alerts  │
└────────┬──────────────┬───────────────┬──────────┘
         │              │               │
    ┌────▼────┐    ┌────▼────┐         │
    │ Uptime  │    │ Netdata │         │
    │  Kuma   │    │  Agent  │         │
    │ (:3001) │    │(:19999) │         │
    └────┬────┘    └─────────┘         │
         │                             │
         └──── webhook (DOWN) ────────►│
               (backup path)
```

## Integration Method: API Polling via Heartbeat

### Uptime-Kuma API
```
GET http://localhost:3001/api/status-page/default
→ All monitor statuses in one call
→ JARVIS classifies: UP=Tier 4, DEGRADED=Tier 2, DOWN=Tier 1

GET http://localhost:3001/api/badge/:id/uptime/7
→ 7-day uptime percentage per monitor
→ Used in morning briefing
```

### Netdata API
```
GET http://localhost:19999/api/v1/info
→ System info, agent version

GET http://localhost:19999/api/v1/data?chart=system.cpu
→ CPU usage time series

GET http://localhost:19999/api/v1/alarms
→ Active health alarms
→ JARVIS classifies by severity
```

## Dual Alert Path (Redundancy)

| Path | Trigger | Latency | Dependency |
|------|---------|---------|------------|
| Uptime-Kuma → Telegram direct | Monitor DOWN | ~20 seconds | Independent of JARVIS |
| Uptime-Kuma → JARVIS webhook → processed alert | Monitor DOWN | ~30 seconds | Requires JARVIS running |

Both paths should be configured. If JARVIS goes down, Uptime-Kuma still alerts directly to Telegram.

## Heartbeat Integration Spec

Add to JARVIS heartbeat Step 2 (Gather Observations):

```javascript
// Pseudo-code for heartbeat monitoring integration
async function gatherMonitoringObservations() {
  // 1. Poll Uptime-Kuma
  const ukStatus = await fetch('http://localhost:3001/api/status-page/default');
  const monitors = parseMonitors(ukStatus);
  
  // 2. Poll Netdata alarms
  const ndAlarms = await fetch('http://localhost:19999/api/v1/alarms');
  const activeAlarms = parseAlarms(ndAlarms);
  
  // 3. Classify
  const observations = [];
  for (const m of monitors) {
    if (m.status === 'down') observations.push({ tier: 1, ...m });
    else if (m.status === 'degraded') observations.push({ tier: 2, ...m });
  }
  for (const a of activeAlarms) {
    if (a.severity === 'critical') observations.push({ tier: 1, ...a });
    else if (a.severity === 'warning') observations.push({ tier: 2, ...a });
  }
  
  return observations;
}
```

## Standing Order Template

```markdown
| Name | Schedule | Status | Last Run | Last Result |
|------|----------|--------|----------|-------------|
| monitoring-health | Every heartbeat (15min) | Active | — | — |
```

**Rule:** Silent on success. Alert on any Tier 1 or Tier 2 finding. Log everything to daily memory.
