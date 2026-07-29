# Veracity AI — Master Improvement Plan

**Document type:** Living engineering source of truth for AI intelligence quality  
**Scope:** AI research quality, decision support, evidence, trust, enterprise intelligence workflows, and the two-developer execution / QA process required to ship them  
**Out of scope:** Landing page redesign, styling, animations, visual polish, UI work that does not improve AI reasoning  
**Primary objective:** Make Veracity produce enterprise-grade research and decision support comparable to the best AI research assistants  
**Codebase reviewed:** `feature/langgraph-hybrid-architecture` (orchestrator, classify, quality gate, synthesis, memory, sources, watchlists, monitoring, agents, ADRs, phase docs)  
**Created:** 2026-07-29  
**Last updated:** 2026-07-29 — Phase 1 implemented and evaluated; B1/B4 results, issue resolutions, and remaining latency-gate blocker recorded

> **Single source of truth.** Do not create parallel roadmaps. Update this file when new weaknesses, issues, or acceptance criteria are discovered.

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
| IC-1 | End of Phase 1 | **Engineering complete 2026-07-29:** memory/history gating live; B1+B4 baselines recorded. Final approval waits on full-suite latency gate + second-developer review. |
| IC-2 | End of Phase 2 | Evidence bind fix live; B3 baseline updated |
| IC-3 | Mid Phase 3 | Intent/mission interfaces frozen for B templates |
| IC-4 | End of Phase 4 | Decision frame fields available to board pack |
| IC-5 | End of Phase 5 | Structured monitoring events feed timeline |
| IC-6 | End of Phase 6 | Full 5-benchmark suite green vs original baselines |

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
9. **Watchlist change detection is shallow** — recommendation-title diff, not structured event extraction (`lib/monitoring/diff-sweep.ts`).
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
| Watchlist alert with little real change | Workflow | Rec-title diff ≠ structured competitive event |
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
| Watchlists | **Weak (MVP exists)** | CRUD + weekly cron + inbox — not enterprise continuous intel |
| Continuous Intelligence | **Weak / Stops early** | Monday cron, ≤3 competitors, in-app alerts, rec-title diffs |

**None are enterprise-complete.**  
Strongest relative area: **one-shot competitive / market research**.  
Weakest relative areas: **Acquisition DD, continuous monitoring fidelity, grounded strategy surfaces**.

---

## 9. Watchlists — High-Priority Gap Analysis

### 9.1 What exists today

- Watchlist + competitor items (name + optional URL)
- Weekly Inngest cron (`0 9 * * 1`) + manual run
- Cap ~3 competitors per user
- Sweep reuses orchestrate with competitive / market / pricing / adjacent
- “Material change” ≈ new recommendation titles or confidence change
- Event categories exist in taxonomy (`pricing`, `launch`, `feature`, `hiring`, `docs`, `sentiment`, `funding`, `other`)
- In-app alerts + timeline + health states
- Decision memory + soft feedback learning preamble

### 9.2 What is missing vs Perplexity Enterprise / AlphaSense / CB Insights / Crunchbase / Glean

| Capability | Today | Required for enterprise continuous intel |
|------------|-------|------------------------------------------|
| Competitors | Free-text names, ≤3/week | Canonical entities, aliases, relationship graph, larger universes |
| Funding | Prompted + keyword category | Dedicated extractor + source tiers |
| Hiring | Ad-hoc searches in competitive agent | Velocity metrics, role/geo classification |
| Pricing | Scrape when URL known | Structured tier diffs; alert only on material packaging/price change |
| Leadership | Absent | Exec/board/founder changes as first-class signal |
| Product launches | Heuristic | Changelog/RSS/release adapters |
| Security | Absent | Breach / CVE / trust-center / SOC2 mentions |
| Acquisitions | Folded into funding regex | Distinct M&A events |
| Customer sentiment | Weak community scrape | Volume/velocity baselines |
| News | Serp in agents | Deduped wire with authority scores |
| Change detection | Rec-title set diff | Structured event extract → timeline → alert |
| Delivery | In-app only | Slack/email + routing rules |
| Cadence | Weekly fixed | Configurable per watchlist |

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
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 1 exit gate

- [x] Engineering complete
- [ ] Automated tests pass
- [x] Benchmark prompts executed
- [x] AI quality checklist passed (no Fail on entity/memory/hallucination/confidence)
- [x] No critical regressions
- [x] Documentation updated in this file (log + issues)
- [ ] Ready for next phase

**Phase 1 gate note (2026-07-29):** Phase-scoped tests, typecheck, and offline
quality checks are green. The complete Vitest run is blocked only by the
pre-existing executor-parity synthetic p95 latency gate (37.501ms vs 30ms);
functional parity passed. Keep merge/next-phase boxes open until that gate is
green or formally re-baselined and a second developer reviews the shared-file
changes.

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

- [ ] Feature implemented
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual benchmark prompts executed (B3, B4)
- [ ] Output evaluated (universal checklist)
- [ ] Weaknesses documented (Issue Tracker)
- [ ] Issues fixed (P0/P1)
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 2 exit gate

- [ ] Engineering complete
- [ ] Automated tests pass
- [ ] Benchmark prompts executed
- [ ] AI quality checklist passed
- [ ] No critical regressions
- [ ] Documentation updated in this file
- [ ] Ready for next phase

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

- [ ] Feature implemented
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual benchmark prompts executed (B2, B3)
- [ ] Output evaluated (universal checklist)
- [ ] Weaknesses documented (Issue Tracker)
- [ ] Issues fixed (P0/P1)
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 3 exit gate

- [ ] Engineering complete
- [ ] Automated tests pass
- [ ] Benchmark prompts executed
- [ ] AI quality checklist passed
- [ ] No critical regressions
- [ ] Documentation updated in this file
- [ ] Ready for next phase

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

- [ ] Feature implemented
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual benchmark prompts executed (B1, B2, B3)
- [ ] Output evaluated (universal checklist)
- [ ] Weaknesses documented (Issue Tracker)
- [ ] Issues fixed (P0/P1)
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 4 exit gate

- [ ] Engineering complete
- [ ] Automated tests pass
- [ ] Benchmark prompts executed
- [ ] AI quality checklist passed
- [ ] No critical regressions
- [ ] Documentation updated in this file
- [ ] Ready for next phase

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

- [ ] Feature implemented
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual benchmark prompts executed (B5)
- [ ] Output evaluated (universal checklist)
- [ ] Weaknesses documented (Issue Tracker)
- [ ] Issues fixed (P0/P1)
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 5 exit gate

- [ ] Engineering complete
- [ ] Automated tests pass
- [ ] Benchmark prompts executed
- [ ] AI quality checklist passed
- [ ] No critical regressions
- [ ] Documentation updated in this file
- [ ] Ready for next phase

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

- [ ] Feature implemented
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual benchmark prompts executed (B1–B5)
- [ ] Output evaluated (universal checklist)
- [ ] Weaknesses documented (Issue Tracker)
- [ ] Issues fixed (P0/P1)
- [ ] Regression tests pass (quality ≥ baseline)
- [ ] Ready for merge
- [ ] Ready for next phase

#### Phase 6 exit gate

- [ ] Engineering complete
- [ ] Automated tests pass
- [ ] Benchmark prompts executed
- [ ] AI quality checklist passed
- [ ] No critical regressions
- [ ] Documentation updated in this file
- [ ] Ready for next phase / release candidate

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

<!-- Example starter row — replace when real evals begin
### Eval — 2026-07-29 — Phase 0 baseline — Benchmark B4 — Owner A
Phase: 0 (baseline before Phase 1)
Prompt executed: Compare WSO2 and SyscoLabs… (with Lilian/Clay memory)
Expected output: No memory bleed; category mismatch honesty
Actual output: (fill after run)
...
-->

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
| AIQ-004 | Evidence bind fallback | Attaches unrelated top URLs when overlap fails | P0 | 2 | A | Open | | Fake trust trails |
| AIQ-005 | Missing falsifiers/assumptions schema | Synthesis JSON lacks assumptions/unknowns/whatWouldChangeThis | P1 | 1 | A | Verified | dev@2026-07-29 | Added assumptions, unknowns, limitations, falsifiers, alternatives, confidence drivers |
| AIQ-006 | openQuestions never written | Scratchpad field unused | P1 | 1–3 | A | Verified | dev@2026-07-29 | Agents emit questions; workflow records/infer them and follow-ups surface them |
| AIQ-007 | Watchlist title-only materiality | Diff uses recommendation titles, not structured events | P0 | 5 | B | Open | | |
| AIQ-008 | Steal Strategy ungrounded | No retrieval/citations | P1 | 4 | B | Open | | |
| AIQ-009 | Weak DD workflow | No acquisition diligence mission | P1 | 3 | B | Open | | |
| AIQ-010 | Domain padding over-research | normalizeDomains forces ≥3 domains | P2 | 3 | A | Open | | |
| AIQ-011 | Heuristic entity hard-override | Dual heuristic entities ignore LLM names | P1 | 1 | A | Verified | dev@2026-07-29 | LLM resolution preferred; disagreement logged and final confidence capped |
| AIQ-012 | Missing leadership/security watch signals | Continuous intel gaps | P2 | 5 | B | Open | | |
| AIQ-013 | Self-comparison identity contamination | B1 took Tier 0 path, then treated same-name public companies as this application | P0 | 1 | A | Verified | dev@2026-07-29 | Self-comparison routing + structural fact/source boundary; final B1 had zero homonym URLs |
| AIQ-014 | Honesty schema truncates synthesis JSON | 768-token cap truncated expanded synthesis contract and forced weak fallback | P1 | 1 | A | Verified | dev@2026-07-29 | Raised cap to 1400; live B1 returned complete JSON |
| AIQ-015 | Executor parity p95 gate red locally | Synthetic p95 37.501ms exceeds 30ms despite functional parity | P2 | 1 | A | Open | | Blocks full automated-test checkbox; investigate or re-baseline before merge |

_Add new rows as benchmarks discover weaknesses. Never delete resolved rows; mark `Verified` and set Resolved Version._

---

## 16. Measurement Plan (Quality Ops)

### 16.1 Automated layers (feasible and recommended)

| Layer | What | Cadence |
|-------|------|---------|
| Offline deterministic | Memory gate, bind fallback absence, abstain flags, entity scope | Every PR (`test:quality` + vitest) |
| Live prompt suite | 5 master benchmarks + 20–40 extended prompts | Nightly / pre-release |
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
| Source trust | `lib/tools/source-validator.ts` |
| Watchlist diff | `lib/monitoring/diff-sweep.ts` |
| Steal strategy (ungrounded) | `app/api/steal-strategy/route.ts` |
| Offline quality script | `scripts/validate-output-quality.ts` |
| Architecture accuracy stance | `docs/adr/0005-accuracy-stack-custom.md`, `docs/adr/0008-phase5-enablement-hold.md` |

---

*End of master plan. This is the single living roadmap and issue tracker for Veracity AI intelligence quality improvement.*
