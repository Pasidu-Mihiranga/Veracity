# AI Workflow (System B)

System B owns intelligence routing, mission definition, agent execution, accuracy post-processing, and synthesis. It must remain callable from System A without importing platform concerns into agents.

## Stages

### Intent router
- **Purpose:** Map natural language → product, competitor, domains, intent, `runExecution`.
- **Impl:** `classifyQuery` (rules → LLM → fallback) + `detectExecutionIntent`.
- **Stay custom:** Hybrid policy is product logic; framework adds no accuracy.

### Tier selection
- **Purpose:** Bound cost/latency (Tier 0 direct answer → Tier 3+ swarm).
- **Impl:** Classifier `tier` + `minAgents` in `orchestrate()`.
- **Stay custom.**

### Mission planner
- **Purpose:** Deterministic DAG of research (+ optional execution) steps.
- **Impl:** `planMission` / `missionWaves` in `mission-planner.ts`.
- **Stay custom as source of truth;** executors consume the DAG.

### Agent selection
- **Purpose:** UI ∩ classifier domains, pad to `minAgents`, full sweep override.
- **Impl:** `resolveAgentSet` in `adaptive-selection.ts`.
- **Stay custom.**

### Wave / parallel execution
- **Purpose:** Run agents in dependency waves with progress + cancel hooks.
- **Impl:** Imperative loop in `orchestrate()` today.
- **Hybrid candidate:** Behind `WorkflowExecutor` (`CurrentExecutor` | `LangGraphExecutor`).

### Domain agents + tools
- **Purpose:** Live signal gather + structured `AgentOutput` with signal-quality penalty.
- **Impl:** `lib/agents/{market-trends,competitive,...}.ts` + `lib/tools/*`.
- **Stay custom;** executor only calls `agent.run`.

### Execution engine
- **Purpose:** Grounded Stage-2 content / A/B / outreach.
- **Impl:** `execution-engine.ts` + `enforceExecutionGrounding`.
- **Stay custom;** optional later subgraph wrap only if grounding remains mandatory.

### Quality + evidence + synthesis
- **Purpose:** Honesty stack and final answer.
- **Impl:** `output-quality.ts`, source validator/bind/coverage, `synthesize` / `generateMindMap`.
- **Stay custom libraries.** Never replace with LLM-only checks.

### Reports
- **Purpose:** PDF/DOCX from post-gate `OrchestratorOutput`.
- **Impl:** `report-templates.ts`, `lib/export/*` (presentation; System A UI triggers).
