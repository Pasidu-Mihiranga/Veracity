# Benchmark Plan

## Gate

Before any default enablement of `LangGraphExecutor`, run a dual-executor comparison on **≥100** representative queries.

## Query corpus (minimum categories)

| Category | Examples | Count target |
|----------|----------|--------------|
| Tier 0 | Greetings, meta, gibberish | ≥10 |
| Tier 1–2 | Narrow single-domain | ≥20 |
| Tier 3 full swarm | Multi-domain competitive | ≥30 |
| Execution intent | Campaign / A/B / outreach | ≥15 |
| Homonym / person-name traps | Ambiguous entity | ≥10 |
| Thin evidence | Obscure products | ≥10 |
| Refine follow-ups | Feedback-injected | ≥5 |

Total ≥ 100. Store fixtures under `scripts/benchmarks/queries.json` when Phase 4 starts.

## Compare per query

- Answer rubric / accuracy score
- Evidence URLs and bind quality
- Confidence levels
- Source set / trust tiers
- Latency (p50/p95 across runs)
- Token / `geminiCallCount` / estimated cost
- Quality gate flags and abstain behaviour
- Report payload fields
- Consistency (repeat N=3 for flaky categories)

## Pass criteria

See [success-metrics.md](./success-metrics.md). All gates must pass.

## Report artifact

Publish `docs/architecture/benchmark-langgraph-vs-current.md` with pass/fail.  
**Continue only if** LangGraph matches or exceeds CurrentExecutor on accuracy/evidence and meets latency/cost gates.
