import { query } from '@/lib/db';
import type { AlertSeverity } from '@/lib/monitoring/severity';

let monitoringSchemaPromise: Promise<void> | null = null;

export function ensureMonitoringSchema(): Promise<void> {
  if (!monitoringSchemaPromise) {
    monitoringSchemaPromise = query(`
      ALTER TABLE competitive_events ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'low';
      ALTER TABLE competitive_events ADD COLUMN IF NOT EXISTS materiality_score real NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS alert_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        alert_id uuid NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
        channel text NOT NULL CHECK (channel IN ('email', 'slack')),
        status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (alert_id, channel)
      );
    `).then(() => undefined).catch((error) => {
      monitoringSchemaPromise = null;
      throw error;
    });
  }
  return monitoringSchemaPromise;
}

export type AlertEventRow = {
  id: string;
  user_id: string;
  watchlist_id: string | null;
  job_id: string | null;
  product: string;
  competitor: string;
  title: string;
  summary: string;
  severity: AlertSeverity;
  diff: Record<string, unknown>;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

export type AlertUpsertResult = AlertEventRow & { is_new: boolean };

export type AlertUpsertInput = {
  userId: string;
  watchlistId?: string | null;
  jobId?: string | null;
  product: string;
  competitor: string;
  title: string;
  summary: string;
  severity: AlertSeverity;
  diff?: Record<string, unknown>;
  dedupeKey: string;
};

export async function upsertAlertEvent(input: AlertUpsertInput): Promise<AlertUpsertResult> {
  const { rows } = await query<AlertUpsertResult>(
    `INSERT INTO alert_events (
       user_id, watchlist_id, job_id, product, competitor,
       title, summary, severity, diff, dedupe_key
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
       summary = EXCLUDED.summary,
       severity = EXCLUDED.severity,
       diff = EXCLUDED.diff,
       job_id = COALESCE(EXCLUDED.job_id, alert_events.job_id)
     RETURNING *, (xmax = 0) AS is_new`,
    [
      input.userId,
      input.watchlistId ?? null,
      input.jobId ?? null,
      input.product,
      input.competitor,
      input.title,
      input.summary,
      input.severity,
      JSON.stringify(input.diff ?? {}),
      input.dedupeKey,
    ],
  );
  return rows[0];
}

/**
 * Atomic alert-budget gate. The advisory transaction lock serializes parallel
 * competitor jobs for the same watchlist before count + insert.
 */
export async function upsertAlertEventWithinBudget(
  input: AlertUpsertInput,
  weeklyBudget: number,
): Promise<AlertUpsertResult | null> {
  const { rows } = await query<AlertUpsertResult>(
    `WITH budget_lock AS MATERIALIZED (
       SELECT pg_advisory_xact_lock(hashtext($1 || ':' || COALESCE($2::text, '')))
     ),
     usage AS (
       SELECT count(*)::int AS used
       FROM alert_events, budget_lock
       WHERE user_id = $1::uuid
         AND ($2::uuid IS NULL OR watchlist_id = $2::uuid)
         AND created_at >= date_trunc('week', now())
     )
     INSERT INTO alert_events (
       user_id, watchlist_id, job_id, product, competitor,
       title, summary, severity, diff, dedupe_key
     )
     SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb,$10
     FROM usage
     WHERE used < $11
     ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
       summary = EXCLUDED.summary,
       severity = EXCLUDED.severity,
       diff = EXCLUDED.diff,
       job_id = COALESCE(EXCLUDED.job_id, alert_events.job_id)
     RETURNING *, (xmax = 0) AS is_new`,
    [
      input.userId,
      input.watchlistId ?? null,
      input.jobId ?? null,
      input.product,
      input.competitor,
      input.title,
      input.summary,
      input.severity,
      JSON.stringify(input.diff ?? {}),
      input.dedupeKey,
      Math.min(50, Math.max(1, Math.floor(weeklyBudget))),
    ],
  );
  return rows[0] ?? null;
}

export async function listAlerts(
  userId: string,
  filters: { unread?: boolean; severity?: string; competitor?: string; limit?: number } = {},
): Promise<AlertEventRow[]> {
  const clauses = ['user_id = $1'];
  const vals: unknown[] = [userId];
  let i = 2;
  if (filters.unread) {
    clauses.push('read_at IS NULL');
  }
  if (filters.severity) {
    clauses.push(`severity = $${i++}`);
    vals.push(filters.severity);
  }
  if (filters.competitor) {
    clauses.push(`lower(competitor) = lower($${i++})`);
    vals.push(filters.competitor);
  }
  const limit = Math.min(Math.max(filters.limit ?? 40, 1), 100);
  vals.push(limit);
  const { rows } = await query<AlertEventRow>(
    `SELECT * FROM alert_events
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${i}`,
    vals,
  );
  return rows;
}

export async function markAlertRead(
  id: string,
  userId: string,
): Promise<AlertEventRow | null> {
  const { rows } = await query<AlertEventRow>(
    `UPDATE alert_events SET read_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId],
  );
  return rows[0] ?? null;
}

export async function insertCompetitiveEvent(input: {
  userId: string;
  product: string;
  competitor: string;
  title: string;
  summary: string;
  category: string;
  sourceUrls?: string[];
  jobId?: string | null;
  confidence?: string;
  clusterKey: string;
  eventDate?: string;
  severity?: AlertSeverity;
  materialityScore?: number;
}): Promise<void> {
  await ensureMonitoringSchema();
  await query(
    `INSERT INTO competitive_events (
       user_id, product, competitor, event_date, title, summary,
       category, source_urls, job_id, confidence, cluster_key, severity, materiality_score
     ) VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
    [
      input.userId,
      input.product,
      input.competitor,
      input.eventDate ?? null,
      input.title,
      input.summary,
      input.category,
      JSON.stringify(input.sourceUrls ?? []),
      input.jobId ?? null,
      input.confidence ?? 'medium',
      input.clusterKey,
      input.severity ?? 'low',
      Math.max(0, Math.min(1, input.materialityScore ?? 0)),
    ],
  );
}

export async function listCompetitiveEvents(
  userId: string,
  opts: { product?: string; competitor?: string; days?: number } = {},
): Promise<Array<{
  id: string;
  product: string;
  competitor: string;
  event_date: string;
  title: string;
  summary: string;
  category: string;
  cluster_key: string;
  source_urls: unknown;
  confidence: string;
  severity: AlertSeverity;
  materiality_score: number;
}>> {
  await ensureMonitoringSchema();
  const days = opts.days ?? 90;
  const clauses = [`user_id = $1`, `event_date >= CURRENT_DATE - $2::int`];
  const vals: unknown[] = [userId, days];
  let i = 3;
  if (opts.product) {
    clauses.push(`lower(product) = lower($${i++})`);
    vals.push(opts.product);
  }
  if (opts.competitor) {
    clauses.push(`lower(competitor) = lower($${i++})`);
    vals.push(opts.competitor);
  }
  const { rows } = await query(
    `SELECT id, product, competitor, event_date::text, title, summary, category,
            cluster_key, source_urls, confidence, severity, materiality_score
     FROM competitive_events
     WHERE ${clauses.join(' AND ')}
     ORDER BY event_date DESC, created_at DESC
     LIMIT 200`,
    vals,
  );
  return rows as Array<{
    id: string;
    product: string;
    competitor: string;
    event_date: string;
    title: string;
    summary: string;
    category: string;
    cluster_key: string;
    source_urls: unknown;
    confidence: string;
    severity: AlertSeverity;
    materiality_score: number;
  }>;
}

export async function countWeeklyAlerts(
  userId: string,
  watchlistId?: string | null,
): Promise<number> {
  await ensureMonitoringSchema();
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM alert_events
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR watchlist_id = $2)
       AND created_at >= date_trunc('week', now())`,
    [userId, watchlistId ?? null],
  );
  return Number(rows[0]?.count ?? 0);
}
