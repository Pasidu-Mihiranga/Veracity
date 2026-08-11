/**
 * Mock data for the Home "Intelligence Stories" reel.
 *
 * These stand in for what will eventually be Veracity-AI-generated briefings
 * personalised to the companies a user tracks and the questions they have
 * searched. Nothing here is live — it is UI scaffolding only, so the reel and
 * the full-screen viewer have realistic shapes to render against.
 *
 * A `Story` is one bubble in the reel. Each story holds 1–4 `StorySegment`s,
 * the auto-advancing "pages" you tap through inside the viewer, exactly like a
 * social story — but every segment is a piece of growth intelligence.
 */

export type StoryKind =
  | 'ai-briefing'      // Veracity's own synthesised weekly/daily briefing
  | 'company-update'   // a tracked company moved (pricing, feature, positioning)
  | 'market-trend'     // where the category is heading, with a shape to show it
  | 'competitor-move'  // a rival did something worth reacting to
  | 'opportunity';     // an opening Veracity spotted for the user

export interface StorySegment {
  id: string;
  kind: StoryKind;
  /** Small mono eyebrow, e.g. "Dialog Axiata · Pricing". */
  eyebrow: string;
  headline: string;
  /** The AI-written narrative paragraph. */
  body: string;
  /** Optional custom content image path. */
  image?: string;
  /** Optional headline metric shown as a chip. `delta` sign drives its colour. */
  metric?: { label: string; value: string; delta?: number };
  /** Optional sparkline, oldest → newest. Rendered as a mini area under the metric. */
  spark?: number[];
  /** Relative time for the segment, e.g. "2h ago". */
  timeAgo: string;
  /** Optional call-to-action that would drop a question into the search box. */
  cta?: { label: string; query: string };
}

export interface Story {
  id: string;
  /** Card title. */
  title: string;
  kind: StoryKind;
  /** Whether the card shows as unseen (accented) or seen (muted). */
  seen: boolean;
  /** [from, to] gradient for the card accent and the viewer background wash. */
  gradient: [string, string];
  segments: StorySegment[];
}

export const HOME_STORIES: Story[] = [
  {
    id: 'briefing',
    title: 'Your briefing',
    kind: 'ai-briefing',
    seen: false,
    gradient: ['#2A78D6', '#334E9E'],
    segments: [
      {
        id: 'briefing-1',
        kind: 'ai-briefing',
        eyebrow: 'Veracity AI · Weekly briefing',
        headline: 'Three moves across your market this week',
        body: 'Telecom got busier while tea stayed quiet. Dialog cut 5G add-on pricing, SLT-Mobitel answered within 48 hours, and buyer chatter shifted toward data caps. Here is what actually matters for your next decision.',
        image: '/stories/briefing-1.png',
        metric: { label: 'Material changes', value: '3', delta: 2 },
        spark: [1, 0, 2, 1, 3, 2, 3],
        timeAgo: '2m ago',
        cta: { label: 'Summarise the week for me', query: 'Summarise what changed across my tracked companies this week and what I should do about it.' },
      },
      {
        id: 'briefing-2',
        kind: 'market-trend',
        eyebrow: 'Veracity AI · Signal',
        headline: 'Price is now the battleground in telecom',
        body: 'Two of the last three material moves were pricing, not features. When the leaders start competing on price, the window to defend margin narrows. Worth deciding your line before the next round.',
        image: '/stories/briefing-2.png',
        metric: { label: 'Pricing moves', value: '2 of 3' },
        timeAgo: '2m ago',
        cta: { label: 'Where is telecom pricing heading?', query: 'Where is telecom pricing heading and how should we respond?' },
      },
    ],
  },
  {
    id: 'dialog',
    title: 'Dialog Axiata',
    kind: 'company-update',
    seen: false,
    gradient: ['#3B6FB0', '#2A78D6'],
    segments: [
      {
        id: 'dialog-1',
        kind: 'company-update',
        eyebrow: 'Dialog Axiata · Pricing',
        headline: 'Cut its 5G add-on price 18%',
        body: 'The first pricing move in the segment this quarter. Dialog dropped the monthly 5G data add-on from LKR 1,490 to LKR 1,220 and pushed it hard on prepaid — a clear grab for volume ahead of the holiday cycle.',
        image: '/stories/dialog-1.png',
        metric: { label: 'Add-on price', value: '−18%', delta: -18 },
        spark: [1490, 1490, 1490, 1350, 1350, 1220, 1220],
        timeAgo: '2h ago',
        cta: { label: 'How should we respond to Dialog?', query: 'Dialog Axiata cut its 5G add-on price 18%. How should we respond?' },
      },
      {
        id: 'dialog-2',
        kind: 'competitor-move',
        eyebrow: 'Dialog Axiata · Positioning',
        headline: 'Leaning into "fastest 5G" messaging',
        body: 'Alongside the price cut, homepage and ad copy shifted from coverage to speed. This pairs a cheaper entry point with a performance claim — harder to counter on price alone.',
        image: '/stories/dialog-2.png',
        timeAgo: '5h ago',
      },
    ],
  },
  {
    id: 'slt',
    title: 'SLT-Mobitel',
    kind: 'competitor-move',
    seen: true,
    gradient: ['#64748B', '#475569'],
    segments: [
      {
        id: 'slt-1',
        kind: 'competitor-move',
        eyebrow: 'SLT-Mobitel · Response',
        headline: 'Answered Dialog within 48 hours',
        body: 'SLT-Mobitel matched the effective price with a bundled data boost rather than a headline cut — protecting its list price while neutralising the offer. A measured, margin-aware response.',
        image: '/stories/slt-1.png',
        metric: { label: 'Response time', value: '48h' },
        timeAgo: '1d ago',
        cta: { label: 'Compare Dialog and SLT-Mobitel', query: 'Compare Dialog Axiata and SLT-Mobitel. Who is winning right now?' },
      },
    ],
  },
  {
    id: 'market',
    title: 'Market trend',
    kind: 'market-trend',
    seen: false,
    gradient: ['#2F8F86', '#1F6F73'],
    segments: [
      {
        id: 'market-1',
        kind: 'market-trend',
        eyebrow: 'Telecom · Share of voice',
        headline: 'Dialog is pulling ahead on attention',
        body: 'Across search, news and social over the last 12 weeks, Dialog’s share of voice rose from 34% to 41% while SLT-Mobitel slipped. Attention is a leading indicator — it tends to move a quarter before subscriptions.',
        image: '/stories/market-1.png',
        metric: { label: 'Dialog share of voice', value: '41%', delta: 7 },
        spark: [34, 35, 34, 36, 38, 37, 39, 40, 39, 41, 41, 41],
        timeAgo: '3h ago',
        cta: { label: 'Where is the telecom market heading?', query: 'Where is the telecom market heading?' },
      },
    ],
  },
  {
    id: 'opportunity',
    title: 'Opportunity',
    kind: 'opportunity',
    seen: false,
    gradient: ['#5B6BA8', '#3F4E86'],
    segments: [
      {
        id: 'opp-1',
        kind: 'opportunity',
        eyebrow: 'Veracity AI · Opening',
        headline: 'Nobody owns "data caps" in the conversation',
        body: 'Buyer complaints about throttling are rising, but none of the three leaders is addressing caps head-on in their messaging. A clear, honest cap policy could be a wedge — the demand is showing up before anyone has answered it.',
        image: '/stories/opp-1.png',
        metric: { label: 'Complaint volume', value: '+31%', delta: 31 },
        spark: [8, 9, 11, 10, 13, 15, 18],
        timeAgo: '6h ago',
        cta: { label: 'Find gaps competitors are missing', query: 'What positioning gaps are telecom competitors leaving open right now?' },
      },
    ],
  },
];
