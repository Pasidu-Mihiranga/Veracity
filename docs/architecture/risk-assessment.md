# Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Accuracy regression (reorder/rewrite honesty stack) | Critical | Keep custom; goldens; parity |
| Dual-executor drift | High | Shared interface; single mission planner; parity tests |
| Framework lock-in | Medium | Agents/platform never import LangGraph |
| Latency/cost creep | Medium | ≤+5% gates; benchmark |
| False Gen-2 collaboration (unread scratchpad) | High | Phase 0 wire or remove |
| Sync timeout (TD-12) | Medium | Prefer async for heavy tiers (independent of LG) |
| Prompt rewrite during “agent migration” | High | Agents stay custom; no LC chains |
| Silent KG / side-effect failures | Medium | Warn-log; do not couple to executor choice |

## Rollback

1. Set `langgraphExecutor` feature flag **false**.
2. Traffic uses `CurrentExecutor` immediately.
3. No database migration required for Small Hybrid.
4. Remove LangGraph dependency only if permanently abandoned (optional cleanup).

## Compatibility

- SSE event types unchanged.
- `OrchestratorOutput` schema unchanged.
- Inngest job progress callbacks unchanged.
