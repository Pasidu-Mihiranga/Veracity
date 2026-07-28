# Code Quality Assessment

## Strengths (preserve)

1. Hybrid deterministic + LLM classification with Tier 0 fast-path.
2. Pure, tested policy modules: adaptive selection, mission planner, execution planner, output quality, evidence bind, execution intent.
3. Signal quality penalty + execution grounding — product moat.
4. Graceful partial failure (`Promise.allSettled` + synthesis fallback).
5. Same `orchestrate()` for SSE and Inngest.
6. Typed `AgentOutput` / artifacts for UI and export.

## Issues

| # | Problem | Evidence | Root cause | Impact | Recommendation | Risk | Effort | Benefit |
|---|---------|----------|------------|--------|----------------|------|--------|---------|
| 1 | God-orchestrator | `orchestrator.ts` ~1078 LOC | Stages co-located | Hard to change safely | Split stage modules | Med | M | High |
| 2 | Scratchpad stub | Write-only; agents unread | Half Gen-2 | Fake collaboration | Wire or remove | High | S–L | Honesty |
| 3 | Policy in control loop | Domain pad / cost in loop | Convenience | Untestable policy | Extract policies | Low | S | Clarity |
| 4 | Duplicated agent/cost | 6 agents same shape; cost ×3 | Copy-paste | Fix drift | Helper + cost module | Low | S | Consistency |
| 5 | Hidden couplings | Classify-fail→full swarm; SSE no cancel | Path drift | Cost/UX | Unify cancel; pass classification | Med | S–M | Reliability |
| 6 | No `orchestrate()` tests | Tests stop at planners | Deferred mocks | Blocks migration | Integration + goldens | High if skipped | M | Unlocks Phase 0+ |
| 7 | Inline prompts | ~12 modules | No prompt package | Unsafe edits | `lib/agents/prompts/` | Low | M | Safer iteration |
| 8 | HuggingFace* names | `gemini.ts` | Historical | Confusion | Rename + aliases | Low | S | Clarity |
| 9 | Missing ADRs | Only ADR-0001 | Decisions in phase plan | Weak governance | ADR-0002..0007 | Low | S | Traceability |
| 10 | Sync timeout (TD-12) | `asyncSweep` default off | Demo convenience | 120s failures | Prefer async heavy tiers | Med | S | Reliability |

## Priority for Phase 0

P0: `orchestrate()` tests + goldens; scratchpad decision; split coordinator.  
P1: Prompt extraction; cost/agent helpers.  
P2: Naming cleanup; async default policy (product call).
