# Veracity AI — 5-Minute Demo Pitch (Evaluator Script)

> **Product:** Veracity AI — a Growth Intelligence Assistant.
> **One-liner:** *"Ask a market question, and up to 9 specialist AI agents fan out in real time to research it, then turn the findings into shipped campaigns — with a feedback loop that learns from real outcomes."*
>
> **How to use this file:** Read the **🎤 Say** lines out loud, near-verbatim. The **🖥 Do** lines tell you exactly which screen to open and what to click. Keep it moving — the whole thing is 5 minutes. Practice once so the clicks and words line up.

---

## ⏱ Timing at a glance

| # | Beat | Screen | Time | Running |
|---|------|--------|------|---------|
| 1 | The hook & the problem | Home (top) | 0:30 | 0:30 |
| 2 | Home — Intelligence Stories + Market at a glance | Home | 0:45 | 1:15 |
| 3 | The live run — 6 agents in parallel | Research | 1:30 | 2:45 |
| 4 | Research → Action — the Execution Engine | Research (execution artifact) | 1:00 | 3:45 |
| 5 | Closing the loop — rate, record, refine | Execution Plan | 0:45 | 4:30 |
| 6 | It generalises + the close | Home / any product | 0:30 | 5:00 |

**Pre-demo checklist (do this before you present):**
- [ ] Logged in; **Home** tab loads with tracked companies (Dialog Axiata, SLT-Mobitel, PickMe, Dilmah).
- [ ] One research session already run and saved (so "Pick up where you left off" is populated).
- [ ] Network is up — SerpAPI / Firecrawl / Reddit keys valid (this is a *live-signal* demo).
- [ ] A backup screenshot/recording of a completed run, in case the network stalls.
- [ ] Second product name ready for the generalisation beat (e.g. *Vector Agents*, or any product the judge names).

---

## 1 · The hook & the problem — *0:30*

**🖥 Do:** Start on the **Home** screen, scrolled to the very top so the *"Your intelligence briefing"* story reel is visible.

**🎤 Say:**
> "Every growth team asks the same question every week — *what did our competitors just do, and what should we do about it?* Today that answer means hours of trawling competitor sites, Reddit threads, news, and pricing pages, and it's stale by the time you finish.
>
> Veracity AI collapses that into a single question. You ask about a company or a market, and a team of specialist AI agents does the trawling, the analysis, and the synthesis for you — in about a minute, grounded in live data, with every claim sourced and confidence-scored. Let me show you."

**💡 Talking point:** This is *not a chatbot and not one model call* — it's a coordinated multi-agent system on live signals. Say that phrase; it's the differentiator.

---

## 2 · Home — Intelligence Stories + Market at a glance — *0:45*

**🖥 Do:** Point to the **story reel** at the top ("Your briefing", "Dialog Axiata", "SLT-Mobitel", "Market trend", "Opportunity"). Click the **"Your briefing"** card — the full-screen story viewer fans open. Tap through 1–2 segments, then close it (the cards collapse back like a deck).

**🎤 Say:**
> "The moment you land on Home, Veracity has already done work for you. This is your personalised intelligence briefing — AI-generated stories about the companies *you* track and the markets *you* care about. I'll open my briefing…
>
> *(tapping through)* …three material moves this week — Dialog cut its 5G add-on pricing, SLT-Mobitel answered within 48 hours, and buyer chatter is shifting toward data caps. Each story is a beat I can act on — and any card can drop that question straight into research."

**🖥 Do:** Close the story, scroll down slightly to **"Market at a glance"** (the KPI strip + the momentum area chart + the share-of-voice donut).

**🎤 Say:**
> "Below that, the market at a glance — my momentum, changes this week, and share of voice. This momentum chart shows Dialog pulling ahead of SLT-Mobitel over twelve weeks, and the donut shows who holds the attention right now. So before I've typed anything, I already know *where the market is heading.*"

**💡 Talking point:** Home answers "what changed while I was away?" from already-collected data — it costs nothing to open. Only a *new question* triggers a live run. That's the cost story, up front.

---

## 3 · The live run — 6 agents in parallel — *1:30* (the centrepiece)

**🖥 Do:** Go to the **Research** tab (or click a story/quick-prompt that launches research). In the ask box, type a real query:

> **"Compare Dialog Axiata and SLT-Mobitel. Who is winning right now?"**

Hit **Launch Research**. Let the **agent status grid** light up live.

**🎤 Say (while it runs):**
> "Here's the core of the product. I ask one question, and six specialist agents fan out *in parallel* — watch them light up as they finish. Each one owns a distinct domain:
> - **Market Trends** — where the category is heading;
> - **Competitive** — positioning and feature bets;
> - **Win / Loss** — what customers actually say on Reddit and in reviews;
> - **Pricing** — tiers and packaging;
> - **Positioning** — messaging gaps;
> - **Adjacent** — threats from outside the category.
>
> These aren't one prompt pretending to be six — each agent makes its *own* live tool calls to SerpAPI, Firecrawl, and Reddit, follows the thread, and comes back with findings. If one source fails, it falls back — Reddit to Hacker News, Firecrawl to a direct scrape — so the run degrades gracefully instead of crashing."

**🖥 Do:** When it completes, scroll the **Intelligence Summary**. Point to the **metrics in the header** (latency, estimated cost, API-call count). Click **one agent card** to expand its findings and **sources**.

**🎤 Say:**
> "Done — about a minute. And notice the header: wall-clock time, estimated cost — around half a cent — and the number of model calls. We track cost on *every* run.
>
> Now the important part for trust: I click into any agent, and every claim carries a **confidence score** and a **source link**. Facts are separated from interpretation. Nothing here is the model guessing from training data — it's grounded in what it fetched today."

**💡 Talking points to hit:** *parallelism* (Promise.allSettled), *multi-hop* (2–4 tool calls per agent), *graceful degradation*, *structured output* (confidence + sources + facts vs interpretation), *findings render as interfaces* (charts, matrices, scorecards) — not a wall of text.

---

## 4 · Research → Action — the Execution Engine — *1:00*

**🖥 Do:** In the same thread, ask a **follow-up with execution intent**:

> **"Now write me a 3-variant cold email campaign to win back SLT-Mobitel's price-sensitive customers."**

Watch **3 more sub-agents** run after the research stage. When the **Execution Plan** artifact renders, open the **variant tabs**.

**🎤 Say:**
> "Research is only half of it. When my question asks for *action* — copy, outreach, a campaign — Veracity runs a second stage: three execution sub-agents that turn the research into shipped assets. That's nine agents on one thread.
>
> Here's the Execution Plan. Three A/B variants — and this is the key bit — each variant carries a **falsifiable hypothesis tied to a specific research signal** from stage one. So this angle isn't a guess; it traces straight back to the pricing and win-loss evidence we just gathered. I get ready-to-send email and LinkedIn sequences and a deployment timeline. The recommended variant is highlighted."

**💡 Talking point:** This proves *Research → Action* sequencing. Say "every copy angle is grounded — you can map it back to concrete evidence."

---

## 5 · Closing the loop — rate, record, refine — *0:45*

**🖥 Do:** On a recommendation, click **thumbs up/down**. Under a variant, expand **"Record campaign result"** and paste a number (e.g. reply rate 4.2%, hypothesis confirmed). Then click **"Refine with feedback"** in the Execution Plan header.

**🎤 Say:**
> "And this is what makes it a *system*, not a one-shot tool — it closes the loop. I rate the recommendations. I record what actually happened in the real campaign — say, *the ROI angle got three times the replies.* Then I click **Refine with feedback**, and the engine re-runs, grounded in my real outcomes: it keeps the hypotheses that were confirmed, inverts the ones that failed, and never reuses a subject line that flopped.
>
> So across cycles, Veracity measurably learns *my* market — research, execute, feedback, refine."

**💡 Talking point:** Outcomes persist across sessions (`recommendation_feedback`, `variant_results`). This is measurable learning — the strongest "product" story.

---

## 6 · It generalises + the close — *0:30*

**🖥 Do:** Return to **Home**. Gesture at the tracked companies / the ask box.

**🎤 Say:**
> "One last thing — nothing here is hard-coded to telecom. I can point Veracity at *any* product or market — a tea exporter facing new EU rules, an AI SDR tool, whatever you name — and the same nine agents, the same grounding, the same loop apply. It even remembers my company context across sessions, so I never repeat myself.
>
> So that's Veracity AI: ask a question, get boardroom-quality, sourced, confidence-scored intelligence in a minute, turn it into shipped campaigns, and let it learn from the results. Thank you — happy to take any question or run one live for you right now."

**💡 If a judge names a product:** run it live. The best possible ending is answering *their* question on *their* company.

---

## 🎯 Scoring cheat-sheet — say these phrases on purpose

| Judging criterion | Say this, on this screen |
|---|---|
| **Multi-agent system** | "Six research + three execution agents, fanned out in parallel, each making its own live tool calls." *(agent grid)* |
| **Product design** | "Findings render as interfaces — charts, matrices, scorecards — inline, not a text dump." *(intelligence summary)* |
| **Intelligence quality** | "Every claim is sourced and confidence-scored; facts are separated from interpretation." *(expanded agent card)* |
| **Scalability / cost** | "About half a cent a query; we show cost, latency, and call count on every run." *(summary header)* |
| **Demo strength** | "Live signals now, and it generalises to any product you name." *(offer to run their query)* |

## 🛟 If something breaks
- **A run stalls / a tool fails:** don't panic — narrate it. *"One source failed, watch it fall back — the run still completes."* Graceful degradation is a feature, not a bug.
- **Network dies completely:** switch to the backup recording, keep narrating the same beats.
- **Execution doesn't trigger:** make sure the query uses a generation verb — *write, draft, generate, create* — plus a marketing artifact.

## ⏳ 90-second cut (if you're time-boxed)
Beat 1 (hook) → Beat 3 (one live run + sources + cost) → Beat 4 (one line: "and it turns that into a grounded campaign") → Beat 6 (close). Skip Home tour and the feedback loop; mention them in one sentence.
