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

## 2026-08-02 — Wave 4 (part 1): ScenarioBrief and MiroFish hardening

### Built — `lib/intelligence/scenario-brief.ts`

The rule this module exists to enforce: **an arbitrary user prompt must never go
straight to a persona pool.** A synthetic panel answers whatever it is asked,
confidently, and if the question smuggled in an assumption then the answer
inherits it invisibly. The brief is therefore built from verified project state,
shown to the user, and versioned before anything expensive runs.

- **Facts require evidence span ids.** A "fact" with no evidence is an
  assumption wearing a disguise, and the panel would be told it is established.
- **Assumptions are rendered to the panel as explicitly unproven**, so a
  persona does not treat a premise as settled and have its answer read back as
  evidence for it.
- **Branching creates a new version** rather than mutating. Overwriting the base
  case destroys the only thing that makes a branch interesting — the comparison.
- **The cache key includes the evidence hash, panel version, and model version.**
  Two runs of "the same" scenario against different evidence are different runs;
  colliding them serves a stale panel result as though it reflected current facts.
- **Round 1 withholds other personas' responses.** Showing them produces
  artificial consensus: personas converge on whatever they read first, and the
  resulting agreement measures the prompt rather than the segments.
- **Limitations are non-negotiable and not caller-supplied.** Every scenario
  output carries that it is synthetic, that persona agreement has no statistical
  weight, that it is uncalibrated and not a prediction, and the real panel size.
  The whole risk of this feature is a user reading synthetic output as market
  research, and that disclosure is the only thing between the two readings.

Validation warns without blocking when a brief rests entirely on assumptions —
a thought experiment is legitimate, it just has to be labelled — and when *no*
assumptions are stated alongside facts, which usually means an unproven premise
is hiding inside the decision question.

### Built — migration `0010_swarm_scenarios.sql`

`swarm_scenarios`, `swarm_rounds`, `swarm_responses`. The existing path ran a
panel, streamed a result, and forgot it, which made the lab a novelty: no
follow-up, no per-persona inspection, no branch comparison.

Persona responses are stored verbatim so the panel is inspectable rather than
only summarised — a user must be able to read what was actually said instead of
trusting a distribution chart. Per-persona failures are recorded, so a partial
panel is reported as partial and never silently becomes a smaller panel that
looks complete. Nothing in these tables is evidence: synthetic responses never
join `evidence_spans` and are never cited as sources.

### Built — MiroFish service hardening

The service holds a model API key and does unbounded model work per request.
Left open it is a quota drain and a cross-tenant read waiting to happen. It is
now treated as a private worker:

- CORS restricted to the configured app origin instead of every origin.
- Every route except health requires `X-MiroFish-Token`, compared with
  `hmac.compare_digest` — a plain `==` leaks the token a byte at a time to
  anyone willing to measure.
- **An unset token fails closed** (503 on every API route). A silent open
  default is how a service ends up exposed in the one environment nobody checked.
- Simulation and project directories resolve under a fixed root and reject
  traversal. The character check would suffice today, but the resolve-and-compare
  stays correct if the id format is relaxed, and on a filesystem with symlinks
  only the resolved comparison is authoritative.
- Binds `127.0.0.1` by default, with a warning when overridden.

Health stays unauthenticated so a supervisor can distinguish "misconfigured"
from "dead".

### Tests added

- `__tests__/scenario-brief.test.ts` — 23 tests covering validation, the
  unproven-premise and thought-experiment warnings, branch versioning, cache-key
  sensitivity, round-prompt separation of facts from assumptions, round-1
  isolation, and every mandatory limitation.
- `mirofish-service/test_server_guards.py` — 17 tests covering auth accept and
  reject, the fail-closed path, nine hostile identifiers against both directory
  helpers, and that generated ids match the safe pattern.

### Verification

- Migration applied and verified against local PostgreSQL; re-running is
  idempotent. Supabase mirror `014` and `db/schema.sql` updated.
- `python3 -m py_compile mirofish-service/server.py`: PASS.
- MiroFish guard tests: PASS — 17 passed. Created `mirofish-service/.venv`
  (already git-ignored) and installed the declared requirements plus pytest.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 58 files passed, 1 skipped; 613 tests passed,
  1 skipped (up from 590).
- ESLint: PASS, zero errors.

### Remaining in Wave 4

Wiring the brief into the run path, persisting rounds and responses through the
repo, the segment/persona follow-up UI, and the dissent, objection, sensitivity,
and transition charts.

## 2026-08-02 — Wave 0 closed: real multimodal input and honest README

### Built — image bytes actually reach the model

`ImageAttachment` has carried base64 image data all along, but only the *count*
reached the model: the classifier prompt read "Attached images: 2. Metadata
only." while the product's copy implied it had examined the screenshot. That
line was accurate about the implementation and dishonest about the product,
which is precisely why it had to change rather than be deleted.

- `lib/agents/gemini.ts` gained a `buildContents` helper that emits
  `inline_data` parts alongside the text prompt, wired into both the text and
  JSON generation paths.
- Unsupported types, oversized payloads, and empty data are skipped rather than
  failing the whole request — a text answer without one screenshot beats no
  answer. Images per request are capped, since an oversized inline payload fails
  the entire call rather than being ignored.
- `lib/agents/classify.ts` now passes the real bytes and tells the model to read
  them rather than guess from the count.

### Built — README states what is true

The header claimed multi-agent intelligence with a closed feedback loop and said
nothing about maturity. It now leads with the product promise and carries a
claim-by-claim reality table: which charts are genuinely measured, which are
model-derived, that enterprise SSO is unavailable and why, and that synthetic
panel output never enters the evidence ledger. Status is stated plainly as
advanced prototype / private beta.

### Tests added

- `__tests__/multimodal-images.test.ts` — 9 tests: the bytes travel, the text
  prompt survives alongside them, both generation paths attach images, and each
  rejection path (unsupported type, oversized, over-cap, empty) drops the image
  without failing the request. A source-level check keeps the old
  "Metadata only" wording from returning.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 59 files passed, 1 skipped; 622 tests passed,
  1 skipped (up from 613).
- ESLint: PASS, zero errors.

**Wave 0 is now complete.** Every item in the product-level honesty sweep is
done: fabricated output removed and locked by tests, the outbound URL policy in
place, feature flags agreeing across client and server, real multimodal input,
and a README that does not overstate the product.

## 2026-08-02 — Wave 4 (part 2): scenario runner and result surfaces

### Built — `lib/intelligence/scenario-runner.ts`

Executes the three rounds and aggregates the result. Aggregation is where a
synthetic panel is most likely to mislead, so the rules are strict:

- **Failed personas are counted, never dropped.** Silently excluding them turns
  a half-broken run into a smaller panel that looks complete, and the
  distribution then reads as consensus among the survivors.
- **Counts must reconcile to the panel size.** When they do not — because
  personas failed, returned nothing, or named an alternative that is not in the
  brief — the distribution is withheld and the reason is stated. A chart whose
  bars do not sum to the stated total invites the reader to infer a total that
  is not there.
- **No probability is emitted.** Persona counts are counts; converting them to a
  percentage implies a sampling frame that does not exist.
- **A persona that fails one round is still asked the next**, so a transient
  model error in round 2 cannot silently shrink the decision round.
- Position changes between the challenge and decision rounds are recorded, so
  movement can be charted rather than inferred from two separate distributions.
  Movement is often more informative than the final split.

### Built — `components/artifacts/ScenarioLabCharts.tsx`

The design works against the single most dangerous misreading — persona
agreement taken as evidence:

- The synthetic badge sits on every panel, not just the first.
- Counts render as "7 of 12 personas", never as a percentage.
- Dissent gets equal visual weight to the majority, because a 7–5 split and a
  12–0 split are different findings that a bar chart alone conflates.
- Unanimity is explicitly flagged as more likely to reflect framing than
  agreement, with a prompt to re-check the assumptions.
- A zero count renders as no bar rather than a minimum-width stub.
- Raw persona responses stay one click away, so the panel is inspectable rather
  than something the user has to take on trust.
- Limitations render last and always.

### Tests added

- `__tests__/scenario-runner.test.ts` — 17 tests: round execution, per-persona
  history isolation, the absence of any probability field, reconciliation and
  withholding, invented alternatives, failure counting, recovery after a
  mid-scenario failure, refusal to fabricate a panel, dissent, objection
  grouping, and position changes.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 60 files passed, 1 skipped; 639 tests passed,
  1 skipped (up from 622).
- Production `next build`: PASS.
- ESLint: PASS, zero errors.

## 2026-08-02 — Wave 4 (part 3): scenario persistence and a NULL-uniqueness bug

### Built — `lib/intelligence/scenario-repo.ts`

Ownership-scoped persistence for scenarios, rounds, and responses. Rounds and
responses are written in one transaction: a scenario with round 1 stored and
round 3 missing would render as a panel that mysteriously stopped answering,
and a user would have no way to distinguish that from a panel that genuinely
deadlocked.

`loadScenarioResponses` orders by persona then round rather than round then
persona, because the useful reading is "what did this persona think over time" —
which is the question a follow-up is usually chasing. `loadScenarioLineage`
returns every version of a lineage, since comparison is the entire point of
branching; without it a branch is just another disposable run.

### A real constraint bug the database smoke test caught

The rounds table declared `UNIQUE (scenario_id, round, scope, scope_target)`,
which does not do what it appears to. SQL treats every NULL as distinct for
uniqueness purposes, and a panel-scoped round has `scope_target IS NULL` — so
the same round could be inserted any number of times and the constraint would
never fire. The dedupe protection was decorative.

Replaced with a unique index on
`(scenario_id, round, scope, COALESCE(scope_target, ''))`, which collapses the
NULL to a real value so the constraint actually binds. The migration drops the
old constraint first, so re-running it repairs an already-applied database
rather than silently leaving the broken version in place.

This is the second time a smoke test against real PostgreSQL caught something
the TypeScript-level tests could not: the first was the read-after-write
ordering in the collection run. Constraints that exist only in application code
are assumptions; constraints in the database are facts.

### Tests added

- `scripts/smoke-swarm-scenarios.mjs` (`npm run test:e2e:swarm-scenarios`) —
  15 checks: branch versioning without destroying the base, a branch that cannot
  point at a later version, duplicate-round rejection, a segment follow-up
  recorded as a further round rather than a new scenario, a failed persona
  recorded rather than dropped, empty-body rejection, cascade deletion, and —
  explicitly — that no synthetic response leaked into `evidence_spans`.

### Verification

- `npm run test:e2e:swarm-scenarios`: PASS — 15 passed, 0 failed.
- Migration re-applied and verified; idempotent.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 60 files passed, 1 skipped; 639 tests passed,
  1 skipped.
- ESLint: PASS, zero errors.

## 2026-08-02 — Wave 3 (part 3): wiring the dashboard and evidence drawer

### Built — API routes

- `GET /api/projects/[id]/dashboard` — assembles the returning-user digest
  server-side. The materiality threshold and every send gate are applied here
  rather than in the client, so a caller cannot request unfiltered changes; the
  whole point of materiality is that noise never reaches the user. Source
  coverage is returned separately from change, because "nothing changed" and
  "we could not look" mean opposite things and collapsing them would let a
  broken collector read as a quiet market.
- `GET /api/evidence?ids=` — backs the drawer. Ownership-scoped through
  `loadSpans`, so an id belonging to another user simply does not come back
  rather than returning 403 and confirming it exists. Requested and found counts
  are both returned, so the drawer can say "2 of 3 excerpts are no longer
  available" instead of quietly showing fewer than the claim cited.

Both routes repeat the `user_id` predicate on every query even though ownership
is checked first, so a later refactor that loses the ownership check still
cannot return another user's rows.

### Built — client wiring

- `hooks/useProjectDashboard.ts` — loads the dashboard and, on demand, the
  evidence behind any item. The last-visit marker is advanced only once the
  user has actually seen the dashboard, never on fetch: a monitoring product
  that silently drops the week's changes because someone opened and closed a
  tab is worse than one that repeats itself. Blocked `localStorage` (private
  browsing) falls back to the server default rather than failing the screen.
- `components/dashboard/ProjectDashboard.tsx` — composes the change list with
  the evidence drawer, so "what changed?" and "prove it" are one click apart
  rather than in two different places. That adjacency is most of the product's
  claim to being more than a research bot. "Ask about this" carries the observed
  before/after values into the question so the turn does not re-derive them.

A render-loop hazard was fixed while writing it: the mark-as-seen effect
originally depended on the hook's return object, which is rebuilt every render,
so it would have run on every render rather than when data arrived.

### Tests added

- `__tests__/dashboard-api.test.ts` — 12 tests covering row mapping (including
  that an unresolved entity is named rather than rendered blank, which reads as
  a bug and destroys trust in the row), server-side gating, the unchanged-vs-
  unreachable split, and evidence id parsing with its cap.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 61 files passed, 1 skipped; 651 tests passed,
  1 skipped (up from 639).
- Production `next build`: PASS. Both routes register: `/api/evidence` and
  `/api/projects/[id]/dashboard`.
- ESLint over the new routes, hook, and components: zero errors and zero
  warnings. The 23 repo-wide warnings are pre-existing.

## 2026-08-02 — Wave 3 complete: dashboard mounted and proven end to end

### Built — the dashboard is now the first thing a project shows

`ProjectDashboard` is mounted in `DashboardWorkspace`'s intelligence tab, above
the static project overview. Research §14.1: lead with change, not a blank
prompt. A chat box asks a returning user to remember what they were tracking and
re-type it; a change list tells them what happened while they were away, which
is what makes a second visit worth more than the first.

"Ask about this" on any change routes into the existing composer, carrying the
observed before/after values so the research turn does not have to re-derive
them.

### Verified against a running server, not just in unit tests

`scripts/smoke-dashboard-e2e.mjs` (`npm run test:e2e:dashboard`) drives the real
Next.js server with a real session: signup → create project → seed a change
event with a genuine evidence span → call the dashboard API → call the evidence
API. 11 checks, all passing:

- The digest returns the seeded change and the headline names it.
- Before/after values survive the round trip intact.
- The materiality *reason* reaches the client, so a user can disagree with the
  judgment rather than only receiving it.
- The evidence route returns the exact excerpt with its snapshot hash.
- A sub-threshold change is withheld, and the withholding is explained.

That last pair is the one worth having an integration test for: it proves the
gates run server-side and that suppression is visible rather than silent.

Route probes also confirmed the unauthenticated paths redirect rather than
leaking: `/`, `/api/projects/[id]/dashboard`, and `/api/evidence` all return 307
to the auth page, and `/auth` returns 200.

### A pre-existing multi-tenant bug found while doing this

`canonical_entities` has a unique constraint on
`(scope_key, entity_type, entity_key)` with no owner column. Two different users
tracking the same competitor under the same scope key collide, and the second
user's insert fails with a unique violation. It surfaced when a smoke run
collided with a leftover row belonging to a different user.

Not fixed here — it is outside this change and wants its own migration
following the drop-then-recreate pattern from `0010`. Flagged as follow-up work.

### Verification

- `npm run test:e2e:dashboard`: PASS — 11 passed, 0 failed. All test data
  removed afterwards; a post-check confirms zero leftover users.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 61 files passed, 1 skipped; 651 tests passed,
  1 skipped.
- Production `next build`: PASS.
- ESLint over the changed components: zero errors, zero warnings.

## 2026-08-02 — Closing the loop on MiroFish auth, and a Node version pin

### Fixed — the hardening had broken every existing MiroFish call

Adding the shared secret to the worker was only half the change. The two
TypeScript clients still sent bare `Content-Type` headers, so with the hardened
service every panel would have returned 401.

Worse, five of the nine call sites were readiness and config GETs that swallow
failures and return `false` or `[]`. A 401 on those does not surface as an
error — it looks exactly like "the simulation is not ready", which is the kind
of silent outage that takes a day to diagnose.

- Added `MIROFISH_SERVICE_TOKEN` to the config schema.
- Added a shared `mirofishHeaders()` builder in both `lib/tools/mirofish.ts` and
  `lib/tools/mirofish-live.ts`, and routed all nine fetches through it.
- The header is omitted rather than sent empty when unconfigured, so a missing
  secret fails as "missing" rather than as "wrong".

### Tests added

- `__tests__/mirofish-auth-header.test.ts` — 11 tests. Beyond checking the
  header is sent, it asserts that the number of `mirofish Headers()` uses equals
  the number of `await fetch(` calls in each client, so a new call site cannot
  quietly reintroduce an unauthenticated request. That count assertion is what
  caught the five GETs I had missed.
- Also asserts `.env.example` documents the token, origin, and host, and that
  the documented host stays on loopback.

### Fixed — Node version pin

A fresh shell defaulted to Node 18, where Vitest will not start at all
(`node:util` has no `styleText` export before 20.12). The repo had no pin, so
this presents as a confusing startup crash rather than as a version problem.
Added `.nvmrc` (22) and `engines.node >= 20.12` to `package.json`.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 62 files passed, 1 skipped; 662 tests passed,
  1 skipped (up from 651).
- ESLint over the changed clients, config, and test: zero errors.

## 2026-08-02 — Wave 4 (part 4): the Swarm Lab is reachable

### Built — `lib/intelligence/mirofish-adapter.ts`

Bridges the worker's whole-panel interview to the runner's per-persona,
per-round model. One worker call per round, demultiplexed back to the personas
that produced each response — calling per persona would multiply cost by the
panel size for identical work.

Decisions worth recording:

- **Personas come from the brief, not the worker.** The worker supplies voices;
  the brief supplies who they are meant to be. Without that the runner's segment
  breakdown would be meaningless.
- **Short response lists fail the uncovered personas.** If the panel is three
  and the worker returns two, the third is counted as failed rather than the
  panel being quietly shrunk to two. Extra responses are ignored rather than
  invented into personas that do not exist.
- **`checkPanelAvailable` refuses at the door.** Discovering the worker is down
  after two rounds have been billed is worse than refusing before starting, and
  the user gets a specific reason — including naming `MIROFISH_SERVICE_TOKEN`
  when it is missing, since without it every call returns 503 and the failure
  otherwise looks like an outage rather than a setting.
- **`parseDecision` is conservative.** An unparseable answer yields no choice
  rather than a guessed one. The runner then fails to reconcile the distribution
  and withholds it, which is correct: better than attributing a position to a
  persona that never clearly took it.

A regex subtlety worth noting: the keyword match had to become case-insensitive
("Option" opens a sentence as often as "option" sits inside one), but applying
the `i` flag wholesale would let "go with the cheaper plan" capture "the". The
uppercase requirement is therefore re-applied to the captured id after the
match rather than being dropped.

### Built — API routes

- `POST /api/scenarios` — validate and store a brief for review. Creating and
  running are separate calls on purpose: a synthetic panel is expensive and its
  output is easy to misread, so the user inspects alternatives, segments, facts,
  and assumptions before anything is spent. Validation warnings are returned but
  never block.
- `GET /api/scenarios/[id]` — the scenario with every persona response in full
  and its version lineage. Responses are not summarised, because a user must be
  able to read what a persona actually said instead of trusting a chart.
- `POST /api/scenarios/[id]/run` — runs the panel. Availability is re-checked
  even though create already checked it, since minutes may have passed. An
  already-complete scenario returns 409 pointing at branching, because
  re-running would append a second set of rounds and make the thread ambiguous.
  A failed run is still persisted — a scenario that ran and produced nothing is
  a fact about the panel, and discarding it would leave the user unable to
  distinguish it from one never started. If persistence itself fails the outcome
  is still returned, since the model calls were already spent.

All three are ownership-scoped and return 404 rather than 403 for another
user's scenario, so a response never confirms an id exists.

### Tests added

- `__tests__/mirofish-adapter.test.ts` — 19 tests. Availability refusals with
  specific reasons, panel derivation from the brief, one worker call per round,
  correct demultiplexing, and four no-fabrication cases: unreachable worker,
  short response list, extra responses, and blank responses.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 63 files passed, 1 skipped; 681 tests passed,
  1 skipped (up from 662).
- Production `next build`: PASS. All three routes register.
- ESLint: zero errors.

## 2026-08-02 — The pipeline is connected: project collection

### The gap this closes

A grep for callers of `saveExtractedEvidence`, `runCollection`, `saveChangeEvent`
and the connectors found **nothing outside `lib/intelligence/`**. Every piece of
the evidence pipeline was built and tested, and none of it ran in the actual
application. A real project's dashboard would have stayed empty indefinitely,
and the failure would have looked like "the market is quiet" rather than "the
collector was never called".

This is the difference between a library and a product, and it is worth
recording as its own entry because passing tests were actively hiding it.

### Built — `lib/intelligence/project-collection.ts`

Turns a Market Project into source definitions, collects them, and writes to the
ledger.

- **Source discovery is conservative.** Only URLs the user supplied, or the
  high-value paths derived from those (`/pricing`, `/changelog`, `/blog`), are
  fetched. A guessed URL that 404s costs a request and teaches nothing; a
  guessed URL that resolves to the *wrong* company produces evidence attributed
  to an entity it does not describe, which is worse than no evidence.
- **An explicit approval outranks the blocklist.** A user who approved a
  specific URL means it, even if a pattern would otherwise exclude it.
- **Structured extraction runs before the model.** A pricing page yields prices
  by regex against its own text; a GitHub URL yields release counts from the
  API. Those are measured — no model reads them — so the model-backed extractor
  covers only what they cannot.
- **Entities are scoped per project.** Two projects tracking the same competitor
  keep separate entities, or their snapshots and change history interleave.
- A blocked URL is logged as a policy outcome and the run continues; the source
  is reported unreachable rather than escalating as an error.

### Built — `POST /api/projects/[id]/collect`

Runs inline rather than queued. A first collection is the moment a user is most
likely to be watching, and a job id they have to poll is worse than a wait they
can see. Scheduled refreshes are the case that belongs in a queue and remain
tracked separately.

A project with no product URL and no approved sources is **refused with a
specific instruction** rather than returning an empty run, because an empty run
reads as "we looked and found nothing".

### Tests added

- `__tests__/project-collection.test.ts` — 13 tests covering source derivation,
  the refusal to invent competitor URLs, blocklist handling, approval
  precedence, dedupe across trailing slashes, and per-project entity scoping.
- Extended `scripts/smoke-dashboard-e2e.mjs` to 15 checks, adding the collect
  route's contract: the no-sources refusal with its machine-readable code, and
  a 404 for a project the user does not own.

Writing those smoke assertions caught that `apiError` nests as
`{ error: { code, message } }` rather than a bare string — my first assertion
read the wrong field and passed a truthy object check while proving nothing.

### Verification

- `npm run test:e2e:dashboard`: PASS — 15 passed, 0 failed.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 64 files passed, 1 skipped; 694 tests passed,
  1 skipped (up from 681).
- Production `next build`: PASS; `/api/projects/[id]/collect` registers.
- ESLint: zero errors.

### What is still not wired

MiroFish live testing is deliberately deferred at the product owner's request.
The scenario routes and adapter are complete and unit-tested against a mocked
worker; they have never run against the real service.

## 2026-08-02 — Orphan sweep: connecting everything that had no caller

### The audit

After connecting project collection, I grepped every exported symbol in
`lib/intelligence/` and the new components for callers outside their own module.
The result was worse than expected:

| Module | Callers before |
|---|---:|
| `ChartSpecView` | 0 |
| `ScenarioLabCharts` | 0 |
| `buildTurnContext` | 0 |
| `requiresCollection` / `canAnswerFromStored` | 0 |
| `planMetricChart` / `planEvidenceCoverageChart` | 0 |
| `verifyClaims` | 0 |
| `discoverFeed` | 0 |
| `loadObservations` / `saveChartSpec` | 0 |

Nine modules, all tested, none reachable. The same failure the ledger had:
green tests describing behaviour nobody could invoke.

### Built — measured charts, end to end

- `GET /api/projects/[id]/charts` plans charts from stored observations. No
  model is asked for rows: the planner decides whether observations can
  legitimately be drawn and builds the spec. Refused charts return their reasons
  rather than being dropped, because "observations use incompatible units" tells
  a user something true about their data while a missing chart tells them the
  product is broken.
- `components/dashboard/ProjectCharts.tsx` renders them through `ChartSpecView`
  and passes evidence span ids to the drawer, so "show the excerpts behind this"
  resolves to actual excerpts.
- Per-tier price keys stay distinct series. Collapsing them would make
  "$49 → $499" look like a price rise when it is really two different plans.

### Built — the cheap Explain path

Turn modes previously only appended an instruction to the prompt while still
running the full sweep, so "what did you mean by that?" cost the same as the
original research.

- `lib/intelligence/stored-answer.ts` loads relevant claims, builds a bounded
  context, and makes exactly one model call over the ledger.
- `POST /api/projects/[id]/explain` returns 409 with a reason when stored
  evidence cannot answer, rather than silently escalating. A user who asked a
  cheap question should not be billed for a sweep without being told, and "the
  newest stored evidence is 40 days old" is actionable.
- Citations are filtered to claim ids that actually exist. A hallucinated
  citation is worse than none, because it looks verifiable.

### Built — claim verification is now unavoidable

`verifyClaims` had no caller, which meant an unsupported numeric claim could
still reach the ledger — the exact failure the ledger exists to prevent.
`saveVerifiedClaims` in `ledger-repo` runs the verifier inside the write, so no
path can persist around it, and returns rejections rather than swallowing them.

### Built — feed discovery, and a design fix it forced

Wiring `discoverFeed` into `buildSourceDefinitions` made source derivation
perform up to eight HTTP requests per entity. The test suite went from 15s to
58s and six tests began failing, because a pure database function had quietly
become a network function whose results depended on which sites were up.

Discovery is now a separate `withDiscoveredFeeds` step with an injectable
fetcher, called explicitly from `collectProject`. Derivation stays pure and
fast; the cost of discovery is visible at the call site.

### Built — stored scenarios are readable

`components/dashboard/ScenarioView.tsx` reads a persisted scenario back and
renders it through `ScenarioLabCharts`. Counts are recomputed from the stored
rows rather than read from a stored summary, so a chart can never disagree with
the responses behind it. It reuses the runner's reconciliation rule, so the live
and stored paths cannot drift.

### Tests added

- `__tests__/stored-answer.test.ts` — 15 tests: mode gating, exactly one model
  call, refusal with a reason instead of silent escalation, no answer
  manufactured on model failure, and hallucinated citations dropped.
- `__tests__/project-collection.test.ts` grew to 18 with five discovery tests,
  including that derivation does no network work when there is nothing to
  discover.

### Verification

- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 65 files passed, 1 skipped; 714 tests passed,
  1 skipped (up from 694). Suite is back to ~15s.
- Production `next build`: PASS. `/charts`, `/collect`, `/explain` all register.
- ESLint: zero errors.

### Still not wired

`saveVerifiedClaims` is reachable but nothing in the agent synthesis path calls
it yet — claims are still produced by the orchestrator without passing through
the verifier. That is the next connection, and it needs the shared evidence pack
to exist first so agents have span ids to cite.

## 2026-08-02 — Research claims now reach the ledger

### The last named disconnection

`saveVerifiedClaims` was reachable but nothing called it: agent output was
rendered and forgotten. The Explain path had nothing to read and the
evidence-coverage chart had nothing to count.

### Built — `lib/intelligence/claims-from-research.ts`

Agents emit `facts[]` and `interpretation[]`. The hard part is that an agent
calling a line a "fact" is the model's own opinion of its own output. Trusting
that label is how "the category is consolidating" ends up in the ledger as an
established fact with a URL beside it.

Classification is therefore **re-derived**: a statement is stored as a `fact`
only when a stored excerpt actually supports it. Everything else becomes an
`interpretation` — legitimate analyst output that does not require evidence.
Nothing is dropped and nothing is promoted.

`excerptSupports` requires both substantial content-word overlap **and**, when
the statement asserts a number, that the same number appears in the excerpt.
The numeric condition is the one that matters: "prices rose to $59" and "prices
rose to $99" share nearly every word, and a purely lexical check would bind the
first statement to the second excerpt.

Confidence comes from the deterministic deriver rather than the agent, so a
single-source fact can never be labelled high. Synthesis-failure markers are
dropped rather than stored — they are diagnostics, and keeping them would
pollute the Explain path with error text presented as findings.

### Wired into the research-completion path

`app/api/sessions/[id]/messages/route.ts` now persists claims when an assistant
message carries orchestrator output for a project. Deliberately non-fatal: the
message is already saved and is what the user asked for, so failing the request
over a secondary write would lose their turn to bookkeeping.

### A test failure worth recording

The end-to-end run initially showed the supported `$59` statement vanishing
rather than being stored as a fact. The cause was not a bug: the seeded span had
no `metric_observation`, so the verifier correctly rejected a numeric claim
whose number nothing measured. **The seed was unrealistic, not the code** — the
real pipeline emits an observation alongside every price span.

Fixed the seed to match reality, and added an explicit assertion for the
rejection path: a numeric claim citing a span with no matching observation never
reaches the ledger, proven through the full HTTP request rather than in a unit
test.

### Tests added

- `__tests__/claims-from-research.test.ts` — 16 tests: excerpt support including
  the differing-number case, fact/interpretation classification in both
  directions, interpretation never promoted, synthesis markers dropped,
  deterministic confidence, and rejection reporting.
- `scripts/smoke-dashboard-e2e.mjs` grew to 25 checks covering claim
  persistence, classification, and the Explain round trip.

### Verification

- `npm run test:e2e:dashboard`: PASS — 25 passed, 0 failed.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 66 files passed, 1 skipped; 730 tests passed,
  1 skipped (up from 714).
- Production `next build`: PASS.
- ESLint: zero errors.

## 2026-08-02 — Fixing the remaining gaps: ownership, connectors, scheduling

### Fixed — G-G1, the cross-user entity collision

`canonical_entities` was unique on `(scope_key, entity_type, entity_key)` with
no owner column. Two users tracking the same competitor under the same scope
collided: the second user's insert failed with a 23505, even though neither can
see the other's rows. In production that means one user's entity keys can deny
another user the ability to create theirs, presenting as an unexplained error
during project setup.

Migration `0011` replaces it with a unique index over
`(user_id, scope_key, entity_type, entity_key)`, bringing entities in line with
every other table in the schema. Written drop-then-create so re-running repairs
an already-broken database.

The apply script **proves** the fix rather than trusting the DDL: it creates two
users, has both insert the same entity key, and confirms a single user still
cannot duplicate one. A migration that claims success without testing the
behaviour it changed is how a constraint like this got shipped wrong originally.

### Built — GDELT connector

Free and keyless, answering one narrow question: how often is this entity
written about, in a fixed query, over time.

The caveats are the point and travel with the data:

- It measures **media attention**, not market share or sentiment. A spike may be
  one wire story syndicated fifty times.
- The corpus denominator is unknown and changes as GDELT adds and drops outlets,
  so counts compare only within one series. That is why this is `derived` and
  `isEstimated`, never `measured`.
- A name that is also a common word is refused **up front**. "Apple" and "Block"
  return everything, and no downstream care fixes that. A user told the name is
  too generic can supply a domain; a user shown a meaningless line cannot
  un-see it.

GDELT answers a bad query with an HTML error page and a 200 status, so the parse
is defensive rather than trusting the content type.

### Built — FRED connector

Official statistical series: measured, dated, with units read from the series
metadata rather than assumed — FRED units differ per series and change on
revision, and a chart labelled with the wrong unit is worse than an unlabelled
one.

The design constraint is that a macro series says nothing about a specific
competitor. It is context for a decision. So spans are marked
`entityMatch: 'unverified'`, the metric key is namespaced `fred:<id>` so it
cannot collide with a company metric, and the first limitation states plainly
that this is not evidence about any competitor. That misuse — reading a macro
trend as a finding about one company — is the likely one.

FRED marks unpublished periods with `"."`. Those are dropped rather than parsed
as zero, which would be a real rate.

### Built — scheduled project refresh

`lib/inngest/functions/project-refresh.ts`, registered and running weekly.

This is what makes the workspace living rather than something a user must
remember to poke. The economics work only because of the no-change short
circuit: a project whose five tracked pages are untouched costs five HTTP
requests and zero model calls, so a weekly sweep across every project is
affordable in a way that re-researching each would not be.

- One step per project, so Inngest retries the one that failed rather than
  re-collecting everything because the last project timed out.
- Concurrency keyed per user, so one user's ten projects cannot saturate the
  collector.
- Ordered by least-recently-collected, so a backlog drains fairly.
- A project with nothing to collect is excluded from the query rather than
  burning a step to discover that every week.

### A test artifact worth noting

The FRED tests initially failed with "ReadableStream is locked". Not a product
bug: `fetchSeries` issues two requests in parallel and `safeFetch` reads each
body to enforce its size cap, so a stub returning one shared `Response` instance
left the second read on a consumed stream. Fixed the stub to return a fresh
response per call.

### Tests added

- `__tests__/connectors-gdelt-fred.test.ts` — 22 tests, weighted toward refusal
  and labelling: ambiguous names refused without an API call, HTML-error-with-200
  handled, macro series never attributed to an entity, missing periods never
  becoming zeros.

### Verification

- Entity ownership migration applied, verified behaviourally, and idempotent.
- `npm run test:e2e:evidence-ledger`: PASS — 18/18.
- `npm run test:e2e:swarm-scenarios`: PASS — 15/15.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 67 files passed, 1 skipped; 752 tests passed,
  1 skipped (up from 730).
- Production `next build`: PASS.
- ESLint: zero errors.

## 2026-08-02 — The three named remainders, closed

### 1. Shared evidence pack — agents now cite

The bridge from agent output to claims had to *guess* afterwards which excerpt
supported which statement, by lexical similarity. That guess is deliberately
conservative, so it under-matches: real facts got filed as interpretation and
the fact count read low.

`lib/intelligence/evidence-pack.ts` gives agents the evidence up front, with
ids, and asks them to cite. A citation the agent made is direct testimony about
what it used; a similarity score computed afterwards is only an inference about
what it might have used.

Two properties preserved:

- **Citing is preferred, never trusted blindly.** A cited id must exist in the
  pack that agent was given, *and* the excerpt must still support the statement.
  An agent citing `[span-999]` gets it stripped exactly as a hallucinated URL
  would be, and the count of such attempts is logged so the prompt instruction
  can be monitored.
- **The heuristic stays as a fallback**, so this raises the ceiling without
  lowering the floor.

The pack is threaded through `AgentContext.evidencePackBlock` into all six
research agents' system prompts, and the messages route passes the same pack to
the claims bridge so a cited id is validated against what that agent actually
had rather than against the whole ledger.

Citation markup is stripped before storage, so bracket ids never reach the user.

### 2. Methodology contract on the five remaining artifacts

`ChartSpecView` carries data class, unit, period, formula, sources, and CSV —
but only for things with a period and a numeric axis. A competitive matrix, a
win/loss scorecard, and a positioning gap table are not series. Forcing them
through a chart spec would mean **inventing a period and unit they do not have**,
which is the kind of fabrication the spec exists to prevent.

What they do share is the obligation: say where this came from, what class of
claim it is, how fresh it is, and let the user take the rows away.
`ArtifactMethodology` carries that, and is now on `CompetitiveMatrix`,
`WinLossScorecard`, `PricingTable`, `PositioningGap`, and `ThreatHeatmap`.

Each states its own honest method and limitations rather than a generic string —
win/loss says the frequency describes a convenience sample of public posts with
an unknown denominator; pricing says advertised list prices only, with
negotiated and annual-commit pricing invisible; threats say risk levels are
judgments about plausibility, not observed intent. Data class defaults to
`derived`, so a genuinely observed artifact has to say so rather than an
unlabelled one being read as measured.

### 3. Scenario brief review UI

`components/dashboard/ScenarioBriefReview.tsx`. This screen is the reason
`ScenarioBrief` exists rather than a raw prompt: a synthetic panel answers
whatever it is asked, so a question that smuggled in an assumption produces an
answer that inherits it invisibly. The only defence is showing the premise
before the panel sees it.

Facts and assumptions sit adjacent and visually distinct, assumptions are
editable, and an edit says plainly that it will run as a **new version** rather
than silently overwriting the base case — because comparison is the point of
branching. A brief with no facts says outright that it is a thought experiment.

### Verification

- `npm run test:e2e:dashboard`: PASS — 35 checks (was 25), adding: an agent
  citation binds the claim to that exact span, citation markup never reaches the
  stored statement, an invented span id is stripped rather than stored, a
  measured chart is built from the stored observation with every row tracing to
  an evidence span and a stated formula, and evidence coverage is classed
  derived rather than measured.
- `npm run test:e2e:evidence-ledger`: PASS — 18/18.
- `npm run test:e2e:swarm-scenarios`: PASS — 15/15.
- `npm run typecheck`: PASS.
- Full Vitest regression: PASS — 68 files passed, 1 skipped; 769 tests passed,
  1 skipped (up from 752).
- Production `next build`: PASS.
- ESLint: zero errors; two pre-existing warnings remain in files not touched.

## 2026-08-02 — Activity timeline, artifact attachment, swarm follow-up

### Built — activity timeline and source coverage

`GET /api/projects/[id]/timeline` plus `components/dashboard/ActivityTimeline.tsx`.

Deliberately distinct from the digest. The digest answers "what should I look at
since last time" and applies materiality gates; this answers "what has happened
at all", and **includes the changes the gates suppressed** — marked as
below-threshold rather than hidden. Someone investigating a competitor needs the
quiet moves too. The gates exist to protect attention, not history.

The coverage matrix reports what has actually been read per entity, per source
type, with age. It is deliberately **coverage, not a feature comparison**:
claiming a feature matrix the ledger cannot support would be the exact
fabrication this product exists to avoid. What it can honestly say is "we read
their pricing page twice this month and have never seen their changelog", which
is what a user needs to judge how much weight the rest deserves. A source never
collected renders as "never collected" rather than a blank cell, which reads as
a rendering failure.

### Built — artifact attachment

`components/dashboard/ArtifactAttachPicker.tsx`. "Ask about this chart" only
works if the chart's content travels with the question; without it the model
guesses which chart was meant, and a wrong guess produces a confident answer
about the wrong thing.

Attaching is also what makes a turn cheap: a question with an attached claim can
be answered from the ledger by the Explain path, while the same question without
it looks like new research and triggers a sweep. Display-only metadata is
dropped before sending, so nothing decorative reaches the prompt.

### Built — swarm follow-up

`POST /api/scenarios/[id]/follow-up` and `ScenarioFollowUp`.

A follow-up is recorded as a **further round on the same scenario**, not a new
scenario. The thread is the point: "why did procurement object?" is a question
about the panel that already answered, and a fresh scenario would lose the
context that makes the answer meaningful.

Scope narrows who is asked, and the respondent count is shown before the user
commits — asking one persona is cheap and specific, asking the whole panel again
costs a full round. Prior responses are scoped per persona, so no persona ever
sees another's answers; sharing them would manufacture the agreement the round
structure exists to avoid. A persona that fails is recorded as failed rather
than omitted, so a partial follow-up reads as partial.

Following up on a scenario that never ran returns 409 rather than starting one.

### A smoke-seed correction

Coverage came back empty at first. The query was right: `project-collection`
creates entities under `project:{id}`, and my smoke seeded a test-specific scope
key, so the join correctly found nothing. Fixed the seed to match what
collection actually does — the same class of unrealistic-fixture problem as the
missing `metric_observation` earlier.

### Verification

- `npm run test:e2e:dashboard`: PASS — 42 checks (was 35). New: the timeline
  includes the change the digest suppressed, coverage reports what has been read
  per entity and counts stored excerpts, and follow-up refuses a panel that
  never answered with an explanatory message.
- `npm run test:e2e:evidence-ledger`: PASS — 18/18.
- `npm run test:e2e:swarm-scenarios`: PASS — 15/15.
- `npm run typecheck`: PASS.
- Full Vitest: PASS — 769 passed, 1 skipped.
- Production `next build`: PASS; `/timeline` and `/follow-up` register.
- ESLint: zero errors across `components`, `lib`, and `app`.

## 2026-08-02 — Typed events, entity correction, and the first live-provider run

### Built — typed market events

`lib/intelligence/typed-events.ts`. Change events were inferred from metric
diffs: a `plan_price` observation moved, therefore "pricing changed". That works
for a number that moved and is blind to everything else — a tier renamed, a plan
sunset, a feature moved behind Enterprise.

Worse, inference guesses at *what kind* of change happened. The research is
explicit that pricing and release events must not be derived from content
changes alone, because "this page differs" is not the claim "they raised the
price", and presenting the second when you observed only the first is a
fabrication with a diff attached to make it look verified.

The extractors already know. Now they emit directly:

- **A price moved** — plan present in both readings at a different amount.
- **A plan appeared** — packaging changed, often a bigger signal than a price.
- **A plan disappeared** — a strategic move involving *no number changing at
  all*, which metric diffing could never see.
- **A currency change** — a repricing even at the same number, and not compared
  as a numeric move because across currencies that is meaningless.
- **Releases and changelog entries** carry `effectiveAt` from the source, so a
  competitor who shipped three weeks ago shipped three weeks ago.

A first reading still emits nothing, and undated changelog entries are skipped
rather than dated to now.

### Built — entity match correction

`GET/PATCH /api/projects/[id]/entities` and `EntityCorrectionPanel`.

Entity matching is a heuristic and when it is wrong the failure compounds:
evidence about a different company attaches to a competitor and every claim
resting on it inherits the error. The user is the only reliable arbiter of "that
Lilian is the design agency".

Marking a span as a mismatch **does not delete it** — the excerpt was genuinely
retrieved and the record of having looked is worth keeping. What changes is that
it stops supporting claims, stops reaching the digest, and leaves the evidence
pack. Critically, the correction also **downgrades the claims that leaned on
it** to interpretation; without that the fix would be cosmetic, with the span
withdrawn but its claims still sitting in the ledger at their old confidence.
The count is returned so the UI can say what the correction actually did.

Source allow/block was already enforced in `project-collection` and is verified
by the existing tests.

### `npm run test:e2e:live-research` — run for the first time

Explicitly requested, real, and billable. It passed, and it surfaced two things
no unit test could.

**1. `proxy-agent` could not be found at runtime.** `apify-client` loads it
through a require the bundler cannot trace, so every Apify call failed with
"Cannot find module 'proxy-agent'" — with the token correctly configured and the
package correctly installed. Fixed by adding `apify-client` and `proxy-agent` to
`serverExternalPackages`. After the fix the Apify run executes and returns a
dataset. This failure existed only inside the Next build, which is exactly the
class of problem a live run exists to catch.

**2. The SerpAPI account is out of searches.** Every `serpapi.*` call returned
HTTP 429 "Your account has run out of searches." Not a code defect — a quota to
top up. Until then, web and news search return nothing and the product is
running on HN, Apify, and the structured connectors only.

What the run did prove: Gemini synthesis works (4 calls, ~5.5k tokens,
`gemini-3.1-flash-lite`), HN works, Apify works after the fix, and every failed
tool was logged as `tool.failed` rather than silently substituted.

**What it did not prove:** the smoke deletes its user on completion, so the
stored output was gone before it could be inspected for fabrication. The
forced-failure suite covers that contract at the unit level; this run did not
independently confirm it end to end.

### Tests added

- `__tests__/typed-events.test.ts` — 15 tests, including the two cases inference
  could never produce: a plan disappearing, and a rename at an identical price
  emitting two events rather than one silent no-change.

### Verification

- `npm run test:e2e:live-research`: PASS (real providers).
- `npm run test:e2e:dashboard`: PASS — 42/42.
- `npm run typecheck`: PASS.
- Full Vitest: PASS — 784 passed, 1 skipped (up from 769).
- Production `next build`: PASS.
- ESLint: zero errors.

### Action for the product owner

Top up SerpAPI, or accept that web and news search are dark. It is the single
largest gap in live coverage right now, and no amount of code fixes it.

## 2026-08-02 — Orphan re-audit: four UI components were unreachable

### The check that caught it

Asked whether the product was finished, I re-ran the mounted-component audit
rather than answering from memory. Four components built earlier in the session
were not rendered anywhere:

| Component | State |
|---|---|
| `ScenarioView` | orphan |
| `ScenarioBriefReview` | orphan |
| `ArtifactAttachPicker` | orphan |
| `EntityCorrectionPanel` | orphan |

Each was tested, typechecked, and included in a passing build. None was
reachable by a user. This is the third time the same failure has appeared this
session — a module can be correct, covered, and completely inert.

The lesson is that "the tests pass" and "the build compiles" are both true of
dead code. Only reachability answers the question.

### Fixed

- `components/dashboard/ScenarioPanel.tsx` owns the Swarm Decision Lab
  lifecycle: draft → review → run → read, and back to review for a branch.
  Splitting those across screens would break what makes the lab worth having —
  a scenario is one object you return to, not a series of disposable runs. The
  brief is seeded from the project rather than typed into a blank form, because
  a blank form produces a generic brief and a generic brief produces a generic
  panel.
- `EntityCorrectionPanel` and `ScenarioPanel` mounted in the workspace beside
  the research itself. Behind a separate screen, the review nobody navigates to
  is the review nobody does.
- `ArtifactAttachPicker` mounted above the conversation, with attachments held
  in workspace state so they survive the composer remounting between result
  states. Attached artifacts are appended to the outgoing message as explicit
  references, so the turn carries what the user pointed at instead of the model
  guessing which chart was meant.

### Verification

- Mounted-component audit: **zero orphans**.
- `npm run test:e2e:dashboard`: PASS — 42/42.
- Rendered check against a live server with a real session: signup 200, project
  created 201, root page 200 with the app shell present, zero errors in the
  server log. Test data removed.
- `npm run typecheck`: PASS.
- Full Vitest: PASS — 784 passed, 1 skipped.
- Production `next build`: PASS.
- ESLint: zero errors.
