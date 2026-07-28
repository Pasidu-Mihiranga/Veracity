# ADR-0002: Custom-First Orchestration; LangGraph Not Default Architecture

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai

## Context

Veracity runs a mature custom Gemini orchestrator (`lib/agents/orchestrator.ts`) with deterministic quality/evidence stacks. Early drafts mentioned LangGraph; the phase-plan decision register already preferred custom orchestration. A hybrid migration was proposed for maintainability.

## Decision

1. **Option C — Small Hybrid** is the approved track: improve custom first; optional LangGraph only as a `WorkflowExecutor` implementation.
2. LangGraph is **not** the product architecture and must not be default-on without benchmark gates (ADR-0007).
3. Accuracy-critical modules remain custom TypeScript (ADR-0005).

## Consequences

### Positive

- Preserves working honesty stack and agent contracts.
- Allows A/B of wave executors without rewrite.
- Avoids premature framework lock-in.

### Negative / Trade-offs

- Dual executor maintenance until one wins.
- Phase 0 work required before any LangGraph dependency.

## Alternatives Considered

1. **Option A — keep as-is** — rejected; god-file and test gaps are real debt.
2. **Option B — improve only, never abstract executor** — rejected as final state; no safe A/B path.
3. **Option D/E — medium/large LangGraph migration** — rejected; accuracy and lock-in risk.

## References

- `docs/architecture/final-recommendation.md`
- `docs/phase_by_phase_improvement_plan.md` decision register
