# Veracity — The Guided Tour

**Who this is for:** anyone demoing Veracity to a prospective customer.

Read it once before your first demo. It gives you the words for every screen,
the reason each thing exists, and the honest answer to the hard questions. You
do not need to be technical to run this demo.

**How long:** 15 minutes for the full tour. 5 minutes for the short version
(marked ⚡ throughout).

---

## Part 0 — What you are actually selling

Before you open anything, you need to be able to say this in your own words.

### The problem your buyer has

They are a founder, product marketer, or growth lead at a company with three to
ten competitors. Once a week — or once a month, or the night before a board
meeting — they do the same thing:

- Open eight browser tabs of competitor pricing pages
- Skim a few news results
- Try to remember what the pricing said last time
- Realise they cannot remember
- Make a decision anyway

**They are not short of information. They are short of a memory.**

### Why "just use ChatGPT" is not the answer

Your buyer will think this. Say it before they do:

> "You could ask ChatGPT this same question. It would give you a good answer,
> today. Ask it again next month and it starts from scratch — it does not
> remember what the price was last time, so it cannot tell you what changed.
> That is the whole job."

The distinction, in one line:

| A chatbot | Veracity |
|---|---|
| Answers the question you asked | Tells you what changed since you last looked |
| Starts fresh every time | Remembers what things looked like before |
| Cites a page | Shows you the sentence |
| Sounds equally confident about everything | Says when it does not know |

### The promise

> **Know what changed, prove it, and decide what to do next.**

Everything in the demo supports one of those three words: **know**, **prove**,
**decide**.

---

## Part 1 — Signing in ⚡

**Screen:** the login page.

**What to say:**

> "Nothing here goes to a third party. The account, the research, and the saved
> evidence all live in your own database. If you self-host, nothing leaves your
> infrastructure except the requests we make to read public web pages."

**Do:** create an account with an email and password. It takes about three
seconds.

**Why it matters to them:** competitive research is commercially sensitive. The
first unspoken question is "who else sees this?" Answer it before they ask.

---

## Part 2 — Setting up a Market Project ⚡

**Screen:** click **New Market Project** in the sidebar.

This is the only setup the product ever asks for. Say that out loud — buyers
brace for a long onboarding.

**Fill in:**

| Field | What to enter | Why it is asked |
|---|---|---|
| **Project name** | e.g. "Q3 pricing decision" | So they can run several in parallel |
| **Your product** | Their company name | Everything is framed relative to them |
| **Product URL** | Their website | We read their own pages too |
| **Competitors** | Three to ten names | Who to watch |
| **The decision you care about** | e.g. "pricing", "roadmap", "positioning" | **The most important field** — see below |

**What to say about the decision field:**

> "This one field changes everything downstream. If you tell it you are working
> on pricing, a competitor's pricing change gets flagged as important and a
> documentation tweak does not. Same data, different priorities, because it
> knows what you are trying to decide."

**Why it matters:** this is the difference between a monitoring feed and a
decision tool. A feed shows you everything. This shows you what bears on your
question.

---

## Part 3 — The first collection

**Screen:** press **Collect** on the project.

**What happens:** the product visits the pages you pointed it at — pricing,
changelog, blog — and saves exactly what they said today.

**What to say while it runs:**

> "It is reading their pricing page and saving the actual words, not a summary.
> That matters for the next part."

**When it finishes,** you will see a short report: how many sources it checked,
how many it could read, and how many it could not.

**Important framing:**

> "Notice it tells you what it *could not* read. Most tools quietly skip those.
> If it cannot open a page, you need to know — otherwise you will read 'nothing
> changed' as 'nothing happened', and those are very different."

### If the first run finds no changes

It will. Say this:

> "First run finds nothing by design. It has nothing to compare against yet —
> it is establishing what things look like today. The value starts on the second
> visit."

This is a strength, not an apology. A tool that reported "changes" on its first
run would be making them up.

---

## Part 4 — The dashboard: what changed ⚡

**Screen:** the project dashboard. This is the product.

### 4.1 — "What changed while you were away"

The top section. Read one aloud:

> **Worth acting on**
> *Lilian changed their pricing: $49/month → $59/month — spotted today.*
> A big change, from a source we trust, on something relevant to your current
> decision.
> *Worth checking whether your own pricing still sits where you want it to.*

**What to point out, in order:**

1. **"Worth acting on"** — not a score, not a percentage. The system already
   decided how much this matters, so the user does not have to.
2. **The sentence** — a complete thought. Old price, new price, when it was
   spotted.
3. **Why it says that** — trusted source, big move, relevant to *their* stated
   decision.
4. **The suggestion** — phrased as a question, never an order.

**What to say:**

> "It has done the interpreting. You do the deciding. Nowhere does it ask you
> to work out what a 0.85 confidence score means."

### 4.2 — "Nothing changed" is a real answer

If the digest is empty, do not skip past it. Read it:

> *Nothing worth your attention changed. We checked every source and compared it
> against last time. Prices, packaging, releases and positioning are all where
> you left them.*

**What to say:**

> "This is thirty seconds that would otherwise have been forty minutes of tab
> opening. A product that only speaks when it has news teaches you that silence
> means it is broken. This one tells you it looked."

**This slide sells the subscription.** Most weeks nothing happens. The value is
knowing that with confidence, cheaply.

### 4.3 — The smaller changes it did not interrupt you for

Below the list: *"3 smaller changes we did not interrupt you for."* Expand it.

**What to say:**

> "It saw more than it showed you, and it will tell you exactly why each one was
> held back. You are never wondering whether it missed something."

---

## Part 5 — Prove it: the evidence drawer ⚡

**This is the moment that wins the deal. Do not rush it.**

**Do:** click **See the quote** on any change.

A panel slides in showing:

- **The exact sentence** from the page, in quotation marks
- **Definitely them** / **Probably them** — whether it is really that company
- **When we read it**
- **A link to the page**
- **A page version** fingerprint

**What to say:**

> "Every number in this product opens onto the sentence it came from. Not the
> page — the sentence. If someone in a board meeting asks where a figure came
> from, you click twice."

**Then say the harder thing:**

> "And when there is no quote, it says so. It will tell you 'this is our reading,
> not something a source stated.' Most tools present both with equal confidence."

### The "Definitely them" label

Worth explaining:

> "Company names are ambiguous. There are several companies called Lilian. If it
> cannot confirm a page is about the right one, it says 'Probably them' and treats
> anything built on it more carefully. You can correct it, and when you do, every
> finding that relied on it gets downgraded automatically."

**Why it matters:** this is the failure mode that destroys trust in competitive
tools — confidently telling you about the wrong company.

---

## Part 6 — Reading the charts

**Screen:** scroll to **Charts from stored evidence**.

### 6.1 — Every chart leads with a sentence

> *Entry-tier price went from $49/month to $59/month between January and March,
> a 20% rise.*
> Read directly from the sources, which you can open.

**What to say:**

> "You do not have to read the chart to get the finding. The chart is there if
> you want to see the shape."

### 6.2 — The three kinds of number ⚡

This is the single most important concept in the product. Teach it once:

| Label | Means | Trust it for |
|---|---|---|
| **Read from the source** | Copied from the page. Nobody interpreted it. | Anything. This is fact. |
| **Worked out by us** | We calculated it from things we collected. | Trends and comparisons — the calculation is shown. |
| **Simulated opinion** | A model played a role and gave a view. | Finding objections. **Never** as evidence about the market. |

**What to say:**

> "Most tools give you one confidence number and hope you do not ask what it
> means. This tells you the *kind* of number you are looking at, which is a more
> useful question."

### 6.3 — Gaps stay gaps

If a chart has a break in the line, point at it:

> "That gap means we did not have a reading that month. It is not zero. Filling
> it in would draw a line through data that does not exist — which is how charts
> lie without anybody intending it."

### 6.4 — "How do we know this?"

Click it. It shows what was counted, the unit, the period, how many readings,
and the exact calculation — plus a link to the quotes behind it.

**What to say:**

> "This is one click away and never in your face. The person who needs it can
> find it; everyone else never sees it."

### 6.5 — When it refuses to draw a chart

Sometimes you will see *"We cannot draw this yet"* with a reason like
*"observations use incompatible units."*

**Do not apologise for this. Sell it:**

> "It just refused to draw you a chart because the numbers were in two different
> currencies. It could have drawn something. It told you why it would have been
> wrong instead."

---

## Part 7 — The full history

**Screen:** **Everything we have seen — including the small things.**

The dashboard shows what deserves attention. This shows everything, including
what was held back, each marked *"we did not interrupt you for this."*

**What to say:**

> "When you are actually investigating a competitor, you want the quiet moves
> too. The filtering protects your attention day to day — it does not hide
> history."

### The coverage table

Below it: what has been read per competitor, and when.

**What to say, carefully:**

> "This is what we have actually read. If it says 'Never checked' next to their
> changelog, that means we cannot tell you what is on it — not that they have
> not shipped anything. That is an important difference and most tools blur it."

**Why it matters:** it tells them how much to trust everything else on screen.

---

## Part 8 — Asking questions ⚡

**Screen:** the composer at the bottom.

### 8.1 — Attach what you are asking about

Click **Attach evidence** and pick a chart or a change.

**What to say:**

> "Now the question carries the chart with it. You do not have to describe which
> one you meant, and it cannot answer about the wrong thing."

### 8.2 — Asking about research it already has is nearly free

Ask something like *"why did they raise the price?"*

**What to say:**

> "That question just got answered from what it already collected — one step, a
> couple of seconds. It did not go and re-research the market. Follow-up
> questions should not cost the same as the original research, and here they do
> not."

### 8.3 — When it needs fresh data, it says so

If the stored evidence is too old, it will say *"the newest stored evidence is
40 days old"* rather than quietly running an expensive sweep.

**What to say:**

> "It will not spend your money without telling you. It tells you why it needs
> to look again and lets you decide."

---

## Part 9 — Testing a decision against simulated buyers

**Screen:** **Swarm Decision Lab**.

⚠️ **Frame this carefully. Oversell it and you lose credibility on everything
else you have shown.**

**Open with the limitation, not the feature:**

> "This is the one part of the product that is not evidence. It generates
> simulated buyers and asks them about a decision. They are not real customers,
> it is not a survey, and it is not a prediction. What it is good at is finding
> the objection you had not thought of."

### 9.1 — Review before running

Click **Stress-test a decision**. It shows you the brief *before* anything runs:

- The decision, and the alternatives
- Who is on the panel
- **Facts** it will be given — with a tick, traceable
- **Assumptions** — editable, and clearly marked as not established

**What to say:**

> "It shows you what it is about to assume before it runs. If a question smuggles
> in an assumption, the answer inherits it and you never notice. This is where
> you catch that."

### 9.2 — Reading the result

- **Counts, never percentages.** "7 of 12 personas" — because there is no
  sample, so a percentage would imply something untrue.
- **Dissent gets equal weight.** A 7–5 split and a 12–0 split mean completely
  different things.
- **Unanimity is flagged as suspicious**, not celebrated.
- **Every persona's actual words** are one click away.

**What to say:**

> "If everyone agrees, it tells you that probably reflects how you framed the
> question rather than genuine consensus. It argues with itself so you do not
> have to."

### 9.3 — Change one assumption and compare

Edit an assumption and re-run. It creates a **new version** and keeps the
original.

**What to say:**

> "'What if they cut price again?' — you change one line, run it, and compare
> against the original. That comparison is the whole point, which is why it never
> overwrites."

---

## Part 10 — Correcting it

**Screen:** **Is this evidence about the right company?**

**What to say:**

> "Matching a page to a company is a guess, and when it guesses wrong, everything
> built on that page inherits the mistake. So you can correct it. Mark something
> as the wrong company and every finding that relied on it is downgraded — and it
> tells you how many."

**Why this closes deals with careful buyers:** it is an admission of fallibility
with a remedy attached. That reads as confidence, not weakness.

---

## Part 11 — It keeps working while nobody is looking

**What to say:**

> "It re-checks your sources every week on its own. When a page has not changed,
> that costs almost nothing — which is why weekly monitoring is affordable at all.
> You come back and it tells you what moved."

**The economic argument, if they ask about cost:**

> "Re-researching everything weekly would be expensive. Checking whether a page
> changed and stopping when it has not is cheap. That is the difference between a
> tool you run occasionally and one that just runs."

---

## Part 12 — Closing: the three questions

End the demo here every time.

> "Three questions, in order.
>
> **What changed?** — the dashboard, in thirty seconds, every Monday.
>
> **How do you know?** — the exact sentence, from the page, on the date it said
> it.
>
> **What should we do?** — a decision you can trace back to evidence, with what
> would change your mind written down.
>
> Everything you have seen serves one of those three."

---

## The hard questions, and honest answers

**Never bluff these.** A buyer who catches an overclaim stops believing the rest.

| They ask | Say |
|---|---|
| *"Does it use AI?"* | "For reading pages and writing the analysis, yes. Not for the numbers — those are read from pages or counted from records. The AI never invents a figure." |
| *"How accurate is it?"* | "Every number opens onto the sentence it came from, so you can check any of them in two clicks. Where it is unsure, it says so rather than guessing." |
| *"What if it is wrong about a competitor?"* | "You correct it in one click, and everything built on that gets downgraded automatically." |
| *"Can it predict what they will do?"* | "No, and it will not pretend to. The simulated panel finds objections you had not considered — it is not a forecast." |
| *"How is this different from Klue or Crayon?"* | "They are built for enabling a sales team — battlecards, distribution. This is built for the person deciding what to do next. Smaller, and it proves every claim." |
| *"What does it cost to run?"* | "Most weeks nothing changes, and confirming that is nearly free. Cost scales with change, not with time." |
| *"Is my research private?"* | "It lives in your own database. Self-hosted, nothing leaves your infrastructure except reading public pages." |
| *"What can it not do?"* | "It reads public sources — pricing pages, changelogs, filings, news, reviews. It cannot see inside their company, their roadmap, or their actual sales numbers. Nothing can, and anything claiming otherwise is guessing." |

---

## Demo checklist

Run through this before every demo.

- [ ] Project already created with **real competitors your buyer recognises**
- [ ] **Two collections already run** so there is a genuine change to show —
      a demo with an empty dashboard is a demo with no product
- [ ] At least one change with a quote behind it
- [ ] At least one chart with more than two points
- [ ] Know your buyer's decision — set the project's decision field to match
- [ ] Have the **hard questions** table open in another window

### If something is missing

- **No changes yet?** Show the empty state and sell "nothing changed is an
  answer." It is a real part of the pitch.
- **A chart refuses to draw?** Show it. Refusing to draw a misleading chart is a
  feature.
- **A source failed to load?** Show that too. "It tells you what it could not
  read" is stronger than pretending everything worked.

**The strongest demo is an honest one.** This product's entire pitch is that it
tells you the truth including the inconvenient parts. A demo that hides its
limits contradicts the thing you are selling.
