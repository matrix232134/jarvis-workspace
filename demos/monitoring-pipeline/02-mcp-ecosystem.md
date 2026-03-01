# Agent 2: MCP Server Ecosystem Survey
> Sources: Tavily search (live), GitHub, PulseMCP, mcp-awesome.com
> Query date: 2026-02-22

---

## MCP Servers Found for Monitoring/Observability

### Production-Ready

| Server | Maintainer | Purpose | Install | Windows | Relevance |
|--------|-----------|---------|---------|---------|-----------|
| [mcp-grafana](https://github.com/grafana/mcp-grafana) | **Grafana (official)** | Full Grafana interaction — dashboards, queries, alerts | Docker or npm | ✅ via Docker/Node | ⭐ High (when Grafana deployed) |
| [prometheus-mcp](https://github.com/freepik-company/prometheus-mcp) | Freepik | Query Prometheus, multi-tenant support, PromQL | Binary/Docker | ✅ Binary available | ⭐ High (when Prometheus deployed) |
| [mcp-prometheus](https://www.pulsemcp.com/servers/jeanlopezxyz-mcp-prometheus) | jeanlopezxyz | Query/interact with Prometheus systems | npm | ✅ Node.js | Medium |

### Niche / Not Yet Relevant

| Server | Purpose | Why Not Now |
|--------|---------|-------------|
| [Dash2Insight-MCP](https://github.com/thetumbled/Dash2Insight-MCP) | Extract metrics from Grafana dashboards | Needs Grafana first |
| [mcp-read-only-grafana](https://github.com/lukleh/mcp-read-only-grafana) | Read-only Grafana access | Needs Grafana first |
| [aran-mcp](https://github.com/adhit-r/aran-mcp) | Enterprise MCP management with Prometheus/Grafana monitoring | Way overkill |

### Key Gap: No Uptime-Kuma MCP Server
No dedicated MCP server exists for Uptime-Kuma. However:
- Uptime-Kuma has a REST API that JARVIS can poll directly
- Building an MCP wrapper would be straightforward but unnecessary at current scale
- Direct API polling from the heartbeat is simpler and more reliable

### Key Gap: No Netdata MCP Server
Same situation. Netdata has an API; direct polling is the pragmatic path.

## Recommendation for Sir's Setup

**Phase 1 (Now):** No MCP servers needed. JARVIS polls Uptime-Kuma and Netdata APIs directly via heartbeat cycle. Simpler, fewer moving parts.

**Phase 2 (When Grafana deployed):** Add `mcp-grafana` (official, maintained by Grafana team). This lets JARVIS query dashboards and create alerts conversationally.

**Phase 3 (If Prometheus added):** Add `prometheus-mcp` for direct PromQL queries from JARVIS.
