# ADR-0004: WorkflowExecutor Abstraction and Feature Flag

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai

## Context

Wave execution is embedded in `orchestrate()`. Introducing LangGraph without an interface would couple the app to a vendor API and block rollback.

## Decision

1. Introduce `WorkflowExecutor` with `CurrentExecutor` and optional `LangGraphExecutor`.
2. Select via feature flag (default **false** / CurrentExecutor).
3. Application code must not import LangGraph types; only the LangGraph executor module may.
4. Mission Planner remains the DAG source of truth for all executors.

## Consequences

### Positive

- Instant rollback via flag.
- Parity testing between executors.
- No business-logic dependency on LangGraph.

### Negative / Trade-offs

- Extra abstraction layer.
- Must keep both implementations in sync until one is retired.

## Alternatives Considered

1. **Hard-cut rewrite of `orchestrate` to LangGraph** — rejected; irreversible risk.
2. **Adapter inside each agent** — rejected; spreads framework coupling.

## References

- `docs/architecture/workflow-executor-interface.md`
- `docs/architecture/hybrid-architecture-design.md`
