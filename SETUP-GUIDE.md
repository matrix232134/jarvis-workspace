# JARVIS Setup Guide — Step by Step

## What's Already Done
- OpenClaw v2026.2.19-2 installed
- All workspace files created (SOUL.md, AGENTS.md, USER.md, IDENTITY.md, MEMORY.md, HEARTBEAT.md, TOOLS.md)
- Custom skills created (system-health, memory-distill, morning-briefing)

## What You Need to Do

### 1. Get Your Anthropic API Key
1. Go to https://console.anthropic.com
2. Create an account (or sign in)
3. Add a payment method (pay-per-use, ~$3/million tokens for Sonnet)
4. Go to API Keys → Create Key
5. Copy the key (starts with `sk-ant-`)

### 2. Run the Onboarding Wizard
```bash
openclaw onboard --install-daemon
```
When prompted:
- Accept the risk acknowledgment
- Choose "QuickStart"
- Select "Anthropic" as provider
- Paste your API key
- Select `claude-sonnet-4-5` as default model
- Choose npm as node manager
- Skip channels for now (or set up Telegram if you have the token ready)

**Important**: The wizard may create default workspace files. Our custom files (SOUL.md, AGENTS.md, etc.) should take priority. If defaults were created, the custom ones we built will need to be restored.

### 3. Create Your Telegram Bot
1. Open Telegram on your phone or desktop
2. Search for @BotFather and start a chat
3. Send `/newbot`
4. Enter display name: `JARVIS`
5. Enter username: `jarvis_entity_bot` (must be unique, must end in `bot`)
6. Copy the token (format: `7123456789:AAHx0rJ9...`)
7. Send `/setprivacy` to BotFather → select your bot → "Disable" (allows group access)

### 4. Connect Telegram
```bash
openclaw channels add telegram
# Enter your bot token when prompted
```

### 5. Pair Your Account
```bash
openclaw gateway restart
```
Then message your bot on Telegram. A pairing code will appear. Approve it:
```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

### 6. Configure Model Strategy
After onboarding, edit the config to set up proper model routing:
```bash
openclaw config set agents.defaults.heartbeat.every "15m"
```

### 7. Security Hardening
```powershell
# Lock config file to current user only
icacls "$env:USERPROFILE\.openclaw\openclaw.json" /inheritance:r
icacls "$env:USERPROFILE\.openclaw\openclaw.json" /grant:r "${env:USERNAME}:(F)"

# Lock credentials directory
icacls "$env:USERPROFILE\.openclaw\credentials" /inheritance:r /T
icacls "$env:USERPROFILE\.openclaw\credentials" /grant:r "${env:USERNAME}:(OI)(CI)(F)" /T
```

### 8. Set Up Morning Briefing Cron
```bash
openclaw cron add --name "morning-briefing" --cron "0 7 * * *" --tz "Australia/Adelaide" --session isolated --announce --channel telegram --message "Deliver the morning briefing. Check system health, overnight events, open items, calendar (if available). [VOICE] under 30 seconds reading. [DISPLAY] for details. Vary the opening."
```

### 9. Set Up Weekly Memory Distillation
```bash
openclaw cron add --name "weekly-distill" --cron "0 3 * * 0" --tz "Australia/Adelaide" --session isolated --model "anthropic/claude-sonnet-4-5" --message "Run memory distillation. Read all memory/*.md files from the past week. Follow the memory-distill skill instructions. Extract preferences, lessons, and patterns. Update MEMORY.md. Do not deliver results."
```

### 10. Set Up Nightly Sleep-Compute
```bash
openclaw cron add --name "sleep-compute" --cron "0 3 * * *" --tz "Australia/Adelaide" --session isolated --model "anthropic/claude-sonnet-4-5" --message "Run sleep-compute skill. Cross-reference today's memory entries, prepare tomorrow's briefing data, run memory maintenance. Do not deliver results."
```

### 11. Set Up Daily Backup
```bash
openclaw cron add --name "daily-backup" --cron "0 4 * * *" --tz "Australia/Adelaide" --session isolated --message "Backup workspace. Run: cd ~/.openclaw/workspace && git add -A && git diff --cached --quiet || git commit -m 'Auto-backup $(date +%Y-%m-%d)'"
```

### 12. Set Up Monthly Evolution Review
```bash
openclaw cron add --name "monthly-evolution" --cron "0 5 1 * *" --tz "Australia/Adelaide" --session isolated --model "anthropic/claude-sonnet-4-5" --message "Run self-improvement-review skill. Generate evolution report for last month. Write to memory/evolution/. Do not deliver results."
```

### 13. Set Up Weekly Standing Order Review
```bash
openclaw cron add --name "standing-order-review" --cron "0 4 * * 1" --tz "Australia/Adelaide" --session isolated --message "Review all standing orders in MEMORY.md. Check health, execution history, and suggest retirements for inactive orders. Update MEMORY.md Standing Orders table."
```

### 14. Initialize Git for Workspace
```bash
cd ~/.openclaw/workspace
git init
git add -A
git commit -m "Initial JARVIS workspace — entity.md split, skills, and configuration"
```

### 15. Test JARVIS
Send these messages on Telegram and verify the responses:
1. "Good morning." → Should get a brief, JARVIS-style greeting
2. "How are my systems?" → Should attempt system health check
3. "What time is it?" → Short factual answer, no padding
4. "I want to rebuild everything from scratch by Friday." → Dry wit response

### 16. Verify
```bash
openclaw doctor --deep
openclaw gateway status
openclaw channels status --probe
openclaw system heartbeat last
```

### 17. Auto-Start on Boot

JARVIS should start automatically when the machine boots. Two options:

**Option A — Task Scheduler (recommended, needs admin):**

Run in an elevated PowerShell terminal:
```powershell
powershell.exe -ExecutionPolicy Bypass -File "$env:USERPROFILE\.openclaw\setup-autostart.ps1"
```

This registers a scheduled task that starts the gateway at boot, retries 3 times on failure, and runs without requiring interactive login.

Verify: `Get-ScheduledTask -TaskName "JARVIS Gateway"`

**Option B — Startup folder (no admin needed, runs on login):**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "$env:USERPROFILE\.openclaw\setup-autostart.ps1" -StartupFolder
```

This creates a shortcut in the Windows Startup folder. Gateway starts when the user logs in. For a dedicated machine with auto-login, this is equivalent to Option A.

### 18. Desktop Control Panel

A "JARVIS Control" shortcut on the desktop provides quick access to start/stop/restart the gateway and check system status.

Create the shortcut:
```powershell
powershell.exe -ExecutionPolicy Bypass -File "$env:USERPROFILE\.openclaw\create-desktop-shortcut.ps1"
```

Double-click "JARVIS Control" on your desktop to open the control panel.

---

## Phase 2+ (After Foundation is Verified)

### Add MCP Servers
Get API keys for each, then add to config:

**Tavily Search** (free tier: https://tavily.com/):
```bash
mcporter config add tavily --command "npx" --arg "-y" --arg "tavily-mcp" --env "TAVILY_API_KEY=YOUR_KEY" --description "Web search via Tavily" --scope home
```

**GitHub** (free: https://github.com/settings/tokens):
```bash
mcporter config add github --command "npx" --arg "-y" --arg "@modelcontextprotocol/server-github" --env "GITHUB_PERSONAL_ACCESS_TOKEN=ghp_YOUR_TOKEN" --description "GitHub API tools" --scope home
```

**Filesystem** (no key needed):
```bash
mcporter config add filesystem --command "npx" --arg "-y" --arg "@modelcontextprotocol/server-filesystem" --arg "C:\\Users\\tyson" --description "Read/write files on this machine" --scope home
```

**Playwright** (no key needed):
```bash
mcporter config add playwright --command "npx" --arg "-y" --arg "@playwright/mcp" --description "Browser automation via Playwright" --scope home
```

Restart gateway after each: `openclaw gateway restart`
