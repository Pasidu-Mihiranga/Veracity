# Veracity

> **Know what changed, prove it, and decide what to do next.**
>
> A living competitive decision workspace. Veracity monitors the competitors and
> sources a team chooses, turns what it finds into a traceable evidence ledger,
> and builds charts whose every value can be traced back to the exact excerpt it
> came from.

**Status: advanced prototype, private beta.** Not enterprise-ready — identity,
tenancy, and governance are deliberately deferred until the core loop retains
users. See [`plans/GAP_CLOSURE_AND_FEATURE_PLAN.md`](./plans/GAP_CLOSURE_AND_FEATURE_PLAN.md) §5.6.

### What is actually true today

| Claim | Reality |
|---|---|
| Evidence-backed claims | Real: `metric_observations` cannot be stored without an evidence span, enforced by the database |
| Measured charts | Real for GitHub releases, SEC filings, changelogs, and pricing pages. Other domains still produce model-derived output, and are labelled `derived` |
| Change detection | Real: content-hash diffing, deterministic dedupe, explainable materiality |
| No fabrication on provider failure | Enforced by `__tests__/no-fabrication-on-failure.test.ts` across all six research agents |
| Synthetic scenario panel | Model-generated personas. Not survey data, not calibrated, never enters the evidence ledger |
| Enterprise SSO / SCIM / RBAC | **Not available.** SAML routes exist but do not verify assertion signatures and are off by default |
| Image analysis | Real — image bytes are sent as multimodal parts |

---

# Getting started

Works on **macOS, Linux, and Windows (WSL2 recommended)**. Roughly 15 minutes,
most of which is waiting for installs.

## 1. What you need first

| Requirement | Version | How to check | If you do not have it |
|---|---|---|---|
| **Node.js** | 20.12 or newer (22 recommended) | `node -v` | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **PostgreSQL** | 14+ with the `pgvector` extension | `psql --version` | See step 3 — the repo can set up its own |
| **Git** | any recent | `git --version` | [git-scm.com](https://git-scm.com) |
| **Python** | 3.10+ | `python3 --version` | Only needed for the optional simulation service |

The repo pins Node with `.nvmrc`. If you use nvm, run `nvm use` in the project
folder and it picks the right version. **Node 18 will not work** — the test
runner fails to start on it, and the error message does not explain why.

## 2. Get the code and install

```bash
git clone <your-repo-url> veracity
cd veracity
nvm use          # optional, but pins the right Node
npm install
```

## 3. Set up the database

You need PostgreSQL with `pgvector`. Pick whichever fits.

### Option A — let the repo run its own PostgreSQL (recommended for local dev)

This creates a PostgreSQL instance inside the project folder on port **5435**,
so it cannot collide with anything else you already run.

```bash
npm run db:local:start     # starts it
npm run db:schema:apply    # creates all tables
npm run db:local:status    # confirms it is up
```

Requires PostgreSQL and pgvector installed via your package manager:

```bash
# macOS
brew install postgresql@17 pgvector

# Ubuntu / Debian / WSL2
sudo apt install postgresql postgresql-contrib postgresql-17-pgvector
```

### Option B — Docker

```bash
docker run -d --name veracity-db \
  -e POSTGRES_PASSWORD=veracity \
  -e POSTGRES_DB=veracity \
  -p 5432:5432 \
  pgvector/pgvector:pg17

npm run db:schema:apply
```

### Option C — a hosted database

Any PostgreSQL 14+ with pgvector works (Supabase, Neon, RDS). Put its
connection string in `DATABASE_URL` and run `npm run db:schema:apply`.

### Apply the migrations

After the schema, run these once. Each is safe to re-run.

```bash
npm run db:migrate:market-projects
npm run db:migrate:project-history
npm run db:migrate:project-decisions
npm run db:migrate:evidence-ledger
npm run db:migrate:swarm-scenarios
npm run db:migrate:entity-ownership
npm run db:migrate:conversation-summaries
```

## 4. Configure your keys

```bash
cp .env.example .env
```

Then open `.env` and fill it in. **Only three are required.**

### Required — the app will not start without these

| Variable | What it is | Where to get it | Cost |
|---|---|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string | From step 3. Local default: `postgresql://veracity@localhost:5435/veracity` | Free |
| `AUTH_SECRET` | Signs your login sessions | Generate one: `openssl rand -base64 32` | Free |
| `GEMINI_API_KEY` | The model that reads pages and writes the analysis | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier available |

### Strongly recommended — without these, coverage is thin

| Variable | What it unlocks | Where | Cost |
|---|---|---|---|
| `SERPAPI_KEY` | Web and news search. **Without it the product cannot search the open web at all** | [serpapi.com](https://serpapi.com) | Free tier, then paid |
| `FIRECRAWL_API_KEY` | Reading competitor pages reliably (JS-heavy sites) | [firecrawl.dev](https://firecrawl.dev) | Free tier available |

### Optional — each adds one capability, and the product says so when missing

| Variable | What it unlocks | Where | Cost |
|---|---|---|---|
| `GITHUB_TOKEN` | Higher rate limits on release tracking. Public repos work without it | [github.com/settings/tokens](https://github.com/settings/tokens) | Free |
| `FRED_API_KEY` | Macroeconomic context charts | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | Free |
| `APIFY_API_TOKEN` | Social signal from X/Twitter | [apify.com](https://apify.com) | Free tier, then paid |
| `SEC_EDGAR_USER_AGENT` | Your contact string for SEC filings. Set it to a real email | — | Free |
| `MIROFISH_*` | The simulated buyer panel. See below | — | Free (self-hosted) |

**No key needed at all** for: SEC EDGAR filings, GDELT news volume, Hacker News,
Reddit, and RSS/changelog feeds. Those work out of the box.

## 5. Start it

If you used **Option A** (the repo's own PostgreSQL), one command starts the
database, seeds a development login, and runs the app:

```bash
npm run dev:local
```

Otherwise start the app on its own — your database is already running:

```bash
npm run dev
```

Open **http://localhost:3000**.

### The development login

`npm run dev:local` creates a ready-made account so you do not sign up by hand
every time:

| | |
|---|---|
| Email | `admin@local.com` |
| Password | `admin1234` |

Re-running the command resets that password, so a forgotten local login is one
command away from working. To seed it without restarting anything:

```bash
npm run dev:seed
```

Override the values with `DEV_SEED_EMAIL` and `DEV_SEED_PASSWORD` in `.env` if
you prefer your own.

> **This account cannot be created anywhere but your own machine.** The seed
> script refuses to run when `NODE_ENV=production`, and refuses when
> `DATABASE_URL` points at anything other than a loopback address — it exits
> without touching the database. A weak, publicly documented admin login is
> only safe because it is impossible to point at a shared or hosted database,
> so please do not add a way to force it.

If you started with plain `npm run dev`, or you are on a hosted database, use
**Sign up** on the login page instead. Any email works and there is no
verification step — the account lives in your own database and nothing is sent
anywhere.

## 6. First five minutes in the product

1. **Create a Market Project** — your product, its website, and up to ten
   competitors. This is the setup you do once.
2. **Press Collect.** The product reads the pages you pointed it at and saves
   exactly what they said.
3. **Look at the dashboard.** It leads with what changed, and every number has a
   "See the quote" link showing the words it came from.
4. **Ask a follow-up.** Questions about research you already have are answered
   from what is stored — fast and nearly free.
5. **Come back next week.** It tells you what moved while you were away.

---

## Running the optional simulated-buyer panel

Not required. It lets you stress-test a decision against model-generated buyer
personas — useful for surfacing objections, **not** a prediction of the market.

```bash
cd mirofish-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..

# Generate a shared secret and put the SAME value in .env
openssl rand -hex 32

npm run mirofish        # runs on 127.0.0.1:5001
```

In `.env`:

```bash
MIROFISH_SERVICE_TOKEN=<the value you generated>
MIROFISH_LIVE_BASE_URL=http://localhost:5001
MIROFISH_ALLOWED_ORIGIN=http://localhost:3000
MIROFISH_HOST=127.0.0.1
```

The service refuses every request without the token, and binds to loopback only.
Both are deliberate: it holds a model key and does unbounded work per request.

---

## Checking your install works

```bash
npm run typecheck                    # types
npm test                             # ~785 unit tests
npm run build                        # production build
npm run test:e2e:evidence-ledger     # database rules (needs the DB up)
npm run test:e2e:dashboard           # full flow (needs `npm run dev` running)
```

`npm run test:e2e:live-research` calls **real, paid providers**. It is the only
command here that costs money.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `styleText is not exported` when running tests | Node 18 | `nvm use 22` |
| `DATABASE_URL: Required environment variable is missing` | No `.env` | `cp .env.example .env` and fill it in |
| `connect ECONNREFUSED ...:5435` | Database not running | `npm run db:local:start` |
| Searches return nothing, logs show `429` | SerpAPI quota exhausted | Top up, or accept no web search |
| `relation "evidence_spans" does not exist` | Migrations not run | Run the migration commands in step 3 |
| The panel says "unavailable" | MiroFish not running or token mismatch | Check both `.env` values match |

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
| **[`docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`](./docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md)** | **Current product direction** — market research, differentiation from general AI, accurate-chart contract, and functional build order |
| [`docs/VERACITY_FULL_TECHNICAL_AUDIT_2026-08-01.md`](./docs/VERACITY_FULL_TECHNICAL_AUDIT_2026-08-01.md) | Full technical/security/agentic audit and later hardening backlog |
| **[`docs/phase_by_phase_improvement_plan.md`](./docs/phase_by_phase_improvement_plan.md)** | **Single engineering execution plan (v2.0.1)** — checkboxes, Now/Next/Later (§0C), onboarding (§0D), competition Must-Haves |
| **[`plan.md`](./plan.md)** | Product thesis & winning strategy |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |
| [`CLAUDE.md`](./CLAUDE.md) | Agent/domain notes for contributors |
| [`.env.example`](./.env.example) | Required vs optional environment variables |
| **[`TOUR.md`](./TOUR.md)** | **Guided demo script** — how to show this to a customer, screen by screen, in plain language |
| **[`AGENTS.md`](./AGENTS.md)** | **Start here if you are an AI coding agent** — commands, conventions, and the failure modes that have actually happened in this repo |
| [`plans/TODO.md`](./plans/TODO.md) | What is built and what is not |
| [`plans/PLAIN_LANGUAGE_PLAN.md`](./plans/PLAIN_LANGUAGE_PLAN.md) | UI wording rules and the vocabulary decisions behind them |
| [`log.md`](./log.md) | Chronological engineering journal — why each change was made |

> **Rule of thumb:** setup → this README · **what product to build now** → product-first roadmap · technical findings → full audit · detailed historical engineering tasks → phase plan · ADRs → `docs/adr/`.

### 15-minute onboarding

1. Skim this README (setup + architecture).
2. Open the product-first roadmap → **§1 / §8 / §12 / §20**.
3. Use the phase plan only for detailed historical engineering tasks and quality gates.
4. Copy `.env.example` → `.env`, run `npm install`, `npm run db:setup`, `npm run dev`.
5. Run `npm test` and `npm run test:quality`.

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
# Existing installations:
npm run db:migrate:market-projects
npm run db:migrate:project-history
npm run db:migrate:project-decisions
```

Supabase users: run SQL under `supabase/schema.sql` and `supabase/migrations/` in order.
For this MVP update, existing Supabase installations must include migrations `010_market_projects.sql`, `011_project_research_history.sql`, and `012_project_decisions.sql`.

#### Isolated local database used by this workspace

This checkout can use its own PostgreSQL 17 + pgvector cluster under the git-ignored `.local/postgres-data` directory. It runs on port `5435` so it does not conflict with Docker/PostgreSQL on the default port.

```bash
npm run db:local:status
npm run db:local:start
npm run db:schema:apply
npm run db:migrate:market-projects
npm run db:migrate:project-history
npm run db:migrate:project-decisions
npm run db:local:stop
npm run dev:local             # start the local DB if needed, then start Next.js
```

The active `.env` must point `DATABASE_URL` at that cluster. The database files and credentials are local development state and must never be committed.

### 4. Run

```bash
npm run dev:local           # local Postgres + dev login + Next.js  ← usual
npm run dev                 # Next.js only → http://localhost:3000
npm run dev:full            # Next.js + local MiroFish (Python venv)
npm run mirofish:bootstrap  # seed a local MiroFish simulation map
```

`dev:local` seeds `admin@local.com` / `admin1234` so you are not signing up by
hand each time. It refuses to run against a non-loopback `DATABASE_URL` or with
`NODE_ENV=production`.

### 5. Quality checks

CI runs `npm test` and `npm run test:quality` on every PR. Locally:

```bash
npm test
npm run test:quality   # offline output-quality / anti-hallucination scenarios
npm run typecheck
npm run lint
# with the local app running: authenticated project → research → decision → outcome smoke
npm run test:e2e:market-project
# optional and billable: also exercises Gemini + one market-trends agent
npm run test:e2e:live-research
# optional (needs running app + real session cookie):
# COOKIE='veracity_session=…' npm run test:api-smoke
```

---

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run dev:local` | Local Postgres + seeded dev login + dev server |
| `npm run dev:seed` | Create/reset the `admin@local.com` dev login (loopback databases only) |
| `npm run dev:full` | App + MiroFish side-by-side |
| `npm run mirofish` | MiroFish Flask service only |
| `npm run build` / `start` | Production build & serve |
| `npm test` | Vitest unit tests |
| `npm run test:quality` | Offline quality gate + abstain / category-mismatch scenarios |
| `npm run test:api-smoke` | Live HTTP smoke of all `/api` routes (`COOKIE=veracity_session=…`) |
| `npm run test:e2e:market-project` | Authenticated Market Project, snapshot, decision, and outcome journey against a running local app |
| `npm run test:e2e:live-research` | Same journey plus one bounded live Gemini/market-trends sweep; requires provider keys and may incur API cost |
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

**What to build next:** use the product-first roadmap **§12** for release sequencing. Reuse task details, quality gates, and ownership guidance from the phase/master plans where they support that sequence.

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
