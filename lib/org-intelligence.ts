import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { withTenantScope, type TenantContext } from '@/lib/tenant';

export type OrgIntelligence = {
  workspace: {
    id: string;
    name: string;
    industry: string | null;
    timezone: string | null;
    logo_url: string | null;
  } | null;
  watchlists: {
    active: number;
    healthy: number;
    degraded: number;
    stale: number;
    paused: number;
  };
  alerts: {
    unread: number;
    high: number;
    medium: number;
    low: number;
  };
  jobs: {
    successful: number;
    failed: number;
    averageRuntimeMs: number | null;
  };
  decisions: {
    total: number;
    accepted: number;
    acceptanceRate: number | null;
    recent: Array<{
      id: string;
      title: string;
      decision: string;
      outcome: string;
      confidence: number;
      reason: string;
      created_at: string;
    }>;
  };
  trends: Array<{ competitor: string; eventCount: number }>;
  operatingRhythm: {
    profileSnapshots30d: number;
    materialProfileDiffs30d: number;
    latestBoardPackAt: string | null;
    boardPackStale: boolean;
    actions: string[];
  };
};

export async function getOrgIntelligence(
  ctx: TenantContext,
  workspaceMeta?: {
    id: string;
    name: string;
    industry: string | null;
    timezone: string | null;
    logo_url: string | null;
  } | null,
): Promise<OrgIntelligence> {
  const scope = withTenantScope(ctx, 1);

  const watchlists = await query<{ health_status: string; enabled: boolean; count: string }>(
    `SELECT health_status, enabled, count(*)::text AS count
     FROM watchlists
     WHERE ${scope.sql}
     GROUP BY health_status, enabled`,
    scope.params,
  );

  const wl = {
    active: 0,
    healthy: 0,
    degraded: 0,
    stale: 0,
    paused: 0,
  };
  for (const row of watchlists.rows) {
    const n = Number(row.count);
    if (row.enabled) wl.active += n;
    if (row.health_status === 'healthy') wl.healthy += n;
    else if (row.health_status === 'degraded') wl.degraded += n;
    else if (row.health_status === 'stale') wl.stale += n;
    else if (row.health_status === 'paused') wl.paused += n;
  }

  const alerts = await query<{ severity: string; unread: string }>(
    `SELECT severity, count(*) FILTER (WHERE read_at IS NULL)::text AS unread
     FROM alert_events
     WHERE ${scope.sql}
     GROUP BY severity`,
    scope.params,
  );
  const al = { unread: 0, high: 0, medium: 0, low: 0 };
  for (const row of alerts.rows) {
    const n = Number(row.unread);
    al.unread += n;
    if (row.severity === 'high') al.high += n;
    else if (row.severity === 'medium') al.medium += n;
    else if (row.severity === 'low') al.low += n;
  }

  const jobs = await query<{
    successful: string;
    failed: string;
    avg_ms: string | null;
  }>(
    `SELECT
       count(*) FILTER (WHERE status = 'completed')::text AS successful,
       count(*) FILTER (WHERE status = 'failed')::text AS failed,
       avg(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)
         FILTER (WHERE status = 'completed' AND started_at IS NOT NULL AND finished_at IS NOT NULL)::text AS avg_ms
     FROM research_jobs
     WHERE ${scope.sql}`,
    scope.params,
  );

  const decisionStats = await query<{ total: string; accepted: string }>(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE decision = 'accepted')::text AS accepted
     FROM decision_memory
     WHERE ${scope.sql}`,
    scope.params,
  );

  const recentDecisions = await query<{
    id: string;
    title: string;
    decision: string;
    outcome: string;
    confidence: number;
    reason: string;
    created_at: string;
  }>(
    `SELECT id, title, decision, outcome, confidence, reason, created_at
     FROM decision_memory
     WHERE ${scope.sql}
     ORDER BY created_at DESC
     LIMIT 8`,
    scope.params,
  );

  const trends = await query<{ competitor: string; event_count: string }>(
    `SELECT competitor, count(*)::text AS event_count
     FROM competitive_events
     WHERE ${scope.sql}
       AND event_date >= (CURRENT_DATE - INTERVAL '30 days')
     GROUP BY competitor
     ORDER BY count(*) DESC
     LIMIT 8`,
    scope.params,
  );
  const profileActivity = await query<{
    snapshots: string;
    material: string;
  }>(
    `SELECT
       count(*)::text AS snapshots,
       count(*) FILTER (WHERE material_event_count > 0)::text AS material
     FROM competitor_profile_snapshots
     WHERE ${scope.sql}
       AND observed_at >= now() - interval '30 days'`,
    scope.params,
  );
  const boardPack = await query<{ generated_at: string }>(
    `SELECT generated_at
     FROM board_pack_snapshots
     WHERE ${scope.sql}
     ORDER BY generated_at DESC
     LIMIT 1`,
    scope.params,
  );

  const total = Number(decisionStats.rows[0]?.total ?? 0);
  const accepted = Number(decisionStats.rows[0]?.accepted ?? 0);
  const latestBoardPackAt = boardPack.rows[0]?.generated_at ?? null;
  const boardPackStale = !latestBoardPackAt ||
    Date.now() - Date.parse(latestBoardPackAt) > 7 * 24 * 60 * 60 * 1000;
  const actions = [
    ...(wl.stale > 0 ? [`Resume or repair ${wl.stale} stale watchlist(s).`] : []),
    ...(al.high > 0 ? [`Review ${al.high} unread high-severity alert(s).`] : []),
    ...(boardPackStale ? ['Refresh the 30-day continuous board pack.'] : []),
  ];

  return {
    workspace: workspaceMeta ?? null,
    watchlists: wl,
    alerts: al,
    jobs: {
      successful: Number(jobs.rows[0]?.successful ?? 0),
      failed: Number(jobs.rows[0]?.failed ?? 0),
      averageRuntimeMs: jobs.rows[0]?.avg_ms ? Number(jobs.rows[0].avg_ms) : null,
    },
    decisions: {
      total,
      accepted,
      acceptanceRate: total > 0 ? accepted / total : null,
      recent: recentDecisions.rows,
    },
    trends: trends.rows.map((r) => ({
      competitor: r.competitor,
      eventCount: Number(r.event_count),
    })),
    operatingRhythm: {
      profileSnapshots30d: Number(profileActivity.rows[0]?.snapshots ?? 0),
      materialProfileDiffs30d: Number(profileActivity.rows[0]?.material ?? 0),
      latestBoardPackAt,
      boardPackStale,
      actions,
    },
  };
}

export function orgIntelligenceEnabled(): boolean {
  return featureFlags.orgIntelligence && featureFlags.workspaces;
}
