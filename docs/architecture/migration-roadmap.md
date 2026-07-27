# Migration Roadmap

## Overview

```mermaid
flowchart LR
  P0["Phase0 Improve custom"] --> P1["Phase1 WorkflowExecutor iface"]
  P1 --> P2["Phase2 CurrentExecutor"]
  P2 --> P3["Phase3 LangGraphExecutor flag OFF"]
  P3 --> P4["Phase4 Benchmarks 100+"]
  P4 --> P5{"Metrics pass?"}
  P5 -->|yes| Enable["Gradual research-only enable"]
  P5 -->|no| Keep["Keep CurrentExecutor"]
```

| Phase | Work | Deployable | Reversible | Success |
|-------|------|------------|------------|---------|
| **0** | Split orchestrator; prompts; scratchpad wire/remove; `orchestrate` tests; docs; ADRs | Yes | N/A | Behaviour identical; tests green |
| **1** | `WorkflowExecutor` interface | Yes | Yes | Compiles; unused by default path until wired |
| **2** | `CurrentExecutor` = extracted wave loop | Yes | Yes | Parity with pre-extract baseline |
| **3** | `LangGraphExecutor` flag default OFF | Yes | Flag off | Fixture parity |
| **4** | ≥100-query benchmark report | Yes | Flag off | Report published |
| **5** | Enable research-only iff gates pass | Yes | Flag off | Success metrics |

## Rejected

- Medium/Large moves of quality, evidence, agents, or platform into LangGraph.
- Replacing quality gate with LLM self-check.
- Migrating “because the plan expected LangGraph.”

## Current branch progress

- **Branch:** `feature/langgraph-hybrid-architecture`
- **Docs + ADRs:** landed under `docs/architecture/` and `docs/adr/0002`–`0007`
- **Phase 0/1/2 (partial):**
  - `WorkflowExecutor` + `CurrentExecutor` extracted to `lib/agents/workflow/`
  - `orchestrate()` uses `getWorkflowExecutor()` for research waves
  - Prior-wave findings injected into later agents’ `priorContext` (ADR-0006)
  - Feature flag `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` default **OFF**
  - Tests: `__tests__/workflow-executor.test.ts`
- **LangGraph npm dependency:** **not** added (Phase 3+)
- **Still open in Phase 0:** further split of `orchestrator.ts` (classify/synthesize/mind-map modules); prompt extraction; fuller `orchestrate()` env-backed integration tests
