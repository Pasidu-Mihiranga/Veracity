import type { EventCategory } from '@/lib/monitoring/severity';

export type TrendEvent = {
  competitor: string;
  category: EventCategory | string;
  title: string;
};

export type CompetitorTrendSummary = {
  competitor: string;
  bullets: string[];
  overallTrend: string;
  eventCount: number;
};

const BULLET_BY_CATEGORY: Record<string, string> = {
  pricing: 'Increased or shifted pricing',
  launch: 'Released or launched a product',
  feature: 'Shipped AI / product features',
  hiring: 'Hiring or org changes',
  leadership: 'Leadership team changes',
  security: 'Security posture or incidents',
  docs: 'Documentation / changelog updates',
  sentiment: 'Community / sentiment signals',
  funding: 'Funding or M&A activity',
  acquisition: 'Acquisition or merger activity',
  news: 'Material market or company news',
  other: 'Other competitive moves',
};

/** Deterministic headline from category histogram. */
export function trendHeadlineFromHistogram(counts: Record<string, number>): string {
  const launch = (counts.launch ?? 0) + (counts.feature ?? 0);
  const pricing = counts.pricing ?? 0;
  const funding = counts.funding ?? 0;
  const acquisition = counts.acquisition ?? 0;
  const hiring = counts.hiring ?? 0;
  const leadership = counts.leadership ?? 0;
  const security = counts.security ?? 0;

  if (security >= 1) return 'Elevated risk posture';
  if (acquisition >= 1) return 'Market consolidation';
  if (launch >= 2 && pricing >= 1) return 'Aggressive expansion';
  if (launch >= 2 || (launch >= 1 && funding >= 1)) return 'Product acceleration';
  if (pricing >= 2 || (pricing >= 1 && launch === 0)) return 'Monetization push';
  if (hiring + leadership >= 2) return 'Org transformation';
  if (hiring + leadership === 1 && launch === 0 && pricing === 0) return 'Efficiency / consolidation';
  if (funding >= 1) return 'Capital-backed growth';
  if (launch + pricing + funding + hiring === 0) return 'Quiet / monitoring';
  return 'Mixed competitive motion';
}

export function buildTrendSummaries(
  events: TrendEvent[],
  minEvents = 2,
): CompetitorTrendSummary[] {
  const byComp = new Map<string, TrendEvent[]>();
  for (const e of events) {
    const list = byComp.get(e.competitor) ?? [];
    list.push(e);
    byComp.set(e.competitor, list);
  }

  const out: CompetitorTrendSummary[] = [];
  for (const [competitor, list] of byComp) {
    if (list.length < minEvents) continue;
    const counts: Record<string, number> = {};
    for (const e of list) {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    const bullets = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => BULLET_BY_CATEGORY[cat] ?? BULLET_BY_CATEGORY.other);
    out.push({
      competitor,
      bullets,
      overallTrend: trendHeadlineFromHistogram(counts),
      eventCount: list.length,
    });
  }
  return out.sort((a, b) => b.eventCount - a.eventCount);
}
