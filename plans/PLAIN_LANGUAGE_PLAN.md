# Veracity — Plain Language and Low-Cognitive-Load UX Plan

Created: 2026-08-02
Status: **Active.**

## The problem, stated plainly

The product currently speaks to the user in the vocabulary of its own
implementation. A founder or product marketer — the actual target user in
`docs/PRODUCT_FIRST_MARKET_RESEARCH_AND_ROADMAP_2026-08-01.md` §5 — opens the
dashboard and is asked to understand:

| What the UI says | What the user has to already know |
|---|---|
| `derived` / `measured` / `synthetic` | Our internal trust taxonomy |
| `materiality 0.85` | That this is a 0–1 score, and what counts as high |
| `evidence span` | That we store excerpts with offsets |
| `entity match: probable` | That entity resolution is a fuzzy process |
| `snapshot hash a1b2c3` | What a content hash is and why they'd check it |
| `claim type: interpretation` | Our fact/inference distinction |
| `below alert threshold` | That there is a threshold, and where it sits |
| `sample size 12` / `formula` | Statistical framing |

Audit on 2026-08-02 found **281 occurrences** of these terms across the
components directory.

None of this is wrong. All of it is the *implementation's* view surfacing
directly as the *user's* view, which is a failure of translation, not of
engineering.

## What the research says

Searched 2026-08-02. Consistent findings across UX and plain-language sources:

1. **One good confidence indicator beats several.** Overloaded trust UI
   backfires; a single well-designed cue outperforms multiple complex ones.
   ([SkillSeek — confidence and provenance UI cues](https://skillseek.eu/answers/ai-experience-designer-confidence-and-provenance-ui-cues))
2. **Jargon measurably raises error rates and slows decisions.** It impairs
   processing fluency and undermines the reader's self-efficacy.
   ([Inkbot — reducing corporate jargon](https://inkbotdesign.com/reducing-corporate-jargon/),
   [Acrolinx — clear language and readability](https://www.acrolinx.com/blog/how-clear-language-improves-readability-in-technical-documentation/))
3. **Glossaries have outsized impact and almost nobody ships one** — only ~16%
   of analytics platforms include one, despite the confidence gain.
   ([Querio — simplifying analytics for non-technical users](https://querio.ai/articles/ui-ux-simplify-analytics-non-technical-users))
4. **Layer provenance by audience.** Simple statements for non-experts,
   technical detail on demand — not both at once.
   ([Decision Provenance, arXiv](https://arxiv.org/pdf/1804.05741))
5. **Cut ruthlessly.** Microcopy should remove everything non-essential.
   ([UX Writing Hub](https://uxwritinghub.com/3-microcopy-rules-every-ux-writer-must-know/))

## The principle

> **The system does the interpreting. The user does the deciding.**

The user should never have to translate our vocabulary into their own. Where a
judgment is needed — is this trustworthy? is this important? is this fresh? —
the product states the judgment in a sentence, and offers the mechanics behind
it one click away for anyone who wants them.

## Design rules

1. **Lead with a sentence, not a label.** "Read directly from Lilian's pricing
   page today" beats a `measured` chip.
2. **Never show a raw score.** `materiality 0.85` becomes "Worth acting on".
   The number stays available in detail, because a user who wants to tune a
   threshold needs it.
3. **Say what it means for *them*.** A chart's caption answers "so what?", not
   "what is this".
4. **One trust cue per surface.** Not a data class *and* a confidence *and* a
   sample size competing for the same glance.
5. **Technical detail is opt-in, never removed.** Hashes, formulas, offsets and
   span ids stay — behind "How do we know this?".
6. **Absence is stated in plain words.** "We have not checked their changelog"
   rather than a blank cell or `null`.
7. **No internal nouns in the primary view.** No span, artifact, materiality,
   entity match, dedupe, persona id, claim type, or data class.

## Vocabulary decisions

| Internal | User-facing | Explanation offered on demand |
|---|---|---|
| `measured` | **Read from the source** | We copied this figure from the page itself. |
| `derived` | **Worked out by us** | We calculated this from what we collected. |
| `synthetic` | **Simulated opinion** | Model-generated reactions. Not real customers. |
| `materiality ≥ 0.75` | **Worth acting on** | Big change, trusted source, relevant to your decision. |
| `materiality 0.5–0.75` | **Worth knowing** | Real change, but not urgent. |
| `materiality < 0.5` | **Minor** | Small or low-confidence; kept for the record. |
| `evidence span` | **Quote** | The exact words we found. |
| `entity_match: confirmed` | **Definitely them** | The page names the company. |
| `entity_match: probable` | **Probably them** | Strong signal, not certain. |
| `entity_match: unverified` | **Not confirmed** | We could not confirm this is the right company. |
| `entity_match: mismatch` | **Different company** | This is about someone else. |
| `claim_type: fact` | **Backed by a quote** | Someone said this, and we kept the words. |
| `claim_type: interpretation` | **Our read** | Our analysis, not something a source stated. |
| `snapshot hash` | **Page version** | Lets you confirm the quote came from the page we saved. |
| `sample size` | **Based on N readings** | How many observations sit behind this. |
| `formula` | **How we counted** | The exact calculation. |
| `panel` / `persona` | **Simulated buyers** | Roles the model plays, not real people. |
| `no-change short circuit` | **Nothing changed** | We checked and it was the same. |

## Build order

1. `lib/ux/vocabulary.ts` — one source of truth, so a term cannot drift between
   surfaces. **Done.**
2. `lib/intelligence/plain-language.ts` — deterministic sentence generation for
   charts and changes. Deterministic rather than model-generated: it must be
   free, instant, and identical every time, and a model would occasionally
   editorialise. **Done.**
3. Apply across every user-facing component. **Done.**
4. `components/ui/Glossary.tsx` — the thing 84% of platforms skip. **Done.**
5. README rewrite with a full guided setup for any OS. **Done.**

## Deliberately unchanged

- **Log output, code comments, table and column names.** These are for
  engineers, and renaming them would make the codebase harder to reason about
  while helping no user.
- **The underlying distinctions.** Nothing here collapses measured into derived
  or hides a synthetic label. The rigour stays; only the wording changes.
