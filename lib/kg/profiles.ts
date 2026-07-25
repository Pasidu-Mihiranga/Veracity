import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { normalizeEntityKey } from '@/lib/kg/normalize';
import {
  buildTrendSummaries,
  trendHeadlineFromHistogram,
} from '@/lib/monitoring/trend-summary';

export type CompetitorProfileRow = {
  id: string;
  workspace_id: string;
  competitor_key: string;
  display_name: string;
  summary: string;
  website_url: string | null;
  trend_headline: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  props: Record<string, unknown>;
  projected_at: string;
};

type DomainEventRow = {
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
};

/** Rebuild competitor_profiles projection from immutable kg_domain_events. */
export async function projectCompetitorProfile(
  workspaceId: string,
  competitorKeyOrName: string,
): Promise<CompetitorProfileRow | null> {
  if (!featureFlags.competitorProfiles && !featureFlags.evidenceGraph) return null;

  const key = normalizeEntityKey(competitorKeyOrName);
  const { rows: events } = await query<DomainEventRow>(
    `SELECT event_type, payload, occurred_at
     FROM kg_domain_events
     WHERE workspace_id = $1 AND aggregate_type = 'competitor' AND aggregate_key = $2
     ORDER BY occurred_at ASC
     LIMIT 500`,
    [workspaceId, key],
  );

  if (events.length === 0) {
    const { rows: nodes } = await query<{ label: string; created_at: string }>(
      `SELECT label, created_at FROM kg_nodes
       WHERE workspace_id = $1 AND kind = 'competitor' AND key = $2 AND archived_at IS NULL
       LIMIT 1`,
      [workspaceId, key],
    );
    if (!nodes[0]) return null;
    const { rows } = await query<CompetitorProfileRow>(
      `INSERT INTO competitor_profiles (
         workspace_id, competitor_key, display_name, summary, first_seen_at, last_seen_at, projected_at
       ) VALUES ($1,$2,$3,$4,$5,$5,now())
       ON CONFLICT (workspace_id, competitor_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         projected_at = now(),
         updated_at = now()
       RETURNING *`,
      [workspaceId, key, nodes[0].label, 'Observed in knowledge graph.', nodes[0].created_at],
    );
    return rows[0];
  }

  const displayName =
    (typeof events[0].payload.displayName === 'string' && events[0].payload.displayName) ||
    competitorKeyOrName;
  const first = events[0].occurred_at;
  const last = events[events.length - 1].occurred_at;

  const trendEvents = events.map((ev) => ({
    competitor: displayName,
    category: String(ev.payload.category ?? (ev.event_type.replace(/^signal\./, '') || 'other')),
    title: typeof ev.payload.title === 'string' ? ev.payload.title : ev.event_type,
  }));

  const counts: Record<string, number> = {};
  for (const e of trendEvents) {
    counts[e.category] = (counts[e.category] ?? 0) + 1;
  }
  const summaries = buildTrendSummaries(trendEvents, 1);
  const headline = summaries[0]?.overallTrend ?? trendHeadlineFromHistogram(counts);

  const summary =
    trendEvents
      .map((t) => t.title)
      .slice(-3)
      .reverse()
      .join(' · ') || `${events.length} signals projected from domain events.`;

  const { rows } = await query<CompetitorProfileRow>(
    `INSERT INTO competitor_profiles (
       workspace_id, competitor_key, display_name, summary, trend_headline,
       first_seen_at, last_seen_at, props, projected_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now(),now())
     ON CONFLICT (workspace_id, competitor_key) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       summary = EXCLUDED.summary,
       trend_headline = EXCLUDED.trend_headline,
       first_seen_at = EXCLUDED.first_seen_at,
       last_seen_at = EXCLUDED.last_seen_at,
       props = EXCLUDED.props,
       projected_at = now(),
       updated_at = now()
     RETURNING *`,
    [
      workspaceId,
      key,
      displayName,
      summary.slice(0, 800),
      headline,
      first,
      last,
      JSON.stringify({ eventCount: events.length, categoryCounts: counts }),
    ],
  );
  return rows[0];
}

export async function listCompetitorProfiles(
  workspaceId: string,
): Promise<CompetitorProfileRow[]> {
  const { rows } = await query<CompetitorProfileRow>(
    `SELECT * FROM competitor_profiles
     WHERE workspace_id = $1
     ORDER BY last_seen_at DESC NULLS LAST
     LIMIT 100`,
    [workspaceId],
  );
  return rows;
}

export async function listDomainEventsAsOf(
  workspaceId: string,
  competitorKey: string,
  asOf?: Date,
): Promise<DomainEventRow[]> {
  const key = normalizeEntityKey(competitorKey);
  if (asOf) {
    const { rows } = await query<DomainEventRow>(
      `SELECT event_type, payload, occurred_at
       FROM kg_domain_events
       WHERE workspace_id = $1 AND aggregate_type = 'competitor' AND aggregate_key = $2
         AND occurred_at <= $3
       ORDER BY occurred_at ASC
       LIMIT 500`,
      [workspaceId, key, asOf.toISOString()],
    );
    return rows;
  }
  const { rows } = await query<DomainEventRow>(
    `SELECT event_type, payload, occurred_at
     FROM kg_domain_events
     WHERE workspace_id = $1 AND aggregate_type = 'competitor' AND aggregate_key = $2
     ORDER BY occurred_at ASC
     LIMIT 500`,
    [workspaceId, key],
  );
  return rows;
}
