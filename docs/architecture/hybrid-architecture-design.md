# Hybrid Architecture Design

## Target topology

```mermaid
flowchart TB
  subgraph sysA [System A Business Platform Custom]
    Auth["Auth Workspace FF RBAC"]
    Gateway["Chat SSE / Inngest"]
    UI["UI Export Memory store"]
  end
  subgraph policy [AI Policy Custom]
    Intent["Intent Router"]
    TierN["Tier Selection"]
    Select["Agent Selection"]
    Mission["Mission Planner"]
  end
  subgraph execAbs [Workflow Executor Abstraction]
    IFACE["WorkflowExecutor"]
    Cur["CurrentExecutor"]
    LG["LangGraphExecutor"]
    IFACE --> Cur
    IFACE --> LG
  end
  subgraph agents [Existing Agents Custom]
    Research["Domain agents + tools"]
    Stage2["Execution Engine + grounding"]
  end
  subgraph honesty [Accuracy Stack Custom]
    Synth["Synthesize + mind map"]
    Q["Quality Pipeline"]
    E["Evidence Pipeline"]
  end
  Auth --> Gateway --> Intent --> TierN --> Select --> Mission --> IFACE
  Cur --> Research
  LG --> Research
  Research --> Stage2 --> Synth --> Q --> E --> Gateway --> UI
```

## Layer responsibilities

1. **Platform** — auth, tenancy, SSE/job, flags, memory injection, UI.
2. **Policy** — classify, tier, select agents, define mission DAG (custom TS).
3. **Executor** — run waves only; `CurrentExecutor` default; `LangGraphExecutor` optional.
4. **Agents** — unchanged `AgentConfig.run` contracts.
5. **Accuracy stack** — fixed post-order pure functions; never reimplemented as prompts alone.

## Design invariants

- LangGraph is an **implementation detail**, not the architecture.
- Mission Planner is the single DAG source of truth.
- Post-pipeline order is identical for every executor.
- Feature flag selects executor; application code does not branch on LangGraph types.
