import type { EventCategory } from '@/lib/monitoring/severity';
import { isoWeekKey } from '@/lib/monitoring/dedupe';

export type CompetitiveEventLite = {
  id: string;
  competitor: string;
  title: string;
  summary: string;
  category: EventCategory | string;
  event_date: string;
  cluster_key: string;
};

export function buildClusterKey(input: {
  competitor: string;
  category: string;
  date?: Date | string;
}): string {
  const d = input.date
    ? typeof input.date === 'string'
      ? new Date(input.date)
      : input.date
    : new Date();
  const family = categoryFamily(input.category);
  return `${isoWeekKey(d)}|${input.competitor.trim().toLowerCase()}|${family}`;
}

function categoryFamily(category: string): string {
  if (category === 'pricing' || category === 'funding' || category === 'acquisition') return 'monetization';
  if (category === 'launch' || category === 'feature') return 'product';
  if (category === 'hiring' || category === 'leadership') return 'org';
  if (category === 'security') return 'risk';
  if (category === 'news') return 'market';
  if (category === 'docs' || category === 'sentiment') return 'signal';
  return 'other';
}

export type TimelineCluster = {
  clusterKey: string;
  competitor: string;
  weekLabel: string;
  categoryFamily: string;
  events: CompetitiveEventLite[];
};

/** Group events into weekly clusters (expandable in UI). */
export function clusterCompetitiveEvents(
  events: CompetitiveEventLite[],
): TimelineCluster[] {
  const map = new Map<string, CompetitiveEventLite[]>();
  for (const e of events) {
    const key = e.cluster_key || buildClusterKey({
      competitor: e.competitor,
      category: e.category,
      date: e.event_date,
    });
    const list = map.get(key) ?? [];
    list.push({ ...e, cluster_key: key });
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([clusterKey, evs]) => {
      const [weekLabel, competitor, family] = clusterKey.split('|');
      return {
        clusterKey,
        competitor: competitor ?? evs[0]?.competitor ?? '',
        weekLabel: weekLabel ?? '',
        categoryFamily: family ?? 'other',
        events: evs,
      };
    })
    .sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
}
