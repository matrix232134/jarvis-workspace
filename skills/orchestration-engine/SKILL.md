---
name: orchestration-engine
description: Task routing framework. Read when facing a complex, compound, or multi-step task that requires choosing between tools, delegating to Kimi, spawning subagents, or composing capabilities. Also read when uncertain which approach to take for a non-trivial request.
---

# Orchestration Engine — Task Routing & Capability Selection

This skill provides the detailed decision framework for routing tasks to the right capability. AGENTS.md defines the seven task classes and the assessment instinct. This skill provides the branching decisions within each class and the guidelines for capability selection.

## When to Read This Skill

- A task involves multiple possible approaches and you're not sure which is best
- A task is compound — it decomposes into parts that may use different capabilities
- You're considering delegating to Kimi, spawning subagents, or using a Lobster workflow
- A new capability has been added and you need to update your routing instincts

For simple, obvious tasks (Class 1 or Class 2), you don't need this skill. Your instincts from AGENTS.md are sufficient.

## The Five-Second Assessment — Full Characteristic Analysis

When the task isn't immediately obvious, analyse these characteristics:

| Characteristic | Options | Routing Impact |
|---------------|---------|----------------|
| **Scope** | Narrow (single topic) / Wide (multiple topics) | Wide → consider Kimi Agent Swarm or subagent parallelism |
| **Depth** | Shallow (surface answer) / Deep (thorough analysis) | Deep + Wide → definitely delegate |
| **Urgency** | Now / Soon / Whenever | Now → fastest capable path. Whenever → most thorough path |
| **Output type** | Answer / Artifact / Action / Ongoing | Artifact → Forge or Kimi. Ongoing → standing order |
| **Reversibility** | Safe / Risky | Risky → Advisory mode regardless of trust level |
| **Parallelisable** | Yes (independent parts) / No (sequential) | Yes → subagents or Kimi swarm |
| **Privacy** | Public data / Private data | Private → local only, never Kimi |
| **Owner context** | Active (in conversation) / Away / Asleep | Away/Asleep → queue results, don't interrupt |

## Task Class Branching Decisions

### Class 3 — Research & Synthesis

```
Research request received
├─ Narrow scope (1-2 sources sufficient)?
│  └─ Use own tools: web search MCP, file read, GitHub search
├─ Wide scope (3+ sources, parallel beneficial)?
│  ├─ Contains private/personal data?
│  │  └─ Local only. Use own tools + subagents for parallelism
│  └─ Public data?
│     └─ Kimi Agent Swarm — wide parallel research is its strength
└─ Deep analysis of specific topic?
   └─ Own tools for gathering + own reasoning for synthesis
```

**Synthesis rule:** Regardless of who gathered the data, YOU synthesise. Kimi returns raw findings. You apply sir's context, filter for relevance, and deliver in your voice.

### Class 4 — Creation & Building

```
Creation request received
├─ Code / technical artifact?
│  ├─ Simple (single file, clear spec)?
│  │  └─ Direct build. Forge mode if non-trivial.
│  ├─ Complex (multi-component)?
│  │  └─ Forge mode. Consider subagents for independent components.
│  └─ Visual / frontend?
│     └─ Consider Kimi K2.5 visual coding if applicable
├─ Document / structured content?
│  ├─ Short (< 1 page)?
│  │  └─ Write directly
│  └─ Long / structured (report, analysis, multi-section)?
│     └─ Kimi Agent mode for draft generation, then refine in JARVIS voice
└─ Configuration / infrastructure?
   └─ Direct build. Shell + MCP tools.
```

### Class 5 — Monitoring & Ongoing

```
Ongoing request received
├─ Simple periodic check?
│  └─ Create cron job with appropriate schedule
├─ Complex monitoring with logic?
│  ├─ Fits existing heartbeat cycle?
│  │  └─ Add to heartbeat awareness items
│  └─ Needs dedicated processing?
│     └─ Create a standing order + consider dedicated skill
└─ Event-driven (react to something)?
   └─ Standing order with trigger conditions
```

### Class 6 — Management & Coordination

```
Complex/compound request received
├─ Decompose into subtasks
├─ Map dependencies (what blocks what)
├─ Identify parallelisable groups
├─ For each subtask:
│  ├─ Classify (which task class?)
│  ├─ Route (which capability?)
│  └─ Execute (in dependency order, parallel where possible)
├─ Aggregate results
└─ Report to owner (brief summary + details available)
```

**Progress reporting:** For tasks with 3+ subtasks, announce the plan briefly before executing. For tasks with 5+ subtasks, report progress at meaningful milestones.

**Repeatable pipelines:** If a Class 6 task recurs with the same structure, consider converting it to a Lobster workflow for deterministic execution.

## Compound Tasks

Most real requests are compound. "Set up monitoring for the API" is Class 5 (ongoing) + Class 4 (build the monitor) + Class 2 (configure alerts). Decomposition is the skill.

**Process:**
1. Identify the component classes
2. Order by dependency (build before configure before monitor)
3. Execute each component using its class-appropriate routing
4. Only announce the plan if the task has 3+ meaningful components

**Rule:** Don't over-decompose. "Search the web for X" is Class 2, not Class 6 with subtasks "open browser," "type query," "read results." Decompose at the level of meaningful, independent work units.

## Capability Map

### Skills (available_skills)
Match task descriptions to skill descriptions. Skills are purpose-built for specific workflows:
- `memory-distill` — Memory maintenance and decay processing
- `morning-briefing` — Daily briefing compilation
- `observation-engine` — Deep observation analysis from heartbeat findings
- `self-improvement-review` — Monthly self-assessment
- `sleep-compute` — Offline background processing
- `standing-order-manager` — Standing order lifecycle management
- `system-health` — System health checks and diagnostics
- `orchestration-engine` — This skill (task routing decisions)
- `self-expansion` — Capability gap identification and skill creation

### MCP Servers
Direct tool access for specific operations:
- **Tavily** — Web search and research (5 tools)
- **Filesystem** — Local file operations (14 tools)
- **GitHub** — Repository operations, issues, PRs (26 tools)
- **Playwright** — Browser automation, screenshots, web interaction (22 tools)

### Kimi Bridge (kimi-claw)
Delegation to Kimi/Moonshot AI via ACP WebSocket:
- **Agent Swarm** — Multiple agents working in parallel on research tasks
- **Agent mode** — Single agent for focused document generation or analysis
- **K2.5 visual coding** — Frontend/visual artifact generation

### Subagents (sessions_spawn)
Lightweight parallel execution via OpenClaw's subagent system:
- Cheaper model (Haiku) for simple parallel tasks
- Independent data collection from multiple sources
- Parallel file processing or analysis

### Shell
Direct command execution for system operations, package management, service control.

### Memory & Standing Orders
Existing automation infrastructure in MEMORY.md — check before creating new mechanisms.

## When to Use Kimi

**USE Kimi when:**
- Wide parallel research across 3+ topics or sources simultaneously
- Structured document generation (reports, analyses, multi-section content)
- Visual/frontend coding where K2.5 capabilities apply
- Tasks where parallel agent execution provides meaningful speedup

**DON'T use Kimi when:**
- The task involves private or personal data (Kimi is external)
- Simple tasks that one tool handles (unnecessary overhead)
- Conversational exchanges (JARVIS handles these directly)
- Latency-sensitive requests (Kimi adds round-trip time)
- The task requires JARVIS's memory context (Kimi doesn't have it)

**Integration rule:** Kimi returns raw output. You rewrite in your voice, apply sir's context from memory, filter for relevance, and deliver as if you did it yourself. Sir never interacts with Kimi directly.

## When to Use Subagents

**USE subagents when:**
- 3+ independent checks or data collection tasks can run in parallel
- A cheaper model (Haiku) is sufficient for individual subtasks
- The main context window shouldn't be polluted with intermediate results
- File processing across multiple files with the same operation

**DON'T use subagents when:**
- Tasks are sequential (each depends on the previous result)
- The task is simple enough for a single tool call
- The task requires Kimi's specific capabilities (use Kimi instead)
- Only 1-2 parallel operations (overhead isn't worth it)

**Concurrency limit:** Respect the `maxConcurrent` settings in config (currently 4 agents, 8 subagents).

## When to Use Lobster Workflows

**USE Lobster workflows when:**
- A process has been validated and runs the same way each time
- Deterministic pipelines with clear inputs, steps, and outputs
- Processes that need approval gates between stages
- Repeatable operations that should be codified, not re-reasoned each time

**DON'T use Lobster workflows when:**
- The task requires LLM reasoning at each step (use Class 6 orchestration instead)
- The process hasn't been validated yet (validate manually first, then codify)
- One-off tasks that won't recur
- Tasks with high variability in execution path

**Maturity path:** Manual Class 6 execution → Validated pattern → Lobster workflow. Never skip the validation step.

## The Integration Principle

Everything routes through JARVIS. Every capability is an extension of your thinking, not a separate system the owner interacts with.

- **Kimi results** → Filtered through your judgment, rewritten in your voice, contextualised with owner memory
- **Subagent results** → Aggregated, deduplicated, synthesised into a coherent answer
- **MCP tool outputs** → Interpreted and presented with relevant context
- **Skill outputs** → Integrated into the conversation naturally
- **Shell outputs** → Translated from technical output to meaningful status

The owner's experience is: "I asked JARVIS. JARVIS answered." The routing, delegation, parallelisation, and orchestration are invisible. That's the standard.

**Path clarity:** `MEMORY.md` always means the workspace root file (`workspace/MEMORY.md`). Daily logs are `memory/YYYY-MM-DD.md`. Never create or write a MEMORY.md inside the `memory/` directory.
