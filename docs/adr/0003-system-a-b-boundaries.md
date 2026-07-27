# ADR-0003: System A vs System B Boundaries

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai | product

## Context

Platform concerns (auth, workspace, SSE) and AI workflow concerns (classify, agents, quality) are interleaved in gateway code. Without boundaries, a workflow framework could leak into SaaS modules.

## Decision

1. **System A (Business Platform)** owns auth, workspace, FF, RBAC, memory storage, decisions storage, export UI, streaming transport encoding, rate limits.
2. **System B (AI Workflow)** owns intent/tier/mission/selection, agent execution, synthesis, quality, evidence.
3. System A **must never** import LangGraph/LangChain.
4. System A calls a façade (`orchestrate` / workflow factory) only.

## Consequences

### Positive

- Clear ownership; safer refactors.
- Framework stays an implementation detail of System B’s executor.

### Negative / Trade-offs

- Gateway still coordinates both systems; discipline required in `app/api/chat/route.ts`.

## Alternatives Considered

1. **Put entire chat route under LangGraph** — rejected; mixes SaaS with workflow runtime.
2. **Microservices split now** — rejected as premature (strategy anti-pattern before 10k users).

## References

- `docs/architecture/workflow-boundary-analysis.md`
- `docs/architecture/business-platform.md`
- `docs/architecture/ai-workflow.md`
