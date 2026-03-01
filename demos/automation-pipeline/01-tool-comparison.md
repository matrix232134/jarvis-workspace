# Agent 1: Automation Tool Comparison
> Source: Sub-agent with live web search | Runtime: ~85s | Tokens: 30k

## Comparison Table

| Criteria | **n8n** | **Node-RED** | **Huginn** | **Activepieces** |
|---|---|---|---|---|
| GitHub Stars | ~55k+ | ~22.8k | ~48.7k | ~20.8k |
| License | Fair-code (Sustainable Use) | Apache 2.0 | MIT | MIT (CE) / Commercial (EE) |
| Language | TypeScript/Node.js | JavaScript/Node.js | Ruby | TypeScript/Node.js |
| Windows Native | Excellent — `npx n8n` | Excellent — `npm i -g node-red` | Poor — requires Ruby, Docker recommended | Moderate — Docker recommended |
| RAM (idle) | ~200-400 MB | ~50-150 MB (lightweight) | ~300-500 MB (Ruby/Rails) | ~200-400 MB (can leak) |
| Webhook Support | Built-in, first-class | Built-in via HTTP-in nodes | Via WebRequestAgent | Built-in, first-class |
| Telegram | Native Telegram node (trigger + send) | Community node (node-red-contrib-telegrambot) | Built-in Telegram agents | Native Telegram piece |
| Setup Ease (Windows) | Trivial — `npx n8n` | Trivial — `npm i -g node-red && node-red` | Difficult — Ruby ecosystem | Moderate — Docker Compose |
| Integrations | 400+ | 5000+ community nodes | ~50 built-in agents | 280+ pieces |

## Recommendation

**n8n** for sir's setup. `npx n8n` runs immediately on existing Node.js v24 with zero config. Native Telegram and webhook nodes, 400+ integrations, active development. Node-RED is the lightweight alternative if RAM is a concern.
