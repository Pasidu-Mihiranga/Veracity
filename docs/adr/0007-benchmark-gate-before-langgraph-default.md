# ADR-0007: Benchmark Gate Before LangGraph Default-On

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai | devops

## Context

Shipping LangGraph as default without measurable parity risks accuracy, latency, and cost regressions. The project must not migrate because a roadmap phase expected it.

## Decision

1. `LangGraphExecutor` ships behind a feature flag default **OFF**.
2. Before default-on: run ≥100-query dual-executor benchmark per `docs/architecture/benchmark-plan.md`.
3. All [success metrics](../architecture/success-metrics.md) must pass.
4. Failure → keep `CurrentExecutor` permanently until a new ADR revisits.

## Consequences

### Positive

- Evidence-based enablement.
- Clear kill-switch culture.

### Negative / Trade-offs

- Benchmark cost (tokens/time) before enablement.
- Flag dual-path until decision.

## Alternatives Considered

1. **Enable after parity unit tests only** — rejected; insufficient for live tool variance.
2. **Shadow traffic in production without gates** — postponed; staging benchmark first.

## References

- `docs/architecture/benchmark-plan.md`
- `docs/architecture/success-metrics.md`
- ADR-0002, ADR-0004
