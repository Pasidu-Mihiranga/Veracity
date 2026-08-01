# Veracity AI — Master Improvement Plan

> **Scope clarification (2026-08-01):** This remains the detailed AI-quality engineering backlog and acceptance framework. Product scope and build order are governed by [`PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md`](./PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md). When priorities conflict, use the product-first roadmap and reuse quality gates from this document.

**Document type:** Living engineering source of truth for AI intelligence quality  
**Scope:** AI research quality, decision support, evidence, trust, enterprise intelligence workflows, and the two-developer execution / QA process required to ship them  
**Out of scope:** Landing page redesign, styling, animations, visual polish, UI work that does not improve AI reasoning  
**Primary objective:** Make Veracity produce enterprise-grade research and decision support comparable to the best AI research assistants  
**Codebase reviewed:** `feature/langgraph-hybrid-architecture` (orchestrator, classify, quality gate, synthesis, memory, sources, watchlists, monitoring, agents, ADRs, phase docs)  
**Created:** 2026-07-29  
**Last updated:** 2026-07-29 — Phase 5 implemented and evaluated; structured material events, signal collectors, cadence/cost controls, alert budgets, email/Slack egress, B5 integration, and B4 regression recorded

> **AI-quality source of truth.** Update this file when new reasoning/evidence weaknesses or acceptance criteria are discovered. Use the product-first roadmap for feature priority and release sequencing.

---

## 1. Mission Statement

Veracity already has a real multi-agent research stack:

- classify → adaptive agent selection → mission waves → synthesis → quality gate → evidence bind
- optional LangGraph wave executor behind a feature flag
- Phase 5 watchlist / alert / decision-memory primitives

The product is **not failing because LangGraph is missing**.  
The product is limited by **reasoning, evidence honesty, memory hygiene, investigation depth, and continuous-intel fidelity**.

This roadmap is organized around one question:

> After a run, would a Fortune 500 strategy team trust this answer enough to act — or only enough to start a conversation?

---

## 2. Development Methodology (Mandatory for Every Phase)

Every phase in this roadmap must follow the same lifecycle.  
**No phase is complete until both engineering tasks and AI output quality are validated.**

```
Planning
   ↓
Implementation
   ↓
Automated Testing
   ↓
Manual AI Benchmark Evaluation
   ↓
Output Review (universal quality checklist)
   ↓
Issue Discovery (log in Master Issue Tracker)
   ↓
Fixes
   ↓
Regression Testing (automated + manual benchmarks)
   ↓
Phase Approval (exit gate)
   ↓
Merge
```

### 2.1 Lifecycle rules

| Step | Required activity | Done when |
|------|-------------------|-----------|
| Planning | Confirm phase objectives, owners, shared interfaces, baseline benchmark scores | Written plan notes in Phase Evaluation Log |
| Implementation | Ship phase tasks on feature branches | Code complete + self-reviewed |
| Automated Testing | Unit / integration / `test:quality` / relevant fixtures | Green locally + CI |
| Manual AI Benchmark Evaluation | Run owned master benchmarks with live product | Outputs captured in evaluation log |
| Output Review | Score with universal AI Output Quality Checklist | Checklist filled; score ≥ phase gate |
| Issue Discovery | File every weakness into Master Issue Tracker | Issue IDs assigned |
| Fixes | Resolve P0/P1 issues discovered this phase | Tracker updated |
| Regression Testing | Re-run automated suite + affected benchmarks vs baseline | Quality ≥ baseline (see Regression Policy) |
| Phase Approval | Both developers + checklist exit gate | All exit-gate boxes checked |
| Merge | Merge to integration branch only after approval | No open critical regressions |

### 2.2 Completeness rule

A phase is **not complete** if:

- engineering tasks remain unfinished, **or**
- automated tests fail, **or**
- master benchmarks were not manually executed, **or**
- AI quality checklist was not filled, **or**
- critical regressions remain open

### 2.3 Manual AI evaluation procedure (every phase)

Developers **must** manually:

1. Run the relevant benchmark prompts (Section 13).
2. Review raw outputs (answer, recommendations, sources, confidence, warnings).
3. Compare with the previous baseline recorded in the Phase Evaluation Log.
4. Identify weaknesses using the universal checklist (Section 4).
5. Record new issues in the Master Issue Tracker (Section 15).
6. Fix issues owned by the phase.
7. Re-run until acceptance criteria and exit gate are satisfied.

**No implementation is complete without manual AI evaluation.**

---

## 3. Two Developer Workflow

Goal: two developers work in parallel with minimum merge conflicts, shared quality bar, and clear ownership of benchmarks.

### 3.1 Developer A — Accuracy Stack (AI reasoning)

**Owns**

- Reasoning quality
- Prompt engineering
- Evidence binding / attribution
- Quality gate / abstain
- Confidence calibration
- Memory and history scoping
- Orchestration quality hooks (accuracy path)
- Benchmark prompts related to reasoning: **B1, B3 (evidence claims), B4**

**Primary code**

- `lib/agents/classify.ts`
- `lib/agents/query-scope.ts`
- `lib/agents/extract-entities.ts`
- `lib/agents/direct-answer.ts`
- `lib/agents/prompts/*`
- `lib/agents/synthesize.ts`
- `lib/agents/output-quality.ts`
- `lib/agents/bind-evidence.ts`
- `lib/tools/source-validator.ts`
- `lib/tools/source-relevance.ts`
- memory/history gating call sites in `orchestrator.ts` (accuracy interface only)
- quality evals / offline suites (`scripts/validate-output-quality.ts`, related `__tests__`)

**Primary phases:** 1, 2, early 3 (intent + adaptive quality), 4 (decision frame / rec ranking)

### 3.2 Developer B — Enterprise Workflows & Continuous Intel

**Owns**

- Enterprise workflows (DD, compare missions, monitoring intents)
- Watchlists
- Continuous intelligence
- Monitoring / alerts / timeline
- Report / board-pack generation
- Executive workflow outputs (content contracts, not visual redesign)
- Benchmark prompts related to workflows: **B2, B5, B3 (workflow framing)**

**Primary code**

- `lib/monitoring/*`
- `lib/watchlists.ts`
- `lib/inngest/functions/*`
- watchlist / alert / timeline APIs
- steal-strategy grounding or demotion
- board pack / report generation content pipelines
- competitor profiles / continuous intel integration
- mission templates for DD / monitoring (consumes schema owned by A)

**Primary phases:** 3 (workflow templates), 4 (board packs / steal strategy), 5, 6

### 3.3 Shared components (high conflict risk)

| Shared component | Owner of interface | Consumer | Conflict rule |
|------------------|--------------------|----------|---------------|
| `lib/agents/orchestrator.ts` | A owns accuracy hooks | B adds mission/intent switches behind small interfaces | Prefer PRs that touch only one concern; land A schema first |
| `lib/agents/types.ts` (synthesis / quality fields) | **A** | B | A merges schema fields before B consumes them |
| `lib/agents/mission-planner.ts` | Coordinate | Both | A for quality-adaptive rules; B for workflow templates — split by function if needed |
| Chat route / orchestration call sites | Coordinate | Both | Thin wrappers; no quality-gate rewrites by B |
| Monitoring → `orchestrate()` | B calls | A quality stack unchanged | B must not fork quality gate |
| UI field surfacing | Only if required for AI fields | Both | No visual redesign workstreams |

### 3.4 Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` / protected integration | Release-ready only |
| `feature/ai-quality-integration` | Shared integration branch for Phases 1–6 |
| `feat/a-phaseN-<slug>` | Developer A phase work |
| `feat/b-phaseN-<slug>` | Developer B phase work |
| `fix/<issue-id>-<slug>` | Hotfixes for tracker issues |

Rules:

1. Branch from the latest integration branch, not stale forks.
2. Keep PRs small and phase-scoped.
3. Do not mix A accuracy changes and B monitoring changes in one PR unless required for compile.
4. Schema/interface PRs (A) merge **before** consumer PRs (B).

### 3.5 Merge strategy

1. Developer completes lifecycle through Regression Testing.
2. Open PR into `feature/ai-quality-integration`.
3. CI must be green (`lint`, `test`, `test:quality` as applicable).
4. Other developer reviews shared-file diffs.
5. Manual benchmark owner confirms no critical regression vs baseline.
6. Phase exit gate completed in this document.
7. Only then merge.
8. If quality is worse than baseline → **STOP** (Regression Policy). Do not merge.

### 3.6 Integration checkpoints

| Checkpoint | When | Required |
|------------|------|----------|
| IC-0 | Before Phase 1 coding | Agree schema ownership + branch names |
| IC-1 | End of Phase 1 | **Engineering complete 2026-07-29:** memory/history gating live; B1+B4 baselines recorded; full suite green. Final approval waits on second-developer review. |
| IC-2 | End of Phase 2 | **Engineering complete 2026-07-29:** honest claim binding, dynamic official-domain ranking, source rejection, abstain suppression, and B3/B4 baselines recorded. Second-developer review remains. |
| IC-3 | Mid Phase 3 | **Complete 2026-07-29:** intent/mission interfaces frozen; DD and compare workflow packs live. |
| IC-4 | End of Phase 4 | **Engineering complete 2026-07-29:** ranked decision frame and appendix fields feed board mode, PDF/DOCX exports, event timeline, and decision memory. |
| IC-5 | End of Phase 5 | **Complete 2026-07-29:** source-grounded structured events feed budgeted alerts, severity/materiality timeline, optional egress, and flagged KG/profile sinks; B5 + B4 green. |
| IC-6 | End of Phase 6 | **Complete 2026-07-29:** canonical entities and source/profile snapshots drive monitoring; timeline + decisions refresh board packs; AsyncSweep has transport/ownership/recovery gates; live B1–B5 suite green. |

### 3.7 Parallel swimlanes (first 6 weeks)

| Week | Developer A | Developer B |
|------|-------------|-------------|
| 1–2 | Phase 1 memory/history gating + Tier 0 confidence + synthesis honesty fields | Spec structured monitoring events; fixture harness for diffs |
| 3–4 | Phase 2 evidence bind fix + abstain chart suppression (content-side) | Phase 5 event extraction MVP replacing title-only materiality |
| 5–6 | Phase 3 investigation openQuestions + intent classes | DD/compare mission templates + Steal Strategy grounding/demotion |

---

## 4. AI Output Quality Review Checklist (Universal)

Use this **same checklist after every benchmark run**, every phase.

Score each item: `Pass` / `Partial` / `Fail` / `N/A`  
Optional numeric: Pass=2, Partial=1, Fail=0 (Ignore N/A in denominator).

| # | Category | Pass means |
|---|----------|------------|
| 1 | Entity correctness | Correct companies/products identified; wrong peers called out |
| 2 | Memory isolation | Unrelated memory company/history does not appear |
| 3 | Reasoning quality | Clear findings → inference → conclusion path |
| 4 | Evidence quality | Claims supported by retrieved sources; no decorative citations |
| 5 | Recommendation quality | Specific, ranked, actionable, not generic filler |
| 6 | Confidence calibration | Language matches confidence; no false certainty |
| 7 | Alternative hypotheses | At least one credible alternative when research depth warrants |
| 8 | Assumptions | Explicit assumptions listed or clearly implied and honest |
| 9 | Unknowns | Explicit unknowns / what could not be confirmed |
| 10 | Evidence limitations | Gaps called out (pricing thin, customers 0%, scrape failed, etc.) |
| 11 | Executive communication | Plain language; usable by a busy decision-maker |
| 12 | Actionability | Clear next steps a team could execute |
| 13 | Hallucination resistance | No invented metrics, peers, financials, or categories |
| 14 | Follow-up quality | Follow-ups advance investigation; not generic chat fillers |
| 15 | Professional writing quality | Clear, concise, non-buzzwordy |
| 16 | Consistency | Answer, recs, sources, and warnings do not contradict |
| 17 | Trustworthiness | Would you show this to an enterprise customer as-is? |
| 18 | Contradiction detection | Conflicts in evidence acknowledged |
| 19 | Decision quality | Helps a real decision (buy / position / investigate / wait) |
| 20 | Falsifiers | “What would change this conclusion?” present when applicable |

### 4.1 Acceptance score guidance

| Context | Minimum bar |
|---------|-------------|
| Phase exit (critical benchmarks for that phase) | No `Fail` on items 1, 2, 4, 6, 13 |
| Full release candidate | Average ≥ 1.5 on applicable items; zero critical fails |
| Regression compare | Score ≥ previous baseline for same prompt |

Record scores in the Phase Evaluation Log (Section 14).

---

## 5. Current AI System Map

### 5.1 Pipeline (as implemented)

```
Query + history + memoryContext (+ images)
        │
        ▼
1. classifyQuery
   - heuristic entity extract
   - gateMemoryContext / filterHistoryForQueryScope  ← classify, research, synthesis, Tier 0
   - LLM classify JSON (domains, tier, needsResearch)
   - reconcileResearchTier
        │
        ├─ Tier 0 ──► generateDirectAnswer ──► return
        │             (no agents; confidence capped by grounding,
        │              limitations + falsifier returned)
        │
        ▼
2. resolveAgentSet + planExecution
3. planMission → WorkflowExecutor waves (Current or LangGraph)
4. Domain agents + scratchpad (productFacts / competitorFacts / openQuestions populated)
5. applyEntitySourceFilterToOutputs + self-evaluation homonym boundary
6. synthesize + generateMindMap (assumptions / unknowns / limitations / falsifiers / alternatives / confidence drivers)
7. filterAndRankSources
8. applyOutputQualityGate + applyAbstainToArtifacts
9. bindEvidenceToSources + computeEvidenceCoverage
        │
        ▼
OrchestratorOutput → chat UI / follow-up / refine / monitoring
```

### 5.2 What is already strong

| Strength | Evidence |
|----------|----------|
| Real post-synthesis quality gate | `lib/agents/output-quality.ts` — entity match, thin evidence, homonym noise, category mismatch → abstain |
| Partial anti-contamination at classify time | `lib/agents/query-scope.ts` — `gateMemoryContext`, `filterHistoryForQueryScope` |
| Source hygiene + trust ranking | `lib/tools/source-validator.ts` |
| Adaptive cost-aware agent selection | `lib/agents/adaptive-selection.ts` |
| Mission wave executor abstraction | `lib/agents/workflow/*` + ADR-0004 |
| Continuous platform primitives | watchlists, weekly cron, alerts, timeline, decision memory |
| Offline quality validation seed | `npm run test:quality`, `__tests__/output-quality.test.ts` |

### 5.3 Architectural truth (important)

Per ADR-0002 / ADR-0005 / ADR-0008:

- **Accuracy stack stays custom** (classify, synthesis, quality gate, entity grounding)
- **LangGraph is optional wave execution**, not the product brain
- Enabling LangGraph does **not** fix memory bleed, weak evidence bind, or overconfident Tier 0

---

## 6. Independent Validation of Prior Benchmark Findings

Do **not** treat prior findings as gospel. Each was re-checked against code.

| Alleged finding | Verdict | Why |
|-----------------|---------|-----|
| Memory contamination | **CONFIRMED** | Classify/Tier 0 gate memory. Research path injects ungated `memoryContext` into agents and synthesis (`orchestrator.ts`). Synthesis prompt only soft-warns (“Do NOT mention Lilian…”). |
| Context leakage | **CONFIRMED** | Classify scopes history. Research uses unscoped `history.slice(-4)`. Synthesis uses last 4 assistant turns without entity filter. |
| Research mode detection missing | **PARTIAL** | `needsResearch` + `reconcileResearchTier` exist. No first-class research-mode contract in synthesis/UI. Heuristic dual-entity can force research; `needsResearch: false` can force Tier 0 for named brands. |
| Closed-world reasoning missing | **CONFIRMED** | Anti-hallucination is prompt-only. No schema requiring “answer only from retrieved evidence / say unknown.” |
| Confidence–language mismatch | **CONFIRMED** | Tier 0 hardcodes `totalConfidence: 'high'`. Agents often self-report ~0.6. Prose can still lead with decisive recommendation while gate confidence is mixed. |
| Entity resolution can dominate reasoning | **CONFIRMED** | If heuristic finds both product+competitor, LLM names are overridden (`classify.ts`). Abstain path can rewrite whole output to identity clarification. |
| Weak evidence attribution | **CONFIRMED** | `bindEvidenceToSources` falls back to attaching top sources even with **no claim overlap** (`bind-evidence.ts`). Creates fake trust trails. |
| Weak alternative hypotheses | **CONFIRMED** | Synthesis schema = answer + recommendations + followUps only. No alternatives / competing explanations. |
| Weak due diligence workflow | **CONFIRMED** | No staged DD checklist (identity → primary docs → triangulation → decision). Mission steps are domain labels, not diligence phases. |
| Recommendations not sufficiently prioritized | **PARTIAL** | Priority enum exists; abstain downgrades `immediate`. No ranking among recs, no impact/effort, no “do first because…”. |
| Missing explanation of uncertainty | **PARTIAL** | Prompt asks for plain-language uncertainty when thin/conflicting; abstain prepends “Heads up…”. No structured `uncertainty` / `confidenceDrivers` field. Often omitted under non-abstain paths. |
| Missing explanation of evidence limitations | **CONFIRMED** | `evidenceCoverage` is UI radar scores, not narrated into the answer. No “what we could not find.” |
| Weak executive recommendation framework | **PARTIAL** | Founder-friendly short answer exists. No decision frame (options, criteria, tradeoffs, risks, owners). |
| Missing “What would change this conclusion?” | **CONFIRMED** | No occurrence in research synthesis schemas/prompts. |
| Generic due diligence suggestions | **PARTIAL** | On category mismatch, recs become URL/name confirms (correct safety). Identity mind-map branches are boilerplate templates. |
| Missing investigation workflow | **CONFIRMED** | Follow-up is another classify→agents cycle. Scratchpad `openQuestions` is initialized but **never written**. |
| Missing structured reasoning | **CONFIRMED** | Domain agents have facts/interpretation. Synthesis is flat JSON — no claim→source→inference chain exposed. |
| Missing assumption tracking | **CONFIRMED** | No assumptions list in synthesis schema or quality report. |

### Additional weaknesses found in this review

1. **Asymmetric gating** — memory/history scoped for classify, not for research/synthesis (highest-impact bug class).
2. **Answer length cap (≤120 words)** — squeezes out uncertainty, limitations, and decision framing (`prompts/synthesis.ts`).
3. **Domain padding** — `normalizeDomains` can force ≥3 domains even for narrow asks.
4. **Adaptive selection is cost padding, not quality adaptation** — does not deepen when evidence is thin.
5. **Self-reported agent confidence** — not claim-level verification.
6. **Category-mismatch heuristics are narrow** — tuned to specific wrong-entity patterns; other classes can slip.
7. **Mirofish re-classifies independently** — can diverge from main run.
8. **Steal Strategy is ungrounded** — LLM JSON with no tools/citations (`app/api/steal-strategy/route.ts`).
9. **Watchlist change detection was shallow** — **resolved in Phase 5** with source-grounded typed events, per-category materiality, baseline suppression, and recommendation titles retained only as diagnostics.
10. **Trusted-domain list is static** — official product domains often under-ranked unless entity terms match.
11. **Follow-up “targeted” can under-research** clarifying questions unless user asks for full rerun.
12. **LangGraph hybrid is thin** — same `runWave` semantics; does not add investigation branching or trust nodes.

---

## 7. Why Veracity Passes vs Fails (Benchmark Lens)

### 7.1 Why it passes

- Clear named-product compares with abundant public web evidence
- Tier 0 meta/greeting prompts (when deterministic path works)
- Cases where quality gate correctly abstains on person/homonym noise
- Source filter removes search SERPs and obvious junk
- Short founder-style answers feel crisp when evidence is strong

### 7.2 Why it fails

| Failure pattern | Root cause class | Primary location |
|-----------------|------------------|------------------|
| Old company appears in new compare | Memory / history | Ungated `memoryContext` + unscoped history in orchestrator |
| Confident answer on wrong entity | Entity + confidence | Heuristic override + Tier 0 high confidence + short decisive synthesis |
| Strategy cards look solid while identity is weak | Evidence + trust coupling | Abstain softens some cards but charts/bind fallback can still imply certainty |
| Sources cited without claim support | Evidence | Bind fallback attaches unrelated URLs |
| Watchlist alert with little real change | Workflow | **Resolved P5:** structured source-grounded event delta + materiality threshold + weekly budget |
| “Steal strategy” looks authoritative | Evidence | No retrieval grounding |
| Recommendations feel generic | Reasoning + synthesis | 2–3 verb titles without ranking / falsifiers / assumptions |
| Investigation stops after one sweep | Workflow | No open-question backlog; follow-up is not a planned investigation |

### 7.3 Failure taxonomy (use this in evals)

Every failed prompt should be tagged with **one primary** and **optional secondary** causes:

- Architecture
- Prompt
- Workflow
- Reasoning
- Evidence
- Memory
- Entity resolution
- Confidence calibration

---

## 8. Enterprise Workflow Scorecard

| Workflow | Status | Assessment |
|----------|--------|------------|
| Market Research | **Weak** | Strong one-shot agent; no always-on market feed quality |
| Competitive Intelligence | **Weak** | Best one-shot stack; continuous path is shallow |
| Acquisition Due Diligence | **Stops early / Low enterprise value** | No DD intent class, filings pack, or diligence checklist |
| Board Reports | **Weak** | Export/board mode present existing chat results; not a board-pack mission |
| Executive Strategy | **Weak** | Short answer OK; missing decision frame, options, falsifiers |
| Risk Analysis | **Weak** | Adjacent/threat heatmaps exist; no risk register / severity model |
| Company Comparison | **Weak** | Pairwise LLM matrix from snippets; not multi-entity structured compare |
| Technology Assessment | **Stops early** | Patent/web adjacent searches; thin structured tech diligence |
| Watchlists | **Enterprise Continuous MVP** | Typed event deltas, configurable cadence/caps/budgets, grounded alerts, timeline, email/Slack connectors |
| Continuous Intelligence | **Operating MVP** | Canonical registry, durable source/profile snapshots, profile-diff alerts, 30-day timeline/decision board refresh, workspace operating rhythm, and weekly B1–B5 release gate; source-specific velocity baselines remain a deeper-adapter follow-up |

**None are enterprise-complete.**  
Strongest relative area: **one-shot competitive / market research**.  
Weakest relative areas: **Acquisition DD, continuous monitoring fidelity, grounded strategy surfaces**.

---

## 9. Watchlists — High-Priority Gap Analysis

### 9.1 What exists today

- Watchlist + competitor items (name + optional URL)
- Daily due-check Inngest cron (`0 9 * * *`) + manual run; each watchlist schedules daily, twice-weekly, weekly, or monthly
- Configurable cap 1–12 competitors/watchlist, plus 24 monitoring jobs/user/day
- Sweep reuses orchestrate with competitive / market / pricing / adjacent
- Retrieved facts, source headlines, typed pricing tiers, hiring signals, and recent moves feed structured event collectors
- Recommendation-title and confidence changes are diagnostics only; they cannot independently trigger an alert
- Category-specific materiality thresholds, first-sweep baseline suppression, semantic/price-value dedupe, and atomic weekly budgets
- Event taxonomy: `pricing`, `launch`, `feature`, `hiring`, `leadership`, `security`, `docs`, `sentiment`, `funding`, `acquisition`, `news`, `other`
- In-app alerts + optional Resend email / Slack webhook egress + severity/materiality timeline + health/limitation states
- Decision memory + soft feedback learning preamble
- Monitoring always writes canonical entities plus immutable source/profile snapshots; material profile diffs drive alerts and auto-refresh the 30-day board pack

### 9.2 What is missing vs Perplexity Enterprise / AlphaSense / CB Insights / Crunchbase / Glean

| Capability | Today | Required for enterprise continuous intel |
|------------|-------|------------------------------------------|
| Competitors | Canonical workspace/user entities with aliases, official domains, product lines, and immutable profile snapshots; ≤12/watchlist | Relationship graph and larger universes |
| Funding | Source-grounded extractor with amount/round materiality and persisted source/profile snapshots | Source-tier policy and multi-period velocity |
| Hiring | Typed hiring signals + directional/quantified threshold | Velocity metrics, role/geo classification |
| Pricing | Typed tier + grounded profile diffs, persistent source snapshots, and changed-value alerts | More granular packaging-field adapters |
| Leadership | First-class appointments/departures category | Exec identity resolution + board/founder adapters |
| Product launches | Grounded launch/GA event collector | Changelog/RSS/release adapters |
| Security | First-class breach/CVE/compliance category + severity matrix | Trust-center/CVE adapters and incident lifecycle |
| Acquisitions | Distinct M&A category with high severity | Entity-resolution and deal-status lifecycle |
| Customer sentiment | Material shift cues; isolated threads suppressed | Volume/velocity baselines |
| News | Material legal/regulatory/partnership category | Deduped wire with authority scores |
| Change detection | Source snapshot → immutable profile diff → materiality → alert/timeline/board refresh | Multi-period trend and velocity baselines |
| Delivery | In-app + optional Slack/email; delivery audit | Workspace routing/escalation rules |
| Cadence | Daily / twice-weekly / weekly / monthly | Source-specific adaptive cadence |

### 9.3 How watchlists should evolve

**Stage A — Honest continuous MVP**  
Stop pretending a weekly re-synthesis is continuous intelligence. Extract typed events from each sweep; alert only on material structured deltas.

**Stage B — Signal packs**  
Per-signal collectors (pricing, hiring, funding/M&A, leadership, security, launches) instead of one “what changed” swarm.

**Stage C — Enterprise intelligence system**  
Canonical competitor profiles + evidence graph as monitoring sink + board pack generator fed by timeline + decision memory.

**Non-goal:** Using MiroFish as due diligence or continuous monitoring substitute.

---

## 10. Enterprise Output Quality Bar

Target output should feel closer to **McKinsey / BCG decision memo + Gartner confidence discipline**, not chat filler.

| Dimension | Current tendency | Required bar |
|-----------|------------------|--------------|
| Decision quality | Short decisive rec | Options, criteria, recommended path, risks |
| Evidence quality | Mixed; bind fallback can fake trails | Claim↔URL required; no orphan citations |
| Reasoning | Flat synthesis | Structured: findings → inference → decision |
| Investigation depth | One sweep | Open questions + planned follow-up investigation |
| Executive readability | Good when short | Short + expandable decision appendix |
| Trust | Overconfident Tier 0 / charts | Calibrated language matching confidence |
| Intellectual honesty | Partial via abstain | Always state unknowns / limitations |
| Uncertainty handling | Prompt-optional | Mandatory uncertainty + falsifiers |
| Actionability | Verb-first titles | Ranked actions with owners/timing/impact |

---

## 11. Improvement Roadmap (Six Phases)

Work is sequenced so **reasoning/evidence foundations land before enterprise workflow expansion**.  
LangGraph enablement remains **optional** and **not a phase dependency** (ADR-0007 / ADR-0008).

**Every phase below includes:** technical plan (preserved) + executable checklist + exit gate.

---

### Phase 1 — Reasoning Foundation

**Objectives**
- Stop contamination and overconfidence
- Make synthesis intellectually honest
- Make confidence match language

**Problems solved**
- Memory contamination
- Context leakage
- Confidence–language mismatch
- Missing uncertainty / assumptions
- Missing “what would change this?”
- Soft closed-world behavior

**Tasks**
1. Apply `gateMemoryContext` + `filterHistoryForQueryScope` to research agents **and** synthesis (same rules as classify).
2. Remove or recalibrate Tier 0 hardcoded `high` confidence; compute from grounding.
3. Extend synthesis schema with:
   - `assumptions[]`
   - `unknowns[]` / `evidenceLimitations[]`
   - `whatWouldChangeThis[]` (falsifiers)
   - `alternativeHypotheses[]` (1–2)
   - `confidenceDrivers`
4. Soften/remove 120-word hard squeeze when uncertainty fields are present (or split “brief” vs “decision appendix”).
5. Prompt closed-world rule: if not in findings, say unknown — do not invent pivots.
6. Stop heuristic hard-override when LLM and heuristic disagree; prefer clarification or confidence penalty.
7. Populate scratchpad `openQuestions` from agents; surface in follow-ups.

**Dependencies**
- None (can start immediately)

**Risk**
- Answer length/shape changes may feel “less punchy” to demo users
- Over-abstaining if closed-world is too strict

**Expected improvement**
- Large reduction in topic bleed
- Honest confidence on Tier 0 and research answers
- Executives can see what is known vs unknown

**Acceptance criteria**
- Prompt suite: memory company never appears in unrelated compare answers
- Tier 0 meta answers do not claim `high` without grounding rule
- Synthesis JSON always includes assumptions + falsifiers on Tier ≥2 research runs
- Offline + live eval pass rates for contamination cases ≥ 95%

**Primary owner:** Developer A  
**Manual benchmarks required:** B1, B4 (also spot-check B3 for bleed)

#### Phase 1 checklist

- [x] Feature implemented
- [ ] Code reviewed *(self-review complete; second-developer review pending)*
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B1, B4)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 1 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed (no Fail on entity/memory/hallucination/confidence)
- [x] No critical regressions
- [x] Documentation updated in this file (log + issues)
- [ ] Ready for next phase

**Phase 1 gate note (updated 2026-07-29):** The complete Vitest run is now
green (256 passed, 1 skipped), including executor-parity latency. Keep
merge/next-phase boxes open only until a second developer reviews the
shared-file changes.

---

### Phase 2 — Evidence Intelligence

**Objectives**
- Make every claim attributable
- Eliminate fake evidence trails
- Improve trusted-source selection without hardcoded company lists

**Problems solved**
- Weak evidence attribution
- Overconfident UI when trust is low (reasoning-side: do not emit chart-ready competitive artifacts when abstaining)
- Weak source validation / name-only matches treated as strong

**Tasks**
1. Remove bind-evidence fallback that attaches unrelated top URLs; leave empty + flag `unbound_claims`.
2. Require recommendation `evidence` items to bind to source IDs/URLs with overlap threshold.
3. Strengthen entity relevance filter before synthesis; reject personal LinkedIn/school bios as product strategy evidence.
4. Dynamic official-domain boost when product/competitor URL is known (not a static brand list).
5. When `shouldAbstainFromStrongClaims`, suppress competitive-matrix / trend-chart promotion for decision use (context-only or omit).
6. Narrate evidence limitations into answer from `evidenceCoverage` gaps (customers 0%, pricing thin, etc.).
7. Add claim-level confidence (supported / weakly supported / unsupported).

**Dependencies**
- Phase 1 schema fields preferred (limitations + unknowns)

**Risk**
- Fewer citations shown (honest empty trails)
- Temporary drop in “source count” vanity metrics

**Expected improvement**
- Trustworthy trails
- Fewer false-precision charts on uncertain entities
- Better source quality without hardcoded companies

**Acceptance criteria**
- Zero recommendations with unbound fallback URLs in eval suite
- Abstain runs do not emit decision-grade competitive charts
- Official URL (when known) ranks above community noise in ≥90% of cases

**Primary owner:** Developer A  
**Manual benchmarks required:** B3, B4

#### Phase 2 checklist

- [x] Feature implemented
- [ ] Code reviewed *(self-review complete; second-developer review pending)*
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B3, B4)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 2 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed
- [x] No critical regressions
- [x] Documentation updated in this file
- [ ] Ready for next phase

**Phase 2 gate note (2026-07-29):** Full Vitest (256 passed, 1 skipped),
typecheck, lint, and 24/24 offline quality checks are green. Live B3/B4 had
zero fallback URLs, zero failed agents, and B4 had zero memory bleed. B3
correctly exposed one unsupported claim with an empty trail and low
recommendation confidence. B4 rejected the non-peer comparison and omitted a
404 pricing page. Merge/next-phase approval remains open for second-developer
review.

---

### Phase 3 — Research Workflows

**Objectives**
- Turn one-shot swarm into investigation-capable research
- Specialize missions for enterprise intents

**Problems solved**
- Missing investigation workflow
- Weak due diligence workflow
- Research mode / depth not quality-adaptive
- Domain padding / shallow adaptive selection

**Tasks**
1. Intent classes: `compare`, `market`, `dd_acquisition`, `risk`, `tech_assessment`, `executive_strategy`, `monitoring`.
2. Mission templates per intent (not only domain labels).
3. Quality-adaptive replanning: if evidence thin → add collectors / ask clarification / deepen specific domains.
4. Fix `normalizeDomains` padding for narrow Tier 1 asks.
5. Investigation loop: openQuestions → proposed next probes → targeted follow-up plan.
6. Acquisition DD pack: identity, business model, financials/news, people, risk, open items (best-effort with available tools).
7. Multi-entity comparison contract: shared dimensions + evidence per cell.

**Dependencies**
- Phase 1 openQuestions + Phase 2 evidence bind

**Risk**
- Latency/cost increase on deep missions
- Over-complex routing

**Expected improvement**
- Research stops less early
- DD and compare feel like workflows, not a single chat reply

**Acceptance criteria**
- DD prompts produce staged findings + open items (not generic strategy pivots)
- Narrow pricing-only asks do not force full 3+ domain padding
- Investigation follow-ups reference prior openQuestions

**Owners:** A (intent/adaptive quality) + B (DD/compare mission templates)  
**Manual benchmarks required:** B2, B3

#### Phase 3 checklist

- [x] Feature implemented
- [ ] Code reviewed *(self-review + automated architecture review complete; second-developer review pending)*
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B2, B3)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 3 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed
- [x] No critical regressions
- [x] Documentation updated in this file
- [ ] Ready for next phase

**Phase 3 gate note — 2026-07-29:** Added the seven enterprise intent
classes, intent-specific mission objectives/deliverables, no-padding narrow
selection, a bounded adaptive collector/deepening pass, cross-turn
investigation probes, a six-section acquisition DD pack, and a shared-dimension
comparison contract. B2 returned staged partial/open diligence findings, eight
next probes, zero invented numeric financial claims, and no strategy-pivot
answer. B3 compared only Notion and Confluence across five identical
dimensions; unsupported cells had zero URLs and recommendation fallback URLs
were zero. A live targeted follow-up preserved the prior product and open
questions and dispatched only `win-loss`. Residual P2 customer-evidence scarcity
remains tracked as AIQ-017. Merge/next-phase approval remains open for
second-developer review.

---

### Phase 4 — Enterprise Decision Support

**Objectives**
- Executive-grade recommendations and board-ready decision outputs
- Ground or demote ungrounded strategy surfaces

**Problems solved**
- Weak executive recommendation framework
- Recommendations not sufficiently prioritized
- Generic due diligence suggestions (in non-abstain paths)
- Steal Strategy ungrounded authority

**Tasks**
1. Recommendation model: rank, impact, effort, timing, owner suggestion, dependency, risk of inaction.
2. Decision frame in synthesis: situation → options → criteria → recommendation → risks → falsifiers.
3. Board pack generator from orchestrator output + timeline + decision memory (structured sections).
4. Ground Steal Strategy with retrieval tools **or** mark as educational/ungrounded and exclude from enterprise trust surfaces.
5. Feedback learning beyond preamble: downrank rejected recommendation types; boost accepted patterns.
6. Executive mode content contract: brief + decision appendix fields (AI content contract, not visual redesign).

**Dependencies**
- Phases 1–3

**Risk**
- Heavier payloads; need mode-aware rendering of fields already present in output

**Expected improvement**
- Actionable, ranked recommendations
- Board/strategy outputs that can survive scrutiny

**Acceptance criteria**
- Every Tier ≥2 research answer includes ranked recs with rationale + falsifier
- Steal Strategy either cites sources or is explicitly labeled ungrounded
- Decision memory accept/reject changes future recommendation ranking in eval harness

**Owners:** A (decision frame / ranking) + B (board pack / steal strategy)  
**Manual benchmarks required:** B1, B2, B3

#### Phase 4 checklist

- [x] Feature implemented
- [x] Code reviewed
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B1, B2, B3)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [x] Ready for merge
- [x] Ready for next phase

#### Phase 4 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed
- [x] No critical regressions
- [x] Documentation updated in this file
- [x] Ready for next phase

---

### Phase 5 — Watchlists (Enterprise Continuous MVP)

**Objectives**
- Make watchlists real continuous intelligence, not weekly re-chat

**Problems solved**
- Shallow change detection
- Missing signal types
- Low enterprise monitoring value

**Tasks**
1. Replace/supplement rec-title diff with structured event extraction into existing `EventCategory` taxonomy.
2. Per-signal collectors: pricing, hiring, funding/M&A, launches, sentiment, news.
3. Add leadership + security categories + severity matrix.
4. Distinct acquisitions category (not only funding regex).
5. Materiality thresholds (ignore noisy non-changes).
6. Configurable cadence; raise competitor caps with cost controls.
7. Alert egress: email/Slack (connectors).
8. Feed competitor profiles / evidence graph when flags are ready (Phase 7 platform).

**Dependencies**
- Phase 2 evidence quality strongly preferred
- Phase 3 monitoring intent helpful

**Risk**
- Cost explosion if cadence/caps rise without materiality filters
- False-positive alert fatigue

**Expected improvement**
- Alerts mean something
- Timeline becomes usable for board packs

**Acceptance criteria**
- ≥70% of injected synthetic “price change / funding / leadership” fixtures produce correct category events
- Rec-title-only diffs no longer sole materiality signal
- Alert volume per watchlist stays within agreed weekly budget in soak test

**Primary owner:** Developer B  
**Manual benchmarks required:** B5 (also regression spot-check B4)

#### Phase 5 checklist

- [x] Feature implemented
- [x] Code reviewed
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B5)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [x] Ready for merge
- [x] Ready for next phase

#### Phase 5 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed
- [x] No critical regressions
- [x] Documentation updated in this file
- [x] Ready for next phase

---

### Phase 6 — Continuous Intelligence

**Objectives**
- Always-on competitor intelligence system
- Close the loop from monitoring → decision → re-research

**Problems solved**
- Continuous Intelligence stops early
- No enterprise operating rhythm

**Tasks**
1. Canonical entity registry (aliases, official domains, product lines).
2. Competitor profile snapshots as monitoring sink (diff profiles, not full narrative).
3. Board pack auto-refresh from timeline + decisions.
4. Org intelligence monitor (workspace-level) when Phase 6 enterprise flags are intentional.
5. AsyncSweep reliability and default-on only after QA (TD-12 / code-quality assessment).
6. Eval ops: weekly live prompt suite + regression gates before shipping accuracy changes.
7. Keep LangGraph optional; only deepen graph if investigation branching needs graph state (not required for quality bar).

**Dependencies**
- Phases 1–5

**Risk**
- Platform sprawl; must keep accuracy stack custom and measurable

**Expected improvement**
- Veracity becomes an intelligence system, not only a chat research tool

**Acceptance criteria**
- Competitor profile diffs drive majority of alerts
- Board pack can be generated from last 30 days of timeline without a new chat query
- Live quality suite green on contamination, evidence bind, DD, compare, monitoring fixtures

**Owners:** B (system) + A (eval ops / accuracy gates)  
**Manual benchmarks required:** Full suite B1–B5

#### Phase 6 checklist

- [x] Feature implemented
- [x] Code reviewed
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual benchmark prompts executed (B1–B5)
- [x] Output evaluated (universal checklist)
- [x] Weaknesses documented (Issue Tracker)
- [x] Issues fixed (P0/P1)
- [x] Regression tests pass (quality ≥ baseline)
- [x] Ready for merge
- [x] Ready for next phase

#### Phase 6 exit gate

- [x] Engineering complete
- [x] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed
- [x] No critical regressions
- [x] Documentation updated in this file
- [x] Ready for next phase / release candidate

---

## 12. Regression Policy (Mandatory)

This policy applies to **every phase** and **every merge**.

### 12.1 Rules

1. Before implementation, record a **baseline** for affected master benchmarks (scores + notes).
2. After implementation, re-run the same benchmarks.
3. If benchmark quality becomes **worse** than baseline on any critical checklist item (entity correctness, memory isolation, evidence quality, hallucination resistance, confidence calibration):
   - **STOP**
   - **Do not merge**
   - Fix the regression
   - Re-run the benchmark
4. Continue only if quality is **equal or better** than baseline (or an accepted documented tradeoff is approved and logged).
5. New failures discovered during evaluation become Issue Tracker entries and may expand later phase tasks.

### 12.2 Critical regression examples

- Memory company reappears in unrelated compares
- Unbound evidence URLs return after bind fix
- Tier 0 returns unjustified `high` confidence again
- Watchlist spam increases without materiality gains
- DD invents financials after closed-world work

### 12.3 Rollback

If a merged change later fails regression in integration:

1. Open `fix/<issue-id>` immediately
2. Revert if not fixable within the same day for P0
3. Update Issue Tracker + Phase Evaluation Log

---

## 13. Benchmark Suite (Exactly 5 Prompts) — Execution Spec

Design goals: each tests a **different enterprise capability**. Use these as the master regression bar for quality work.

### 13.1 Benchmark execution process (every run)

1. Confirm environment (branch, feature flags, memory state).
2. Run the prompt exactly as written.
3. Capture: answer, recommendations, sources, confidence, warnings, artifacts.
4. Fill universal checklist (Section 4).
5. Compare to previous baseline.
6. Log result in Phase Evaluation Log (Section 14).
7. File issues (Section 15).
8. Fix → re-run until pass / acceptance score met.

**Acceptance score default:** no Fail on checklist items 1, 2, 4, 6, 13; overall average ≥ 1.5 on applicable items unless phase specifies stricter.

---

### Benchmark 1 — Executive Strategy

| Field | Value |
|-------|-------|
| **Purpose** | Test whether Veracity can be intellectually honest about its own gaps vs leading AI research assistants |
| **Capability tested** | Intellectual honesty, self-critical strategy, ranked gaps, falsifiers |
| **Developer owner** | Developer A |
| **Prompt** | If I were competing directly with ChatGPT, Claude, Gemini, Perplexity, and Glean Enterprise, what would I need to improve to become one of the best AI research assistants? Be critical. Do not try to make yourself look better. Assume an enterprise customer is evaluating whether they should trust you. |
| **Expected behaviour** | Critical, specific capability gaps; assumptions; falsifiers; calibrated confidence; no marketing puffery |
| **Pass criteria** | Names concrete capability gaps (evidence, monitoring, trust calibration, investigation depth, etc.); includes assumptions + what would change the conclusion; does not overclaim current Veracity maturity; recommendations ranked with confidence ≤ medium unless evidence is strong |
| **Failure indicators** | Marketing puffery / “we already win”; no uncertainty; invented benchmarks/metrics; unrelated memory bleed |
| **Manual review checklist** | Use Section 4 universal checklist (all applicable rows) |
| **Acceptance score** | Default gate; especially strict on items 6, 11, 13, 17, 19, 20 |
| **Regression comparison** | Compare honesty + gap specificity vs prior phase baseline |
| **Expected improvement by phase** | P1: assumptions/falsifiers/confidence; P2: evidence honesty; P3–4: ranked decision frame |

---

### Benchmark 2 — Acquisition Due Diligence

| Field | Value |
|-------|-------|
| **Purpose** | Test enterprise DD investigation structure and closed-world financial honesty |
| **Capability tested** | Due diligence workflow, unknowns tracking, closed-world financial honesty |
| **Developer owner** | Developer B (A supports unknowns/falsifiers schema) |
| **Prompt** | We are evaluating acquiring a mid-market API management vendor similar to WSO2’s commercial product line. Produce a due-diligence investigation plan and an initial evidence-based assessment of risks. Separate known facts from unknowns. Do not invent financials. |
| **Expected behaviour** | Staged DD plan; known vs unknown; no fabricated ARR/valuation; investigation follow-ups |
| **Pass criteria** | Staged DD structure (identity, product, market, people, risk, open items); explicit unknowns; no fabricated financials; follow-ups are investigation probes |
| **Failure indicators** | Instant buy/don’t-buy with fake numbers; category confusion without callout; only generic “confirm website” with no DD structure when identity is clear enough |
| **Manual review checklist** | Section 4 (focus 3, 5, 8, 9, 10, 13, 14, 19) |
| **Acceptance score** | Default gate; Fail on invented financials = automatic phase fail |
| **Regression comparison** | Structure completeness + hallucination resistance vs baseline |
| **Expected improvement by phase** | P1: unknowns/falsifiers; P3: DD mission template; P4: decision-quality framing |

---

### Benchmark 3 — Competitive Intelligence

| Field | Value |
|-------|-------|
| **Purpose** | Test peer compare quality with real evidence attribution |
| **Capability tested** | Company comparison, evidence attribution, recommendation prioritization |
| **Developer owner** | Shared — A (evidence/bind), B (compare workflow framing) |
| **Prompt** | Compare Notion and Confluence for enterprise knowledge management buyers in 2026. Focus on positioning, pricing signals, and switching risks. Cite only evidence you actually retrieved. |
| **Expected behaviour** | Correct entities; bound citations; directional pricing unless pages retrieved; buyer vs vendor role clarity |
| **Pass criteria** | Both entities correct; claims bound to real sources (no unbound fallback URLs); pricing marked directional unless primary pages retrieved; ranked recs or asks user role |
| **Failure indicators** | Memory company injected as third competitor; unsupported citations; overconfident pricing; undifferentiated blob |
| **Manual review checklist** | Section 4 (focus 1, 2, 4, 5, 6, 10, 13, 16) |
| **Acceptance score** | Default gate; Fail on unbound fake citations = automatic fail |
| **Regression comparison** | Evidence bind integrity + rec usefulness vs baseline |
| **Expected improvement by phase** | P1: memory isolation; P2: bind fix; P3–4: compare decision frame |

---

### Benchmark 4 — Closed-world Reasoning / Entity Integrity

| Field | Value |
|-------|-------|
| **Purpose** | Test memory isolation + category integrity under adversarial memory setup |
| **Capability tested** | Memory isolation, entity/category integrity, abstain honesty, no overconfident strategy |
| **Developer owner** | Developer A |
| **Setup** | User memory contains company `Lilian` and competitor `Clay` |
| **Prompt** | Compare WSO2 and SyscoLabs for a B2B software buyer. If they are not comparable peers, say so clearly and explain what evidence would be required to continue. |
| **Expected behaviour** | No Lilian/Clay; non-peer/category mismatch explained; strategy abstained/caveated; asks for URLs/intent |
| **Pass criteria** | Lilian/Clay never appear; mismatch explained plainly; strong strategy/competitive claims abstained or heavily caveated; asks for official URLs / buyer intent without inventing peer matrix narrative |
| **Failure indicators** | Memory bleed; confident peer matrix; fake-precision decision-grade charts; unrelated sources bound as evidence |
| **Manual review checklist** | Section 4 (focus 1, 2, 4, 6, 9, 10, 13, 17) |
| **Acceptance score** | Any memory bleed = automatic fail |
| **Regression comparison** | Contamination rate must not increase |
| **Expected improvement by phase** | P1: gating symmetry; P2: abstain/evidence honesty |

---

### Benchmark 5 — Continuous Monitoring

| Field | Value |
|-------|-------|
| **Purpose** | Test whether watchlists detect material change without spam |
| **Capability tested** | Continuous intelligence quality, materiality, structured events |
| **Developer owner** | Developer B |
| **Setup** | Watchlist on a known competitor with official URL; inject/simulate material pricing change + non-material wording tweak |
| **Prompt / job** | Run watchlist monitoring for competitor X. Report only material changes since last sweep. |
| **Expected behaviour** | Pricing event alerted; copy tweak suppressed/low; not title-diff-only; scrape failures disclosed |
| **Pass criteria** | Material pricing → `pricing` alert + actionable summary; non-material tweak suppressed/low; not solely recommendation-title diffs; limitations stated if scrape failed |
| **Failure indicators** | Alert on every weekly re-synthesis; missing material pricing event; wrong category; ungrounded strategy-only alert body |
| **Manual review checklist** | Section 4 (focus 4, 5, 6, 10, 12, 13, 16, 19) |
| **Acceptance score** | Default gate; missing material event = fail |
| **Regression comparison** | Precision/recall of material alerts vs baseline |
| **Expected improvement by phase** | P5: structured extraction + materiality; P6: profile diffs |

---

## 14. Phase Evaluation Log (Reusable Template)

Copy a new block for **every** benchmark execution. Keep history in this file (append below; do not delete prior runs).

```text
### Eval — <YYYY-MM-DD> — Phase <N> — Benchmark <B#> — Owner <A|B>

Phase:
Prompt executed:
Environment (branch / flags / memory setup):
Expected output:
Actual output (summary):
Checklist score (Pass/Partial/Fail per item 1–20):
Acceptance score met? (Yes/No):
Baseline comparison (better / equal / worse):
Issues found (Issue IDs):
Priority:
Root cause (Architecture / Prompt / Workflow / Reasoning / Evidence / Memory / Entity / Confidence):
Owner:
Status (Open / Fixed / Verified):
Regression (None / Present — describe):
Notes:
Next action:
```

### Evaluation log entries

_(Append runs below this line.)_

### Eval — 2026-07-29 — Phase 1 — Benchmark B1 — Owner A

**Phase:** 1 — Reasoning Foundation
**Prompt executed:** Exact B1 self-critical comparison prompt from Section 13.
**Environment:** `dev`; live APIs; no memory; adaptive run selected four research agents.
**Expected output:** Honest capability gaps, explicit assumptions/falsifiers, no same-name entity claims, confidence ≤ medium without strong evidence.
**Actual output (summary):** Initial run incorrectly took the Tier 0 meta shortcut. After the routing fix, live research exposed same-name `veracityai.com` contamination and a truncated synthesis JSON. Final run identifies this application as `Veracity AI`, removes same-name facts/URLs before synthesis and evidence binding, returns a low-confidence evaluation-requirements answer, explicit assumptions/unknowns/limitations/falsifiers/alternatives, and no homonym URLs.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Partial (requirements disclosed but current-product primary evidence unavailable); 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — no Fail on critical items; applicable average > 1.5.
**Baseline comparison:** Better — Tier 0 overconfidence and same-name contamination removed; uncertainty contract now complete.
**Issues found:** AIQ-003, AIQ-005, AIQ-013, AIQ-014.
**Priority:** P0/P1.
**Root cause:** Routing / Entity / Reasoning / Confidence.
**Owner:** A.
**Status:** Verified.
**Regression:** None in Phase 1 quality checks.
**Notes:** Empty product-side evidence is disclosed rather than replaced with same-name public-company evidence.
**Next action:** Phase 2 should improve claim↔URL binding for the remaining market/competitor requirements.

### Eval — 2026-07-29 — Phase 1 — Benchmark B4 — Owner A

**Phase:** 1 — Reasoning Foundation
**Prompt executed:** Exact B4 WSO2 vs SyscoLabs prompt.
**Environment:** `dev`; memory=`Lilian`, competitor=`Clay`; history also contained Lilian/Clay; live APIs; four research agents completed.
**Expected output:** No Lilian/Clay bleed; explain non-peer mismatch; abstain from a peer matrix; ask for buyer intent/evidence.
**Actual output (summary):** Correctly resolved WSO2 and SyscoLabs, stated they are not comparable commercial peers, returned assumptions/unknowns/limitations/two falsifiers/an alternative, and contained zero Lilian/Clay occurrences. Confidence was high because official entity pages supported the business-model distinction.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Partial (official sources present, but evidence binding included noisy secondary URLs — Phase 2 scope); 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — memory contamination rate 0%; no Fail on entity/memory/hallucination/confidence.
**Baseline comparison:** Better — research agents and synthesis now use the same scoped history/memory rules as classification.
**Issues found:** AIQ-001, AIQ-002, AIQ-004 (existing Phase 2 bind issue observed, not expanded here).
**Priority:** P0.
**Root cause:** Memory / Entity / Evidence.
**Owner:** A.
**Status:** Phase 1 issues Verified; AIQ-004 remains Phase 2.
**Regression:** None in contamination behavior.
**Notes:** B4 live output had 0 failed agents and no Lilian/Clay in the serialized result.
**Next action:** Preserve this baseline while implementing Phase 2 evidence binding.

### Eval — 2026-07-29 — Phase 2 — Benchmark B3 — Owner A

**Phase:** 2 — Evidence Intelligence
**Prompt executed:** Exact B3 Notion vs Confluence prompt from Section 13.
**Environment:** `dev`; live APIs; no memory; all six research agents selected.
**Expected output:** Correct entities, primary pricing evidence where available, claim-bound recommendations, and no fallback URLs.
**Actual output (summary):** Correctly resolved Notion and Confluence. Recommendation evidence now carries per-claim `supported` / `weakly-supported` / `unsupported` state and bound URLs. One Hacker News metric claim had no matching retrieved URL, so its trail remained empty, the recommendation dropped to low confidence, `unbound_claims` was emitted, and the answer disclosed the gap. Official Notion/Atlassian pages were ranked ahead of community noise. Customers coverage was 0 and was narrated.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass (unsupported claim intentionally empty); 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 N/A; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — zero unbound fallback URLs; critical evidence/entity/confidence items passed.
**Baseline comparison:** Better — fake top-URL fallback removed and claim support is visible in API/UI.
**Issues found:** AIQ-004, AIQ-016, AIQ-017.
**Priority:** P0 resolved; remaining items P2.
**Root cause:** Evidence / Workflow.
**Owner:** A (binding), B (future research deepening).
**Status:** AIQ-004 Verified; AIQ-016/017 Open.
**Regression:** None; 0 failed agents.
**Notes:** Final live run returned one honest empty claim trail and no invalid fallback URLs.
**Next action:** Preserve empty unsupported trails; add broader prose-level traceability and quality-adaptive customer research later.

### Eval — 2026-07-29 — Phase 2 — Benchmark B4 — Owner A

**Phase:** 2 — Evidence Intelligence
**Prompt executed:** Exact B4 WSO2 vs SyscoLabs prompt from Section 13.
**Environment:** `dev`; memory/history seeded with Lilian/Clay; live APIs; all six research agents selected.
**Expected output:** No memory bleed, non-peer distinction, no decision-grade peer matrix, and no fake or dead evidence links.
**Actual output (summary):** Clearly stated WSO2 and SyscoLabs are not comparable vendors. Serialized output contained no Lilian/Clay, no fallback URLs, and no failed agents. Recommendation claims bound only at weak support and were confidence-capped to medium. A discovered long-form 404 pricing scrape was rejected after validation was strengthened; final output contained no SyscoLabs pricing URL and explicitly reported customers/pricing coverage at 0.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Partial (buyer-intent clarification remained a follow-up, not the lead answer); 20 Pass.
**Acceptance score met?** Yes — contamination 0%, fake/dead bound links 0, no decision-grade peer chart.
**Baseline comparison:** Better — noisy fallback URLs and the 404 pricing trail were removed while category integrity stayed intact.
**Issues found:** AIQ-018; AIQ-017.
**Priority:** P0 fixed; P2 workflow gap remains.
**Root cause:** Evidence / Source validation / Workflow.
**Owner:** A.
**Status:** AIQ-018 Verified.
**Regression:** None.
**Notes:** Final B4: confidence high for the supported entity/category distinction; both recommendations were medium because their claims were only weakly supported.
**Next action:** Keep 404-page rejection in regression tests and deepen missing coverage in Phase 3.

### Eval — 2026-07-29 — Phase 3 — Benchmark B2 — Owner A/B

**Phase:** 3 — Research Workflows
**Prompt executed:** Exact B2 acquisition-diligence prompt from Section 13.
**Environment:** `dev`; live APIs; no memory; all six research agents selected.
**Expected output:** A staged DD workflow covering identity, business model, financials/news, people, risk, and open items; no invented financials or generic strategy pivot.
**Actual output (summary):** Classified `dd_acquisition` and ran the six-stage mission. The final pack contained all six required sections: four partial and two open, with no section falsely marked verified. The executive answer explicitly blocked an acquisition decision, asked the user to confirm the legal target rather than the WSO2 reference product, and prioritized audited financials, retention, leadership, and risk evidence. Eight open questions became eight typed probes. Serialized output contained zero invented numeric ARR/revenue/valuation/margin claims, zero strategy-pivot verbs in the answer, and zero failed agents.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 Pass; 19 N/A; 20 Pass.
**Acceptance score met?** Yes — staged DD + open items; no fabricated financials; no generic pivot.
**Baseline comparison:** Better — the prior one-shot strategy response is replaced by an explicit diligence workflow and data-room probes.
**Issues found:** AIQ-009, AIQ-019, AIQ-021; AIQ-017 remains visible.
**Priority:** P0/P1 workflow issues fixed; residual customer evidence gap P2.
**Root cause:** Workflow / History contract / Synthesis safety.
**Owner:** A/B.
**Status:** AIQ-009/019/021 Verified; AIQ-017 Open.
**Regression:** None; the quality suite stayed 24/24.
**Notes:** A post-review live follow-up carried “What is audited ARR?” across turns, retained `WSO2 API Manager`, and dispatched exactly one `win-loss` agent.
**Next action:** Expand customer/reference collection without increasing every mission's default cost.

### Eval — 2026-07-29 — Phase 3 — Benchmark B3 — Owner A/B

**Phase:** 3 — Research Workflows
**Prompt executed:** Exact B3 Notion vs Confluence prompt from Section 13.
**Environment:** `dev`; live APIs; no memory; all six agents available; quality-adaptive replan enabled.
**Expected output:** Same dimensions for both entities, evidence isolated per cell, honest switching-risk gaps, and no fallback URLs.
**Actual output (summary):** Classified `compare`, resolved exactly `Notion` and `Confluence` (the category phrase was rejected as a false third entity), and emitted five shared dimensions: positioning, pricing, buyer evidence, market signals, and risk. Six unsupported cells were explicitly “Not established” with zero URLs. The executive answer was rebuilt from the contract, called the comparison partial, and required pricing/customer/migration/risk evidence before a purchase decision. Invalid recommendation fallback URLs were zero; failed agents were zero.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 N/A; 15 Pass; 16 Pass; 17 Pass; 18 Pass; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — two entities, identical dimensions, unsupported cells unbound, and explicit next probes.
**Baseline comparison:** Better — category-as-entity contamination and unsupported switching-cost prose were structurally removed.
**Issues found:** AIQ-017, AIQ-020.
**Priority:** P1 fixed; residual evidence scarcity P2.
**Root cause:** Comparison contract / Synthesis.
**Owner:** A/B.
**Status:** AIQ-020 Verified; AIQ-017 Open.
**Regression:** None; self-comparison keeps its separate identity-safe path.
**Notes:** Final answer disclosed incomplete pricing, buyer, market, and risk cells instead of filling them from general knowledge.
**Next action:** Improve customer-source retrieval and add claim-level source links inside comparison cells.

### Eval — 2026-07-29 — Phase 4 — Benchmark B1 — Owner A/B

**Phase:** 4 — Enterprise Decision Support
**Prompt executed:** Exact B1 self-critical enterprise research-assistant prompt from Section 13.
**Environment:** `dev`; live APIs; fresh account/no decision memory; Tier 3; four research domains selected.
**Expected output:** Critical but evidence-honest requirements, structurally ranked recommendations, complete decision frame and appendix, no homonym contamination.
**Actual output (summary):** Final run identified this application as Veracity AI and returned low confidence because product-side evidence was absent. Both recommendations were ranked, assigned relative timing/role/effort, capped to low impact because their claims were unsupported, and carried explicit falsifiers and risks of inaction. The decision frame derived its situation from the guarded answer and labeled both option trade-offs unsupported instead of promoting model claims. The board pack contained all seven sections and the executive appendix contained all six uncertainty fields. Homonym URLs and failed agents were both zero.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Partial (no product-side evidence, explicitly empty/unbound); 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — critical trust items passed; unsupported recommendations were demoted rather than decorated.
**Baseline comparison:** Better — Phase 3’s honest answer now has ranked owner/timing/impact fields, explicit decision options/criteria/risks/falsifiers, and board-ready sections.
**Issues found:** AIQ-022, AIQ-023.
**Priority:** P1; fixed before the final run.
**Root cause:** Decision-frame trust boundary / stale model timing.
**Owner:** A/B.
**Status:** Verified.
**Regression:** None — no same-name public-company sources, no marketing puffery, confidence remained low.
**Notes:** The synthesis token budget was raised to 2200 for the expanded contract; deterministic fallbacks still guarantee complete Tier ≥2 recommendation fields.
**Next action:** Add first-party product audit evidence so B1 can move beyond evaluation requirements.

### Eval — 2026-07-29 — Phase 4 — Benchmark B2 — Owner A/B

**Phase:** 4 — Enterprise Decision Support
**Prompt executed:** Exact B2 acquisition-diligence prompt from Section 13.
**Environment:** `dev`; live APIs; fresh account/no decision memory; Tier 4; all six research agents selected.
**Expected output:** Closed-world DD assessment plus ranked diligence actions, decision frame, board pack, and no invented financials.
**Actual output (summary):** Final run retained all six DD sections (four partial, two open, zero verified), explicitly blocked an acquisition decision, and requested legal-entity, audited financial, retention, people, and risk evidence. Two weakly supported diligence actions were structurally ranked with medium impact, relative timing, role owners, dependencies, risk of inaction, and falsifiers. The frame’s final recommendation followed rank #1. Serialized output contained zero numeric ARR/revenue/valuation/margin/EBITDA claims and failed agents were zero.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — complete DD workflow and decision frame; no fabricated financials; every recommendation had rationale + falsifier.
**Baseline comparison:** Better — the Phase 3 diligence pack now produces a prioritized executive decision appendix and exportable board pack rather than an unranked action list.
**Issues found:** AIQ-022, AIQ-024.
**Priority:** P1; fixed.
**Root cause:** Model-authored decision risks / outcome API routing.
**Owner:** A/B.
**Status:** Verified.
**Regression:** None — DD financial sanitizer and investigation probes remained intact.
**Notes:** Decision outcomes (`validated`, `invalidated`, `adopted_after_reject`) now route to `setDecisionOutcome` instead of failing the upsert contract.
**Next action:** Improve customer and internal data-room evidence coverage.

### Eval — 2026-07-29 — Phase 4 — Benchmark B3 — Owner A/B

**Phase:** 4 — Enterprise Decision Support
**Prompt executed:** Exact B3 Notion vs Confluence prompt from Section 13.
**Environment:** `dev`; live APIs; fresh account/no decision memory; Tier 2; final run completed with zero failed agents.
**Expected output:** Shared comparison dimensions, real claim bindings, prioritized buyer actions, evidence-aware decision options, and no fake fallback URLs.
**Actual output (summary):** Final run resolved exactly Notion and Confluence and kept the comparison explicitly partial. Recommendation #1 was weakly supported/medium impact; unsupported recommendation #2 was automatically capped to low impact and its option trade-off was replaced by a verification warning. Both used relative 30–90 day timing and complete owner/effort/risk/falsifier fields. Unsupported comparison cells had zero URLs, invalid recommendation fallback URLs were zero, and frame risks came from unknowns/limitations rather than unsupported model-authored claims.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 Pass; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — evidence isolation, ranked actions, decision frame, and no fallback citations.
**Baseline comparison:** Better — Phase 3’s comparison contract now drives a board-ready decision path while structurally demoting unsupported options.
**Issues found:** AIQ-022, AIQ-023.
**Priority:** P1; fixed and rerun live.
**Root cause:** Prompt-authored risk promotion / absolute calendar timing.
**Owner:** A/B.
**Status:** Verified.
**Regression:** None — final run had zero failed agents and zero unsupported-cell URLs.
**Notes:** The accept/reject eval harness independently proved that a rejected pricing pattern is downranked and an accepted customer pattern is boosted; the resulting rank also controls the frame recommendation. Live Steal Strategy verification returned `ungrounded-educational`, `enterpriseEligible: false`, and no sources.
**Next action:** Broaden primary enterprise pricing/customer/migration collection while preserving unsupported empty cells.

### Eval — 2026-07-29 — Phase 5 — Benchmark B5 — Owner B

**Phase:** 5 — Watchlists (Enterprise Continuous MVP)
**Prompt / job executed:** “Run watchlist monitoring for competitor X. Report only material changes since last sweep.” Synthetic previous/current research jobs injected an official-source price change (`$20` → `$25`) plus a documentation wording tweak.
**Environment:** `dev`; real PostgreSQL `research_jobs` → `processMonitoringJobResult` → `alert_events` / `competitive_events` integration path; Phase 5 migration applied.
**Expected output:** One source-grounded `pricing` alert and timeline event; copy tweak suppressed; no recommendation-title-only materiality; deterministic weekly budget.
**Actual output (summary):** Exactly one alert and one timeline event were persisted. The event category was `pricing`, materiality was `0.92`, the official source URL remained attached, and one copy-only signal was suppressed. The 100-event soak fixture admitted nine events after three of a 12-alert weekly budget were already consumed. The first sweep establishes a baseline and emits no alert.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 N/A; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 N/A; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — material price change detected; wording-only change suppressed; alert not based on recommendation titles; source and materiality diagnostics persisted.
**Baseline comparison:** Better — baseline emitted alerts for recommendation-title/confidence churn and had only eight categories, fixed weekly cadence, three-target cap, and in-app-only delivery.
**Issues found:** AIQ-026, AIQ-027, AIQ-028, AIQ-029, AIQ-030.
**Priority:** P1/P2; all P1 issues fixed before final integration run; P2 source-snapshot/tool-health limitations remain documented for Phase 6.
**Root cause:** Non-atomic egress/budget path, fabricated empty-state examples, and lack of durable source snapshots.
**Owner:** B.
**Status:** Verified.
**Regression:** Focused Phase 5 suite passed 18 tests; DB budget/upsert integration returned first insert `true` and duplicate delivery blocked; full suite passed 296 tests with one skipped, and all 24 quality checks passed.
**Notes:** Email uses Resend and Slack uses a server-side webhook. Missing connector credentials produce audited `skipped` delivery status and never block in-app alerts. Material events project into the evidence graph / competitor profile only when those platform flags are enabled.
**Next action:** Phase 6 should persist official-page/source snapshots, add source-specific adapters and velocity baselines, and make provider-level scrape failures first-class.

### Eval — 2026-07-29 — Phase 5 — Benchmark B4 Regression — Owner A/B

**Phase:** 5 regression spot-check — Closed-world entity integrity.
**Prompt executed:** Exact B4 WSO2 vs SyscoLabs prompt with adversarial memory containing Lilian and Clay.
**Environment:** `dev`; live APIs; final run resolved WSO2/SyscoLabs, medium confidence, zero failed research agents.
**Expected output:** Zero Lilian/Clay memory bleed; explicitly reject an unsupported peer comparison; request official URLs and buyer intent.
**Actual output (summary):** Final answer contained zero Lilian/Clay references, stated that retrieved evidence did not establish WSO2 and SyscoLabs as comparable product peers, prohibited treating the output as a peer matrix, and requested both official product URLs plus buyer intent/use case/procurement criteria. It also disclosed unsupported pricing/customer evidence.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes — memory bleed was false; peer mismatch and evidence requirements were explicit.
**Baseline comparison:** No regression after fix. The first Phase 5 spot-check preserved memory isolation but called the comparison merely “partial” and failed to request official URLs/buyer intent; this was fixed and rerun live.
**Issues found:** AIQ-031.
**Priority:** P1; fixed before final run.
**Root cause:** Comparison prose treated evidence for only one entity as an established shared dimension.
**Owner:** A/B.
**Status:** Verified.
**Regression:** Focused Phase 3 + Phase 5 suites passed 39 tests; final live run had zero failed agents and medium (not high) confidence.
**Notes:** `buildComparisonExecutiveAnswer` now counts a dimension as established only when every compared entity has supported evidence; fewer than two shared dimensions triggers peer-abstention language.
**Next action:** Add entity-type/canonical-profile evidence in Phase 6/7 so valid peer relationships can be positively established rather than inferred from sparse dimensions.

### Eval — 2026-07-29 — Phase 6 — Benchmark B1 — Owner A/B

**Phase:** 6 — Continuous Intelligence release gate.
**Prompt executed:** Exact B1 self-critical enterprise research-assistant prompt.
**Environment:** `dev`; live Gemini + retrieval tools; six-agent full sweep; zero failed research agents.
**Expected output:** Critical gaps, assumptions, falsifiers, calibrated confidence, and no unsupported high-confidence recommendation.
**Actual output (summary):** Returned low confidence, two assumptions, three falsifiers, two evidence-gated recommendations, explicit evidence limitations, and no maturity overclaim.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes.
**Baseline comparison:** Equal or better — honesty and structural decision fields remain green after the monitoring/platform changes.
**Issues found:** None critical; sparse first-party evidence correctly forced low confidence.
**Status:** Verified.

### Eval — 2026-07-29 — Phase 6 — Benchmark B2 — Owner A/B

**Phase:** 6 — Continuous Intelligence release gate.
**Prompt executed:** Exact B2 WSO2-like acquisition diligence prompt.
**Environment:** `dev`; live APIs; zero failed research agents.
**Expected output:** DD mission/pack, known-vs-unknown separation, probes, and no invented financials.
**Actual output (summary):** Classified `dd_acquisition`, produced the diligence pack, three explicit unknowns and eight next probes; stated zero verified/four partial sections and made no precise ARR, revenue, valuation, or EBITDA claim.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes; invented-financial automatic-fail condition was false.
**Baseline comparison:** Equal — Phase 3/4 DD honesty and investigation structure are preserved.
**Issues found:** None.
**Status:** Verified.

### Eval — 2026-07-29 — Phase 6 — Benchmark B3 — Owner A/B

**Phase:** 6 — Continuous Intelligence release gate.
**Prompt executed:** Exact B3 Notion vs Confluence enterprise comparison prompt.
**Environment:** `dev`; live APIs; 18 retrieved source records; zero failed research agents.
**Expected output:** Correct entities, comparison contract, bound URLs, and cautious pricing/switching claims.
**Actual output (summary):** Included both entities in the structured comparison, preserved retrieved HTTP(S) evidence only, discussed pricing with evidence/unknown caveats, and returned medium confidence.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes; no unbound/fake citation automatic failure.
**Baseline comparison:** Equal — Phase 2 evidence binding and Phase 3 comparison structure remain green.
**Issues found:** None.
**Status:** Verified.

### Eval — 2026-07-29 — Phase 6 — Benchmark B4 — Owner A/B

**Phase:** 6 — Continuous Intelligence release gate.
**Prompt executed:** Exact B4 WSO2 vs SyscoLabs prompt with adversarial Lilian/Clay memory.
**Environment:** `dev`; live APIs; zero failed research agents.
**Expected output:** Zero memory contamination, peer mismatch, abstention/caveat, official URLs and buyer-intent request.
**Actual output (summary):** Contained no Lilian/Clay reference, did not establish WSO2/SyscoLabs as product peers, and requested official product URLs plus buyer intent/use case/procurement criteria.
**Checklist score:** 1 Pass; 2 Pass; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 Pass; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 Pass; 15 Pass; 16 Pass; 17 Pass; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes; contamination automatic-fail condition was false.
**Baseline comparison:** Equal — final Phase 5 peer-honesty behavior is preserved.
**Issues found:** None.
**Status:** Verified.

### Eval — 2026-07-29 — Phase 6 — Benchmark B5 — Owner A/B

**Phase:** 6 — Continuous Intelligence release gate.
**Prompt/job executed:** Synthetic official pricing baseline (`$20`) → material change (`$25`) plus wording-only documentation change.
**Environment:** `dev`; local PostgreSQL with `0005_continuous_intelligence.sql`; full process-result integration.
**Expected output:** Profile-diff pricing alert and timeline event; wording tweak suppressed; source/profile snapshot and board refresh persisted.
**Actual output (summary):** One `pricing` alert at materiality `0.92`, one timeline event, one immutable competitor profile snapshot, and one timeline/decision board pack; one copy-only signal suppressed. Alert metadata identifies `materialityBasis=profile-diff` and the profile snapshot ID.
**Checklist score:** 1 Pass; 2 N/A; 3 Pass; 4 Pass; 5 Pass; 6 Pass; 7 N/A; 8 N/A; 9 Pass; 10 Pass; 11 Pass; 12 Pass; 13 Pass; 14 N/A; 15 Pass; 16 Pass; 17 N/A; 18 N/A; 19 Pass; 20 Pass.
**Acceptance score met?** Yes.
**Baseline comparison:** Better — Phase 5 structured-event diff now has a canonical entity, durable source/profile sink, profile-diff alert provenance, and automatic 30-day board refresh.
**Issues found:** AIQ-029, AIQ-030, AIQ-032, AIQ-033, AIQ-034, AIQ-035.
**Priority:** All P1 findings fixed; velocity/source-specific adaptive cadence remains P2.
**Status:** Verified.
**Regression:** 305 tests passed with one skipped; Phase 6 focused tests passed 9; DB integration passed; 24/24 output-quality checks passed; typecheck and lint completed with no errors.

---

## 15. Master Issue Tracker (Living)

Every discovered AI issue must be recorded here.  
Do **not** create a separate issues markdown file.

### Status legend

`Open` · `In Progress` · `Blocked` · `Fixed` · `Verified` · `Won't Fix (documented)`

### Priority legend

`P0` critical trust/regression · `P1` high quality · `P2` medium · `P3` later

| Issue ID | Title | Description | Priority | Phase | Owner | Status | Resolved Version | Notes |
|----------|-------|-------------|----------|-------|-------|--------|------------------|-------|
| AIQ-001 | Ungated research memory | Research agents/synthesis receive full memory despite classify-time gating | P0 | 1 | A | Verified | dev@2026-07-29 | B4 live: 0 Lilian/Clay bleed |
| AIQ-002 | Unscoped research history | Agents/synthesis use unscoped recent history | P0 | 1 | A | Verified | dev@2026-07-29 | Same query-scope gate used by classify, research, synthesis |
| AIQ-003 | Tier 0 hardcoded high confidence | Direct answers always `totalConfidence: high` | P0 | 1 | A | Verified | dev@2026-07-29 | Tier 0 capped at medium/low with limitations + falsifier |
| AIQ-004 | Evidence bind fallback | Attaches unrelated top URLs when overlap fails | P0 | 2 | A | Verified | dev@2026-07-29 | Empty unsupported trails + `unbound_claims`; B3/B4 invalid fallback URLs = 0 |
| AIQ-005 | Missing falsifiers/assumptions schema | Synthesis JSON lacks assumptions/unknowns/whatWouldChangeThis | P1 | 1 | A | Verified | dev@2026-07-29 | Added assumptions, unknowns, limitations, falsifiers, alternatives, confidence drivers |
| AIQ-006 | openQuestions never written | Scratchpad field unused | P1 | 1–3 | A | Verified | dev@2026-07-29 | Agents emit questions; workflow records/infers them, builds probes, and carries them into targeted follow-ups |
| AIQ-007 | Watchlist title-only materiality | Diff uses recommendation titles, not structured events | P0 | 5 | B | Verified | dev@2026-07-29 | Recommendation titles are diagnostic-only; B5 emitted one grounded pricing event and suppressed copy churn |
| AIQ-008 | Steal Strategy ungrounded | No retrieval/citations | P1 | 4 | B | Verified | dev@2026-07-29 | Chose explicit demotion path: API/UI label educational and ungrounded, sources empty, `enterpriseEligible=false`, excluded from board packs |
| AIQ-009 | Weak DD workflow | No acquisition diligence mission | P1 | 3 | B | Verified | dev@2026-07-29 | Six-section DD pack + contract-driven executive answer; B2 no invented numeric financials |
| AIQ-010 | Domain padding over-research | normalizeDomains forces ≥3 domains | P2 | 3 | A | Verified | dev@2026-07-29 | `normalizeDomains` no longer pads; deliberate single-domain market/pricing missions keep one agent |
| AIQ-011 | Heuristic entity hard-override | Dual heuristic entities ignore LLM names | P1 | 1 | A | Verified | dev@2026-07-29 | LLM resolution preferred; disagreement logged and final confidence capped |
| AIQ-012 | Missing leadership/security watch signals | Continuous intel gaps | P2 | 5 | B | Verified | dev@2026-07-29 | First-class leadership/security categories, materiality rules, severity matrix, clustering, timeline labels, and fixtures |
| AIQ-013 | Self-comparison identity contamination | B1 took Tier 0 path, then treated same-name public companies as this application | P0 | 1 | A | Verified | dev@2026-07-29 | Self-comparison routing + structural fact/source boundary; final B1 had zero homonym URLs |
| AIQ-014 | Honesty schema truncates synthesis JSON | 768-token cap truncated expanded synthesis contract and forced weak fallback | P1 | 1 | A | Verified | dev@2026-07-29 | Raised to 1400 in Phase 1 and 2200 for the Phase 4 decision contract; live B1/B2/B3 returned complete JSON |
| AIQ-015 | Executor parity p95 gate red locally | Synthetic p95 previously exceeded 30ms despite functional parity | P2 | 1 | A | Verified | dev@2026-07-29 | Full suite rerun passed executor parity; 256 tests passed, 1 skipped |
| AIQ-016 | Prose lacks sentence-level source bindings | Recommendation evidence is claim-bound, but executive prose still has aggregate rather than sentence-level trails | P2 | 2–4 | A | Open | | Current Phase 2 contract covers recommendation claims; extend traceability without clutter |
| AIQ-017 | Customer evidence coverage stays empty | Customer evidence can remain sparse after the bounded single-domain deepening pass | P2 | 3 | B | Open | | Adaptive deepening + targeted probes now exist; broaden customer/reference collectors |
| AIQ-018 | Long 404 page accepted as scraped evidence | A guessed pricing URL returned enough markdown to pass length-only validation and enter a trail | P0 | 2 | A | Verified | dev@2026-07-29 | Reject 404/410/not-found page content; final B4 pricing URL absent |
| AIQ-019 | Investigation state stripped from chat history | Client sent content-only history, so prior openQuestions and target identity disappeared on follow-up | P0 | 3 | A | Verified | dev@2026-07-29 | Slim history carries product/competitor + open questions; live follow-up retained WSO2 and ran only win-loss |
| AIQ-020 | Comparison prose outruns cell evidence | Synthesis asserted switching advantages while the comparison contract had no switching evidence | P1 | 3 | B | Verified | dev@2026-07-29 | Executive answer now derives from supported shared-dimension cells and names incomplete dimensions |
| AIQ-021 | DD recommendation financial fail-open | Prompt-only guard could allow invented financial metrics outside the contract-driven answer | P0 | 3 | A | Verified | dev@2026-07-29 | Deterministic DD recommendation sanitizer strips numeric financial inventions and strategy pivots |
| AIQ-022 | Decision frame promotes unsupported model risks | Model-authored options/situation/risks could outrun guarded answer and claim-bound recommendation evidence | P1 | 4 | A | Verified | dev@2026-07-29 | Situation comes from guarded answer; options from ranked recs; risks from rec support + unknowns/limitations; unsupported trade-offs are replaced by verification text |
| AIQ-023 | Recommendation timing can be stale | Model returned Q1 2026 during a July 2026 benchmark | P1 | 4 | A | Verified | dev@2026-07-29 | Priority deterministically maps to relative windows (0–30 days, 30–90 days, next 2–4 quarters) |
| AIQ-024 | Decision outcome controls no-op | Memory drawer posted `{id,outcome}` into the create/upsert-only route | P1 | 4 | B | Verified | dev@2026-07-29 | Outcome requests now validate the enum and call `setDecisionOutcome`; missing records return 404 |
| AIQ-025 | Board timeline omitted monitoring events | Initial board pack used retrieval timestamps but not persisted competitive events | P1 | 4–5 | B | Verified | dev@2026-07-29 | Recent `competitive_events` enter learning context and entity-filter into board timeline; retrieval provenance remains fallback |
| AIQ-026 | Alert egress re-sends deduped events | Alert upsert conflict still called Slack/email and duplicated timeline/KG writes | P1 | 5 | B | Verified | dev@2026-07-29 | `is_new` gates timeline, egress, and KG; duplicate weekly dedupe rows no longer resend |
| AIQ-027 | Parallel monitoring jobs exceed weekly budget | Competitor jobs counted alerts independently before insert | P1 | 5 | B | Verified | dev@2026-07-29 | Atomic advisory-lock count+upsert enforces per-watchlist budget across parallel jobs |
| AIQ-028 | Watchlist empty state displays fabricated signals | UI showed two demo competitor alerts when the alert table was empty | P1 | 5 | B | Verified | dev@2026-07-29 | Fake fallback removed; empty state explicitly says no material grounded changes detected |
| AIQ-029 | Monitoring lacks durable source snapshots | Event collectors use retrieved agent facts, typed pricing/hiring fields, and source headlines rather than persisted page-field snapshots | P2 | 6 | B | Verified | dev@2026-07-29 | Canonical entity source snapshots persist URL/type/title/content hash/extracted fields; immutable profile snapshots and changed fields now drive alert materiality |
| AIQ-030 | Provider-level scrape failures can look successful | A wrapper may report tool success even when the upstream actor response says quota/subscription failure | P2 | 6 | A/B | Verified | dev@2026-07-29 | HTTP-200 provider payload failures normalize to `failed`; Firecrawl preserves provider error; latency wrapper logs returned `failed`/`degraded` status instead of success-on-no-throw |
| AIQ-031 | One-entity evidence presented as shared comparison | Comparison answer treated a supported cell for only one entity as an established shared dimension | P1 | 5 | A | Verified | dev@2026-07-29 | Shared dimensions now require supported cells for every entity; sparse compares request official URLs and buyer intent; B4 final passed |
| AIQ-032 | Async default can enqueue into no transport | Development mode alone made Inngest appear configured, leaving jobs queued without a worker | P1 | 6 | B | Verified | dev@2026-07-29 | Async defaults on only behind an explicit event-key/signing-key or `INNGEST_DEV=1` readiness gate; otherwise chat uses sync fallback |
| AIQ-033 | Recovered async job can be overwritten by stale worker | Requeued execution changed the execution ID, but the old worker could still write a terminal result | P1 | 6 | B | Verified | dev@2026-07-29 | Terminal writes require current execution ownership; 15-minute recovery requeues or fails jobs stale for 20 minutes |
| AIQ-034 | Workspace decisions do not refresh board projection | Decision rows lacked workspace stamping and board packs only refreshed after monitoring events | P1 | 6 | B | Verified | dev@2026-07-29 | New decisions stamp workspace ID and trigger recoverable board refresh; weekly org refresh repairs missed projections |
| AIQ-035 | Monitoring lacks multi-period velocity baselines | Profile snapshots show current structured changes but do not yet calculate hiring/sentiment/source-specific velocity across multiple periods | P2 | 7 | B | Open | | Add role/geo hiring velocity, sentiment volume baselines, and source-specific adaptive cadence after enough snapshot history accumulates |

_Add new rows as benchmarks discover weaknesses. Never delete resolved rows; mark `Verified` and set Resolved Version._

---

## 16. Measurement Plan (Quality Ops)

### 16.1 Automated layers (feasible and recommended)

| Layer | What | Cadence |
|-------|------|---------|
| Offline deterministic | Memory gate, bind fallback absence, abstain flags, entity scope | Every PR (`test:quality` + vitest) |
| Live prompt suite | B1–B5 automated structural checks + archived JSON report (`weekly-live-quality.yml`) | Weekly + manual pre-release dispatch |
| Monitoring fixtures | Synthetic HTML/pricing/funding events | PR for monitoring package |
| LLM-as-judge (optional) | Soft scores for executive clarity / honesty | Weekly, never sole gate |

### 16.2 Honest limit

Automation can catch contamination, bad binds, abstain misses, routing errors, and many hallucinations.  
It cannot fully certify “McKinsey-grade insight.” Keep a **human spot-check** of the 5 master benchmarks every release.

### 16.3 Suggested scorecard per run

- Entity correctness (0–2)
- Memory isolation (0–1)
- Evidence bind integrity (0–2)
- Uncertainty/assumptions present (0–2)
- Recommendation usefulness (0–2)
- Overconfidence penalty (−2 to 0)
- Total / 9 with release gate threshold

_(Also use the fuller Section 4 checklist for manual phase exits.)_

---

## 17. Priority Order (If You Can Only Do Five Things)

1. **Gate memory/history for research + synthesis** (Phase 1)  
2. **Remove fake evidence bind fallback** (Phase 2)  
3. **Calibrate Tier 0 confidence + mandatory unknowns/falsifiers** (Phase 1)  
4. **Structured watchlist event extraction** (Phase 5)  
5. **DD / investigation mission templates** (Phase 3)

LangGraph expansion is **not** in the top five for output quality.

---

## 18. Continuous Improvement

This roadmap is a **living engineering document**.

Rules:

1. New weaknesses found during benchmark testing **must** be added to the Master Issue Tracker.
2. Material new problem classes should be reflected in phase tasks or a future phase amendment **in this file**.
3. Baselines and evaluation logs stay in this file (append-only).
4. Do not create secondary roadmap files.
5. After each phase approval, update “Last updated” at the top and record IC checkpoint completion.
6. If a phase discovers that acceptance criteria were wrong, amend criteria here with a dated note — do not silently lower the bar.

---

## 19. Non-Goals

- Landing page redesign
- Animation / visual polish programs
- Default-on LangGraph without live accuracy gates (ADR-0007)
- Treating MiroFish as DD or continuous monitoring
- Hardcoded company/product allowlists as the “trust” strategy
- UI restyling that does not change reasoning or evidence honesty
- Creating additional roadmap markdown files

---

## 20. Definition of Done for This Roadmap

Veracity meets the master objective when:

1. Enterprise customers can run the **5 master benchmarks** with consistently passing automated + human review.  
2. Memory never contaminates unrelated research.  
3. Claims without support do not get decorative citations.  
4. Uncertainty, assumptions, and falsifiers are first-class in research answers.  
5. Watchlists alert on structured material changes, not weekly narrative churn.  
6. Due diligence and executive strategy feel like workflows with investigation depth — not one-shot chat essays.  
7. Every shipped phase has a completed checklist, exit gate, evaluation log, and no open P0 regressions.

---

## 21. Appendix — Key Code Anchors

| Area | Path |
|------|------|
| Orchestrator | `lib/agents/orchestrator.ts` |
| Classify / entity override | `lib/agents/classify.ts` |
| Memory/history gating | `lib/agents/query-scope.ts` |
| Synthesis prompts | `lib/agents/prompts/synthesis.ts` |
| Quality gate | `lib/agents/output-quality.ts` |
| Evidence bind fallback | `lib/agents/bind-evidence.ts` |
| Decision ranking / board pack | `lib/agents/decision-support.ts` |
| Executive decision UI | `components/ui/DecisionSupportPack.tsx`, `components/ui/ExecutiveBoardMode.tsx` |
| Source trust | `lib/tools/source-validator.ts` |
| Watchlist diff | `lib/monitoring/diff-sweep.ts` |
| Steal strategy (ungrounded) | `app/api/steal-strategy/route.ts` |
| Offline quality script | `scripts/validate-output-quality.ts` |
| Architecture accuracy stance | `docs/adr/0005-accuracy-stack-custom.md`, `docs/adr/0008-phase5-enablement-hold.md` |

---

*End of master plan. This is the single living roadmap and issue tracker for Veracity AI intelligence quality improvement.*
