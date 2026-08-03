# UI Redesign Plan

**Status:** proposed, not started
**Created:** 2026-08-03
**Decisions taken:** adopt the design language into Veracity's own components (no
imported demo dashboard); chart colour encodes **evidence quality**, not series
identity.

---

## 1. Why this is needed

The honest diagnosis, from the commit audit on 2026-08-03.

Across 46 commits, **13% of the work landed in the UI** (3,386 of ~26,000 lines).
The rest went to `lib/`, tests, docs, database, and scripts. That split was
deliberate and it built the evidence ledger the product depends on — but it means
the surface a buyer judges barely moved.

Worse: the 27 UI components that *were* built are gated behind one line —
[`DashboardWorkspace.tsx:278`](../components/dashboard/DashboardWorkspace.tsx) —

```tsx
{selectedProject ? <ProjectDashboard … /> : null}
```

An account with no Market Project never renders any of it. The empty state offers
chat suggestion chips, which lead into the older single-shot chat flow. **The
product has two surfaces and shows new users the weaker one.**

So this is not a repaint. Painting the weak surface a nicer colour still leaves
the strong one unreachable.

### The second failure: honest output that reads as broken

A run with thin evidence currently renders a 5×3 battlefield grid, fifteen
identical "Not established by retrieved evidence" cells, a decision slide, six
board-mode slides, domain cards, and a business snapshot — all empty.

The system *knows*. It sets `entity_category_mismatch`, warns "entity category
mismatch", and prints "CONFIRM THE EXACT COMPANY OR PRODUCT FIRST". Then it draws
the whole product anyway. There is no gate in `lib/` or `components/` that
suppresses a comparison the system has already judged meaningless.

Correct behaviour presented this way reads as a broken product. That is the single
biggest credibility problem, and it is a rendering decision, not a research one.

---

## 2. What we are keeping

Not up for redesign — these already work and carry the brand:

| Keep | Why |
|---|---|
| The Veracity logo and wordmark | Brand identity |
| The dark sign-in page | Art-directed, deliberate, already pinned via `useForcedTheme('dark')` |
| The bot / chat animation | Genuinely good; it is the "agent is working" signal |
| Parallel agent-run animation | The clearest proof of multi-agent execution |

The dark sign-in needs no work: `useForcedTheme` already isolates it, so a light
app palette will not touch it.

---

## 3. Design direction

Grounded in current practice for enterprise dashboards and agentic interfaces
(sources in §8).

### 3.1 The governing rule

> **Colour carries meaning, not decoration.**

Vercel's dashboard is the reference: near-monochrome chrome, so the few coloured
things read instantly *because* nothing else competes. Our current UI does the
opposite — accent blue on everything, then red `UNSUPPORTED` chips fifteen at a
time, so nothing stands out and the red stops meaning anything.

### 3.2 Neutral chrome (all app surfaces)

A slate ramp. Everything structural is greyscale.

| Role | Light | Dark |
|---|---|---|
| Page plane | `#F8FAFC` | `#0B1120` |
| Card surface | `#FFFFFF` | `#111827` |
| Raised surface | `#F1F5F9` | `#1B2536` |
| Primary ink | `#0F172A` | `#F8FAFC` |
| Secondary ink | `#475569` | `#94A3B8` |
| Muted (axis, labels) | `#94A3B8` | `#64748B` |
| Hairline border | `#E2E8F0` | `rgba(255,255,255,0.10)` |
| Gridline | `#EFF3F8` | `#1E293B` |
| Interactive accent | `#2A78D6` | `#3987E5` |

The current `#C9D9E8` "dark blue" page plane goes. It is the reason the whole app
reads as tinted rather than neutral.

Typography follows enterprise practice: 300 for secondary data, 400 body, 500
interactive, 600–700 headings. `tabular-nums` **only** in table columns and axis
ticks, never on hero figures.

### 3.3 Evidence quality — the status palette

This is the product's whole premise, so it gets the colour budget. Three states,
each with **an ink step for text and a fill step for chart marks**.

| State | Meaning to the user | Ink (text/badge) | Fill (chart mark) |
|---|---|---|---|
| Measured | Read directly from a source | `#047857` | `#0CA30C` |
| Derived | Model-inferred from evidence | `#B45309` | `#FAB219` |
| Unsupported | Evidence does not establish this | `#B91C1C` | `#D03B3B` |

**Validated, not eyeballed:**

- Ink steps all clear WCAG 4.5:1 on both `#FFFFFF` and `#F8FAFC`
  (5.48 / 5.02 / 6.47 on white).
- Fill trio passes CVD separation (worst adjacent ΔE 11.3 protan, 24.4 tritan)
  and the normal-vision floor (ΔE 27.6) on a white surface.
- The fill trio's amber fails the categorical lightness band and sits at 1.83:1
  contrast. **This is expected and allowed for a status palette** — the documented
  mitigation is the icon + label pairing below, which we are adopting anyway. It
  would not be acceptable for a series palette.

**Hard rule, from the data-viz guidance and directly aimed at our current bug:**

> A status colour never carries meaning alone. Every evidence-state marker ships
> with an icon **and** a text label.

So a bare red `UNSUPPORTED` chip is not permitted. It becomes an icon plus plain
words — and per §4.2, in most cases it should not be on screen at all.

### 3.4 Competitor series colour

When a chart genuinely compares entities, use the validated categorical order,
assigned in fixed slot order and **never cycled**:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | blue | `#2A78D6` | `#3987E5` |
| 2 | orange | `#EB6834` | `#D95926` |
| 3 | aqua | `#1BAF7A` | `#199E70` |

Capped at **three** for scatter/bubble/small-multiple forms — past three the
all-pairs colourblind floors cannot be cleared. A fourth competitor folds into
"Other" or becomes a small multiple.

Colour follows the entity, never its rank: filtering competitors must not repaint
the survivors.

Never a dual-axis chart. Two measures of different scale become two charts.

---

## 4. Workstreams

Ordered by visible impact per unit of effort.

### Phase 1 — Make the good surface reachable *(highest impact)*

The 27 components already exist and are tested. They just need a route in.

1. Replace the empty state: lead with **"Track a competitor"**, not a chat prompt.
2. Project creation as a 3-field inline form — your product, its URL, up to 10
   competitors. No modal, no wizard.
3. After a chat answer that names a company, offer **"Track this properly"** —
   converting a one-shot question into a monitored project.
4. Show the project dashboard as the default landing surface once one exists.

**Effort:** small. **Result:** 27 components become visible.

### Phase 2 — Collapse meaningless output

5. Add an identity gate. When `entity_category_mismatch` is set or entity match is
   weak, suppress the battlefield, board mode, domain cards, and snapshot. Render
   **one** screen: what we could not confirm, one input to fix it, one button.
6. Everything suppressed goes behind a single "show the empty analysis anyway".
7. Provider-down handling: when SerpAPI (or any provider) fails, say
   *"web search unavailable — here is what Reddit, HN and GitHub returned"*
   instead of scoring 0% across every dimension.

**Effort:** medium. **Result:** thin runs read as honest, not broken.

### Phase 3 — The palette swap

8. Rewrite `lib/theme-tokens.ts` with §3.2. One file, and the app follows.
9. Clean the 14 of 79 components that hardcode hex.
10. Add evidence-state ink/fill tokens to `lib/ux/vocabulary.ts`, so wording and
    colour for a state are defined in one place.
11. Rebuild every evidence badge as icon + label.

**Effort:** small — the token layer already exists and is centralised. This is the
cheapest phase, which is why it is *not* first: repainting an unreachable surface
changes nothing.

### Phase 4 — Charts

12. Apply mark specs: 2px lines, ≥8px markers, 4px rounded data-ends anchored to
    the baseline, 2px surface gaps between adjacent fills, recessive grid.
13. Hover layer on every chart — crosshair + tooltip on line/area, per-mark
    tooltip on bar/dot/cell.
14. Legend whenever ≥2 series; direct labels for ≤4; never a value on every point.
15. A table view behind every chart — required, and also the relief mechanism for
    the sub-3:1 fills.
16. Dark-mode steps **selected**, not auto-flipped, and re-validated against the
    dark surface.

### Phase 5 — Agentic interaction patterns

From current agent-UX practice; several we already partly have.

17. **Plan before execute** — show the agent plan before the sweep runs.
18. **Confidence signalling** — already present as materiality; needs the plain
    wording layer applied consistently.
19. **Progressive delegation** — let the user set how much runs unsupervised.
20. **Reasoning one interaction away** — do not front-load explanations; every
    agent action expandable, click for why, hover to preview.
21. **Plain-language audit log** — "Read Lilian's pricing page", never
    `GET /api/collect 200`.

---

## 5. MiroFish

The upstream project ([`666ghj/MiroFish`](https://github.com/666ghj/MiroFish)) is a
full multi-agent simulation platform: Node 18+ frontend, Python 3.11–3.12 backend,
built on CAMEL-AI's OASIS, using Zep Cloud for agent memory and an
OpenAI-compatible LLM.

Our `mirofish-service/` is **not** that — it is our own small Flask shim
(`server.py`), which is why nothing upstream applies to it today.

Integrating the real thing:

| Item | Detail |
|---|---|
| Ports | Upstream frontend **3000**, backend **5001** — 3000 collides with Veracity, must be reassigned |
| Keys | Needs a Zep Cloud key and an OpenAI-compatible LLM key (upstream suggests Qwen-plus) |
| Cost | Upstream warns simulations burn significant tokens; start under 40 rounds |
| Wiring | Point `MIROFISH_LIVE_BASE_URL` at the backend on 5001 |
| Risk | Separate stack with its own runtime, deps, and spend |

**Recommendation: do this after Phases 1–2.** It adds a second heavyweight runtime
to a product whose primary surface is not yet reachable. The Swarm Lab already
degrades gracefully when MiroFish is absent, so nothing is blocked by waiting.

---

## 6. Feasibility

**Yes, and cheaper than it looks.**

| Factor | Finding |
|---|---|
| Colours centralised | `lib/theme-tokens.ts` — one file drives the app |
| Hardcoded hex | Only **14 of 79** component files |
| Components exist | 27 already built, mounted, and tested — just unreachable |
| Stack current | TypeScript 5.9, Tailwind 4.1, React 19, recharts 3.8, lucide-react |
| Vocabulary layer exists | `lib/ux/vocabulary.ts` already the single source for wording |
| Dark login isolated | `useForcedTheme` means a light palette cannot break it |

The expensive-sounding parts — palette, wording, chart colour — are the cheap ones,
because the abstractions are already in place. The genuinely new work is Phases 1
and 2: routing users to the right surface, and knowing when to show less.

---

## 7. External blockers

- **SerpAPI key invalid.** The key in `.env` is 43 chars beginning `sk_`; SerpAPI
  keys are 64 hex characters. The account API returns `Invalid API key`. Until
  this is a real key with quota, every run has no web-search evidence and no
  amount of UI work will make output look substantial.
- **No real user has used this.** Everything here is reasoned from research and
  the codebase, not observed behaviour.

---

## 8. Sources

- [Agentic UX design patterns with real examples — Eleken](https://www.eleken.co/blog-posts/agentic-ux-examples)
- [Designing for AI agents: 10 UX patterns (2026) — Mantlr](https://mantlr.com/blog/designing-for-ai-agents-ux-patterns-2026)
- [UI/UX & human-AI interaction patterns — Agentic Design](https://agentic-design.ai/patterns/ui-ux-patterns)
- [Agent UX: UI design for AI agents in 2026 — Fuselab Creative](https://fuselabcreative.com/ui-design-for-ai-agents/)
- [B2B SaaS colour palettes 2026 — Tentackles](https://tentackles.com/blog/b2b-saas-color-palettes-2026-that-stand-out)
- [Enterprise SaaS typography rules — Lollypop](https://lollypop.design/blog/2026/july/enterprise-saas-typography-rules/)
- [SaaS dashboard design examples & trends 2026 — AdminLTE](https://adminlte.io/blog/saas-dashboard-design-examples/)
- Palette validated with the data-viz skill's `validate_palette.js`; WCAG ratios
  computed against `#FFFFFF` and `#F8FAFC`.

---

# Appendix — Prototype scope, requested 2026-08-03

Recorded because it exceeds one working session. Ordered by demo value.

## Done

- **Multi-industry seed** — `npm run seed:demo`. Three projects (ride-hailing,
  tea export, apparel), 8 pages, 14 snapshots, 54 evidence spans, 24 metric
  observations, 8 change events, 6 material. Real pipeline; only `fetchPage` is
  canned.
- **Extraction fixed** — the prompt never named its output fields, so every
  extraction failed schema validation and the ledger was permanently empty.
- **Pricing vocabulary** — `fare`, `fee`, `tariff`, `rate` now classify as
  pricing. Without them a competitor fare rise scored 0.2 and was withheld.

## Not done

### 1. Clarifying questions before a sweep
When a user asks for a comparison, ask back what they actually want scoped:
local demand · market saturation · global gap · capital requirements ·
regulatory exposure. Agentic-UX research calls this *plan-before-execute*, and
it is the single highest-value addition: it converts a vague prompt into a
scoped run and makes the agent look like it is thinking rather than guessing.

`lib/agents/orchestrator.ts` already classifies intent; this is a new turn type
that returns questions instead of dispatching.

### 2. Non-competitor modes
Idea evaluation, market-trend scan, regulatory scan, capital-raising landscape.
The six agents already cover the reasoning; what is missing is the *intent* that
routes to them without a competitor named.

### 3. Agent run animation fires once
Reported: the parallel-agent animation plays on the first run only. Likely a
mount-once effect keyed on something stable across runs. Needs a repro.

### 4. Home dashboard depth
Stat tiles and research history exist. Missing: charts (blocked until a project
has two collection runs — now true after `seed:demo`, so this is unblocked),
shortcuts, and per-company sparklines.

### 5. Density and visual polish
The reference set (Efferd, Firecrawl, Claude desktop) shares one property: each
screen does one job. Veracity still stacks.

## The pivot to justify in the submission

One-off research is a commodity — ChatGPT, Perplexity and Gemini Deep Research
do it better. None of them remember what was true last month. Veracity is a
**monitoring** product; the chat box was the commodity surface it led with.
`seed:demo` now demonstrates the difference: a competitor's fare moved, we hold
the sentence that proves it, and the unchanged competitor short-circuits without
paying for extraction.
