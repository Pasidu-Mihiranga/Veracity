# Veracity — Product Strategy & Winning Thesis

> **Active build plan:** [`plans/MVP_BUILD_PLAN.md`](./plans/MVP_BUILD_PLAN.md). Current tasks are in [`plans/TODO.md`](./plans/TODO.md), and completed work/verification is recorded in [`log.md`](./log.md). These files supersede the historical phase plans for MVP implementation order.

> **2026-08-01 product reset:** The current market research, positioning, and functional build priority now live in [`docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`](./docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md). This older thesis remains useful architecture/history, but the product-first roadmap wins if the documents conflict.

> **Share this with other developers.** It explains *why* we build what we build.  
> For the living engineering checklist (phases, tasks, exit criteria), use  
> [`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md).

---

## 1. Core winning thesis

Judges and customers will see research bots and chat wrappers. We win by:

1. **Seamless intent detection** — no manual “switch to research mode”; conversation flows naturally into research or execution.
2. **Ephemeral UIs in the thread** — variant grids, domain panels, charts, mind maps, and execution plans rendered inline (artifact-style).
3. **Closed loop with learning** — recommendation ratings + variant results feed refine; the next cycle is measurably sharper.
4. **Live signals only** — real web/community research (SerpAPI, Firecrawl, Reddit/HN, Apify, etc.), not canned prompts.
5. **Polish & demo clarity** — responsive dashboard, live agent progress (SSE), cost/latency metrics, executive PDF export.
6. **Technical excellence** — multi-agent orchestration (research fan-out → synthesis → optional execution), typed outputs, tests, CI.

This hits the hard constraints: multi-agent, dynamic UIs, tools/live data, full loop — not a single prompt.

---

## 2. Current tech stack (source of truth)

| Layer | Choice | Notes |
|-------|--------|--------|
| LLM | Google Gemini (`GEMINI_MODEL`, default flash-class) | Multimodal; usage tracked via `usageMetadata` |
| Orchestration | Custom TypeScript orchestrator (`lib/agents/orchestrator.ts`) | Parallel research + conditional execution |
| Agents | 6 research + execution engine (+ MiroFish swarm optional) | Structured `AgentOutput` + confidence/sources |
| Tools | SerpAPI, Firecrawl, Reddit/HN, Apify, scrape fallbacks | Degrade gracefully when keys missing |
| Frontend | Next.js 15 + React 19 + Tailwind | SSE chat, modular UI under `components/ui/` |
| Data | PostgreSQL + pgvector (local and/or Supabase) | Sessions, memory, embeddings, feedback |
| Auth | JWT (`AUTH_SECRET`) + optional Google OAuth / Supabase | See `.env.example` |
| Observability | JSON logger + correlation IDs (`lib/logger.ts`) | Chat route emits `x-correlation-id` |
| Export | `@react-pdf/renderer` executive PDF | Intelligence Summary → Export PDF |

> Historical note: early hackathon drafts mentioned Claude + LangGraph. **This repo runs on Gemini + our orchestrator.** Use the product-first roadmap for current scope; use this section for the implemented stack context.

---

## 3. Agent architecture

```
User query
  → Orchestrator (classify intent, fan-out)
      → Research agents (parallel): market, competitive, win/loss, pricing, positioning, adjacent
      → Optional: MiroFish / MiroFish Live (swarm forecast)
      → Optional Stage 2: Execution Engine (content, A/B variants, outreach)
  → Synthesis + mind map + recommendations
  → SSE stream to dashboard
  → Feedback → Refine loop
```

All agents return structured outputs so claims stay traceable to sources and tools.

---

## 4. How developers should use this repo

| Doc | When to read it |
|-----|-----------------|
| [`README.md`](./README.md) | Setup, scripts, API overview |
| **This file (`plan.md`)** | Product thesis + architecture intent |
| [`docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`](./docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md) | Current product scope and build order |
| [`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md) | Historical engineering task inventory and detailed quality gates |
| [`docs/adr/`](./docs/adr/) | Architecture decisions (governance, env schema) |
| [`CLAUDE.md`](./CLAUDE.md) | Deeper agent/domain notes for AI-assisted work |
| [`.env.example`](./.env.example) | Required vs optional env vars |

**Before starting work:** check the phase tracker in the improvement plan, pick an open `[ ]` item, open a branch, keep commits simple (no “Phase N” wording required).

---

## 5. Demo / product proof points

- Live agent status grid during a sweep  
- Artifact drill-down with sources  
- Execution plan with “record result” + refine  
- Cost/latency strip on the intelligence summary  
- One-click **Export PDF** for stakeholder share-out  

---

*Last updated: 2026-07-22 — aligned with Gemini orchestrator, observability, and PDF export.*
