import { query } from '@/lib/db';
import { propagateClaimConfidence } from '@/lib/kg/confidence';
import { normalizeEntityKey } from '@/lib/kg/normalize';
import type {
  KgEdgeRow,
  KgNodeKind,
  KgNodeRow,
  KgNodeVersionRow,
  KgRel,
  Provenance,
} from '@/lib/kg/types';

function provCols(p?: Provenance) {
  return {
    created_by: p?.createdBy ?? null,
    source_agent: p?.sourceAgent ?? null,
    job_id: p?.jobId ?? null,
    session_id: p?.sessionId ?? null,
    model_version: p?.modelVersion ?? null,
  };
}

export async function findNodeByKey(
  workspaceId: string,
  kind: KgNodeKind,
  key: string,
): Promise<KgNodeRow | null> {
  const { rows } = await query<KgNodeRow>(
    `SELECT * FROM kg_nodes
     WHERE workspace_id = $1 AND kind = $2 AND key = $3 AND archived_at IS NULL
     LIMIT 1`,
    [workspaceId, kind, key],
  );
  return rows[0] ?? null;
}

/** Upsert canonical node; append version when label/props change (never silent overwrite). */
export async function upsertCanonicalNode(input: {
  workspaceId: string;
  kind: KgNodeKind;
  label: string;
  key?: string;
  props?: Record<string, unknown>;
  confidence?: number;
  validFrom?: Date;
  validUntil?: Date | null;
  provenance?: Provenance;
}): Promise<KgNodeRow> {
  const key = input.key ?? normalizeEntityKey(input.label);
  const existing = await findNodeByKey(input.workspaceId, input.kind, key);
  const prov = provCols(input.provenance);
  const props = input.props ?? {};
  const confidence = input.confidence ?? 0.5;

  if (!existing) {
    const { rows } = await query<KgNodeRow>(
      `INSERT INTO kg_nodes (
         workspace_id, kind, label, key, props, confidence,
         valid_from, valid_until, created_by, source_agent, job_id, session_id, model_version
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        input.workspaceId,
        input.kind,
        input.label,
        key,
        JSON.stringify(props),
        confidence,
        (input.validFrom ?? new Date()).toISOString(),
        input.validUntil?.toISOString() ?? null,
        prov.created_by,
        prov.source_agent,
        prov.job_id,
        prov.session_id,
        prov.model_version,
      ],
    );
    const node = rows[0];
    await query(
      `INSERT INTO kg_node_versions (
         node_id, workspace_id, version, label, props, confidence_snapshot,
         created_by, source_agent, job_id, session_id, model_version
       ) VALUES ($1,$2,1,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)`,
      [
        node.id,
        input.workspaceId,
        input.label,
        JSON.stringify(props),
        confidence,
        prov.created_by,
        prov.source_agent,
        prov.job_id,
        prov.session_id,
        prov.model_version,
      ],
    );
    return node;
  }

  const changed =
    existing.label !== input.label ||
    JSON.stringify(existing.props) !== JSON.stringify(props) ||
    Math.abs(Number(existing.confidence) - confidence) > 0.001;

  if (!changed) return existing;

  const { rows: verRows } = await query<{ max: string }>(
    `SELECT COALESCE(max(version), 0)::text AS max FROM kg_node_versions WHERE node_id = $1`,
    [existing.id],
  );
  const nextVer = Number(verRows[0]?.max ?? 0) + 1;

  const { rows } = await query<KgNodeRow>(
    `UPDATE kg_nodes SET
       label = $2,
       props = $3::jsonb,
       confidence = $4,
       updated_at = now(),
       source_agent = COALESCE($5, source_agent),
       job_id = COALESCE($6, job_id),
       session_id = COALESCE($7, session_id),
       model_version = COALESCE($8, model_version)
     WHERE id = $1
     RETURNING *`,
    [
      existing.id,
      input.label,
      JSON.stringify(props),
      confidence,
      prov.source_agent,
      prov.job_id,
      prov.session_id,
      prov.model_version,
    ],
  );

  await query(
    `INSERT INTO kg_node_versions (
       node_id, workspace_id, version, label, props, confidence_snapshot,
       created_by, source_agent, job_id, session_id, model_version
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
    [
      existing.id,
      input.workspaceId,
      nextVer,
      input.label,
      JSON.stringify(props),
      confidence,
      prov.created_by,
      prov.source_agent,
      prov.job_id,
      prov.session_id,
      prov.model_version,
    ],
  );

  return rows[0];
}

export async function upsertEdge(input: {
  workspaceId: string;
  fromNodeId: string;
  toNodeId: string;
  rel: KgRel;
  weight?: number;
  trust?: number;
  props?: Record<string, unknown>;
  validFrom?: Date;
  validUntil?: Date | null;
  provenance?: Provenance;
}): Promise<KgEdgeRow> {
  const prov = provCols(input.provenance);
  const existing = await query<KgEdgeRow>(
    `SELECT * FROM kg_edges
     WHERE workspace_id = $1 AND from_node_id = $2 AND to_node_id = $3 AND rel = $4
       AND valid_until IS NULL
     LIMIT 1`,
    [input.workspaceId, input.fromNodeId, input.toNodeId, input.rel],
  );
  if (existing.rows[0]) {
    const { rows } = await query<KgEdgeRow>(
      `UPDATE kg_edges SET weight = $2, trust = $3, props = $4::jsonb
       WHERE id = $1 RETURNING *`,
      [
        existing.rows[0].id,
        input.weight ?? existing.rows[0].weight,
        input.trust ?? existing.rows[0].trust,
        JSON.stringify(input.props ?? existing.rows[0].props ?? {}),
      ],
    );
    return rows[0];
  }
  const { rows } = await query<KgEdgeRow>(
    `INSERT INTO kg_edges (
       workspace_id, from_node_id, to_node_id, rel, weight, trust, props,
       valid_from, valid_until, created_by, source_agent, job_id, session_id, model_version
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      input.workspaceId,
      input.fromNodeId,
      input.toNodeId,
      input.rel,
      input.weight ?? 1,
      input.trust ?? 0.7,
      JSON.stringify(input.props ?? {}),
      (input.validFrom ?? new Date()).toISOString(),
      input.validUntil?.toISOString() ?? null,
      prov.created_by,
      prov.source_agent,
      prov.job_id,
      prov.session_id,
      prov.model_version,
    ],
  );
  return rows[0];
}

export async function recomputeClaimConfidence(
  workspaceId: string,
  claimNodeId: string,
): Promise<number> {
  const { rows } = await query<{ trust: number }>(
    `SELECT trust FROM kg_edges
     WHERE workspace_id = $1 AND from_node_id = $2 AND rel = 'supports'
       AND valid_until IS NULL`,
    [workspaceId, claimNodeId],
  );
  const confidence = propagateClaimConfidence(rows);
  await query(`UPDATE kg_nodes SET confidence = $2, updated_at = now() WHERE id = $1`, [
    claimNodeId,
    confidence,
  ]);
  return confidence;
}

export async function listNodes(input: {
  workspaceId: string;
  kind?: KgNodeKind;
  q?: string;
  asOf?: Date;
  limit?: number;
}): Promise<KgNodeRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const params: unknown[] = [input.workspaceId];
  const clauses = [`workspace_id = $1`, `archived_at IS NULL`];
  if (input.kind) {
    params.push(input.kind);
    clauses.push(`kind = $${params.length}`);
  }
  if (input.q?.trim()) {
    params.push(`%${input.q.trim().toLowerCase()}%`);
    clauses.push(`(lower(label) LIKE $${params.length} OR lower(key) LIKE $${params.length})`);
  }
  if (input.asOf) {
    params.push(input.asOf.toISOString());
    clauses.push(
      `valid_from <= $${params.length} AND (valid_until IS NULL OR valid_until > $${params.length})`,
    );
  }
  params.push(limit);
  const { rows } = await query<KgNodeRow>(
    `SELECT * FROM kg_nodes
     WHERE ${clauses.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getNeighborhood(
  workspaceId: string,
  nodeId: string,
  depth = 1,
): Promise<{ nodes: KgNodeRow[]; edges: KgEdgeRow[] }> {
  const d = depth >= 2 ? 2 : 1;
  const { rows: edges } = await query<KgEdgeRow>(
    d === 1
      ? `SELECT * FROM kg_edges
         WHERE workspace_id = $1 AND valid_until IS NULL
           AND (from_node_id = $2 OR to_node_id = $2)`
      : `WITH RECURSIVE walk AS (
           SELECT e.*, 1 AS depth FROM kg_edges e
           WHERE e.workspace_id = $1 AND e.valid_until IS NULL
             AND (e.from_node_id = $2 OR e.to_node_id = $2)
           UNION
           SELECT e.*, w.depth + 1 FROM kg_edges e
           JOIN walk w ON e.workspace_id = $1 AND e.valid_until IS NULL
             AND (e.from_node_id IN (w.from_node_id, w.to_node_id)
               OR e.to_node_id IN (w.from_node_id, w.to_node_id))
           WHERE w.depth < 2
         )
         SELECT DISTINCT ON (id) * FROM walk`,
    [workspaceId, nodeId],
  );

  const ids = new Set<string>([nodeId]);
  for (const e of edges) {
    ids.add(e.from_node_id);
    ids.add(e.to_node_id);
  }
  if (ids.size === 0) return { nodes: [], edges: [] };
  const idList = [...ids];
  const { rows: nodes } = await query<KgNodeRow>(
    `SELECT * FROM kg_nodes
     WHERE workspace_id = $1 AND archived_at IS NULL AND id = ANY($2::uuid[])`,
    [workspaceId, idList],
  );
  return { nodes, edges };
}

export async function listNodeVersions(
  workspaceId: string,
  nodeId: string,
): Promise<KgNodeVersionRow[]> {
  const { rows } = await query<KgNodeVersionRow>(
    `SELECT * FROM kg_node_versions
     WHERE workspace_id = $1 AND node_id = $2
     ORDER BY version DESC
     LIMIT 50`,
    [workspaceId, nodeId],
  );
  return rows;
}

export async function appendDomainEvent(input: {
  workspaceId: string;
  aggregateType: 'competitor' | 'product' | 'claim' | 'decision' | 'other';
  aggregateKey: string;
  eventType: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
  provenance?: Provenance;
}): Promise<void> {
  const prov = provCols(input.provenance);
  await query(
    `INSERT INTO kg_domain_events (
       workspace_id, aggregate_type, aggregate_key, event_type, payload,
       created_by, source_agent, job_id, session_id, model_version, occurred_at
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
    [
      input.workspaceId,
      input.aggregateType,
      input.aggregateKey,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
      prov.created_by,
      prov.source_agent,
      prov.job_id,
      prov.session_id,
      prov.model_version,
      (input.occurredAt ?? new Date()).toISOString(),
    ],
  );
}
