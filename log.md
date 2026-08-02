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

## 2026-08-02 — Wave 1 (part 2): ledger modules and database proof

### Built — `lib/intelligence/`

- `snapshot-store.ts` — URL canonicalisation (drops `www.`, fragments, default
  ports, and tracking parameters; sorts the rest so parameter order cannot fork
  one page into two identities), content normalisation that masks volatile
  fragments, and versioned SHA-256 hashing. Masking matters more than it looks:
  without it a rendered timestamp or a cache-busting asset hash makes every
  scheduled run report a change, and the digest becomes noise. `locateSpan`
  returns null rather than fuzzy-matching, because an excerpt that is not
  present is a quote the extractor invented and the caller must be able to see
  that.
- `evidence-extractor.ts` — schema-constrained extraction at temperature 0.
  Every returned excerpt is located in the actual snapshot content before it
  becomes a span; unlocatable ones are collected in `hallucinatedExcerpts` and
  dropped. A metric is kept only when its value literally appears in the excerpt
  it claims to come from, which catches the subtler failure of attaching a real
  number to unrelated text.
- `claim-verifier.ts` — rejects a numeric claim with no backing observation, and
  also rejects one whose asserted number does not match the observation it
  cites. A "has a source" check would wave the latter through. Contradiction is
  deliberately *not* a rejection: disagreement is information the user needs.
  `deriveConfidence` is deterministic, so a single-source claim can never be
  labelled high.
- `chart-planner.ts` — builds specs from stored observations only. Refuses mixed
  units on one axis, refuses observations with no evidence span, downgrades a
  line to bars below three points and says why, and leaves a missing period as
  `null` rather than zero-filling it.
- `ledger-repo.ts` — ownership-scoped persistence. Spans and their observations
  are written in one transaction, and chart specs are validated inside the save
  function so an invalid chart cannot be persisted whatever path produced it.

### Tests added

- `__tests__/intelligence-modules.test.ts` — 41 tests. Covers the six URL forms
  that name one page collapsing to one identity, hash stability across volatile
  fragments, span location including the null case, every claim-verifier
  rejection, and every chart-planner refusal including the null-gap and
  determinism cases.
- `scripts/smoke-evidence-ledger.mjs` (`npm run test:e2e:evidence-ledger`) —
  18 checks against the real local PostgreSQL database, walking snapshot → span
  → observation → change event → chart spec and then attempting the writes that
  must be rejected. It confirms in the database, not just in TypeScript, that a
  number with no evidence span cannot be inserted, that an empty excerpt and
  reversed offsets are refused, that an unknown event type and out-of-range
  materiality are refused, and that a re-run does not duplicate a change. All
  work happens in one transaction and is rolled back; a post-check confirms no
  rows remain.

### Verification

- `npm run test:e2e:evidence-ledger`: PASS — 18 passed, 0 failed.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 49 files passed, 1 skipped; 472 tests passed,
  1 skipped (up from 431).
- ESLint over the new modules and tests: PASS, zero errors.

### Remaining in Wave 1

Shared evidence pack in the orchestrator, rewiring `lib/agents/bind-evidence.ts`
from lexical URL matching to span ids, the evidence drawer, and migrating each
artifact to render a validated `ChartSpec`.

## 2026-08-02 — Wave 1 (part 3): evidence UI and honest claim binding

### Built — evidence surfaces

- `components/artifacts/EvidenceDrawer.tsx` — the "prove it" surface. Shows the
  verbatim excerpt first, then the entity-match state, retrieval timestamp,
  snapshot hash, and source link. The hash matters because it lets a reviewer
  confirm the excerpt came from the snapshot we stored rather than from a page
  that has since changed. Contradicting spans render alongside supporting ones
  with an explicit note that certainty is reduced rather than one side being
  chosen. When nothing backs a claim it says so outright, because an empty panel
  reads as a loading state.
- `components/artifacts/ChartSpecView.tsx` — one renderer for every decision
  chart, so the methodology contract is structural rather than a per-chart
  decision. Data class, unit, period, sample size, formula, limitations,
  generated-at, evidence links, and a CSV of the exact rows are always present.
  `connectNulls={false}` and a null-aware tooltip keep a missing observation a
  visible gap instead of a line drawn through data we never collected. When the
  planner refuses to build a chart, its reasons render verbatim —
  "observations use incompatible units" tells a user something real.

### Built — claim binding now distinguishes proof from topical overlap

`lib/agents/bind-evidence.ts` scored a claim against a source's *title and URL
tokens*. That measures whether a source is topically related; it does not
establish that the page says what the claim says. Presenting the result as
evidence is exactly the "citations that don't prove the claim" problem the
ledger exists to fix.

- `EvidenceClaimBinding` gained `bindingMethod: 'span' | 'lexical'` and
  `evidenceSpanIds`.
- `bindClaim` now takes an optional span index and prefers it: when an excerpt
  supports the claim, the binding is `span` with full support. Otherwise it
  falls back to the lexical score and labels itself `lexical`.
- The lexical path was kept rather than removed because most agents do not
  produce spans yet, and a related source is still worth showing — as a related
  source.

### Tests added

- `__tests__/evidence-binding-method.test.ts` — 5 tests: a lexical overlap is
  labelled lexical and never scores 1, a span wins when present, mixed claims
  resolve per-claim, an empty span list does not fabricate support, and prose
  bindings carry the label too.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 50 files passed, 1 skipped; 477 tests passed,
  1 skipped (up from 472).
- Production `next build`: PASS — compilation, type validation, and static
  generation completed with the new components included.
- ESLint over changed files: zero errors; the same two pre-existing
  `react-hooks/exhaustive-deps` warnings remain in `ExecutionPlan.tsx` and
  `ResultsInsightCharts.tsx`.

### Wave 1 status

The ledger, its modules, its database-level proof, and the evidence UI are in
place. Remaining before Wave 1 closes: the shared evidence pack in the
orchestrator (so the six agents collect once and read from one pack), and
migrating the existing artifacts to render `ChartSpecView` rather than their own
ad-hoc chart markup.

## 2026-08-02 — Wave 2 (part 1): measured connectors and change detection

### Built — connectors that produce genuinely measured data

Both were chosen because they need no paid key and no model reads them, so the
resulting numbers cannot be hallucinated.

- `lib/intelligence/connectors/github-releases.ts` — published release history
  for any public repository. `releasesToMonthlyCounts` emits *every* month
  between the first and last release, including months with zero releases: a
  quiet month is a real finding about a competitor's cadence, and skipping it
  would let a chart imply steady shipping. Rate limiting is reported distinctly
  from "no releases", because in a chart those look identical and mean opposite
  things.
- `lib/intelligence/connectors/sec-edgar.ts` — standardised XBRL company facts.
  `dedupeRestatements` keeps only the most recently filed value per period;
  counting an amended quarter twice looks exactly like a real business swing.
  Coverage limits (US registrants only, periodic figures) travel with the chart
  as `limitations` rather than living in a document nobody reads.

### Built — change detection and materiality

`lib/intelligence/change-detector.ts`:

- `detectMetricChange` refuses to compare across units, does not treat a first
  observation as a change (which would fire a burst of false events the day a
  project is created), and handles a zero baseline without dividing by it.
- `buildDedupeKey` hashes entity, event type, and normalized before/after —
  deliberately excluding run id, timestamp, and snapshot ids. Including any of
  those is what makes a weekly digest re-report the same news every week.
- `scoreMateriality` is deterministic and returns a sentence explaining the
  score. It combines event-type weight, magnitude, source trust, whether the
  entity is tracked, relevance to the project's stated decision, and novelty.
  It is explicitly not model confidence: a model's certainty that it noticed
  something says nothing about whether the something matters, and using it as a
  proxy is how alert fatigue starts.

### Tests added

- `__tests__/connectors.test.ts` — 17 tests. Repository-form parsing, draft and
  prerelease handling, throttling reported distinctly from absence, zero-month
  emission across a year boundary, restatement deduplication, and annual-only
  filtering.
- `__tests__/measured-chart-pipeline.test.ts` — 7 tests proving the vertical
  slice: connector output → evidence spans → metric observations → a validated
  `measured` ChartSpec in which every row has an evidence span to trace back to,
  a quiet month stays a real zero, and a mixed-unit concept is refused.
- `__tests__/change-detection.test.ts` — 21 tests covering detection edge cases,
  dedupe-key stability across runs, and every materiality factor including that
  a routine low-trust edit stays below the alert threshold while a significant
  official pricing move clears it.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 53 files passed, 1 skipped; 522 tests passed,
  1 skipped (up from 477).
- ESLint over the new modules and tests: PASS, zero errors.

### What this means

The product can now produce a chart where every point traces to a dated,
published record rather than to model output — which is the claim the whole
product thesis rests on. Two small connectors deliver more trustworthy chart
rows than another specialist agent would.

### Remaining in Wave 2

Changelog/RSS, pricing-page extraction, GDELT and FRED connectors; wiring
detection into a per-project scheduled collection with the no-change short
circuit; and the shared evidence pack in the orchestrator.

## 2026-08-02 — Wave 2 (part 2): the collection run and no-change short circuit

### Built — `lib/intelligence/collection-run.ts`

The loop that makes the product worth returning to: fetch the approved sources,
compare each against what was stored last time, and do expensive work only where
something moved.

The no-change short circuit is the economic heart of the product. A general
chatbot re-researches the market from scratch on every ask. Here, a week in
which three tracked pages are untouched costs three HTTP requests and no model
calls at all — no duplicate snapshot, no extraction, no synthesis, no event.
That is what makes a scheduled refresh affordable, and it is how the >90%
no-change-skip target is met.

Behaviour worth recording:

- A first sighting is not a change, so creating a project does not fire a burst
  of false events.
- An empty page is recorded as unreachable rather than stored. Storing a failed
  fetch as an empty page makes the real content look like a change when it
  returns.
- Extraction failure keeps the snapshot — it is still a record of what the page
  said — but claims no evidence from it.
- Sources are processed independently. One unreachable page must not abort the
  run: a returning user's dashboard is more useful with four of five sources
  refreshed than with an error.
- Dependencies are injected as ports, so the orchestration logic is testable
  without network or database.

### Two real bugs the tests caught

Both would have produced a product that silently detected nothing.

1. **Read-after-write ordering.** The baseline metrics were loaded *after* the
   new observations were saved, so the value just written became its own
   predecessor and every comparison comes out equal. The baseline is now read
   before the write.
2. **Baseline aliasing.** `previousMetrics` could hand back a live map that
   `saveEvidence` then mutated, moving the baseline to the new value mid-
   comparison. The pipeline now copies the map rather than aliasing it.

### Tests added

- `__tests__/collection-run.test.ts` — 12 tests encoding the Wave 2 exit
  criterion: change a controlled page and exactly one traceable event appears
  with before/after and an explained materiality score; run again unchanged and
  extraction is never called. Also covers cosmetic-difference tolerance, the
  short-circuit rate across a mixed run, no duplicate across runs, first
  sighting, an immaterial change being recorded but kept out of the digest, and
  four degradation paths.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 54 files passed, 1 skipped; 534 tests passed,
  1 skipped (up from 522).
- ESLint: PASS, zero errors.

### Remaining in Wave 2

Changelog/RSS, pricing-page extraction, GDELT and FRED connectors; scheduling
the run per project through Inngest; and the shared evidence pack in the
orchestrator.

## 2026-08-02 — Wave 2 (part 3): changelog and pricing connectors

### Built — `connectors/changelog-rss.ts`

Cheap, structured, high signal. A competitor's changelog says what shipped and
when, in their own words, with no search credit and no model call. The parser is
deliberately small and dependency-free: feeds in the wild are inconsistent
enough that a strict XML parser rejects a meaningful share of them, and a
rejected feed reads as a competitor that stopped shipping.

- Handles both RSS 2.0 and Atom, including CDATA, escaped entities, and Atom's
  `href`-attribute links.
- Undated entries are dropped rather than dated to now. An undated item placed
  at today's date looks like a brand-new release and can fire a false alert.
- Entries carry no metric. A changelog entry is a dated event, not a
  measurement; attaching a number here would invent one the feed never stated.
  Monthly counting is a separate, explicit step.

### Built — `connectors/pricing-extractor.ts`

The highest-value recurring question in the research, and the hardest connector
to do honestly: a pricing page is prose and a price is a number, which is exactly
the gap where a model invents a plausible figure.

Nothing here trusts a model. Prices are matched against the page's own text and
every price keeps its surrounding sentence as the excerpt.

- Requires a currency marker. A bare "49" on a pricing page could be a seat
  count, a percentage, or a feature limit.
- Discount language ("save $100", "was $99") disqualifies the sentence.
- The billing interval is read from the number or, failing that, from the
  sentence around it.
- The metric key includes the plan (`plan_price:pro`). Without that, "$49 →
  $499" reads as a 10x price rise when it is really the Pro and Enterprise
  tiers being compared to each other.
- An unattributed price is marked `probable` rather than `confirmed`, because a
  wrong plan name silently attaches a price to the wrong tier.

### Tests added

- `__tests__/connectors-feed-pricing.test.ts` — 20 tests. Feed parsing for both
  formats, undated-entry handling, quiet-month emission, and for pricing: the
  property that every extracted figure is locatable in the input, plus discount
  rejection, non-price number rejection, plan attribution, interval inference,
  non-dollar currency, duplicate suppression, and per-tier series separation.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 55 files passed, 1 skipped; 554 tests passed,
  1 skipped (up from 534).
- ESLint: PASS, zero errors.

## 2026-08-02 — Wave 3 (part 1): digest assembly and the returning-user surface

### Built — `lib/intelligence/digest.ts`

The five gates from the research (event is from this period, not already
reported, entity matches, an evidence span is stored, materiality clears the
threshold) are enforced in one function, so no caller can send an alert that
skips one.

The design bias is toward sending nothing. A digest a user stops opening is
worth less than no digest, and the failure mode of a monitoring product is
always over-reporting.

- Suppression reasons are returned alongside the digest rather than discarded.
  "We saw four changes but none cleared your threshold" is a useful answer and
  lets a user tune the threshold instead of assuming the product is asleep.
- Items are ordered most-material first, so a user who reads only the first
  item gets the one that matters most, then grouped by entity so the digest
  reads as "what did Lilian do" rather than a flat interleaved list.
- The headline names the change (`Lilian changed pricing`) rather than counting
  changes (`3 changes`), because only the former tells a user whether to open
  it.
- `shouldSend` is separate from `buildDigest`: an empty digest is useful
  in-app — "nothing changed" is information — but must never become an email.
- A hard item cap keeps a noisy week readable, and the overflow is disclosed.

### Built — `components/dashboard/SinceLastVisit.tsx`

The surface a returning user lands on. Research §14.1: lead with change, not a
blank prompt. A chat box asks the user to remember what they were tracking; a
change list tells them what happened while they were away, which is what makes a
second visit worth more than the first.

- "Nothing changed" is stated confidently rather than hidden. A product that
  only speaks when it has news teaches users that silence means broken.
- Every row shows why it was judged material, so a user can argue with the
  threshold rather than having to trust it.
- Unreachable sources are surfaced separately with an explicit note that a
  change on them would not have been detected — "no change" and "we could not
  look" mean opposite things, and collapsing them is dishonest.
- Suppressed changes are disclosed and expandable, answering "why am I not
  seeing more?" before the user has to ask.

### Tests added

- `__tests__/digest.test.ts` — 17 tests, one per gate plus ordering, grouping,
  capping, headline construction, and rendering. Includes the cases that must
  *not* send: pre-period events, cross-run duplicates, entity mismatch, missing
  evidence span, and sub-threshold materiality.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 56 files passed, 1 skipped; 571 tests passed,
  1 skipped (up from 554).
- Production `next build`: PASS, compiled successfully.
- ESLint: PASS, zero errors.

### Remaining in Wave 3

Wiring the dashboard into the project route as the default screen, the activity
timeline and pricing/release charts on it, the feature verification matrix,
rolling conversation summary, artifact references on turns, and a genuinely
cheap Explain mode.

## 2026-08-02 — Wave 3 (part 2): bounded conversation context

### Built — `lib/intelligence/conversation-context.ts`

CLAUDE.md is emphatic that this is not a popup chatbot: context must never reset
between messages, and an agent must never ask again for something the user
already established. The naive way to honour that — send the whole transcript —
gets expensive, then slow, then wrong, because the useful facts end up buried
among small talk.

Context is assembled from five layers with separate budgets:

1. the current question and any artifacts the user attached to it
2. project state — entities, decision focus, corrections, open questions
3. a rolling structured summary of everything older than the recent window
4. the most recent turns, verbatim
5. retrieved claims and evidence

Decisions worth recording:

- **Layer 2 has a hard floor.** It is the cheapest layer and its absence causes
  the worst failure: an agent that has forgotten which product it is researching
  answers confidently about the wrong company. A 400-turn transcript can no
  longer crowd it out.
- **Corrections render last**, so they read as the final word. A user who has
  said "that is a different Lilian" must not be contradicted by an earlier
  inference in the same prompt.
- **Summaries preserve evidence ids verbatim.** A summarised claim that loses
  its ids becomes an unsourced assertion.
- **Recent turns are trimmed from the oldest end**, never mid-turn, because the
  newest exchange is what the question follows on from.
- **Assumptions are labelled as assumptions**, not folded in with facts.
- `canAnswerFromStored` returns a *reason* when it declines, so the UI can say
  "this needs fresh data because the newest evidence is 40 days old" rather than
  silently escalating to a sweep the user did not ask for.

`requiresCollection` makes Explain and Compare genuinely cheap: they answer from
stored evidence with no collection. Running six agents to answer "what did you
mean by that?" costs as much as the original sweep and is not more correct.

### A budget-accounting bug the tests caught

Section separators were not charged against the budget, so a context with
several layers overshot by seven characters per joiner every time. Small, but it
means the declared budget was not the real one — and the whole point of the
budget is that it can be relied on. The joiner cost is now deducted as each
section is added.

### Tests added

- `__tests__/conversation-context.test.ts` — 19 tests. Includes the case that
  matters most: project state survives a 400-turn transcript at 500 characters
  per turn, so the product cannot forget what it is researching.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 57 files passed, 1 skipped; 590 tests passed,
  1 skipped (up from 571).
- ESLint: PASS, zero errors.
