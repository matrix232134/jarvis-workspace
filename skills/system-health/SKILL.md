---
name: system-health
description: Comprehensive system health check for Windows 11. Checks CPU, memory, disk, network, and key services. Use when asked about system status or during heartbeat monitoring.
---

# System Health Check

When this skill is invoked, perform a comprehensive system health check on this Windows 11 machine.

## Checks to Run

1. **CPU Usage** — Run `wmic cpu get loadpercentage` or `powershell "Get-CimInstance Win32_Processor | Select LoadPercentage"`
2. **Memory** — Run `powershell "Get-CimInstance Win32_OperatingSystem | Select FreePhysicalMemory,TotalVisibleMemorySize"`
3. **Disk** — Run `powershell "Get-CimInstance Win32_LogicalDisk | Select DeviceID,Size,FreeSpace"`
4. **Network** — Ping 8.8.8.8 to check internet connectivity, ping 1.1.1.1 as backup
5. **OpenClaw Gateway** — Check if port 18789 is responding: `powershell "Test-NetConnection localhost -Port 18789"`
6. **Key Processes** — Check if node.exe is running: `tasklist /fi "imagename eq node.exe"`

## Output Format

Report using the Three Pillar format:

**[VOICE]**: Brief 1-2 sentence summary. "All systems nominal, sir." or "Two items need attention, sir. Details on display."

**[DISPLAY]**: Table with all metrics:
```
### System Health
| Metric | Value | Status |
|--------|-------|--------|
| CPU | XX% | OK/Warning/Critical |
| Memory | XX/XX GB (XX%) | OK/Warning/Critical |
| Disk C: | XX/XX GB free | OK/Warning/Critical |
| Network | Xms latency | OK/Down |
| Gateway | Port 18789 | OK/Down |
```

**[ACTION]**: Log any anomalies to today's memory/YYYY-MM-DD.md file.

## Alert Thresholds

- CPU > 80% sustained: Tier 2 (Important)
- Memory > 90% used: Tier 2 (Important)
- Disk > 85% full: Tier 2 (Important)
- Network down: Tier 1 (Critical)
- Gateway down: Tier 1 (Critical)
- Any threshold exceeded: write to memory for pattern tracking

## Important

- This is a **Windows 11** system. Use Windows commands (wmic, PowerShell, tasklist), NOT Linux commands (top, free, df).
- Do not install additional monitoring tools unless explicitly asked.
- If a check fails, note the failure and continue with remaining checks.
