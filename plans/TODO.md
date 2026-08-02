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
- [ ] Wire the brief review and run into an API route and the chat surface.
- [ ] Segment and persona follow-up UI (the data model supports it already).

## Next

- [x] Remove remaining fake numeric and provider fallbacks identified in the audit. (2026-08-02, locked by `__tests__/no-fabrication-on-failure.test.ts`.)
- [x] Reclassify rendered artifacts as observed, derived, or synthetic.
- [ ] Extend the completed trend/scenario methodology and safe CSV download pattern to every remaining decision chart.
- [x] Implement reusable Market Project context for initial and follow-up research.
- [ ] Build on completed project editing with entity-match correction and enforced source allow/block controls.
- [x] Add project evidence snapshots and source-coverage events.
- [ ] Add normalized verified pricing/release market events; do not infer these from URL changes alone.
- [ ] Add evidence/claim artifact references to chat turns.
- [ ] Implement honest Swarm Decision Lab schema and persistence.
- [ ] Add a reviewable ScenarioBrief and continuing panel/persona/assumption branches.
- [ ] Add rolling structured research summary and direct claim/chart references in follow-up turns.

## Wave 1 — evidence ledger (2026-08-02)

- [x] Migration `0009`: evidence_spans, metric_observations, change_events, claims, chart_specs.
- [x] Zod schemas and the validated `ChartSpec` contract.
- [x] snapshot-store, evidence-extractor, claim-verifier, chart-planner, ledger-repo.
- [x] Database-level proof (`npm run test:e2e:evidence-ledger`, 18 checks).
- [x] Evidence drawer and the shared `ChartSpecView` renderer.
- [x] Claim binding distinguishes a real span from lexical overlap.
- [ ] Shared evidence pack in the orchestrator (collect once, all agents read it).
- [ ] Migrate existing artifacts to render `ChartSpecView`.

## Wave 2 — connectors and change detection (2026-08-02)

- [x] GitHub releases connector (measured release cadence).
- [x] SEC EDGAR connector (measured filed financials).
- [x] Change detection, deterministic dedupe key, materiality scoring.
- [x] End-to-end proof: connector → spans → observations → measured chart.
- [x] Changelog/RSS connector and pricing-page extractor.
- [x] Collection run with the no-change short circuit and graceful degradation.
- [ ] GDELT and FRED connectors.
- [ ] Schedule the collection run per project through Inngest.

## Wave 3 — living dashboard (2026-08-02)

- [x] Digest assembly with the five send gates and disclosed suppression.
- [x] `SinceLastVisit` returning-user surface.
- [ ] Wire the dashboard into the project route as the default screen.
- [ ] Activity timeline, pricing history, and release cadence on the dashboard.
- [ ] Feature verification matrix with per-cell evidence.
- [ ] Rolling conversation summary and artifact references on turns.
- [ ] Make Explain genuinely cheap (answer from stored evidence, no collection).

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
- [ ] Run `npm run test:e2e:live-research` when external execution allowance is available; this is a real, billable provider check and never falls back to a fabricated result.
