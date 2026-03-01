# Agent 1: Monitoring Tool Comparison
> Sources: Tavily search (live), Reddit r/selfhosted, OpenAlternative, Netdata.cloud, Robotalp, uptimerobot.com
> Query date: 2026-02-22

---

## Primary Candidates for Solo Operator on Windows 11

### Uptime-Kuma (Service Availability)
| Factor | Detail | Source |
|--------|--------|--------|
| GitHub stars | 82,973 | OpenAlternative |
| License | MIT | OpenAlternative |
| Windows support | ✅ Native — Node.js ≥20.4 required | GitHub README |
| Sir's Node.js | v24.13.1 ✅ compatible | Known |
| Notification services | 90+ (Telegram, Discord, Slack, webhook, email...) | GitHub README |
| Monitor types | HTTP(s), TCP, WebSocket, Ping, DNS, Docker, Push, Steam | GitHub README |
| Min check interval | 20 seconds | GitHub README |
| Install method | `git clone` + `npm run setup` + `node server/server.js` | GitHub |
| Background run | PM2 or Windows Task Scheduler | i12bretro.github.io |
| Port | 3001 | GitHub README |
| Weakness | SQLite DB can grow large over time | Reddit r/selfhosted |

### Netdata (Host Performance)
| Factor | Detail | Source |
|--------|--------|--------|
| Windows support | ✅ **Native Windows agent** (not WSL) | netdata.cloud |
| Metrics | CPU, memory, disk, network, processes — 1,000+ metrics per node | netdata.cloud comparison |
| Features | ML anomaly detection, real-time dashboards, health alarms | netdata.cloud |
| UI | Built-in web dashboard on port 19999 | netdata.cloud |
| Install | MSI installer or command-line | YouTube demo confirmed |
| Complementary use | "Many teams use Uptime Kuma for status pages + Netdata for internal monitoring" | netdata.cloud/comparisons/uptimekuma |

### Gatus (Lightweight Alternative)
| Factor | Detail | Source |
|--------|--------|--------|
| GitHub stars | 10,141 | OpenAlternative |
| Config | YAML only (no web UI) | Reddit, LibHunt |
| Resource usage | ~15-30MB RAM (lightest option) | Community benchmarks |
| Verdict | Better for config-as-code shops; Uptime-Kuma wins for solo operator UX | Reddit consensus |

### Rejected Options
| Tool | Reason |
|------|--------|
| Zabbix | Enterprise-grade, massive overkill for 2-3 services |
| Nagios Core | Legacy plugin architecture, complex setup |
| PRTG | Free tier limited to 100 sensors, heavy |
| Prometheus + AlertManager | Requires Grafana for UI, multiple services to maintain |

## Verdict
**Uptime-Kuma + Netdata** as complementary pair. This is confirmed best practice per Netdata's own comparison page — they explicitly recommend this combination.
