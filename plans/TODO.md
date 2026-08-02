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

## Wave 0 — product-level honesty sweep (2026-08-02)

- [x] Remove the market-trends synthesis-failure fabrication.
- [x] Make analyst judgment fields optional and render an unavailable state.
- [x] Add the centralized outbound URL policy and route research fetches through it.
- [x] Replace dynamic feature-flag env reads with static ones.
- [ ] Send real image bytes to the model instead of image metadata.
- [ ] Rewrite README and homepage claims to the product promise.

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
