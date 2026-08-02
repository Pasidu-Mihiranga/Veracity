# Veracity Engineering Log

This is the chronological handoff journal for the product MVP. Keep entries concise but explain what changed, why, verification performed, and what remains.

## 2026-08-01 — MVP product reset and implementation start

### Decision

The active goal is a marketable market-decision MVP, not an enterprise platform expansion and not a generic chatbot. The build sequence is stored in `plans/MVP_BUILD_PLAN.md`; the short queue is `plans/TODO.md`.

### Product position

Veracity connects live market evidence, inspectable charts, a continuing research conversation, decision briefs, and an optional synthetic stakeholder Swarm Decision Lab. Synthetic scenarios are never treated as observed market evidence.

### Repository findings carried into implementation

- Conversation history, session recall, user memory, targeted follow-up orchestration, and message persistence already exist.
- The UI displays only the latest structured report and reconstructs follow-ups in a separate collection, which makes the application feel one-shot.
- The first session/user message is currently persisted only after research completes.
- The local MiroFish adapter is a batched persona interviewer, not the full upstream social simulation. It stores prompt/count history but not a continuing response thread.
- Several fallbacks fabricate plausible personas, responses, probabilities, or chart values and must be removed.

### Baseline verification

- `npm test`: blocked before test discovery because the installed `tinyglobby` dependency cannot import its nested `fdir` package.
- `npm run typecheck`: blocked because the installed dependency tree is missing `phoenix` and `ws` type definitions.
- Interpretation: local `node_modules` is incomplete/inconsistent. Repair the lockfile-based installation before using test failures as product-code signals.

### Work started

- Created the focused build plan and active TODO under `plans/`.
- Started Slice 1: durable chronological research conversation.

### Next handoff

Repair dependencies, rerun typecheck/tests/build, then implement server-first message persistence and the unified conversation timeline.

## 2026-08-01 — Slice 1 complete: durable research conversation

### Built

- `handleSend` now creates the session and persists the first user message before starting the research stream.
- Research requests receive the real session/conversation ID from the beginning, so async jobs can be associated with durable state.
- Failures and cancellations are persisted as assistant turns instead of silently disappearing.
- Follow-ups now create normal user/assistant messages in the main transcript and persist complete structured orchestrator output, sources, recommendations, run metadata, and errors.
- Legacy rows marked `isFollowUp` now hydrate into the chronological message timeline instead of a separate temporary collection.
- Added `ConversationTimeline` so prompts, responses, source links, image attachments, and pending state are visible.
- The latest structured assistant result remains the active detailed intelligence report while previous conversation turns remain accessible.
- MiroFish standard and live agents are disabled by default; the user must explicitly choose a scenario feature.

### Truth/gimmick fixes started

- Removed `changePercent || 5` from the trend chart. A real zero remains zero; non-numeric trend observations do not create percentage bars.
- Removed the TypeScript generic synthetic-swarm fallback when no configured MiroFish simulation exists.
- Removed local MiroFish template personas and generic first-person responses on model/provider failure.
- Local swarm interview history now stores actual persona responses plus explicit failures, which is required for future continuing swarm conversations.
- Removed hardcoded execution-engine fallback campaigns, including invented VP Sales audiences, reply-rate targets, competitor claims, outreach copy, and deployment schedules.
- Execution grounding now rejects incomplete variants and returns no variant when generation fails; it can add only real facts already present in research outputs.
- Execution sub-agent failures are surfaced in the artifact interpretation with confidence zero when all generators fail.

### Tests added

- `__tests__/conversation-history.test.ts`: verifies legacy and new follow-ups remain chronological and structured output survives hydration.
- `__tests__/trend-chart-data.test.ts`: verifies zero/magnitude handling and rejection of non-numeric observations.
- Updated `__tests__/grounding-contract.test.ts` to enforce “no fabricated campaign fallback” behavior.

### Verification

- `npm install`: repaired the incomplete local dependency tree; lockfile/package manifests did not change.
- `npm run typecheck`: PASS.
- `npm test`: PASS after the final truth-reset changes — 38 files passed, 1 skipped; 311 tests passed, 1 skipped.
- Focused ESLint on changed TypeScript/TSX files: PASS with no warnings after corrections.
- `python3 -m py_compile mirofish-service/server.py`: PASS.
- Production `next build`: PASS using nonfunctional build-only values for the three required environment variables. No credentials were stored.
- Execution-focused regression set: PASS — 86 tests across grounding, intent, orchestration, and quality.

### Remaining product work

- Complete the truth reset across execution fallbacks and every artifact.
- Replace the forecast UI/schema with the Swarm Decision Lab scenario schema.
- Build Market Projects, evidence snapshots/changes, decision workflow, and scenario continuation.

## 2026-08-01 — Truth reset: honest artifacts and Swarm Decision Lab

### Built

- Added a public artifact truth class (`observed`, `derived`, or `synthetic`) and a visible label around every non-empty rendered artifact. Existing research artifacts default conservatively to derived unless their producer explicitly proves they are observed.
- Replaced the standard and live MiroFish forecast outputs with `SwarmScenarioOutput` / `scenario-distribution`.
- Removed active probability point estimates, prediction direction, and confidence-interval claims from the swarm UI. Old persisted forecast records remain readable through a compatibility adapter that intentionally drops those fields.
- Removed the live MiroFish fallback that returned an invented 50% estimate and 30–70% interval when synthesis failed. Missing configuration, unavailable service, failed interviews, empty panels, and failed synthesis now mark the agent failed.
- Added scenario methodology and limitations, stored persona responses in the scenario output, and labeled the panel as synthetic rather than a survey.
- Added strict distribution validation: non-negative integer buckets must sum to the panel size or the chart is hidden with an explicit limitation.
- Removed decorative non-zero bars for actual zero values from the scenario chart and executive PDF trend bars.
- Updated product copy, agent progress, report-template selection, and primary-visual selection to use Swarm Decision Lab terminology.

### Tests and verification

- Added `artifact-truth.test.ts` and `swarm-scenario.test.ts`.
- Focused truth/scenario regression suite: PASS — 11 tests.
- Full `npm test`: PASS — 40 files passed, 1 skipped; 316 tests passed, 1 skipped.
- `npm run typecheck`: PASS.
- Focused ESLint: no errors; two pre-existing React hook warnings remain in `IntelligenceResults.tsx`.
- Production `next build`: PASS using nonfunctional build-only values for required environment variables; no credentials were stored.
- Restored the two benchmark snapshot files rewritten by the full test suite so generated timestamps/results are not included as product changes.

### Remaining product work

- Finish artifact methodology/period/source drill-down and downloadable chart data.
- Build Market Projects and reusable baseline context.
- Add evidence-aware turn modes and targeted refresh.
- Build decision briefs, outcome tracking, and continuing/branching scenario conversations.

## 2026-08-01 — Market Projects foundation

### Built

- Added a first-class `market_projects` model for product/company, URL, tracked competitors, geography, decision context, and future source preferences.
- Added `chat_sessions.project_id` with `ON DELETE SET NULL`, so a project organizes research without owning or deleting conversation history.
- Added ownership-scoped list/create/delete APIs and matching browser client helpers.
- Replaced the sidebar's cosmetic project-folder creation flow with guided Market Project setup.
- Added an active-project banner and one-click baseline action.
- Initial and follow-up research turns now receive the same reusable project context before user memory and semantic session recall.
- Kept unassigned and legacy conversations visible under All Recent Research.

### Migration

- PostgreSQL: `db/migrations/0006_market_projects.sql`.
- Supabase: `supabase/migrations/010_market_projects.sql`.
- Fresh local setups receive the same schema through `db/schema.sql`.

### Verification

- `npm run typecheck`: PASS.
- Focused project/conversation/truth/scenario tests: PASS — 9 tests.
- Focused ESLint: no errors; the existing raw mascot `<img>` performance warning remains in `SessionSidebar.tsx`.
- Full `npm test`: PASS — 41 files passed, 1 skipped; 318 tests passed, 1 skipped.
- Production `next build`: PASS; the build generated all 44 routes/pages using nonfunctional build-only environment values.
- `git diff --check`: PASS, and test-generated benchmark snapshots were restored.

### Remaining project work

- Project edit/entity-correction UI and genuinely enforced source allow/block controls.
- Source snapshots, normalized change events, and the project overview.

## 2026-08-01 — Inspectable chart data

### Built

- Added methodology, period, generated time, numeric sample count, and stored source links to the market-trend chart.
- Added CSV downloads for market-trend and synthetic-scenario chart inputs.
- CSV generation quotes all cells and neutralizes spreadsheet formula prefixes (`=`, `+`, `-`, and `@`).
- Scenario downloads keep distribution rows and synthetic perspectives explicitly separated by row type.

### Verification

- `npm run typecheck`: PASS.
- Focused CSV/trend/truth/scenario tests: PASS — 10 tests.
- Focused ESLint: PASS with no warnings.

### Remaining chart work

- Apply the same methodology/source/download contract to competitive, pricing, win/loss, positioning, and threat artifacts.

## 2026-08-01 — Project editing and migration runner

### Built

- Added a repeatable `npm run db:migrate:market-projects` command that loads `.env`, applies migration `0006` inside a transaction, and verifies the project table and session foreign-key column without printing credentials.
- Added ownership-scoped Market Project updates.
- Added project editing for product identity, URL, competitors, geography, decision context, preferred source domains, and domains to avoid.
- Kept avoided domains labeled as a research preference because hard source exclusion is not yet enforced throughout every collector.
- Replaced the sidebar mascot's raw `<img>` with optimized `next/image` rendering.

### Migration status

- The `.env` file is present and the three required variable names are configured.
- The migration was not applied: PostgreSQL requested SCRAM authentication, but the configured `DATABASE_URL` contains no username or password.
- No migration SQL ran and no database state changed. Update `DATABASE_URL` to a complete PostgreSQL connection string, then rerun `npm run db:migrate:market-projects`.

### Verification

- `npm run typecheck`: PASS.
- Focused Market Project and CSV tests: PASS — 4 tests.
- Focused ESLint: PASS with no warnings after replacing the raw sidebar image.
- Production `next build`: PASS, 44 routes/pages. The sandboxed attempt could not reach Google Fonts; the approved network-enabled verification completed successfully.
- Full `npm test`: PASS — 42 files passed, 1 skipped; 320 tests passed, 1 skipped. Test-generated benchmark snapshots were restored afterward.

## 2026-08-01 — Isolated local PostgreSQL environment

### Built

- Created a dedicated PostgreSQL 17 cluster under the git-ignored `.local/postgres-data` directory.
- The cluster listens only on `localhost:5435`, avoiding the unrelated Docker PostgreSQL process already occupying port 5432.
- Created a dedicated `veracity` role and `veracity` database with SCRAM password authentication; updated only `DATABASE_URL` in the ignored `.env`.
- Installed Homebrew pgvector 0.8.6 and enabled the extension in the Veracity database.
- Applied and verified the complete local schema, then applied migration `0006_market_projects.sql` idempotently. The project table exists and currently contains zero projects.
- Added repeatable `db:local:start`, `db:local:stop`, `db:local:status`, `db:schema:apply`, `db:migrate:market-projects`, and `dev:local` commands.
- Added `.local/` to `.gitignore`; initialization password files were deleted immediately after use.
- Removed only the empty PostgreSQL 16 cluster created during setup after confirming the installed pgvector bottle targets PostgreSQL 17/18. No pre-existing database was altered or deleted.

### Runtime verification

- Local PostgreSQL status: running on port 5435.
- Full schema verification: users, chat sessions, Market Projects, and pgvector present.
- Market Projects migration: PASS; existing projects: 0.
- Next.js development server: ready successfully using `.env`.
- Unauthenticated `/` and `/api/projects` correctly redirect to `/auth`; the authentication page returns HTTP 200.
- `npm run typecheck`, focused script ESLint, and `git diff --check`: PASS.

## 2026-08-01 — Project research history, research modes, and decision loop

### Built

- Added durable `project_research_snapshots` records for successful project-linked intelligence responses and `project_research_events` for source-coverage changes. These events are intentionally labeled as coverage changes; they do not claim that a pricing, launch, or market event occurred.
- Added a project overview showing conversation count, total research-run count, latest source count, evidence coverage, latest stored summary, recent coverage changes, and open decisions.
- Added five explicit research actions to the composer: Explain saved research, Verify or update, Compare or branch, Ask synthetic panel, and Full refresh.
- The selected research action is validated by the chat API, applied server-side, passed through async jobs, and stored in message metadata. Ask synthetic panel opts into MiroFish; Full refresh forces a complete sweep.
- Added project-linked decision memory. A generated decision frame can now be adopted, watched, or rejected only after the user supplies a reason.
- Added project-filtered decision retrieval and later outcomes (`validated`, `invalidated`, or `adopted_after_reject`) with an optional observed-result note.
- Added migrations `0007_project_research_history.sql` and `0008_project_decisions.sql`, matching Supabase migrations `011` and `012`, plus repeatable local migration commands.

### Verification so far

- Applied and verified both new migrations against the isolated local PostgreSQL database.
- Authenticated Market Project smoke passed before the decision extension: signup → project → session → messages → snapshot/overview → edit → delete → cleanup.
- Focused turn-mode, project snapshot, and project model tests: PASS — 6 tests.
- TypeScript: PASS after the research-mode and decision-loop changes.
- Focused ESLint: no errors; two existing React hook warnings remain in `IntelligenceResults.tsx`.

### Remaining MVP work

- Complete final full-suite/build/authenticated-smoke regression after the decision extension.
- Add normalized verified market events (pricing/releases), rolling structured project summary, direct artifact references, and continuing/branching swarm sessions.
- Apply the methodology/source/download contract to the remaining chart types.

### Final release-gate verification

- Full Vitest regression: PASS — 44 files passed, 1 skipped; 324 tests passed, 1 skipped.
- Production Next.js build: PASS — compilation, type validation, static generation for 44 pages, and build traces completed.
- Repository ESLint: PASS with zero errors and 24 non-blocking pre-existing warnings.
- Authenticated API/database journey: PASS, including project-linked decision creation, project-filtered retrieval, validated outcome with note, project update/delete, and test-user cleanup.
- Rendered UI journey: PASS — local signup, Market Project creation, overview metrics, all five research actions, and selection of Ask synthetic panel; browser console contained zero errors. Temporary UI test data was removed.
- Provider configuration presence was verified without printing values: Gemini, SerpAPI, Firecrawl, and Apify are configured; MiroFish URL is absent and remains optional/off by default.
- Added `npm run test:e2e:live-research` for a bounded one-agent live-provider proof. It was not executed in this run because the execution environment reached its external-action allowance; no provider success is claimed.

## 2026-08-02 — Wave 0: product-level honesty sweep

### Scope decision

The product owner set the build order explicitly: **a functional, tested product
first; enterprise concerns after.** Enterprise identity (SAML/SCIM), fine-grained
RBAC, compliance dashboards, audit exports, and the enterprise observability
programme are deferred to a phase that begins only once the MVP and the
research-derived features are shipped and tested. They are recorded in
`plans/GAP_CLOSURE_AND_FEATURE_PLAN.md` §5.6, not cancelled.

Wave 0 therefore contains only fixes that determine whether the **product
itself** is correct and trustworthy. Sequencing for the rest of the build is
Waves 1–3 (MVP) → Wave 4 (Swarm Decision Lab) → Wave 5 (UI) → end-to-end tests →
enterprise phase.

### Planning

- Added `plans/GAP_CLOSURE_AND_FEATURE_PLAN.md`: a 30-item gap register in six
  groups, 14 research-derived features, and a six-wave sequence with per-wave
  exit criteria. It consolidates the unfinished Slices, roadmap Milestone 1, and
  the open audit findings into one order of work.
- Verified the register against the working tree rather than against checkboxes.
  Milestone 1 (evidence ledger) is 0% started: there is no `evidence_spans`,
  `metric_observations`, `change_events`, `ChartSpec`, or `lib/intelligence/`.
  `source_snapshots` exists with a `content_hash`, but nothing diffs it.

### Built — fabricated output removed (the core MVP trust claim)

- `lib/agents/market-trends.ts` was the one research agent the earlier truth
  reset missed. On synthesis failure it asserted the fact "Market growth signals
  collected across web, news, and technical channels.", claimed "Synthesis
  synthesized from live search and market signals." while synthesis had just
  thrown, set a `categoryOutlook` of `emerging`, a `timeHorizon` of
  `6-12 months`, and reported 0.5 confidence — with zero data behind any of it.
  It now uses the same `synthesisFailureInterpretation` /
  `SYNTHESIS_FAILURE_CONFIDENCE` handler as the other five agents, and its facts
  come only from raw signals the tools actually returned.
- Four analyst *judgment* fields defaulted to plausible values whenever
  synthesis failed: `categoryOutlook` → `emerging`, `buyerSentiment` → `mixed`,
  `willingnessToPay` → `mid-market`, `overallRisk` → `medium`, plus
  `timeHorizon` and `timeToImpact` strings. Each rendered as a confident badge
  describing an assessment the system never made. All six are now optional in
  `lib/agents/types.ts`, stay `undefined` on failure, and are no longer
  re-defaulted when the output object is constructed.
- Added `components/artifacts/UnassessedBadge.tsx` and wired it into
  `TrendChart`, `WinLossScorecard`, `PricingTable`, and `ThreatHeatmap` so an
  absent judgment renders as "<label> unavailable" in neutral styling.

### Built — outbound URL policy

- Added `lib/net/outbound-policy.ts`. Research tools resolve competitor and
  product URLs originating from user input and model output; the previous guard
  (`lib/tools/source-validator.ts`) rejected the literal string `localhost` and
  nothing else.
- The policy parses, restricts to http/https on ports 80/443, rejects non-public
  IP literals in every encoding the URL parser accepts (dotted-quad, 32-bit
  decimal, octal, hex, IPv6, IPv4-mapped IPv6), resolves DNS and rejects if *any*
  returned record is non-public, then re-runs the whole check on every redirect
  hop. Redirects, response bytes, and wall-clock time are capped. Unresolvable
  hosts fail closed.
- Writing the tests surfaced a bypass in the first implementation: `new URL()`
  re-serialises `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, so a dotted-quad regex
  never matched. Replaced with full IPv6 group expansion, which makes every
  notation converge on the same numeric value.
- `lib/tools/firecrawl.ts` now validates before spending anything — including
  before handing a URL to a third-party crawler, which would otherwise fetch the
  endpoint on our behalf — and its direct-fetch path goes through `safeFetch`.

### Built — feature-flag correctness

- `lib/feature-flags.ts` read flags through a dynamic `process.env[name]` lookup.
  Next.js only inlines *statically referenced* `NEXT_PUBLIC_*` variables into
  browser bundles, so client code silently used hardcoded defaults while the
  server used deployed values: the two disagreed at runtime. Every flag is now a
  literal `process.env.NEXT_PUBLIC_FF_*` read.
- Deferred enterprise and knowledge-graph surfaces are grouped and documented as
  default-off, with SAML called out: its assertion signatures are unverified, so
  it stays unreachable until the enterprise phase replaces the implementation.

### Tests added

- `__tests__/no-fabrication-on-failure.test.ts` — 48 tests. Forces every provider
  *and* synthesis to fail, then runs all six research agents and asserts each
  returns an output rather than crashing the sweep, states that synthesis failed,
  reports low confidence, and produces no facts, no sources, no numeric claims,
  no analyst judgment, and no populated artifact collections. Parameterised over
  the agent list so a newly regressed agent is caught here.
- `__tests__/outbound-policy.test.ts` — 16 tests covering IP encodings, private
  and metadata ranges, protocol/port rules, split-horizon DNS, fail-closed
  resolution, public→private redirect hops, redirect budget, and byte caps.
- `__tests__/feature-flags.test.ts` — 17 tests covering value parsing, a static
  assertion that no dynamic `process.env[...]` read returns to the file, and that
  every deferred surface still defaults off.

### Verification

- Anti-vacuity check: the original `market-trends` fabrication was temporarily
  reintroduced and the forced-failure suite failed on exactly the four expected
  assertions, then passed again once reverted.
- Full Vitest regression: PASS — 47 files passed, 1 skipped; 405 tests passed,
  1 skipped (up from 324; +81 from the three new suites).
- `npm run typecheck`: PASS.
- ESLint over every changed file: PASS, zero errors. Two pre-existing
  `react-hooks/exhaustive-deps` warnings remain in `ExecutionPlan.tsx` and
  `ResultsInsightCharts.tsx`, neither of which was touched.

### Remaining in Wave 0

- Real multimodal image analysis: the model still receives image metadata rather
  than image bytes.
- README and homepage claims still predate the truth reset.

### Next

Wave 1 — the evidence ledger and `ChartSpec` foundation. It is the load-bearing
milestone: the change engine, materiality, the digest, every remaining chart, and
the Swarm Decision Lab scenario brief all read from it, so building any of them
first means building them twice.

## 2026-08-02 — Wave 1 (part 1): evidence ledger schema and chart contract

### Built — migration `0009_evidence_ledger.sql`

Five tables plus three `source_snapshots` columns. The chain previously stopped
at a source URL: a snapshot recorded that a page was fetched and hashed, but
nothing recorded *which words* supported a claim, and no numeric value in any
chart had an origin outside model output.

- `evidence_spans` — verbatim excerpt, offsets into the snapshot's normalized
  content, extraction type, and an entity-match state so an excerpt about a
  similarly named company cannot silently support a claim.
- `metric_observations` — value, unit, period, method, estimated flag. The
  foreign key to `evidence_spans` is `NOT NULL`, which is the load-bearing
  decision in the migration: a number with no excerpt behind it cannot be
  stored at all.
- `change_events` — the ten normalized event types, before/after, effective vs
  observed dates, deterministic materiality with a human-readable reason, and a
  `dedupe_key` under a unique index so a re-run cannot report the same change
  twice. Distinct from `project_research_events`, which stays scoped to source
  *coverage* changes.
- `claims` — statement, `fact` / `interpretation` / `assumption` discriminator,
  and supporting and contradicting span arrays held separately so disagreement
  can be shown rather than silently resolved.
- `chart_specs` — validated spec JSON with `data_class` lifted into a column so
  charts can be filtered by trust class without deserialising every row.
- `source_snapshots` gained `normalized_content` (spans carry offsets into it,
  so it must be retained), `retrieval_status`, and `project_id`.

### Built — `lib/intelligence/types.ts`

Zod schemas for all five records plus the `ChartSpec` contract, and
`validateChartSpec`, which enforces what a shape check cannot:

- a measured chart must cite at least one source and one evidence span;
- a derived chart must state its formula;
- a synthetic chart must state its limitations;
- a chart with no rows is an empty state, not a chart;
- a declared series that is missing from every row, or null all the way down, is
  rejected — a gap drawn as data is the failure mode the schema exists to stop;
- a real zero stays a valid observation, and a null gap alongside real values is
  allowed through.

`canPresentAsMeasured` is deliberately blunt: no evidence span means no, however
confident the model was.

### Tests added

- `__tests__/evidence-ledger-types.test.ts` — 26 tests covering the evidence-span
  rules, the no-orphan-number rule, fact-requires-evidence, change-event
  validity and materiality bounds, and every chart validation branch including
  the zero and null-gap cases.

### Verification

- Migration applied against the isolated local PostgreSQL database and verified:
  all five tables, all three new `source_snapshots` columns, and the
  `change_events` dedupe index exist. Re-running the script is idempotent and
  succeeded a second time with no error.
- Added `npm run db:migrate:evidence-ledger`, the Supabase mirror
  `supabase/migrations/013_evidence_ledger.sql`, and the same DDL in
  `db/schema.sql` so fresh local setups match.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 48 files passed, 1 skipped; 431 tests passed,
  1 skipped (up from 405).
- ESLint over the new module, test, and script: PASS with zero errors.

### Remaining in Wave 1

The schema and contract are in place; nothing writes to them yet. Still to
build: `snapshot-store`, `evidence-extractor`, `metric-normalizer`,
`chart-planner`, `claim-verifier`, the shared evidence pack in the orchestrator,
rewiring `bind-evidence` from lexical URL matching to span ids, the evidence
drawer, and the migration of each artifact to render a validated `ChartSpec`.
