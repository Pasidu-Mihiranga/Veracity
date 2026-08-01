# Veracity Market Decision MVP — Build Plan

Last updated: 2026-08-01

This is the active implementation plan. Product work wins over the historical enterprise phase documents when they conflict.

## Product outcome

Build a market decision workspace that users would choose over a general chatbot because it keeps a living market project, preserves evidence and changes over time, produces inspectable charts, supports continuing research conversations, and can stress-test decisions with a clearly labeled synthetic stakeholder swarm.

## Scope rules

Build now:

- Persistent research conversations with visible user prompts and assistant responses.
- Market-project context, competitors, approved sources, and saved research state.
- Evidence-backed claims and honest charts with inspectable underlying data.
- Targeted follow-up research that reuses existing evidence when possible.
- Decision briefs with alternatives, assumptions, unknowns, and outcomes.
- Optional MiroFish Swarm Decision Lab presented as synthetic scenario analysis.
- Useful exports and a simple repeatable refresh workflow.
- Functional reliability: no fabricated provider fallbacks, fake numbers, or broken empty states.

Do not build during the MVP:

- SAML/SCIM, complex organization roles, compliance dashboards, or enterprise audit exports.
- CRM, email, calendar, Slack, Teams, or large integration catalogs.
- Multi-region infrastructure, large Docker fleets, or premature microservices.
- A general-purpose workflow canvas or arbitrary dashboard builder.
- Predictive-accuracy claims for synthetic personas without real calibration data.

## Product wedge

```text
Live market evidence
  → inspectable claims and charts
  → continuing research conversation
  → decision brief
  → optional synthetic stakeholder stress test
  → recorded action and outcome
```

Monitoring products usually stop at alerts. Synthetic-persona products usually begin with a user-supplied scenario. Veracity connects verified market changes to a decision workflow and keeps the full history.

## Build sequence

### Slice 1 — Real conversation foundation

Status: DONE (2026-08-01)

- [x] Persist the first session and user message before starting research.
- [x] Store every follow-up in the main chronological message stream.
- [x] Render user prompts, main research responses, and follow-up responses in one timeline.
- [x] Restore the same timeline after reload.
- [x] Keep the latest structured report available without hiding prior messages.
- [x] Preserve citations and full orchestrator output for follow-up turns.
- [x] Add tests for message splitting/hydration and conversation behavior.

Exit: a failed request or reload cannot erase the user’s question; a user can continue the same research naturally.

### Slice 2 — Truth reset and useful artifacts

Status: IN PROGRESS

- [ ] Remove fabricated numeric/chart fallbacks and generic success-looking provider fallbacks.
- [ ] Add explicit unavailable/partial states.
- [x] Classify rendered artifacts as observed, derived, or synthetic, using a conservative derived default.
- [ ] Validate chart inputs and hide charts without sufficient numeric observations.
- [ ] Add visible methodology, period, source, and data download to decision charts.
- [x] Fix unsupported trend percentages and remove synthetic confidence intervals from the active and legacy scenario UI.

Completed inside this slice:

- [x] Removed the `changePercent || 5` chart fallback; observed zero remains zero and missing/non-numeric data produces an explanatory empty state.
- [x] Disabled MiroFish by default.
- [x] Removed generic MiroFish persona, interview-response, and TypeScript synthetic-panel fallbacks.
- [x] Persisted complete local swarm interview results and explicit partial failures for future continuing scenario turns.
- [x] Removed hardcoded campaign briefs, A/B variants, outreach schedules, reply-rate targets, audience assumptions, and fabricated execution-copy fallbacks.
- [x] Execution generation failures now produce empty/partial artifacts with explicit unavailable explanations instead of plausible campaign content.
- [x] Replaced both MiroFish execution paths with `scenario-distribution` output and explicit synthetic-scenario limitations.
- [x] Removed the live swarm's invented neutral synthesis fallback; configuration, service, interview, and synthesis failures now fail the agent clearly.
- [x] Legacy saved forecasts are rendered through a compatibility adapter that discards point estimates and confidence intervals.
- [x] Scenario category counts must reconcile exactly to panel size or the distribution chart is hidden.
- [x] Removed minimum-width fake bars for zero values in web/PDF scenario and trend charts.
- [x] Added methodology/source disclosure and injection-safe CSV export to market-trend and synthetic-scenario charts.

Exit: every displayed number has stored input data or is visibly marked synthetic/derived.

### Slice 3 — Market Projects

Status: IN PROGRESS

- [x] Evolve new sessions into project-scoped product, competitor, geography, decision, and source-preference context.
- [x] Add guided project setup and a useful first baseline action.
- [ ] Save source snapshots and normalized change events.
- [ ] Build a project overview: what changed, pricing/release activity, evidence coverage, and open decisions.
- [ ] Let users correct entities and approve/block sources.

Completed inside this slice:

- [x] Added `market_projects`, a safe `chat_sessions.project_id` association, ownership-scoped project APIs, and PostgreSQL/Supabase migrations.
- [x] Added Market Projects to the sidebar without deleting or hiding legacy/unassigned conversations.
- [x] Reuse project context in initial research and targeted follow-up turns.
- [x] Keep project deletion non-destructive to conversation history through `ON DELETE SET NULL`.
- [x] Add project editing for product, URL, competitors, geography, decision context, and preferred/avoided source domains.
- [x] Save durable research snapshots and honest source-coverage changes after each successful project research turn.
- [x] Add a reusable overview with conversation/run/source/evidence/open-decision metrics and latest research history.
- [ ] Normalize verified market events such as pricing and release changes; current events describe source coverage only and are labeled that way.

Exit: configure a product and three competitors once, then return to a reusable evidence-backed workspace.

### Slice 4 — Research memory and efficient follow-ups

Status: IN PROGRESS

- [ ] Add rolling structured conversation summary.
- [ ] Separate user-profile memory from project evidence and decision memory.
- [ ] Add artifact references: ask about a claim, chart, source, event, or recommendation.
- [x] Add turn modes: Explain, Verify/update, Compare/branch, Ask swarm, Full refresh.
- [ ] Use targeted retrieval and collection instead of repeating every agent for every turn.

Exit: ordinary clarification is fast and cheap; only freshness-sensitive questions trigger collection.

### Slice 5 — Decision workflow

Status: IN PROGRESS

- [x] Convert a researched question into a structured decision frame with alternatives, criteria, risks, and falsifiers.
- [ ] Record alternatives, assumptions, unknowns, falsifiers, owner, and review date.
- [x] Link source URLs and claim bindings to each recommendation; broader chart/event links remain follow-up work.
- [x] Record accepted/rejected/watching status, a human-authored reason, and a later outcome note.
- [x] Link decision records to their originating Market Project through the owned research session.

Exit: one decision is traceable from evidence to action to outcome.

### Slice 6 — Swarm Decision Lab

Status: TODO

- [x] Rename/retype MiroFish from forecast to synthetic scenario.
- [x] Make it opt-in through explicit Ask swarm mode; direct invocation from a saved decision remains pending.
- [x] Remove LLM/provider failure fallbacks that fabricate personas or answers.
- [ ] Add a reviewable ScenarioBrief with alternatives, segments, facts, assumptions, and uncertainties.
- [ ] Persist scenario, persona, round, prompt, and response records.
- [ ] Support panel/segment/persona follow-ups and assumption branches.
- [ ] Add alternative, objection, transition, dissent, and sensitivity charts.
- [ ] Keep synthetic output separate from observed evidence and analyst inference.

Exit: users can inspect and continue a labeled scenario without mistaking it for survey data.

### Slice 7 — Repeat value and MVP release

Status: IN PROGRESS — FUNCTIONAL MVP RELEASE GATE PASSED

- [ ] Add manual refresh and one simple scheduled digest path using the existing job system.
- [ ] Show before/after changes and deduplicate unchanged results.
- [ ] Add concise share/export for the current decision brief.
- [x] Run an authenticated local end-to-end project covering signup, project/session/messages, snapshot/overview, decision/outcome, edit/delete, and cleanup.
- [x] Verify project setup and research-mode controls in the rendered UI with no browser-console errors.
- [ ] Measure project creation, return use, evidence opens, follow-up turns, and decision actions.

Exit: five design users can run a complete project loop without engineering help.

## Market-informed feature decisions

Build these differentiators:

- Evidence-to-scenario handoff: swarm inputs come from visible research facts and explicit assumptions.
- Scenario branching: change one assumption and compare stakeholder response changes.
- Evidence-aware chat: users can ask directly from a chart/claim rather than restating context.
- Dissent-first summaries: highlight disagreement and information gaps, not fake consensus.
- Living decision log: the product remembers what was decided and whether it worked.

Avoid copying:

- Generic “thousands of agents predict anything” positioning.
- Decorative dashboards with unverifiable numbers.
- Chat-only deep research that produces another disposable report.
- Monitoring feeds without a decision/action workflow.

## MVP success criteria

- 100% of rendered numeric claims have traceable evidence or an explicit derived/synthetic label.
- A complete conversation survives reload and failed research jobs.
- A follow-up can answer from saved evidence without a full sweep.
- Scenario outputs never enter the observed-evidence ledger.
- A user can complete project → evidence → question → decision → scenario → outcome.
- At least three of five design users return to the same project in a later week.

## Detailed references

- Product and market research: `docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`
- Technical audit: `docs/VERACITY_FULL_TECHNICAL_AUDIT_2026-08-01.md`
- Engineering journal: `log.md`
- Short remaining-work tracker: `plans/TODO.md`
