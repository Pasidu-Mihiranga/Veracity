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

If Phase 4 benchmarks fail, production behaviour equals **improved custom + CurrentExecutor** (Option B outcome) while retaining the interface for future attempts.

## Approval

- **Architecture docs:** ready for review on this branch.
- **Production LangGraph enablement:** not approved until Phase 4 report passes success metrics.
