# Success Metrics

Migration (and LangGraph default-on) is successful **only** if all gates pass.

| Metric | Gate |
|--------|------|
| Accuracy | Equal or exceed golden / rubric baseline |
| Evidence quality | 100% preserve bind + coverage contracts on fixtures |
| Hallucination / gate | Abstain & soften rates within agreed tolerance; no rise in ungrounded claims |
| Latency | p50/p95 ≤ **+5%** vs CurrentExecutor |
| Cost / tokens | ≤ **+5%** geminiCallCount / estimatedCost |
| Regression | Zero critical; SSE contract intact |
| Maintainability | Orchestrator coordinator **&lt;400 LOC**; stages modular |
| Module size | Wave executors individually reviewable (~&lt;300 LOC) |
| Productivity | New mission edge = `planMission` change + executor consume; no agent rewrite |
| Enablement | LangGraph default-on only after Phase 4 approval |

**Failure of any gate → keep `CurrentExecutor`.** Do not enable for plan compliance.
