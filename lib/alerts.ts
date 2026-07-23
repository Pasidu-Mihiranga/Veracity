import { query } from '@/lib/db';
import type { AlertSeverity } from '@/lib/monitoring/severity';

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

export async function upsertAlertEvent(input: {
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
}): Promise<AlertEventRow> {
  const { rows } = await query<AlertEventRow>(
    `INSERT INTO alert_events (
       user_id, watchlist_id, job_id, product, competitor,
       title, summary, severity, diff, dedupe_key
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
       summary = EXCLUDED.summary,
       severity = EXCLUDED.severity,
       diff = EXCLUDED.diff,
       job_id = COALESCE(EXCLUDED.job_id, alert_events.job_id)
     RETURNING *`,
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
}): Promise<void> {
  await query(
    `INSERT INTO competitive_events (
       user_id, product, competitor, event_date, title, summary,
       category, source_urls, job_id, confidence, cluster_key
     ) VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8::jsonb,$9,$10,$11)`,
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
}>> {
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
            cluster_key, source_urls, confidence
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
  }>;
}
