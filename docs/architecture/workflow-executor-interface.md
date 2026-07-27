# WorkflowExecutor Interface Design

## Goal

The rest of the application must never know which executor is active. Switch via feature flag. No business logic may depend on LangGraph APIs.

## Contract

```typescript
export type WorkflowCallbacks = {
  onAgentUpdate: (run: AgentRun) => void;
  onOrchestrationLog?: (msg: string) => void;
  shouldCancel?: () => Promise<boolean> | boolean;
};

export type WorkflowExecutorInput = {
  steps: MissionStep[];
  agents: AgentConfig[];
  context: AgentContext;
};

export type WorkflowExecutorResult = {
  agentRuns: AgentRun[];
  outputs: AgentOutput[];
};

export interface WorkflowExecutor {
  readonly id: 'current' | 'langgraph';
  execute(
    input: WorkflowExecutorInput,
    cb: WorkflowCallbacks,
  ): Promise<WorkflowExecutorResult>;
}
```

## Implementations

| ID | Class | Status |
|----|-------|--------|
| `current` | `CurrentExecutor` | Phase 1–2 — extract today’s wave loop |
| `langgraph` | `LangGraphExecutor` | Phase 3 — behind flag, default OFF |

## Factory

```typescript
function getWorkflowExecutor(): WorkflowExecutor {
  if (featureFlags.langgraphExecutor) return langGraphExecutor;
  return currentExecutor;
}
```

## Guarantees

1. `planMission` / `missionWaves` define topology for both.
2. Agents are invoked only via existing `AgentConfig.run`.
3. Quality / evidence / synthesis remain outside the executor.
4. Callbacks power SSE and Inngest identically.
5. Parity tests compare `WorkflowExecutorResult` (+ full `OrchestratorOutput` at orchestrate level).

## Feature flag

- Env: `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` (or server-only equivalent).
- Default: **false**.
- Kill-switch: set false → immediate rollback; no data migration.
