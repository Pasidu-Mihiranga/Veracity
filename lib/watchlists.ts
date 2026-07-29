import { query } from '@/lib/db';
import {
  computeHealthStatus,
  nextScheduledSweepUtc,
  type HealthStatus,
  type WatchlistCadence,
} from '@/lib/monitoring/health';
import { featureFlags } from '@/lib/feature-flags';
import { withTenantScope } from '@/lib/tenant';

export type WatchlistRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  product: string;
  enabled: boolean;
  last_sweep_at: string | null;
  next_sweep_at: string | null;
  health_status: HealthStatus;
  cadence: WatchlistCadence;
  max_competitors: number;
  weekly_alert_budget: number;
  alert_channels: string[];
  last_sweep_summary: {
    materialEvents?: number;
    suppressedSignals?: number;
    limitations?: string[];
  };
  created_at: string;
  updated_at: string;
};

export type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
  competitor: string;
  competitor_url: string | null;
  enabled: boolean;
  created_at: string;
};

export async function ensureWatchlistTablesExist(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id  uuid,
      name          text NOT NULL,
      product       text NOT NULL,
      enabled       boolean NOT NULL DEFAULT true,
      last_sweep_at timestamptz,
      next_sweep_at timestamptz,
      health_status text NOT NULL DEFAULT 'stale',
      cadence      text NOT NULL DEFAULT 'weekly',
      max_competitors integer NOT NULL DEFAULT 6,
      weekly_alert_budget integer NOT NULL DEFAULT 12,
      alert_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
      last_sweep_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS watchlist_items (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      watchlist_id   uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
      competitor     text NOT NULL,
      competitor_url text,
      enabled        boolean NOT NULL DEFAULT true,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
  `).catch(() => null);
  await query(`
    ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'weekly';
    ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS max_competitors integer NOT NULL DEFAULT 6;
    ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS weekly_alert_budget integer NOT NULL DEFAULT 12;
    ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS alert_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[];
    ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS last_sweep_summary jsonb NOT NULL DEFAULT '{}'::jsonb;
  `).catch(() => null);
}

export async function listWatchlists(
  userId: string,
  workspaceId?: string | null,
): Promise<WatchlistRow[]> {
  await ensureWatchlistTablesExist();
  const scope = withTenantScope(
    { userId, workspaceId: workspaceId ?? null },
    1,
  );
  const { rows } = await query<WatchlistRow>(
    `SELECT * FROM watchlists WHERE ${scope.sql} ORDER BY created_at DESC`,
    scope.params,
  );
  return rows;
}

export async function getWatchlistForUser(
  id: string,
  userId: string,
  workspaceId?: string | null,
): Promise<WatchlistRow | null> {
  await ensureWatchlistTablesExist();
  const scope = withTenantScope(
    { userId, workspaceId: workspaceId ?? null },
    2,
  );
  const { rows } = await query<WatchlistRow>(
    `SELECT * FROM watchlists WHERE id = $1 AND ${scope.sql}`,
    [id, ...scope.params],
  );
  return rows[0] ?? null;
}

export async function createWatchlist(input: {
  userId: string;
  workspaceId?: string | null;
  name: string;
  product: string;
  enabled?: boolean;
  cadence?: WatchlistCadence;
  maxCompetitors?: number;
  weeklyAlertBudget?: number;
  alertChannels?: string[];
}): Promise<WatchlistRow> {
  await ensureWatchlistTablesExist();
  const cadence = input.cadence ?? 'weekly';
  const next = nextScheduledSweepUtc(cadence);
  const enabled = input.enabled !== false;
  const maxCompetitors = clamp(input.maxCompetitors ?? 6, 1, 12);
  const weeklyAlertBudget = clamp(input.weeklyAlertBudget ?? 12, 1, 50);
  const alertChannels = normalizeAlertChannels(input.alertChannels);
  if (featureFlags.workspaces && input.workspaceId) {
    const { rows } = await query<WatchlistRow>(
      `INSERT INTO watchlists (
         user_id, workspace_id, name, product, enabled, next_sweep_at, health_status,
         cadence, max_competitors, weekly_alert_budget, alert_channels
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.userId,
        input.workspaceId,
        input.name,
        input.product,
        enabled,
        next.toISOString(),
        enabled ? 'stale' : 'paused',
        cadence,
        maxCompetitors,
        weeklyAlertBudget,
        alertChannels,
      ],
    );
    return rows[0];
  }
  const { rows } = await query<WatchlistRow>(
    `INSERT INTO watchlists (
       user_id, name, product, enabled, next_sweep_at, health_status,
       cadence, max_competitors, weekly_alert_budget, alert_channels
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.product,
      enabled,
      next.toISOString(),
      enabled ? 'stale' : 'paused',
      cadence,
      maxCompetitors,
      weeklyAlertBudget,
      alertChannels,
    ],
  );
  return rows[0];
}

export async function updateWatchlist(
  id: string,
  userId: string,
  patch: Partial<{
    name: string;
    product: string;
    enabled: boolean;
    last_sweep_at: string | null;
    next_sweep_at: string | null;
    health_status: HealthStatus;
    cadence: WatchlistCadence;
    max_competitors: number;
    weekly_alert_budget: number;
    alert_channels: string[];
    last_sweep_summary: WatchlistRow['last_sweep_summary'];
  }>,
): Promise<WatchlistRow | null> {
  const current = await getWatchlistForUser(id, userId);
  if (!current) return null;

  const enabled = patch.enabled ?? current.enabled;
  const last = patch.last_sweep_at !== undefined ? patch.last_sweep_at : current.last_sweep_at;
  const health = patch.health_status
    ?? computeHealthStatus({
      enabled,
      lastSweepAt: last,
      lastSucceeded: patch.health_status === 'degraded' ? false : undefined,
      cadence: patch.cadence ?? current.cadence,
    });
  const cadence = patch.cadence ?? current.cadence;
  const next = patch.next_sweep_at
    ?? (
      enabled && (
        patch.cadence !== undefined
        || patch.enabled === true && !current.enabled
        || !current.next_sweep_at
      )
        ? nextScheduledSweepUtc(cadence).toISOString()
        : current.next_sweep_at
    );
  const maxCompetitors = clamp(patch.max_competitors ?? current.max_competitors, 1, 12);
  const weeklyAlertBudget = clamp(patch.weekly_alert_budget ?? current.weekly_alert_budget, 1, 50);
  const alertChannels = patch.alert_channels
    ? normalizeAlertChannels(patch.alert_channels)
    : current.alert_channels;

  const { rows } = await query<WatchlistRow>(
    `UPDATE watchlists SET
       name = COALESCE($1, name),
       product = COALESCE($2, product),
       enabled = $3,
       last_sweep_at = $4,
       next_sweep_at = $5,
       health_status = $6,
       cadence = $7,
       max_competitors = $8,
       weekly_alert_budget = $9,
       alert_channels = $10,
       last_sweep_summary = $11::jsonb,
       updated_at = now()
     WHERE id = $12 AND user_id = $13
     RETURNING *`,
    [
      patch.name ?? null,
      patch.product ?? null,
      enabled,
      last,
      next,
      health,
      cadence,
      maxCompetitors,
      weeklyAlertBudget,
      alertChannels,
      JSON.stringify(patch.last_sweep_summary ?? current.last_sweep_summary ?? {}),
      id,
      userId,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteWatchlist(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM watchlists WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listWatchlistItems(
  watchlistId: string,
  userId?: string,
): Promise<WatchlistItemRow[]> {
  if (userId) {
    const { rows } = await query<WatchlistItemRow>(
      `SELECT wi.* FROM watchlist_items wi
       JOIN watchlists w ON wi.watchlist_id = w.id
       WHERE wi.watchlist_id = $1 AND w.user_id = $2
       ORDER BY wi.created_at ASC`,
      [watchlistId, userId],
    );
    return rows;
  }
  const { rows } = await query<WatchlistItemRow>(
    `SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY created_at ASC`,
    [watchlistId],
  );
  return rows;
}

export async function addWatchlistItem(input: {
  watchlistId: string;
  competitor: string;
  competitorUrl?: string | null;
  userId?: string;
}): Promise<WatchlistItemRow | null> {
  if (input.userId) {
    const wl = await getWatchlistForUser(input.watchlistId, input.userId);
    if (!wl) return null;
    const items = await listWatchlistItems(input.watchlistId, input.userId);
    if (items.filter((item) => item.enabled).length >= wl.max_competitors) return null;
  }
  const { rows } = await query<WatchlistItemRow>(
    `INSERT INTO watchlist_items (watchlist_id, competitor, competitor_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.watchlistId, input.competitor, input.competitorUrl ?? null],
  );
  return rows[0];
}

export async function deleteWatchlistItem(
  itemId: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM watchlist_items wi
     USING watchlists w
     WHERE wi.id = $1 AND wi.watchlist_id = w.id AND w.user_id = $2`,
    [itemId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listEnabledMonitoringTargets(limitPerUser = 24): Promise<Array<{
  userId: string;
  watchlistId: string;
  product: string;
  competitor: string;
  competitorUrl: string | null;
}>> {
  await ensureWatchlistTablesExist();
  const { rows } = await query<{
    user_id: string;
    watchlist_id: string;
    product: string;
    competitor: string;
    competitor_url: string | null;
    item_rank: number;
    jobs_today: number;
  }>(
    `SELECT * FROM (
       SELECT w.user_id, w.id AS watchlist_id, w.product, wi.competitor, wi.competitor_url,
         ROW_NUMBER() OVER (PARTITION BY w.id ORDER BY wi.created_at ASC) AS item_rank,
         w.max_competitors,
         (
           SELECT count(*)::int
           FROM research_jobs j
           WHERE j.user_id = w.user_id
             AND j.request->>'kind' = 'monitoring'
             AND j.created_at >= date_trunc('day', now())
         ) AS jobs_today
       FROM watchlists w
       JOIN watchlist_items wi ON wi.watchlist_id = w.id
       WHERE w.enabled = true
         AND wi.enabled = true
         AND COALESCE(w.next_sweep_at, now()) <= now()
     ) t
     WHERE item_rank <= max_competitors
     ORDER BY user_id, watchlist_id, item_rank
     LIMIT 500`,
  );
  const perUser = new Map<string, number>();
  return rows.filter((row) => {
    const used = perUser.get(row.user_id) ?? 0;
    const remainingDailyBudget = Math.max(0, 24 - Number(row.jobs_today ?? 0));
    if (used >= Math.min(limitPerUser, remainingDailyBudget)) return false;
    perUser.set(row.user_id, used + 1);
    return true;
  }).map((r) => ({
      userId: r.user_id,
      watchlistId: r.watchlist_id,
      product: r.product,
      competitor: r.competitor,
      competitorUrl: r.competitor_url,
    }));
}

export async function markWatchlistSweepResult(input: {
  watchlistId: string;
  userId: string;
  succeeded: boolean;
}): Promise<void> {
  const now = new Date();
  const watchlist = await getWatchlistForUser(input.watchlistId, input.userId);
  if (!watchlist) return;
  await updateWatchlist(input.watchlistId, input.userId, {
    last_sweep_at: now.toISOString(),
    next_sweep_at: nextScheduledSweepUtc(watchlist.cadence, now).toISOString(),
    health_status: input.succeeded ? 'healthy' : 'degraded',
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeAlertChannels(channels?: string[]): string[] {
  const allowed = new Set(['in_app', 'email', 'slack']);
  const normalized = (channels ?? ['in_app']).filter((channel) => allowed.has(channel));
  return [...new Set(normalized.length > 0 ? normalized : ['in_app'])];
}
