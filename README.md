# Veracity

> **Know what changed, prove it, and decide what to do next.**

Veracity is a competitive decision workspace. It watches the companies you choose,
records what their public sources said on a given day, and tells you what moved —
with the exact sentence behind every number.

It is not a chatbot with a search tool bolted on. It is a system of record for
competitive change.

---

## Why this exists

Ask ChatGPT, Claude, Perplexity or Gemini to compare two competitors and you will
get a good answer. Ask again next month and you will get a different good answer,
with no way to tell which parts actually changed and which parts the model simply
worded differently.

That is the gap. General assistants are **excellent at answering once** and
**structurally incapable of noticing change**, because nothing persists between
conversations. They have no memory of what a competitor's pricing page said in
March, so they cannot tell you it moved in April.

| | General AI assistant | Veracity |
|---|---|---|
| Answers a research question | Yes, very well | Yes |
| Remembers what was true last month | **No** | Yes — every source snapshotted and hashed |
| Tells you unprompted that something changed | **No** | Yes — that is the product |
| Distinguishes "nothing changed" from "we couldn't check" | **No** | Yes, and they are never merged |
| Every number traceable to a stored excerpt | **No** | Yes, enforced by the database |
| Says "I don't know" when sources fail | Sometimes | Always — enforced by tests |
| Costs money to open | n/a | No — the home screen reads stored data only |

**The one-line pitch:** *"PickMe raised the tuk base fare from LKR 300 to 350 on
3 August. Here is the sentence. Uber did not move."*

No general assistant will ever say that to you unprompted, because none of them
were watching.

---

## What it does

### 1. Competitor comparison — across any number of companies

Compare two companies or ten, on shared dimensions: positioning, pricing, buyer
evidence, market signals, risks and adjacency. Every cell is labelled with how
well evidence supports it, and a cell with no source says **"No source found"**
rather than inventing a plausible sentence.

Comparison is not restricted to software. The pipeline reads a tea exporter's
trade page the same way it reads a SaaS pricing page — the demo data ships with
ride-hailing, tea export and apparel manufacturing precisely to prove that.

### 2. Change detection — the part nothing else does

Every source is fetched, normalised and content-hashed. On the next run:

- **Unchanged** → short circuit. No extraction, no model call, no cost.
- **Changed** → extract evidence, diff the metrics, score how much it matters.

Materiality is **deterministic**, not a model's opinion. It weighs the size of
the move, the type of event, the trust of the source, and whether the company is
one you actually track. Every score carries a plain-English reason you can
disagree with.

### 3. Where a company spikes, and where it lacks

Evidence coverage is computed per dimension — market, competition, customers,
technology, pricing — so a thin area is visible as thin rather than silently
filled in. A company with strong pricing evidence and no customer evidence looks
exactly like that, which is the honest reading of what the sources support.

### 4. Market gap and saturation analysis

Six specialist agents run in parallel over collected evidence:

| Agent | Question it answers |
|---|---|
| Market & trend sensing | Where is the category heading? |
| Competitive landscape | Who is doing what, and is there real demand behind it? |
| Win/loss intelligence | Why do deals go the other way? |
| Pricing & packaging | Is pricing right, and is willingness-to-pay shifting? |
| Positioning & messaging | How should this be talked about? |
| Adjacent market collision | What threat is coming from outside the category? |

They fan out simultaneously and degrade independently: if one fails, the rest
complete and the failure is reported rather than hidden.

### 5. Feature and capability analysis

Release notes, changelogs and capability pages are tracked as first-class
sources. A shipped feature becomes a dated, sourced event — so "they added a
business dashboard in April" is a record, not a recollection.

### 6. Idea and decision support

Every answer ends in a decision frame: the situation, the options, the criteria,
and explicitly **what would change this conclusion**. Decisions can be recorded
as adopted, watched or rejected, so the reasoning behind a past call survives the
people who made it.

### 7. Resource and cost discipline

Cost is a design constraint, not an afterthought:

- The no-change short circuit means an unchanged source costs nothing to re-check.
- Questions about already-collected research are answered from the ledger with a
  single model call, roughly two orders of magnitude cheaper than a fresh sweep.
- Per-query cost, latency and token use are visible in the API usage tab.

### 8. Charts where every value is traceable

Charts are generated from a typed `ChartSpec` contract, and each one declares:

- **What it measures**, in one sentence
- **The formula** behind it
- **Its data class** — `measured` (read from a source), `derived` (computed by
  the system), or `synthetic` (model-generated, never mixed with the other two)
- **The evidence span** behind every row

A chart cannot be rendered from data that has no stored excerpt behind it. This
is enforced at the database level: `metric_observations` has a `NOT NULL`
foreign key to `evidence_spans`.

---

## What is actually working today

Verified, with the test or command that proves it.

| Capability | Status | Proof |
|---|---|---|
| Evidence ledger | **Working** | `metric_observations.evidence_span_id` is `NOT NULL` — a number without a source cannot be stored |
| Change detection | **Working** | `npm run seed:demo` → 8 change events, 6 material, across 3 industries |
| No-change short circuit | **Working** | Same run: unchanged competitors report `unchanged` and skip extraction |
| Evidence extraction | **Working** | Verbatim excerpts, verified against source text; paraphrases are rejected |
| Six agents in parallel | **Working** | `Promise.allSettled` fan-out; one failure does not stop the others |
| No fabrication on failure | **Working** | `__tests__/no-fabrication-on-failure.test.ts` forces every provider to fail |
| Deterministic materiality | **Working** | Explainable score with a stated reason per event |
| Traceable charts | **Working** | `ChartSpec` with formula, data class and evidence ids |
| Change feed home | **Working** | Stat tiles, per-company changes, research history |
| Multi-industry support | **Working** | Demo covers ride-hailing, tea export, apparel |
| Cost visibility | **Working** | Per-query cost, latency, tokens in the API usage tab |
| Simulated buyer panel | **Working, clearly labelled** | Model-generated personas. Not survey data, never enters the ledger |
| Enterprise SSO / SCIM / RBAC | **Not available** | Deliberately deferred until the core loop retains users |

**Test suite: 871 passing.** Typecheck, lint and production build all clean.

---

## Planned for the next phase

Stated plainly so nothing above is ambiguous.

| Planned | Why it matters | Status |
|---|---|---|
| **Scoping questions before a sweep** | When you ask for a comparison, the system asks back what you actually want scoped — local demand, market saturation, global gap, capital requirements, regulatory exposure — turning a vague prompt into a scoped run | Designed, not built |
| **Non-competitor modes** | Idea evaluation, market-trend scan, regulatory scan and capital-raising landscape, without naming a competitor. The agents already reason about these; the intent routing is missing | Designed, not built |
| **Scheduled background sweeps** | Monitoring on a cadence without anyone pressing a button | Partially built — Inngest wired, flag off |
| **Charts on the home screen** | Coverage and change over time. Blocked until a project has two collection runs; `seed:demo` now provides that | Unblocked, not built |
| **Alerting to email and Slack** | Material change reaches you where you work | Alert model exists; egress not built |
| **Team workspaces** | Shared projects and a common evidence base | Deferred |

---

## Pivots from the original proposal

Stated and justified, as the prototype guidelines require.

**1. From "AI research assistant" to "competitive monitoring system".**

We built the research surface first and found it competes directly with ChatGPT
Deep Research, Perplexity and Gemini — all of which do one-off research better
than we will. What none of them do is remember what was true last month. So the
product now leads with the change feed and treats research as the drill-down.
This is a repositioning of the same engine, not a rebuild.

**2. Enterprise identity deferred.**

SAML, SCIM and RBAC were in the original scope. They are deliberately postponed:
they add no value until the core loop retains users, and half-built identity is
worse than none. The SAML routes that exist are flagged off and documented as
not verifying assertion signatures.

**3. LangGraph evaluated and not adopted.**

Benchmarked against the existing executor across 97 runs: zero accuracy
difference, ~7% slower. Kept behind a default-off flag with the benchmark
committed as evidence. See `docs/architecture/`.

---

## Demo data

```bash
npm run seed:demo
```

Seeds three projects across three industries and runs the **real** collection
pipeline twice, a month apart.

Per the prototype guidelines, source page content is canned — but **only** the
page content. Content hashing, evidence extraction, metric observation, change
detection and materiality scoring all execute the production code path
unchanged. Nothing about the agent logic is simulated.

```
PickMe vs Uber          3 checked · 2 changed · 1 unchanged · 4 material
Ceylon tea exporters    3 checked · 2 changed · 1 unchanged · 2 material
Apparel manufacturing   2 checked · 2 changed · 0 unchanged · 0 material

14 snapshots · 54 evidence spans · 24 metric observations · 8 change events
```

Two details worth watching in a demo:

- **The unchanged competitor.** Uber's page is byte-identical across both runs,
  so the short circuit fires and no extraction is paid for. "We looked and
  nothing moved" is a real finding produced by real code.
- **Apparel clears zero material changes.** Genuine movements — recycled content
  18% → 29%, lead time 45 → 38 days — that score below the materiality floor. A
  system where everything is urgent teaches its user that nothing is.

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
npm run db:migrate         # creates every table, column, and index
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

npm run db:migrate
```

### Option C — a hosted database

Any PostgreSQL 14+ with pgvector works (Supabase, Neon, RDS). Put its
connection string in `DATABASE_URL` and run `npm run db:migrate`.

### Keeping the database up to date

`npm run db:migrate` is the only database command you need. It applies the
schema and every migration in order, and it is safe to run as often as you
like — a database that is already current comes out unchanged.

**Run it after every `git pull`.** `npm run dev:local` runs it for you.

If you skip it, the app still starts cleanly and then fails on the first
request with a raw Postgres error:

```
error: relation "market_projects" does not exist
error: column "project_id" does not exist
```

That second one is the confusing case. Your `chat_sessions` table already
existed, so `CREATE TABLE IF NOT EXISTS` skipped it and the newer column was
never added. The table is there; it is just older than the code. `db:migrate`
repairs it in place without touching your data.

Both errors mean the same thing every time:

```bash
npm run db:migrate
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
npm run db:migrate      # schema + every migration, idempotent
npm run db:local:stop
npm run dev:local       # start + migrate + seed login + dev server             # start the local DB if needed, then start Next.js
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
| `npm run dev:local` | Local Postgres + migrate + seeded dev login + dev server |
| `npm run db:migrate` | Apply schema and every migration in order. Idempotent — run after each `git pull` |
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
