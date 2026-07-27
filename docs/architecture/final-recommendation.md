# Final Engineering Recommendation

## Choice: Option C — Small Hybrid migration

| Option | Meaning | Verdict |
|--------|---------|---------|
| A Keep current as-is | No modularization | **Reject** — god-file, stub scratchpad, missing `orchestrate` tests |
| B Improve current only | Phase 0 forever; no executor iface | **Insufficient end-state** — Phase 0 still mandatory first |
| **C Small Hybrid** | Phase 0→2 always; LG behind flag; enable iff benchmarks | **Select** |
| D Medium Hybrid | Deep LG for quality/retry/execution | **Reject** — accuracy/lock-in risk |
| E Large migration | Rewrite onto LG | **Reject** — violates improve-before-replace |

## Evidence

1. Accuracy moat is deterministic TypeScript (quality, evidence, grounding, signal penalty) — must stay custom.
2. Mission DAG already exists (~110 LOC); only the wave runner is a rational LangGraph target.
3. Inngest already provides job durability; LangGraph does not replace the scale path.
4. Highest ROI is Phase 0 improve-before-replace.
5. `WorkflowExecutor` prevents lock-in: the app never depends on LangGraph types.
6. Prior “not LangGraph” decision remains the **default**; Option C only revisits under measurable gates.

## Kill-switch

If Phase 4/5 live benchmarks fail, production behaviour equals **improved custom + CurrentExecutor** (Option B outcome) while retaining the interface for future attempts.

## Phase 5 status (2026-07-28)

**Accepted: ADR-0008 enablement hold.**  
Stub Phase 4 PASS; live full-corpus gates open. `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR` stays **OFF**. Operators may run `npm run bench:executors:live` for sample checks.

## Approval

- **Architecture docs:** ready for review on this branch.
- **Production LangGraph enablement:** **not approved** (ADR-0008) until live accuracy/evidence/cost/latency gates pass.
