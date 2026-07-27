# Live Sample Benchmark (Phase 5)

**Date:** 2026-07-27T21:35:48.458Z  
**Sample size:** 2  
**Verdict:** **PASS** (sample)

| Gate | Result |
|------|--------|
| Crashes | PASS (0) |
| Status parity | PASS (0) |
| Avg latency ratio ≤ 1.25 | PASS (1.0001) |

## Recommendation

Live sample healthy (status parity, ~1.0 latency ratio).  

- **Local testing:** `NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR=1` in `.env` is OK for full-flow QA on this branch (restart `npm run dev`).  
- **Code / production default:** remains **OFF** (ADR-0008) until PR decides otherwise. `.env` is gitignored and will not flip prod.

## Cases

- `q013`: ratio=1.0002 statusOk=true
- `q014`: ratio=1 statusOk=true
