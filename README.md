# Veracity

> Multi-agent growth & competitive intelligence — live research, execution assets, closed feedback loop, and executive PDF export.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Gemini](https://img.shields.io/badge/Gemini-AI-blue?logo=google)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-green?logo=postgresql)
![Tests](https://img.shields.io/badge/Vitest-unit_tests-brightgreen?logo=vitest)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Docs for other developers (start here)

| Document | Purpose |
|----------|---------|
| **[`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md)** | **Single engineering execution plan (v2.0.1)** — checkboxes, Now/Next/Later (§0C), onboarding (§0D), competition Must-Haves |
| **[`plan.md`](./plan.md)** | Product thesis & winning strategy |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |
| [`CLAUDE.md`](./CLAUDE.md) | Agent/domain notes for contributors |
| [`.env.example`](./.env.example) | Required vs optional environment variables |

> **Rule of thumb:** setup → this README · **what to build today** → phase plan §0C · strategy → `plan.md` · ADRs → `docs/adr/`.

### 15-minute onboarding

1. Skim this README (setup + architecture).
2. Open the phase plan → **§0A / §0B / §0C / §0D**.
3. Copy `.env.example` → `.env`, run `npm install`, `npm run db:setup`, `npm run dev`.
4. Run `npm test` and `npm run test:quality`.

---

## Overview

Veracity is a Next.js app for product and growth teams. Ask a question; specialist agents fan out over live web/community signals, synthesise confidence-scored findings, optionally generate campaign assets, and learn from feedback.

**Two-stage architecture (Gemini):**

1. **Research** — market trends, competitive, win/loss, pricing, positioning, adjacent (parallel). Optional MiroFish swarm.
2. **Execution** — when the query asks for copy/campaigns: content, A/B variants, outreach timeline, then refine from recorded outcomes.

### Highlights

- Real-time **SSE** agent progress on the dashboard
- Structured artifacts (matrix, charts, mind map, execution plan)
- **One composer** for new queries and follow-ups (New query starts a fresh session)
- Session history, user memory, semantic recall (**pgvector**)
- **Output quality gate** — entity-aware sources + anti-hallucination abstain rules
- Cost / latency / call counts on each sweep
- Structured JSON logging + correlation IDs
- **Export PDF** executive report
- Rate limiting (Upstash), CI + pre-commit hooks
- Steal strategy + API usage tabs

---

## Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL with [`pgvector`](https://github.com/pgvector/pgvector) (local Homebrew/`apt`, or Supabase)
- [Google AI Studio](https://aistudio.google.com) Gemini API key
- Optional: SerpAPI, Firecrawl, Apify, Upstash Redis, MiroFish (Python)

### 1. Install

```bash
git clone <your-fork-or-org>/Veracity.git
cd Veracity
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Minimum to boot (validated by `lib/config.ts`):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veracity
AUTH_SECRET=change-me-to-a-long-random-string
GEMINI_API_KEY=your_gemini_api_key
```

See `.env.example` for tool keys, MiroFish URLs, Google OAuth, and rate-limit Redis. Set `UPSTASH_*` in production to **enforce** sweep rate limits (fail-open without them).

### 3. Database

```bash
# create DB + apply schema (includes vector types where configured)
npm run db:setup

# if needed, also apply numbered migrations under db/migrations/
# e.g. db/migrations/0002_pgvector.sql
```

Supabase users: run SQL under `supabase/schema.sql` and `supabase/migrations/` in order.

### 4. Run

```bash
npm run dev                 # Next.js only → http://localhost:3000
npm run dev:full            # Next.js + local MiroFish (Python venv)
npm run mirofish:bootstrap  # seed a local MiroFish simulation map
```

### 5. Quality checks

CI runs `npm test` and `npm run test:quality` on every PR. Locally:

```bash
npm test
npm run test:quality   # offline output-quality / anti-hallucination scenarios
npm run typecheck
npm run lint
# optional (needs running app + real session cookie):
# COOKIE='veracity_session=…' npm run test:api-smoke
```

---

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run dev:full` | App + MiroFish side-by-side |
| `npm run mirofish` | MiroFish Flask service only |
| `npm run build` / `start` | Production build & serve |
| `npm test` | Vitest unit tests |
| `npm run test:quality` | Offline quality gate + abstain / category-mismatch scenarios |
| `npm run test:api-smoke` | Live HTTP smoke of all `/api` routes (`COOKIE=veracity_session=…`) |
| `npm run typecheck` | `tsc --noEmit` |

---

## Architecture (short)

```
app/page.tsx              Dashboard shell (SSE + sessions)
components/ui/            Sidebar, chat, progress, results, memory
components/artifacts/     Domain visualizations + ArtifactRenderer
components/export/        Executive PDF (react-pdf)
lib/agents/               Orchestrator + domain/execution agents + output-quality
lib/tools/                SerpAPI, Firecrawl, Reddit/HN, Apify, source-relevance, …
lib/logger.ts             JSON logs + correlation IDs
lib/export/               PDF report data shaping
mirofish-service/         Optional local swarm service (Python)
docs/                     ADRs + phase engineering plan (SoT)
plan.md                   Product thesis for the team
```

### Orchestrator flow

1. Classify query (LLM + deterministic execution-intent heuristics)
2. Fan out research agents (`Promise.allSettled`)
3. Optionally run execution engine grounded in Stage 1
4. Entity-filter sources → synthesise prose + recommendations + mind map
5. URL hygiene + **output quality gate** (abstain/soften when evidence is thin)
6. Stream SSE chunks; attach metrics

### Feedback loop

```
Research → Execute → Rate / record results → Refine → sharper next cycle
```

---

## API sketch

### `POST /api/chat`

SSE stream. Body includes `query`, optional `history`, `images`, `memoryContext`, selected agents, `followUpMode`.

Chunks: `agent_update` · `orchestration_log` · `result` · `error` (+ MiroFish variants).

Response includes `x-correlation-id` for log correlation.

### `POST /api/feedback` / `GET /api/feedback`

Recommendation ratings, actions, variant results.

### `POST /api/refine`

Re-run execution (and related orchestration) with accumulated feedback.

### `POST /api/embed` · `POST /api/recall`

Index / retrieve semantic session context via pgvector.

### `POST /api/steal-strategy` · `GET /api/usage-info`

Steal-strategy analysis · configured providers/models (no secrets).

---

## Team ownership

| Focus | Typical areas |
|-------|----------------|
| Orchestration + refine loop | `lib/agents/orchestrator.ts`, `app/api/refine`, feedback tables |
| Agent quality + grounding | `lib/agents/*`, `lib/agents/output-quality.ts`, `lib/tools/source-relevance.ts` |
| Dashboard UX | `app/page.tsx`, `components/ui/*`, `components/artifacts/*` |
| Tools + QA + CI | `lib/tools/*`, `__tests__/*`, `.github/workflows` |

**What to build next:** always check phase plan **§0C Now / Next / Later** and open `[ ]` items in §0. RACI lives in the phase plan §5.

---

## Configuration tips

### New agent

1. Add `lib/agents/my-agent.ts` implementing `AgentConfig`
2. Register in `lib/agents/orchestrator.ts`
3. Add domain meta / UI tab if user-facing

### Tool fallbacks

Tools return `ToolResult<T>` via `lib/tools/fallback.ts` — never throw; status `ok | degraded | failed` feeds confidence penalties.

### Themes

Dark/light via `lib/theme-provider` (header toggle). Brand wordmarks: `components/ui/BrandWordmark.tsx`.

---

## Deployment

- Deploy on Vercel (or Node host). Set env from `.env.example`.
- Chat route uses `maxDuration = 120` — ensure the plan allows long SSE runs.
- Production: tighten RLS (Supabase migrations), set strong `AUTH_SECRET`, enable rate limits (Upstash).
- Competition UI flags (when implemented): see phase plan §29 (`ff_board_mode`, `ff_orchestrator_view`, `ff_evidence_trail`, `ff_async_sweep`).

---

## Contributing

1. Read [`plan.md`](./plan.md) and **§0C / open checkboxes** in [`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md)
2. Branch: `feat/TASK-id-slug` (see phase plan §5)
3. `npm test` && `npm run test:quality` && `npm run typecheck`
4. Prefer short commit messages focused on *why*
5. Open a PR; update §0 checkboxes when the work lands

---

## License

MIT — see [LICENSE](LICENSE) if present.

## Acknowledgements

Google Gemini · PostgreSQL / pgvector · Firecrawl · SerpAPI · Next.js · Vitest · `@react-pdf/renderer`
