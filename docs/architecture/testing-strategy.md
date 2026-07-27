# Testing Strategy

No LangGraph dependency until Phase 0 unit + integration + golden suites are green.

| Suite | Purpose | When |
|-------|---------|------|
| Unit | Planners, gates, intent, evidence, grounding | Existing + keep green |
| Integration | Mocked `orchestrate()` Tier 0 / classify-fail / exec / abstain | Phase 0 |
| Workflow | Wave ordering, cancel between waves | Phase 0–2 |
| Golden | Serialized `OrchestratorOutput` shapes | Phase 0 |
| Prompt regression | Snapshot prompt assets | Phase 0 after extract |
| Performance | Wave wall-clock + call counts | Phase 2+ |
| AI quality | `npm run test:quality`, `test:router`, refine fixtures | Continuous |
| Executor parity | Same inputs → compare outputs (allowlist volatile fields) | Phase 2–3 |
| E2E | SSE chunk contract; async job smoke | Continuous |
| Benchmark | ≥100 dual-executor | Phase 4 |

## Phase gate

Every migration phase must keep CI green. Phase N+1 does not start if Phase N tests fail.
