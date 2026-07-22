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

Share and read these first when onboarding:

| Document | Purpose |
|----------|---------|
| **[`plan.md`](./plan.md)** | Product thesis, winning strategy, and current architecture intent — **share this with the team** |
| **[`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md)** | Living phase checklist (what’s done / what’s next). Update checkboxes when you ship work |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records (governance, env standards) |
| [`CLAUDE.md`](./CLAUDE.md) | Deep agent/domain notes for contributors and AI-assisted coding |
| [`.env.example`](./.env.example) | Required vs optional environment variables |

> **Rule of thumb:** strategy → `plan.md` · execution backlog → `docs/phase_by_phase_improvement_plan.md` · setup → this README.

---

## Overview

Veracity is a Next.js app for product and growth teams. Ask a question; specialist agents fan out over live web/community signals, synthesise confidence-scored findings, optionally generate campaign assets, and learn from feedback.

**Two-stage architecture (Gemini):**

1. **Research** — market trends, competitive, win/loss, pricing, positioning, adjacent (parallel). Optional MiroFish swarm.
2. **Execution** — when the query asks for copy/campaigns: content, A/B variants, outreach timeline, then refine from recorded outcomes.

### Highlights

- Real-time **SSE** agent progress on the dashboard  
- Structured artifacts (matrix, charts, mind map, execution plan)  
- Session history, user memory, semantic recall (**pgvector**)  
- Cost / latency / call counts on each sweep  
- Structured JSON logging + correlation IDs  
- **Export PDF** executive report from Intelligence Summary  
- Rate limiting (Upstash), CI + pre-commit hooks  

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

See `.env.example` for tool keys, MiroFish URLs, Google OAuth, and rate-limit Redis.

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

```bash
npm test
npm run typecheck
npm run lint
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
| `npm run typecheck` | `tsc --noEmit` |

---

## Architecture (short)

```
app/page.tsx              Dashboard shell (SSE + sessions)
components/ui/            Sidebar, chat, progress, results, memory
components/artifacts/     Domain visualizations + ArtifactRenderer
components/export/        Executive PDF (react-pdf)
lib/agents/               Orchestrator + domain/execution agents
lib/tools/                SerpAPI, Firecrawl, Reddit/HN, Apify, …
lib/logger.ts             JSON logs + correlation IDs
lib/export/               PDF report data shaping
mirofish-service/         Optional local swarm service (Python)
docs/                     ADRs + phase improvement plan
plan.md                   Product thesis for the team
```

### Orchestrator flow

1. Classify query (LLM + deterministic execution-intent heuristics)  
2. Fan out research agents (`Promise.allSettled`)  
3. Optionally run execution engine grounded in Stage 1  
4. Synthesise prose + recommendations + mind map  
5. Stream SSE chunks; attach metrics  

### Feedback loop

```
Research → Execute → Rate / record results → Refine → sharper next cycle
```

---

## API sketch

### `POST /api/chat`

SSE stream. Body includes `query`, optional `history`, `images`, `memoryContext`, selected agents.

Chunks: `agent_update` · `orchestration_log` · `result` · `error` (+ MiroFish variants).

Response includes `x-correlation-id` for log correlation.

### `POST /api/feedback` / `GET /api/feedback`

Recommendation ratings, actions, variant results.

### `POST /api/refine`

Re-run execution (and related orchestration) with accumulated feedback.

### `POST /api/embed` · `POST /api/recall`

Index / retrieve semantic session context via pgvector.

---

## Team ownership (optional sprint model)

| Focus | Typical areas |
|-------|----------------|
| Orchestration + refine loop | `lib/agents/orchestrator.ts`, `app/api/refine`, feedback tables |
| Agent quality + grounding | `lib/agents/*`, `lib/agents/execution/*` |
| Dashboard UX | `app/page.tsx`, `components/ui/*`, `components/artifacts/*` |
| Tools + QA + CI | `lib/tools/*`, `__tests__/*`, `.github/workflows` |

For **what to build next**, always check [`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md).

---

## Configuration tips

### New agent

1. Add `lib/agents/my-agent.ts` implementing `AgentConfig`  
2. Register in `lib/agents/orchestrator.ts`  
3. Add domain meta / UI tab if user-facing  

### Tool fallbacks

Tools return `ToolResult<T>` via `lib/tools/fallback.ts` — never throw; status `ok | degraded | failed` feeds confidence penalties.

### Themes

Dark/light via `lib/theme-provider` (header toggle).

---

## Deployment

- Deploy on Vercel (or Node host). Set env from `.env.example`.  
- Chat route uses `maxDuration = 120` — ensure the plan allows long SSE runs.  
- Production: tighten RLS (Supabase migrations), set strong `AUTH_SECRET`, enable rate limits (Upstash).

---

## Contributing

1. Read [`plan.md`](./plan.md) and the open items in [`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md)  
2. Branch from `main`: `git checkout -b feature/short-name`  
3. `npm test` && `npm run typecheck`  
4. Prefer short commit messages focused on *why*  
5. Open a PR  

---

## License

MIT — see [LICENSE](LICENSE) if present.

## Acknowledgements

Google Gemini · PostgreSQL / pgvector · Supabase · Firecrawl · SerpAPI · Next.js · Vitest · `@react-pdf/renderer`
