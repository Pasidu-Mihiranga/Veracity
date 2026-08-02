# AGENTS.md

Context for AI coding agents working in this repo. Read this before writing code.
Kept short on purpose — every line here costs you tokens on every task.

## What this is

**Veracity** — a competitive intelligence workspace. It monitors competitor
pages, turns what it finds into a traceable evidence ledger, and builds charts
where every value traces back to the exact sentence it came from.

Next.js 15 · React 19 · TypeScript 5.9 · PostgreSQL + pgvector · Gemini.

**Node 20.12+ required.** Node 18 fails to start Vitest with a confusing
`styleText` error. Run `nvm use` first.

## Commands

```bash
npm run dev              # dev server on :3000
npm run typecheck        # tsc --noEmit — run before every commit
npm test                 # ~830 unit tests, ~15s
npx vitest run __tests__/foo.test.ts   # single file
npm run build            # production build
npx eslint components lib app          # zero errors expected

# Database (needs `npm run db:local:start` first)
npm run test:e2e:evidence-ledger    # DB invariants, 18 checks
npm run test:e2e:swarm-scenarios    # scenario tables, 15 checks
npm run test:e2e:dashboard          # full HTTP flow, 47 checks (needs dev server)
npm run test:e2e:live-research      # REAL PROVIDERS, COSTS MONEY — ask first
```

## The one rule that matters

**Never fabricate.** When a provider fails, a source is unreachable, or the
model returns nothing, the product must say so. It must not substitute a
plausible value, a default judgment, or an invented source.

```ts
// WRONG — this shipped once and had to be removed
catch (err) {
  return { facts: ['Market signals collected across web and news channels.'],
           categoryOutlook: 'emerging', confidenceScore: 0.5 };
}

// RIGHT
catch (err) {
  return { facts: factsFromRawSignals(rawContent),   // only what tools returned
           interpretation: synthesisFailureInterpretation(err),
           categoryOutlook: undefined,                // no judgment was made
           confidenceScore: SYNTHESIS_FAILURE_CONFIDENCE };
}
```

`__tests__/no-fabrication-on-failure.test.ts` forces every provider to fail and
asserts no facts, no sources, no numbers, no judgments. If you add an agent, add
it there.

## Four failure modes that have actually happened here

Check for these — each one shipped and had to be caught later.

**1. Building something nothing calls.** Nine modules and four components were
fully tested and completely unreachable. Passing tests and a clean build are
both true of dead code.

```bash
# Run this after adding any module or component
grep -rn "myNewThing" app lib components hooks | grep -v "the/file/itself"
```

**2. Unrealistic test fixtures hiding real behaviour.** A smoke test seeded a
span with no `metric_observation`, so the verifier correctly rejected the claim
— and it looked like a bug. Fixtures must match what production actually writes.

**3. Constraints that do not constrain.** `UNIQUE (a, b, c)` where `c` is
nullable does nothing for NULL rows — SQL treats every NULL as distinct.

```sql
-- Use an expression index when a column is nullable
CREATE UNIQUE INDEX ... ON t (a, b, COALESCE(c, ''));
```

**4. Reading state after writing it.** The collection run loaded "previous"
metrics after saving new ones, so every comparison came out equal and nothing
was ever detected. Read baselines *before* writes, and copy maps rather than
aliasing them.

## Conventions

**Ownership.** Every query is scoped by `user_id`, even when ownership was
already checked. A refactor that drops the outer check must not leak rows.

```ts
`SELECT ... FROM claims WHERE project_id = $1 AND user_id = $2`
```

**Missing means missing.** Never default a judgment or zero-fill a gap.

```ts
categoryOutlook: parsed.categoryOutlook,        // not `?? 'emerging'`
row[key] = values.has(key) ? values.get(key) : null;   // not `?? 0`
```

**User-facing text goes through `lib/ux/vocabulary.ts`.** No internal terms in
the UI — no `materiality`, `entity_match`, `data class`, `evidence span`.

```tsx
// WRONG
<span>materiality {item.materiality.toFixed(2)}</span>
// RIGHT
<span title={importanceOf(item.materiality).meaning}>
  {importanceOf(item.materiality).label}      {/* "Worth acting on" */}
</span>
```

Log output, column names, and code comments keep the precise terms. Only the UI
translates.

**Migrations are drop-then-create** so re-running repairs an already-broken
database. Mirror to `supabase/migrations/`, append to `db/schema.sql`, and add
an apply script that *verifies the behaviour*, not just the DDL.

**Outbound HTTP goes through `lib/net/outbound-policy.ts`.** Research fetches
model-influenced URLs; `safeFetch` handles IP encodings, DNS, redirect hops, and
size caps.

## Layout

```
lib/intelligence/      the evidence ledger — types, extractors, planners, connectors
lib/ux/vocabulary.ts   single source of truth for user-facing wording
lib/agents/            six research agents + orchestrator
components/dashboard/  the returning-user surface
components/artifacts/  charts and evidence rendering
app/api/projects/[id]/ collect · dashboard · charts · timeline · explain · entities
__tests__/             unit tests
scripts/smoke-*.mjs    database and HTTP end-to-end checks
```

## Where to look first

| Question | File |
|---|---|
| What is built, what is not | `plans/TODO.md` |
| Why something was done | `log.md` (chronological, most recent last) |
| Product direction | `docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md` |
| Remaining gaps, by id | `plans/GAP_CLOSURE_AND_FEATURE_PLAN.md` |
| UI wording rules | `plans/PLAIN_LANGUAGE_PLAN.md` |
| Demo script | `TOUR.md` |

## Benchmark artifacts

`docs/architecture/benchmark-langgraph-vs-current.md` and
`scripts/benchmarks/results-executor-parity.json` are **generated**, and the
committed copies are the evidence ADR-0007 gates on.

The parity gates run on every `npm test`, but the files are only rewritten when
you ask:

```bash
npm test                  # gates run, files untouched
npm run bench:executors   # gates run AND the report is refreshed
```

Without that split, every test run rewrote both with a new timestamp and a few
microseconds of latency jitter, so the working tree always looked dirty while
nothing had actually changed.

**LangGraph is installed but off.** `CurrentExecutor` runs everything in
production; ADR-0007 and ADR-0008 require live accuracy, evidence, cost, and
latency gates before that changes, and the stub benchmark shows LangGraph is
~7% slower with zero accuracy difference. Do not migrate to it.

## Do not

- Enable `NEXT_PUBLIC_FF_SAML_SSO` — assertion signatures are unverified;
  enterprise identity is deferred by decision.
- Run `test:e2e:live-research` without asking — it costs real money.
- Bind the MiroFish service to anything but loopback, or remove its token check.
- Add a `process.env[dynamic]` read — Next.js does not inline those into the
  browser bundle, so client and server silently disagree.

## Before you finish

```bash
npm run typecheck && npm test && npx eslint components lib app && npm run build
```

Then append to `log.md` (what changed, why, what you verified, what remains) and
tick `plans/TODO.md`. The log is how the next agent avoids re-deriving your
reasoning.
