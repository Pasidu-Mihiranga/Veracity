# Benchmark: LangGraphExecutor vs CurrentExecutor

**Date:** 2026-08-02T09:44:29.811Z  
**Mode:** Deterministic stub agents (wave-executor parity)  
**Corpus:** 109 queries (`scripts/benchmarks/queries.json`)  
**Verdict:** **PASS** (parity + stub latency gates)

## Gates (success metrics)

| Gate | Result | Detail |
|------|--------|--------|
| Outcome parity | PASS | 0 mismatches / 97 ran |
| Stub absolute overhead (p50 ≤20ms, p95 ≤30ms) | PASS | overhead p50 7.884ms, p95 10.731ms (ratios 1.0958 / 1.1289) |
| Live accuracy / evidence / cost / latency ≤+5% | **Deferred** | Required before `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` default-on (ADR-0007) |

## Latency

| Executor | p50 (ms) | p95 (ms) |
|----------|----------|----------|
| Current | 82.265 | 83.26 |
| LangGraph | 90.149 | 93.991 |
| Absolute overhead | 7.884 | 10.731 |

## Corpus mix

- **tier0:** 12
- **tier1_2:** 22
- **tier3:** 31
- **execution:** 16
- **homonym:** 11
- **thin_evidence:** 11
- **refine:** 6

- Wave executor exercised: **97** cases  
- Skipped (Tier 0 / empty domains): **12**

## Recommendation

Wave-executor parity and stub latency gates **passed**. LangGraph remains **feature-flag OFF** until a live (≥100 query) accuracy/evidence/cost benchmark also passes (ADR-0007 / Phase 5).

## Artifacts

- Corpus: `scripts/benchmarks/queries.json`
- Results: `scripts/benchmarks/results-executor-parity.json`
- Runner: `npm run bench:executors`
