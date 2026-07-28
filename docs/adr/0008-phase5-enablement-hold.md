# ADR-0008: Phase 5 Enablement Hold — CurrentExecutor Remains Default

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai

## Context

Phase 4 stub benchmarks passed (109-query corpus; 0/97 outcome mismatches; ~4ms p50 absolute overhead). ADR-0007 requires live accuracy, evidence, cost, and ≤+5% latency gates before LangGraph default-on. A full live 100-query Gemini+tools sweep is expensive and was not completed as a blocking gate.

## Decision

1. **`NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` remains default OFF** in production and local defaults.
2. **`CurrentExecutor` is the production wave runner.**
3. LangGraph may be enabled only for explicit experiments (`NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR=1`) after operators review live sample results from `npm run bench:executors:live`.
4. A future ADR may supersede this only when a live report documents PASS on accuracy/evidence/cost/latency gates.

## Consequences

### Positive

- No accuracy risk from premature default-on.
- Hybrid infrastructure remains available behind the flag.
- Clear operator path for live sampling.

### Negative / Trade-offs

- Dual executor maintenance until live gates complete or LangGraph is retired.
- Live full-corpus cost deferred.

## Alternatives Considered

1. **Default-on after stub PASS** — rejected; violates ADR-0007 accuracy-first policy.
2. **Remove LangGraph dependency now** — rejected; Option C retains opt-in executor for future measured enablement.

## References

- `docs/architecture/benchmark-langgraph-vs-current.md`
- ADR-0002, ADR-0004, ADR-0007
- `npm run bench:executors` / `npm run bench:executors:live`
