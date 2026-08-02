# Veracity — Gap Closure and Feature Expansion Plan

Created: 2026-08-02
Status: **Active.** Supersedes `plans/MVP_BUILD_PLAN.md` for sequencing. That file remains the record of Slices 1–7 and their completed work.

Source documents consolidated here:

- `docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md` — product direction, Milestones 0–5
- `docs/VERACITY_FULL_TECHNICAL_AUDIT_2026-08-01.md` — P0/P1 findings, fake-claims ledger
- `plans/MVP_BUILD_PLAN.md` / `plans/TODO.md` — Slice status
- `log.md` — verified completions through 2026-08-01

---

## 1. Why this plan exists

The MVP release gate passed on 2026-08-01, but "release gate passed" measured **regression safety** (typecheck, 324 tests, production build, one authenticated journey), not **product completeness**. Three separate gaps remain:

1. **Slice gaps** — Slices 2–7 are all marked IN PROGRESS with real unchecked work.
2. **Roadmap gaps** — Milestone 1 (evidence and chart foundation) of the product-first roadmap is 0% started, and it is the load-bearing milestone for the entire thesis.
3. **Audit gaps** — four P0 findings and several P1s from the technical audit remain open in the working tree.

Additionally, the research identified **features not yet in any plan** — mainly free structured-data connectors and the change/materiality engine — that convert Veracity from "research tool with memory" into the "living market model" the research says is the only defensible position.

---

## 2. Verified current state

Checked directly against the working tree on 2026-08-02, not inferred from checkboxes.

### Genuinely shipped

| Capability | Evidence |
|---|---|
| Durable chronological conversation | `ConversationTimeline`, server-first message persistence |
| Market Projects | `db/migrations/0006`, `lib/projects.ts`, project APIs, guided setup, edit |
| Project research history + overview | `db/migrations/0007`, `lib/project-snapshot-data.ts` |
| Project-linked decisions with outcomes | `db/migrations/0008`, `lib/decisions.ts`, `lib/decision-policy.ts` |
| Five research turn modes | `lib/research-turn-mode.ts`, validated server-side |
| Artifact truth classes | `lib/artifact-truth.ts` — observed / derived / synthetic |
| Swarm scenario schema | `lib/swarm-scenario.ts`, `components/artifacts/SwarmScenarioChart.tsx` |
| Safe CSV export | `lib/csv-download.ts` — formula-prefix neutralized |
| Entity + snapshot primitives | `db/migrations/0005` — `canonical_entities`, `source_snapshots` (has `content_hash`) |
| Isolated local Postgres + pgvector | port 5435, migrations through 0008 applied |

### Confirmed still open (spot-checked in code)

| Finding | Location | State |
|---|---|---|
| V-001 SAML unverified identity | `app/api/auth/saml/login/route.ts`, `acs/route.ts` | Routes present, default-off. Rebuild deferred to the enterprise phase (§5.6) |
| V-003 MiroFish unauthenticated + public bind | `mirofish-service/server.py:60` `CORS(app)`, `:695` `host="0.0.0.0"` | Open — fixed as part of Wave 4 when the service is implemented properly |
| No evidence spans | no `evidence_spans` table, no `lib/intelligence/` | Not started — Wave 1 |
| No `ChartSpec` | no chart-spec module; charts render ad-hoc props | Not started — Wave 1 |
| No change events / materiality | `source_snapshots` stores hashes but no normalized diff events | Not started — Wave 2 |

### Closed in Wave 0 (2026-08-02)

| Finding | Resolution |
|---|---|
| V-005 feature flags dynamic env | `lib/feature-flags.ts` now uses literal `process.env.NEXT_PUBLIC_FF_*` reads; locked by `__tests__/feature-flags.test.ts` |
| V-002 SSRF policy incomplete | `lib/net/outbound-policy.ts` — IP-encoding, DNS, redirect-hop, byte and time policy; `lib/tools/firecrawl.ts` routed through it |
| Fabricated output on failure | `market-trends` synthesis-failure fabrication removed; six analyst judgment fields now render `UnassessedBadge`; locked by `__tests__/no-fabrication-on-failure.test.ts` |

---

## 3. Gap register

Each gap has an ID used by the build waves in §5.

### A — Evidence integrity (blocks the product thesis)

| ID | Gap | Impact |
|---|---|---|
| **G-A1** | No `evidence_spans`: claims bind to source URLs lexically via `lib/agents/bind-evidence.ts`, not to exact excerpts with offsets | "Every claim has a source" is a URL list, not proof. Directly contradicts the differentiation pillar |
| **G-A2** | No `metric_observations`: every numeric value in a chart originates from model output | No number can be reproduced or audited. Milestone 1 exit criterion unmet |
| **G-A3** | No validated `ChartSpec`: unit, period, formula, sample size, data class live per-component | Trend and scenario charts got methodology disclosure; competitive, pricing, win/loss, positioning, threat did not |
| **G-A4** | No claim verifier: nothing rejects an unsupported numeric claim before persistence | Acceptance Scenario E fails |
| **G-A5** | Shared evidence pack absent: each of the 6 agents fetches independently | Duplicate provider spend; agents can cite contradicting retrievals of the same page |

### B — Change intelligence (the retention mechanic)

| ID | Gap | Impact |
|---|---|---|
| **G-B1** | No `change_events`: `project_research_events` records *source-coverage* changes only, and is correctly labelled as such | The product cannot answer "what changed?" — the core JTBD |
| **G-B2** | No content diffing: `source_snapshots.content_hash` exists but nothing computes before/after | Pricing-history and release-cadence charts are unbuildable |
| **G-B3** | No materiality scoring | Every change would be an alert; noise makes the digest worthless |
| **G-B4** | No deduplication across runs | Audit target: <2% duplicate events. Currently unmeasurable |
| **G-B5** | No scheduled per-project collection | Inngest has `research-sweep` but nothing project-source-scoped |
| **G-B6** | No no-change short circuit | Target >90% of no-change runs skip synthesis; currently 0% |

### C — Swarm Decision Lab (Slice 6, largest unbuilt block)

| ID | Gap | Impact |
|---|---|---|
| **G-C1** | No `ScenarioBrief` — arbitrary prompt still goes to the persona pool | Users cannot review alternatives/segments/assumptions before a costly run |
| **G-C2** | No scenario/persona/round/response persistence | Cannot continue questioning a panel; each run is disposable |
| **G-C3** | Single round only | No independent → challenge → decide sequence, so consensus is artificial |
| **G-C4** | No assumption branching | Cannot compare "what if price drops 20%" against the base scenario |
| **G-C5** | No dissent/objection/sensitivity/transition charts | Distribution chart alone under-delivers the lab |
| **G-C6** | MiroFish URL unconfigured | The whole "Ask synthetic panel" path is dark and untested end-to-end |

### D — Conversation depth (Slice 4)

| ID | Gap | Impact |
|---|---|---|
| **G-D1** | No rolling structured summary | Long projects drift; context is transcript fragments + vector recall |
| **G-D2** | No artifact references on turns | Cannot ask "about this chart"; user must restate context |
| **G-D3** | Turn modes select agents but do not truly reduce collection | "Explain" should cost near zero; it does not yet |
| **G-D4** | User-profile memory not separated from project evidence memory | Personal preferences can leak into market conclusions |

### E — Trust and safety blockers

| ID | Gap | Impact |
|---|---|---|
| **G-E1** | SAML routes forge-able (V-001) | Must be hard-disabled before any external user touches the app |
| **G-E2** | MiroFish public bind + open CORS (V-003) | Quota theft, path traversal, cross-tenant read |
| **G-E3** | SSRF policy incomplete (V-002) | Model-influenced URLs can reach internal services |
| **G-E4** | Feature flags disagree client/server (V-005) | Risky features can appear enabled in the browser while off on the server |
| **G-E5** | Image-analysis claim without multimodal implementation | Fake-claims ledger item; user believes images were inspected |
| **G-E6** | Remaining fabricated fallbacks not fully swept | Slice 2 exit criterion unmet |

### G — Found during implementation

| ID | Gap | Impact |
|---|---|---|
| **G-G1** | `canonical_entities` is unique on `(scope_key, entity_type, entity_key)` with no owner column | Two users tracking the same competitor under one scope collide; the second user's insert fails with a unique violation. Found 2026-08-02 while writing the dashboard end-to-end test |

### F — Release credibility

| ID | Gap | Impact |
|---|---|---|
| **G-F1** | `npm run test:e2e:live-research` never executed | No proof any provider chain works end to end |
| **G-F2** | No five benchmark projects (roadmap P0.8) | No way to detect regression in output quality |
| **G-F3** | README/homepage claims predate the truth reset | Marketing overstates delivered capability |
| **G-F4** | No cost-per-run instrumentation against a real budget | Cannot price or bound the free tier |

---

## 4. New features the research supports but no plan contains

These are the additive opportunities, ranked by value-to-effort. All are grounded in §8.6 and §11.1 of the product research.

| ID | Feature | Why it wins | Effort |
|---|---|---|---|
| **F-1** | **SEC EDGAR connector** | No API key, real-time JSON, standardized XBRL facts. Produces genuinely *measured* chart rows for any US public competitor — the only easy path to a chart that is not model-derived | S |
| **F-2** | **GitHub Releases connector** | No key for public repos. Release cadence chart for any open-source competitor is measured, dated, and inspectable. Highest-value chart per hour of work | S |
| **F-3** | **Pricing-page snapshot extractor** | Schema-constrained extraction of plan/price/currency/interval from dated snapshots. Powers pricing-history chart — the #1 recurring decision in §5 | M |
| **F-4** | **Changelog/RSS collector** | Cheap, structured, high-signal. Feeds the activity timeline without burning search credits | S |
| **F-5** | **Evidence drawer** | Every claim/metric/change opens exact excerpt, retrieval timestamp, snapshot hash, entity match, contradicting items | M |
| **F-6** | **Competitor activity timeline** | Roadmap's #1-priority visual. The "since your last visit" surface | M |
| **F-7** | **Weekly digest** | The retention mechanic. Only fires on material, deduplicated, evidence-backed events | M |
| **F-8** | **Project dashboard as home** | Replaces the chat-first homepage. Research says lead with change, not a blank prompt | M |
| **F-9** | **GDELT news-volume connector** | Free news-event volume with a *fixed* query set — honest signal-volume trend with sample caveat | S |
| **F-10** | **FRED macro connector** | Free with key. Adjacent-market context for the Adjacent Collision agent | S |
| **F-11** | **Feature verification matrix** | Upgrade `CompetitiveMatrix` so each cell carries verification state + dated evidence | M |
| **F-12** | **Decision brief export with evidence appendix** | Extends existing PDF export with data class, formula, period, source appendix | S |
| **F-13** | **Scenario branching UI** | Change one assumption, compare panel response. The distinctive Swarm Lab capability | L |
| **F-14** | **Cost/materiality budget per project** | Bounds free tier; makes cost-per-useful-event measurable | M |

Explicitly **not** building (per research §11.3 and §11.4): SAML/SCIM, CRM/Slack/Teams integrations, knowledge-graph explorer, custom dashboard widgets, mobile app, licensed traffic/financial data, LangGraph migration.

---

## 5. Build sequence

Five waves. Each ends in a demoable vertical slice. Do not start a wave before the prior wave's exit criteria pass.

### Wave 0 — Product-level honesty sweep (2–3 days) — COMPLETE 2026-08-02

**Scope rule set by the product owner on 2026-08-02:** enterprise security and enterprise monitoring work is *deferred until after the functional product ships*. Wave 0 contains only fixes that affect whether the **product itself** is correct and trustworthy. Nothing here is an enterprise-identity or compliance project. See §5.6 for what was moved out.

- [x] **G-E6** Sweep remaining fabricated fallbacks; add a test that forces provider failure on every agent and asserts no factual field is populated. *Highest-value item in the wave — it is the MVP's core trust claim*
- [x] **G-E4** Replace dynamic `process.env[name]` in `lib/feature-flags.ts` with a statically enumerated, validated config object. This is a correctness bug: the browser currently reads different flag values than the server
- [x] **G-E3** Build `lib/net/outbound-policy.ts`: parse → DNS-resolve → reject private/link-local/metadata ranges → restrict protocol+port → cap redirects/bytes/time → revalidate each redirect hop. Route `lib/tools/` through it. Product-level because research tools fetch model-influenced URLs; it also stops wasted fetches. **Timeboxed — must not delay feature work**
- [x] **G-E5** Send real image bytes to Gemini multimodal parts so image analysis is genuine
- [x] **G-F3** Rewrite README + homepage claims to the product promise: *Know what changed, prove it, and decide what to do next*
- [x] **G-E1** SAML stays **off by default** and unreachable in the functional product. No rebuild now — see §5.6
- [x] **G-E2** MiroFish binds loopback with a shared-secret header. Done as part of Wave 4 when the service is properly implemented, not as separate security work

**Exit:** a forced-failure test suite proves no agent fabricates a source, quote, persona, number, or interval; flags agree across client and server.

---

### Wave 1 — Evidence ledger and honest charts (1.5–2 weeks)

This is Milestone 1 of the roadmap and the highest-leverage wave in the plan. It is the difference between "another research bot" and Veracity.

**Data layer** — migration `0009_evidence_ledger.sql` (+ Supabase `013`)

- [x] `evidence_spans` — snapshot_id, exact excerpt, start/end offsets, extraction type, entity match, created_at
- [x] `metric_observations` — entity, metric key, value, unit, period start/end, evidence_span_id, method, is_estimated
- [x] `change_events` — entity, event type, before/after, observed + effective dates, materiality, confidence, dedupe key
- [x] `claims` — statement, type, confidence, supporting + contradicting evidence ids, freshness
- [x] `chart_specs` — project/run, validated spec JSON, generated_at
- [x] Extend `source_snapshots` with normalized content and retrieval status

**Module layer** — new `lib/intelligence/`

- [x] `types.ts` — Zod schemas for every record above and for `ChartSpec` (§8.3 of the research: id, kind, dataClass, unit, period, dimensions, series, rows, sourceIds, sampleSize, formula, isEstimated, limitations, generatedAt)
- [x] `snapshot-store.ts` — URL canonicalization, content hashing, size limits, typed collection errors
- [x] `evidence-extractor.ts` — schema-constrained extraction of facts + exact spans; never fills a missing number
- [ ] `metric-normalizer.ts` — units, dates, comparison eligibility
- [x] `chart-spec.ts` + `chart-planner.ts` — **deterministic**; selects a visualization from stored observations, never asks the LLM for rows
- [x] `claim-verifier.ts` — entailment, contradiction, freshness, entity match; **rejects any numeric claim lacking a `metric_observation` id**

**Agent layer**

- [ ] **G-A5** Shared evidence pack: collect once per run, all six agents read from it
- [ ] Agents return claim + evidence ids instead of independent source lists
- [x] Rework `lib/agents/bind-evidence.ts` from lexical URL/title matching to span ids
- [ ] `lib/agents/output-quality.ts` rejects unsupported numerics and incomparable series
- [ ] `lib/agents/market-trends.ts` stops requesting `changePercent`; consumes metric observations

**UI layer**

- [x] **F-5** Evidence drawer: exact excerpt, URL, retrieval timestamp, snapshot hash, entity match, freshness, supporting + contradicting items
- [ ] **G-A3** Migrate every artifact in `components/artifacts/` to render a validated `ChartSpec` — carries the trend/scenario methodology + CSV contract to competitive, pricing, win/loss, positioning, threat
- [ ] Data-class badge, unit, period, sample size, formula, source links, CSV/JSON download on all charts
- [ ] Insufficient-data empty states replace every remaining decorative default

**Exit:** pick any rendered chart row; reproduce its value from stored observations using only the displayed formula and sources. A forced model output containing an unsourced number is rejected before persistence.

---

### Wave 2 — Measured connectors and change detection (1.5–2 weeks)

Where the honest charts get real data and the product starts answering "what changed?".

- [x] **F-2** GitHub Releases connector → `metric_observations` (release cadence). Start here: cheapest path to a measured chart
- [x] **F-1** SEC EDGAR connector → XBRL company facts → `metric_observations`
- [x] **F-4** Changelog/RSS collector → `change_events`
- [x] **F-3** Pricing-page snapshot extractor → dated plan/price/currency/interval records
- [ ] **F-9** GDELT connector with a *fixed, disclosed* query set → signal-volume trend with sample denominator
- [ ] **F-10** FRED connector for adjacent-market context
- [x] **G-B2** Content diffing over `source_snapshots.content_hash` → normalized before/after
- [x] **G-B1** `change-detector.ts` — the ten normalized event types from research §10.4
- [x] **G-B4** `dedupe` — deterministic dedupe key; target <2% duplicates across adjacent runs
- [x] **G-B3** `materiality.ts` — deterministic score from event type, source trust, magnitude, novelty, and the project's current decision. **Not** model confidence
- [ ] **G-B5** Per-project scheduled collection in Inngest, split into idempotent steps
- [x] **G-B6** No-change short circuit: identical hash → heartbeat only, skip extraction and synthesis
- [ ] Track collection success, freshness, and stale/broken monitored sources

**Exit:** change a controlled test page; exactly one traceable event appears with a before/after and an evidence span. Run again unchanged: zero events, zero synthesis cost, freshness updated.

---

### Wave 3 — The living dashboard (1–1.5 weeks)

Turns the accumulated state into the surface users return to.

- [x] **F-8** Project dashboard becomes the default screen; chat becomes "Ask this market" beside it
- [x] "Since your last visit" material-change strip
- [ ] **F-6** Competitor activity timeline
- [ ] Pricing history + release cadence charts (from Wave 2 observations)
- [ ] **F-11** Feature verification matrix — per-cell verification state and dated evidence
- [ ] Evidence quality and stale-source warnings
- [x] **F-7** Weekly digest — fires only when snapshot is new, event is not duplicate, entity matches, materiality clears threshold, and an exact evidence span exists
- [x] **G-D1** Rolling structured conversation summary preserving citation ids
- [x] **G-D2** Artifact references on turns — ask from any claim, chart, source, event, or recommendation
- [x] **G-D3** Make "Explain" genuinely cheap: answer from stored evidence with zero collection
- [x] **G-D4** Separate user-profile memory from project evidence memory
- [ ] **G-B?** Source approve/block genuinely enforced in every collector (currently a labelled preference only)
- [ ] Entity-match correction UI

**Exit:** a user returns after a week and sees only new material changes and their effect on an open decision, without restating market context. One digest email contains at least one useful, evidence-backed item.

---

### Wave 4 — Swarm Decision Lab (1.5–2 weeks)

The differentiator, built only once the evidence base it draws from is real.

- [x] **G-C6** Configure and smoke-test the MiroFish path end to end; keep it private per Wave 0
- [x] **G-C1** `ScenarioBrief` — versioned, generated from verified project state (decision question, alternatives, segments, observed facts by claim id, assumptions, uncertainties, exclusions). User reviews and edits **before** the expensive run
- [x] **G-C2** Persist `swarm_sessions`, `swarm_turns`, `swarm_responses` — full persona text, round, segment, structured choice
- [x] **G-C3** Three rounds: independent reaction → challenge with verified evidence → decision with blocking objection and missing information
- [ ] Follow-ups scoped to full panel, one segment, or one persona, carrying prior swarm turns
- [x] **G-C4** Assumption branching creates a versioned branch, never an overwrite
- [x] **G-C5** Charts: alternative distribution by segment, round-to-round position transitions, objection frequency by stakeholder type, assumption sensitivity matrix, dissent map
- [x] Cache key includes scenario version, panel version, model, and evidence hash
- [ ] Synthesis renders three visually separate blocks: **observed evidence** / **analyst inference** / **synthetic scenario**. Synthetic consensus never raises the confidence of an observed claim
- [ ] Invoke the lab directly from a saved decision

**Exit:** a user reviews a brief, runs a panel, inspects every persona response, asks a follow-up to one segment, branches one assumption, and compares — with no synthetic output anywhere in the evidence ledger.

---

### Wave 5 — Validation (ongoing from Wave 2)

- [ ] **G-F2** Define the five benchmark projects from research §18: B2B SaaS pricing change, OSS release cadence, AI product positioning, SEC-backed public-company signal, review pain-theme monitoring. Freeze expected source and metric behaviour
- [ ] Each benchmark runs twice — baseline and controlled update. The second run matters more
- [ ] **G-F1** Execute `npm run test:e2e:live-research` (real, billable — needs explicit go-ahead)
- [ ] **G-F4 / F-14** Instrument cost per baseline, per refresh, and per *useful material event*; add per-project budget caps
- [ ] **F-12** Decision brief export with evidence appendix and chart methodology
- [ ] Instrument activation, weekly project return, evidence opens, follow-up turns, decision actions
- [ ] Recruit 5–10 design partners with 3+ active competitors; five weekly cycles

**Exit:** three of five design users return weekly unprompted; measured trust metrics hit the targets in §6.

---

### 5.6 Explicitly deferred until after the product works

Decided by the product owner on 2026-08-02: **a functional, tested product comes first. Enterprise concerns come after.** These items are not cancelled — they are sequenced last, and none of them may block a feature wave.

| Deferred | Why it can wait |
|---|---|
| Standards-compliant SAML, SCIM provisioning | No enterprise buyer exists until the core loop retains design partners. Keep the routes off by default meanwhile |
| Fine-grained RBAC, org roles, admin console | Beta is single-owner scoped; ownership checks already exist on every project/decision API |
| Compliance dashboards, audit exports, retention/residency/DLP | Zero regulated users during validation |
| Enterprise observability programme (exporter pipelines, SLI/SLO alerting) | Existing JSON logger and correlation IDs are enough to debug a beta |
| Multi-region infrastructure, Docker fleets, microservices | Single deployment is correct at this size |
| CRM / Slack / Teams / Gong integrations | Research §11.3 defers these until core retention is proven |
| LangGraph migration | ADR 0007 gates it behind a benchmark; the product gap is evidence, not a graph library |

Order of operations: **Wave 0 → Waves 1–3 (MVP) → Wave 4 (Swarm) → Wave 5 (UI) → end-to-end tests → enterprise phase.**

---

## 6. Quality targets

Carried from research §15. These become CI-checkable assertions where possible.

| Metric | Target |
|---|---|
| Measured chart rows carrying evidence ids | 100% |
| Numeric claims with a supporting `metric_observation` | 100% |
| Material events with an exact evidence span | > 95% |
| Duplicate events across adjacent runs | < 2% |
| Entity mismatch in surfaced material events | < 1% |
| Unsupported decision-critical claims | < 2% on the reviewed benchmark set |
| Charts showing data class, method, and period | 100% |
| No-change runs skipping expensive synthesis | > 90% |

---

## 7. Effort estimate

One experienced engineer, sequential:

| Wave | Estimate |
|---|---|
| 0 — Safety and honesty | 2–3 days |
| 1 — Evidence ledger and charts | 8–10 days |
| 2 — Connectors and change detection | 8–10 days |
| 3 — Living dashboard | 5–7 days |
| 4 — Swarm Decision Lab | 8–10 days |
| 5 — Validation | ongoing, ~4 days of setup |

**Total: roughly 7–9 weeks solo.** Waves 1 and 4 parallelize cleanly across two engineers (evidence track / scenario track), compressing to about 5 weeks — though Wave 4 should still start after Wave 1 lands, since the scenario brief consumes verified claims.

---

## 8. Sequencing rationale

Three rules govern the order above.

**Safety before features.** Wave 0 is short and unblocks everything. Shipping features on top of a forge-able SAML route and a publicly bound Python service means rebuilding later.

**Evidence before visuals.** Every remaining chart gap, every connector, the change engine, materiality, the digest, and the scenario brief all read from the same ledger. Building any of them first means building them twice. This is why Wave 1 precedes Wave 2 despite Wave 2 being the more visible work.

**Measured data before more agents.** The research is unambiguous that agent count is not a buyer benefit. Two small connectors — GitHub releases and SEC EDGAR — produce more trustworthy chart rows than a seventh specialist agent, and they cost days rather than weeks.

---

## 9. Open decisions for the product owner

1. **Free-tier bounds.** Research §16 proposes one project, three competitors, weekly refresh, public sources only, thirty days of history. Confirm before Wave 5 instrumentation.
2. **Connector priority.** F-1/F-2 assume competitors are US-public or open-source. If the actual design partners are neither, F-3 (pricing snapshots) and F-4 (changelog/RSS) should lead Wave 2 instead.
3. **Live-provider e2e.** `npm run test:e2e:live-research` is billable and has never run. Needs an explicit go-ahead.
4. **MiroFish upstream.** The local service is a batched persona interviewer, not the upstream social simulation. Wave 4 assumes we keep the local one and describe it accurately. Adopting upstream MiroFish is a larger, separate decision.

---

## 10. References

- Product direction — `docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`
- Technical audit — `docs/VERACITY_FULL_TECHNICAL_AUDIT_2026-08-01.md`
- Slice history — `plans/MVP_BUILD_PLAN.md`
- Short queue — `plans/TODO.md`
- Engineering journal — `log.md`
