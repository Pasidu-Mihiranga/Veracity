import { query } from '@/lib/db';
import {
  computeHealthStatus,
  nextMondaySweepUtc,
  type HealthStatus,
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
}): Promise<WatchlistRow> {
  await ensureWatchlistTablesExist();
  const next = nextMondaySweepUtc();
  const enabled = input.enabled !== false;
  if (featureFlags.workspaces && input.workspaceId) {
    const { rows } = await query<WatchlistRow>(
      `INSERT INTO watchlists (user_id, workspace_id, name, product, enabled, next_sweep_at, health_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.workspaceId,
        input.name,
        input.product,
        enabled,
        next.toISOString(),
        enabled ? 'stale' : 'paused',
      ],
    );
    return rows[0];
  }
  const { rows } = await query<WatchlistRow>(
    `INSERT INTO watchlists (user_id, name, product, enabled, next_sweep_at, health_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.product,
      enabled,
      next.toISOString(),
      enabled ? 'stale' : 'paused',
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
    });
  const next = patch.next_sweep_at ?? (enabled ? nextMondaySweepUtc().toISOString() : current.next_sweep_at);

  const { rows } = await query<WatchlistRow>(
    `UPDATE watchlists SET
       name = COALESCE($1, name),
       product = COALESCE($2, product),
       enabled = $3,
       last_sweep_at = $4,
       next_sweep_at = $5,
       health_status = $6,
       updated_at = now()
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [
      patch.name ?? null,
      patch.product ?? null,
      enabled,
      last,
      next,
      health,
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

export async function listEnabledMonitoringTargets(limitPerUser = 3): Promise<Array<{
  userId: string;
  watchlistId: string;
  product: string;
  competitor: string;
}>> {
  const { rows } = await query<{
    user_id: string;
    watchlist_id: string;
    product: string;
    competitor: string;
    rn: number;
  }>(
    `SELECT * FROM (
       SELECT w.user_id, w.id AS watchlist_id, w.product, wi.competitor,
         ROW_NUMBER() OVER (PARTITION BY w.user_id ORDER BY wi.created_at ASC) AS rn
       FROM watchlists w
       JOIN watchlist_items wi ON wi.watchlist_id = w.id
       WHERE w.enabled = true AND wi.enabled = true
     ) t WHERE rn <= $1`,
    [limitPerUser],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    watchlistId: r.watchlist_id,
    product: r.product,
    competitor: r.competitor,
  }));
}

export async function markWatchlistSweepResult(input: {
  watchlistId: string;
  userId: string;
  succeeded: boolean;
}): Promise<void> {
  const now = new Date();
  await updateWatchlist(input.watchlistId, input.userId, {
    last_sweep_at: now.toISOString(),
    next_sweep_at: nextMondaySweepUtc(now).toISOString(),
    health_status: input.succeeded ? 'healthy' : 'degraded',
  });
}
