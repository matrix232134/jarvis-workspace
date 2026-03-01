# Agent 2: MCP Server Ecosystem Survey
> Source: Sub-agent with live web search | Runtime: ~63s | Tokens: 27k

## Workflow Platform MCP Servers

| Server | Purpose | Install | Windows |
|--------|---------|---------|---------|
| **n8n MCP Server Trigger** (built-in) | Turns n8n workflows into MCP servers via SSE | Built into n8n v1.x+ | ✅ |
| **n8n-nodes-mcp** | Adds MCP Server Trigger + Client Tool nodes | `npm install n8n-nodes-mcp` | ✅ |
| **node-red-contrib-mcp-server** | Start/stop/monitor MCP servers from Node-RED | `npm install node-red-contrib-mcp-server` | ✅ |
| **node-red-mcp-server** (karavaev) | LLMs manage Node-RED flows via MCP | `npm install -g node-red-mcp-server` | ✅ |
| **mcp-node-red** (fx) | 17 tools for Node-RED Admin API v2 | `npx mcp-node-red` | ✅ |

## Telegram MCP Servers

| Server | Purpose | Install | Windows |
|--------|---------|---------|---------|
| **mcp-telegram** (sparfenyuk) | Read-only Telegram via MTProto | Python/uv | ⚠️ |
| **telegram-bot-mcp** (smartmanoj) | Send messages via Bot API | npx | ✅ |
| **Telegram Gateway** (Pandoll-AI) | REST API + MCP bridge for bots | Docker or npm | ✅ |

## Scheduling MCP Servers

| Server | Purpose | Install | Windows |
|--------|---------|---------|---------|
| **mcp-cron** | Schedule tasks via cron expressions | npm/npx | ✅ |
| **Q-Scheduler** | Cron for shell commands, API calls | npm | ✅ |
| **schedule-task-mcp** | Interval/cron/date with SQLite persistence | npm | ✅ |

## Webhook MCP Servers

| Server | Purpose | Install | Windows |
|--------|---------|---------|---------|
| **Webhook MCP** (kevinwatt) | Send to external webhook endpoints | npm | ✅ |

## Key Finding

**n8n has native MCP support built-in.** The MCP Server Trigger node means n8n workflows can be directly exposed as MCP tools — JARVIS could call n8n workflows as if they were native tools. This is a significant integration advantage over Node-RED.

## Gaps Identified

- No dedicated Make/Zapier MCP server
- No Huginn MCP server (community too small)
- No Activepieces MCP server
