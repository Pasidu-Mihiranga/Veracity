# ADR-0005: Accuracy Stack Remains Pure TypeScript

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | ai | product

## Context

Veracity’s differentiation includes `computeSignalQualityPenalty`, `applyOutputQualityGate`, entity source relevance, `filterAndRankSources`, evidence bind/coverage, and `enforceExecutionGrounding`. These are deterministic and regression-tested.

## Decision

1. Quality, evidence, source validation, scrape quality, signal penalty, execution grounding, and execution-intent regex **remain custom pure TypeScript**.
2. They must not be reimplemented as LangGraph “intelligence” or LLM-only self-checks.
3. Post-processing order is fixed: entity filter → synthesize → rank → quality → bind → coverage.
4. Prompts remain soft guards; hard stops stay in code.

## Consequences

### Positive

- Preserves hallucination resistance and evidence fidelity.
- Existing unit tests remain authoritative.

### Negative / Trade-offs

- Graph diagrams will show these as library calls, not “smart nodes.”

## Alternatives Considered

1. **LLM judge node instead of quality gate** — rejected; non-deterministic and weaker than tested thresholds.
2. **Move bind-evidence into agent prompts** — rejected; citation fidelity regresses.

## References

- `lib/agents/output-quality.ts`
- `lib/agents/bind-evidence.ts`
- `lib/agents/execution/grounding.ts`
- `docs/architecture/langgraph-suitability-matrix.md`
