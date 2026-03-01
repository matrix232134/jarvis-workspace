# Agent 3: n8n + JARVIS Integration Architecture
> Source: Sub-agent with live web search | Runtime: ~35s | Tokens: 18k

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Windows 11 Host                    │
│                                                      │
│  ┌──────────────┐   webhook POST   ┌─────────────┐  │
│  │   JARVIS     │ ───────────────► │   n8n        │  │
│  │  (OpenClaw)  │                  │  :5678       │  │
│  │              │ ◄─────────────── │              │  │
│  │  Gateway     │   HTTP callback  │  Workflows   │  │
│  │  :18789      │   to Gateway API │              │  │
│  └──────┬───────┘                  └──────┬───────┘  │
│         │                                 │          │
│         │  15-min heartbeat               │          │
│         │  ┌───────────────┐              │          │
│         └─►│ Health Check  │◄─────────────┘          │
│            │ Workflow      │  execution status        │
│            └───────────────┘                         │
└─────────────────────────────────────────────────────┘
```

## Communication Patterns

### JARVIS → n8n (Trigger Workflows)
```
POST http://localhost:5678/webhook/{workflow-path}
Content-Type: application/json

{
  "task": "deploy-site",
  "params": { "repo": "portfolio", "branch": "main" },
  "callback_url": "http://localhost:18789/api/v1/webhook",
  "correlation_id": "jarvis-20260222-001"
}
```

### n8n → JARVIS (Report Back)
```
POST http://localhost:18789/api/v1/webhook
Content-Type: application/json

{
  "correlation_id": "jarvis-20260222-001",
  "status": "success",
  "result": { "url": "https://site.com", "deploy_time": "34s" }
}
```

### Heartbeat Integration (Every 15min)
```
GET http://localhost:5678/api/v1/workflows        → workflow count
GET http://localhost:5678/api/v1/executions?status=error&limit=5  → recent failures
Header: X-N8N-API-KEY: <api-key>
```

## Error Handling

| Scenario | Detection | Response |
|---|---|---|
| n8n unreachable | Heartbeat HTTP timeout | Alert sir, retry 3x at 30s |
| Webhook 404 | HTTP response code | Workflow deactivated — log + alert |
| Execution failure | Callback with `status: error` | Log, retry if idempotent |
| No callback received | Correlation ID timeout (5 min) | Query executions API for status |
| Auth failure (401/403) | HTTP response code | API key expired — alert immediately |

## n8n API Capabilities (Verified via Web Search)

- Public REST API at `/api/v1/` — workflow CRUD, execution management
- Webhook node — accepts GET/POST/PUT, configurable response timing
- API key auth via `X-N8N-API-KEY` header
- Execution history queryable by status, workflow ID, date range
