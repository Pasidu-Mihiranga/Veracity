# ADR-0006: Scratchpad / Agent Collaboration

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai

## Context

`orchestrate()` builds a scratchpad and appends `productFacts` from agent outputs, but domain agents do not read scratchpad fields. Wave dependencies delay start without passing structured prior findings. Docs risk overselling Gen-2 collaboration.

## Decision

1. **Phase 0:** Implement real cross-wave sharing by injecting a concise prior-wave findings summary into each subsequent agent’s `priorContext` (and keep scratchpad facts for typed consumers).
2. Do not claim multi-agent debate or unread scratchpad as collaboration.
3. If sharing proves harmful to latency/quality in tests, revert to full parallel fan-out and delete unused scratchpad fields (follow-up ADR).

## Consequences

### Positive

- Architecture matches behaviour.
- Later waves can ground on earlier facts without LangGraph.

### Negative / Trade-offs

- Slightly longer prompts for dependent agents.
- Must monitor latency and accuracy goldens.

## Alternatives Considered

1. **Delete scratchpad immediately** — acceptable fallback; chosen primary is light-weight prior-context injection for Gen-2 honesty.
2. **Full LangGraph shared state first** — rejected until Phase 0/benchmarks.

## References

- `lib/agents/orchestrator.ts`
- `lib/agents/mission-planner.ts`
- `docs/architecture/current-architecture.md`
