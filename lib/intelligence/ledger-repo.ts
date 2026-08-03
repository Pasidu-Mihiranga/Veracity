/**
 * Persistence for the evidence ledger.
 *
 * Writes go through here so the invariants the schema encodes are also enforced
 * in one place in application code: an observation is written in the same
 * transaction as the span that backs it, and a chart spec is validated before
 * it is stored.
 *
 * Every function is ownership-scoped by `userId`. The beta is single-owner, and
 * a query that forgets the predicate is how one user's evidence ends up in
 * another user's brief.
 */

import { pool, query } from '@/lib/db';
import { validateChartSpec, type ChartSpec, type ChangeEvent, type Claim, type EvidenceSpan, type MetricObservation } from './types';
import { verifyClaims } from './claim-verifier';
import type { PreparedSnapshot } from './snapshot-store';
import type { ExtractedSpan } from './evidence-extractor';

export interface StoredSnapshot {
  id: string;
  contentHash: string;
  isNew: boolean;
}

/**
 * Persist a snapshot, or return the existing row when the content is unchanged.
 *
 * The `(entity_id, source_url, content_hash)` unique constraint means an
 * unchanged re-fetch collapses onto the existing row instead of growing the
 * table once per scheduled run.
 */
export async function saveSnapshot(params: {
  userId: string;
  projectId?: string | null;
  entityId: string;
  snapshot: PreparedSnapshot;
  scopeKey?: string;
  jobId?: string | null;
}): Promise<StoredSnapshot> {
  const { userId, projectId = null, entityId, snapshot, scopeKey = 'default', jobId = null } = params;

  const existing = await query<{ id: string }>(
    `SELECT id FROM source_snapshots
      WHERE entity_id = $1 AND source_url = $2 AND content_hash = $3 AND user_id = $4
      LIMIT 1`,
    [entityId, snapshot.canonicalUrl, snapshot.contentHash, userId],
  );

  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, contentHash: snapshot.contentHash, isNew: false };
  }

  const inserted = await query<{ id: string }>(
    `INSERT INTO source_snapshots
       (entity_id, user_id, project_id, scope_key, job_id, source_type, source_url,
        source_title, content_hash, normalized_content, retrieval_status, observed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ok', $11)
     ON CONFLICT (entity_id, source_url, content_hash) DO UPDATE
       SET observed_at = EXCLUDED.observed_at
     RETURNING id`,
    [
      entityId, userId, projectId, scopeKey, jobId, snapshot.sourceType,
      snapshot.canonicalUrl, snapshot.title, snapshot.contentHash,
      snapshot.normalizedContent, snapshot.observedAt,
    ],
  );

  return { id: inserted.rows[0].id, contentHash: snapshot.contentHash, isNew: true };
}

export interface SavedEvidence {
  spanIds: string[];
  observationIds: string[];
}

/**
 * Write extracted spans and their observations together.
 *
 * One transaction, because an observation whose span failed to insert is
 * exactly the orphaned number the ledger exists to make impossible.
 */
export async function saveExtractedEvidence(params: {
  userId: string;
  projectId?: string | null;
  entityId?: string | null;
  snapshotId: string;
  spans: ExtractedSpan[];
}): Promise<SavedEvidence> {
  const { userId, projectId = null, entityId = null, snapshotId, spans } = params;
  if (spans.length === 0) return { spanIds: [], observationIds: [] };

  const client = await pool.connect();
  const spanIds: string[] = [];
  const observationIds: string[] = [];

  try {
    await client.query('BEGIN');

    for (const span of spans) {
      const spanRow = await client.query<{ id: string }>(
        `INSERT INTO evidence_spans
           (snapshot_id, user_id, project_id, excerpt, start_offset, end_offset,
            extraction_type, entity_match)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          snapshotId, userId, projectId, span.excerpt, span.startOffset,
          span.endOffset, span.extractionType, span.entityMatch,
        ],
      );
      const spanId = spanRow.rows[0].id;
      spanIds.push(spanId);

      if (span.metric) {
        const obsRow = await client.query<{ id: string }>(
          `INSERT INTO metric_observations
             (user_id, project_id, entity_id, evidence_span_id, metric_key, value, unit,
              period_start, period_end, method, is_estimated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'extracted', $10)
           RETURNING id`,
          [
            userId, projectId, entityId, spanId, span.metric.key, span.metric.value,
            span.metric.unit, span.metric.periodStart, span.metric.periodEnd,
            span.metric.isEstimated,
          ],
        );
        observationIds.push(obsRow.rows[0].id);
      }
    }

    await client.query('COMMIT');
    return { spanIds, observationIds };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Persist claims, rejecting any the verifier will not pass.
 *
 * The verifier existed with no caller, which meant an unsupported numeric claim
 * could still reach the ledger — the exact failure the ledger was built to
 * prevent. Verification happens here rather than at the call site so no path
 * can write around it.
 *
 * Rejections are returned rather than swallowed: "three claims were dropped
 * because no source backed their numbers" is a more useful answer than a
 * shorter list with no explanation.
 */
export async function saveVerifiedClaims(params: {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  claims: Claim[];
  spans: Map<string, EvidenceSpan>;
  observationsBySpan: Map<string, MetricObservation[]>;
  agentId?: string;
}): Promise<{
  saved: Array<{ id: string; statement: string }>;
  rejected: Array<{ statement: string; reasons: string[] }>;
}> {
  const { verified, rejected } = verifyClaims(params.claims, {
    spans: params.spans,
    observationsBySpan: params.observationsBySpan,
  });

  const saved: Array<{ id: string; statement: string }> = [];

  for (const claim of verified) {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO claims
         (user_id, project_id, session_id, statement, claim_type, confidence,
          supporting_span_ids, contradicting_span_ids, freshest_evidence_at, agent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        params.userId, params.projectId ?? null, params.sessionId ?? null,
        claim.statement, claim.claimType, claim.confidence,
        claim.supportingSpanIds, claim.contradictingSpanIds,
        claim.freshestEvidenceAt ?? null, params.agentId ?? claim.agentId ?? null,
      ],
    );
    saved.push({ id: rows[0].id, statement: claim.statement });
  }

  return {
    saved,
    rejected: rejected.map((entry) => ({
      statement: entry.claim.statement,
      reasons: entry.rejections.map((r) => `${r.code}: ${r.detail}`),
    })),
  };
}

/** Load observations for a metric series, oldest first. */
export async function loadObservations(params: {
  userId: string;
  projectId: string;
  metricKey: string;
}) {
  const { rows } = await query(
    `SELECT id, project_id, entity_id, evidence_span_id, metric_key,
            value::float8 AS value, unit, period_start, period_end, method,
            is_estimated, observed_at
       FROM metric_observations
      WHERE user_id = $1 AND project_id = $2 AND metric_key = $3
      ORDER BY COALESCE(period_start, observed_at) ASC`,
    [params.userId, params.projectId, params.metricKey],
  );

  return rows.map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string | null,
    entityId: r.entity_id as string | null,
    evidenceSpanId: r.evidence_span_id as string,
    metricKey: r.metric_key as string,
    value: r.value as number,
    unit: r.unit as string,
    periodStart: r.period_start ? new Date(r.period_start as string).toISOString() : null,
    periodEnd: r.period_end ? new Date(r.period_end as string).toISOString() : null,
    method: r.method as 'extracted' | 'counted' | 'reported',
    isEstimated: r.is_estimated as boolean,
    observedAt: new Date(r.observed_at as string).toISOString(),
  }));
}

/** Load evidence spans by id, for the evidence drawer. */
export async function loadSpans(userId: string, spanIds: string[]) {
  if (spanIds.length === 0) return [];

  const { rows } = await query(
    `SELECT s.id, s.excerpt, s.start_offset, s.end_offset, s.extraction_type,
            s.entity_match, s.created_at,
            snap.source_url, snap.source_title, snap.content_hash, snap.observed_at
       FROM evidence_spans s
       JOIN source_snapshots snap ON snap.id = s.snapshot_id
      WHERE s.user_id = $1 AND s.id = ANY($2)`,
    [userId, spanIds],
  );

  return rows.map((r) => ({
    id: r.id as string,
    excerpt: r.excerpt as string,
    startOffset: r.start_offset as number | null,
    endOffset: r.end_offset as number | null,
    extractionType: r.extraction_type as string,
    entityMatch: r.entity_match as string,
    sourceUrl: r.source_url as string,
    sourceTitle: r.source_title as string,
    contentHash: r.content_hash as string,
    retrievedAt: new Date(r.observed_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/**
 * Insert a change event, ignoring one that has already been recorded.
 *
 * `ON CONFLICT DO NOTHING` against the dedupe index is what keeps a re-run from
 * reporting the same change twice. The return value tells the caller whether
 * this was genuinely new, which is what decides whether a digest item is
 * generated.
 */
export async function saveChangeEvent(params: {
  userId: string;
  projectId: string;
  event: Omit<ChangeEvent, 'id'> & { entityId?: string | null };
}): Promise<{ id: string; isNew: boolean }> {
  const { userId, projectId, event } = params;

  const { rows } = await query<{ id: string }>(
    `INSERT INTO change_events
       (user_id, project_id, entity_id, event_type, before_value, after_value,
        effective_at, observed_at, from_snapshot_id, to_snapshot_id,
        evidence_span_id, materiality, materiality_reason, confidence, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (project_id, dedupe_key) DO NOTHING
     RETURNING id`,
    [
      userId, projectId, event.entityId ?? null, event.eventType,
      event.beforeValue ?? null, event.afterValue ?? null,
      event.effectiveAt ?? null, event.observedAt,
      event.fromSnapshotId ?? null, event.toSnapshotId ?? null,
      event.evidenceSpanId ?? null, event.materiality, event.materialityReason,
      event.confidence, event.dedupeKey,
    ],
  );

  if (rows.length > 0) return { id: rows[0].id, isNew: true };

  const existing = await query<{ id: string }>(
    `SELECT id FROM change_events WHERE project_id = $1 AND dedupe_key = $2`,
    [projectId, event.dedupeKey],
  );
  return { id: existing.rows[0]?.id ?? '', isNew: false };
}

/** Material changes since a timestamp, newest first. */
export async function loadChangeEvents(params: {
  userId: string;
  projectId: string;
  since?: string;
  minMateriality?: number;
  limit?: number;
}) {
  const { rows } = await query(
    `SELECT id, entity_id, event_type, before_value, after_value, effective_at,
            observed_at, evidence_span_id, materiality::float8 AS materiality,
            materiality_reason, confidence
       FROM change_events
      WHERE user_id = $1 AND project_id = $2
        AND ($3::timestamptz IS NULL OR observed_at > $3::timestamptz)
        AND materiality >= $4
      ORDER BY observed_at DESC
      LIMIT $5`,
    [
      params.userId, params.projectId, params.since ?? null,
      params.minMateriality ?? 0, params.limit ?? 50,
    ],
  );
  return rows;
}

/**
 * Store a chart spec after validating it.
 *
 * Validation happens here rather than at the call site so an invalid chart can
 * never be persisted, whatever path produced it.
 */
export async function saveChartSpec(params: {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  spec: unknown;
}): Promise<{ ok: true; id: string; spec: ChartSpec } | { ok: false; reasons: string[] }> {
  const validation = validateChartSpec(params.spec);
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  const { rows } = await query<{ id: string }>(
    `INSERT INTO chart_specs (user_id, project_id, session_id, spec, data_class, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.userId, params.projectId ?? null, params.sessionId ?? null,
      JSON.stringify(validation.spec), validation.spec.dataClass,
      validation.spec.generatedAt,
    ],
  );

  return { ok: true, id: rows[0].id, spec: validation.spec };
}
