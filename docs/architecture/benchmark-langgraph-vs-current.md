# Benchmark: LangGraphExecutor vs CurrentExecutor

**Date:** 2026-07-27T21:17:30.883Z  
**Mode:** Deterministic stub agents (wave-executor parity)  
**Corpus:** 109 queries (`scripts/benchmarks/queries.json`)  
**Verdict:** **PASS** (parity + stub latency gates)

## Gates (success metrics)

| Gate | Result | Detail |
|------|--------|--------|
| Outcome parity | PASS | 0 mismatches / 97 ran |
| Stub absolute overhead (p50 ≤20ms, p95 ≤30ms) | PASS | overhead p50 3.992ms, p95 7.255ms (ratios 1.0485 / 1.0876) |
| Live accuracy / evidence / cost / latency ≤+5% | **Deferred** | Required before `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` default-on (ADR-0007) |

## Latency

| Executor | p50 (ms) | p95 (ms) |
|----------|----------|----------|
| Current | 82.329 | 82.842 |
| LangGraph | 86.321 | 90.097 |
| Absolute overhead | 3.992 | 7.255 |

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

## Phase 5 status (2026-07-28)

**Decision: do not enable LangGraph by default.**

Stub Phase 4 passed (parity + absolute overhead). Per ADR-0007, live accuracy/evidence/cost/latency gates remain open. Production continues on `CurrentExecutor` until a live benchmark report updates this section to PASS.

- Corpus: `scripts/benchmarks/queries.json`
- Results: `scripts/benchmarks/results-executor-parity.json`
- Runner: `npm run bench:executors`
