# Veracity MVP — Active TODO

Last updated: 2026-08-02

> **Sequencing now lives in [`GAP_CLOSURE_AND_FEATURE_PLAN.md`](./GAP_CLOSURE_AND_FEATURE_PLAN.md)** — the consolidated gap register (Slice gaps + roadmap Milestone 1 + open audit findings) and the connector/dashboard/scenario features the research supports. The unchecked items below map into its Waves 0–5.

## Now

- [x] Repair dependency installation and establish passing typecheck/tests/build baseline.
- [x] Create sessions and save the first user message before research starts.
- [x] Unify main and follow-up messages into one chronological timeline.
- [x] Persist complete follow-up output and sources.
- [x] Add regression tests for the conversation data transformation.
- [x] Continue truth reset across execution outputs, trends, charts, and unavailable provider states. (2026-08-02: market-trends synthesis-failure fabrication removed; four analyst judgment fields now render an explicit unavailable badge; forced-failure suite added.)
- [x] Replace MiroFish forecast/confidence UI with an honest scenario output schema.
- [x] Add Market Project model, session association, guided setup, and baseline action.
- [x] Add durable project research snapshots, source-coverage changes, and a project overview.
- [x] Add explicit Explain, Verify, Compare, Ask swarm, and Full refresh turn modes.
- [x] Add project-linked Adopt/Watch/Reject decisions and outcome notes.

## Wave 4 — Swarm Decision Lab (2026-08-02)

- [x] Versioned `ScenarioBrief` with facts separated from assumptions.
- [x] Assumption branching that versions rather than overwrites.
- [x] Scenario/round/response persistence (migration `0010`).
- [x] Harden the MiroFish service: auth, restricted CORS, loopback bind, path safety.
- [x] Three-round scenario runner with honest aggregation and failure counting.
- [x] Scenario/round/response repository with transactional writes.
- [x] Dissent, objection, distribution, and round-transition surfaces.
- [x] Database-level proof (`npm run test:e2e:swarm-scenarios`, 15 checks).
- [x] MiroFish adapter implementing the runner's ports with no fabrication on failure.
- [x] `POST /api/scenarios`, `GET /api/scenarios/[id]`, `POST /api/scenarios/[id]/run`.
- [x] `ScenarioBriefReview` — premise shown before the panel sees it, assumptions editable, edits run as a new version.
- [x] Segment and persona follow-up — `POST /api/scenarios/[id]/follow-up` + `ScenarioFollowUp`, recorded as further rounds so the thread stays intact.

## Next — still open

Entries completed by a wave below have been folded into that wave rather than
being listed twice.

- [x] Methodology and safe CSV on every decision artifact.
- [x] Entity-match correction (`EntityCorrectionPanel` + `/entities` route; a mismatch also downgrades the claims that leaned on the span) and enforced source allow/block in collection.
- [x] Typed pricing/release events emitted directly by the extractors — price moves, new tiers, sunset plans, currency changes, releases with `effectiveAt`. No longer inferred from diffs.
- [x] Evidence/claim artifact references on chat turns.
- [x] Fix `canonical_entities` cross-user uniqueness (migration `0011`, verified behaviourally).

## Wave 1 — evidence ledger (2026-08-02)

- [x] Migration `0009`: evidence_spans, metric_observations, change_events, claims, chart_specs.
- [x] Zod schemas and the validated `ChartSpec` contract.
- [x] snapshot-store, evidence-extractor, claim-verifier, chart-planner, ledger-repo.
- [x] Database-level proof (`npm run test:e2e:evidence-ledger`, 18 checks).
- [x] Evidence drawer and the shared `ChartSpecView` renderer.
- [x] Claim binding distinguishes a real span from lexical overlap.
- [x] Shared evidence pack — agents receive span ids and cite them; citations validated against the pack they were given, heuristic retained as fallback.
- [x] Methodology contract on all artifacts — `ChartSpecView` for series, `ArtifactMethodology` for matrices and scorecards (a matrix is not a series; forcing one would invent a period and unit it lacks).

## Wave 2 — connectors and change detection (2026-08-02)

- [x] GitHub releases connector (measured release cadence).
- [x] SEC EDGAR connector (measured filed financials).
- [x] Change detection, deterministic dedupe key, materiality scoring.
- [x] End-to-end proof: connector → spans → observations → measured chart.
- [x] Changelog/RSS connector and pricing-page extractor.
- [x] Collection run with the no-change short circuit and graceful degradation.
- [x] GDELT and FRED connectors, with their misreadings refused in code.
- [x] Weekly per-project refresh through Inngest, one retryable step per project.

## Wave 3 — living dashboard (2026-08-02)

- [x] Digest assembly with the five send gates and disclosed suppression.
- [x] `SinceLastVisit` returning-user surface.
- [x] Dashboard and evidence API routes with server-side gating.
- [x] `useProjectDashboard` hook and `ProjectDashboard` composition.
- [x] Mount `ProjectDashboard` as the project's leading surface in the app shell.
- [x] Authenticated end-to-end proof (`npm run test:e2e:dashboard`, 11 checks).
- [x] Activity timeline and source coverage on the dashboard — includes sub-threshold changes, marked; pricing and release series render through `ProjectCharts`.
- [x] Source coverage matrix with per-cell freshness and excerpt counts. Deliberately coverage, not a feature comparison — the ledger cannot support the latter honestly.
- [x] Artifact references — `ArtifactAttachPicker` attaches charts and change events to a turn, carrying their content so the model does not guess which was meant.
- [x] Make Explain genuinely cheap — `stored-answer` + `POST /api/projects/[id]/explain`, one model call over the ledger, 409 with a reason instead of silent escalation.

## Wave 0 — product-level honesty sweep (2026-08-02) — COMPLETE

- [x] Remove the market-trends synthesis-failure fabrication.
- [x] Make analyst judgment fields optional and render an unavailable state.
- [x] Add the centralized outbound URL policy and route research fetches through it.
- [x] Replace dynamic feature-flag env reads with static ones.
- [x] Send real image bytes to the model instead of image metadata.
- [x] Rewrite README claims to the product promise, with a claim-by-claim reality table.

## Later, after MVP value is demonstrated

- [ ] Team collaboration improvements.
- [ ] Enterprise identity and compliance features — **deferred by decision on 2026-08-02**
      until the MVP and research features ship and are tested. See
      `plans/GAP_CLOSURE_AND_FEATURE_PLAN.md` §5.6.
- [ ] Large third-party integration catalog.
- [ ] Predictive calibration research using real outcomes.

## Release verification

- [x] TypeScript, full Vitest suite, ESLint (zero errors), and production build.
- [x] Authenticated database/API project → snapshot → decision → outcome journey.
- [x] Rendered dashboard, project setup, project overview, and research-mode selector browser check.
- [x] `npm run test:e2e:live-research` run 2026-08-02 — PASS. Found a `proxy-agent` bundling bug (fixed) and an exhausted SerpAPI quota (needs a top-up; not a code defect).
