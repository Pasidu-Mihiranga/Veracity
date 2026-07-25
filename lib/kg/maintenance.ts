import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { featureFlags } from '@/lib/feature-flags';
import { normalizeEntityKey } from '@/lib/kg/normalize';
import { upsertEdge } from '@/lib/kg/store';
import type { KgNodeRow } from '@/lib/kg/types';

export type MaintenanceReport = {
  normalized: number;
  aliasesWritten: number;
  merged: number;
  edgesRepaired: number;
  archived: number;
};

/** Entity resolution + graph hygiene pipeline. */
export async function runGraphMaintenance(
  workspaceId: string,
  actorUserId: string,
): Promise<MaintenanceReport> {
  if (!featureFlags.kgMaintenance) {
    return { normalized: 0, aliasesWritten: 0, merged: 0, edgesRepaired: 0, archived: 0 };
  }

  let normalized = 0;
  let aliasesWritten = 0;
  let merged = 0;
  let edgesRepaired = 0;
  let archived = 0;

  const { rows: competitors } = await query<KgNodeRow>(
    `SELECT * FROM kg_nodes
     WHERE workspace_id = $1 AND kind = 'competitor' AND archived_at IS NULL
     ORDER BY created_at ASC
     LIMIT 500`,
    [workspaceId],
  );

  const byNorm = new Map<string, KgNodeRow[]>();
  for (const node of competitors) {
    const nk = normalizeEntityKey(node.label || node.key);
    if (nk !== node.key) {
      await query(`UPDATE kg_nodes SET key = $2, updated_at = now() WHERE id = $1`, [
        node.id,
        nk,
      ]);
      normalized += 1;
      node.key = nk;
    }
    const list = byNorm.get(nk) ?? [];
    list.push(node);
    byNorm.set(nk, list);
  }

  for (const [normKey, group] of byNorm) {
    if (group.length < 2) {
      await query(
        `INSERT INTO kg_aliases (workspace_id, alias_key, canonical_node_id, source)
         VALUES ($1,$2,$3,'resolver')
         ON CONFLICT (workspace_id, alias_key) DO UPDATE SET canonical_node_id = EXCLUDED.canonical_node_id`,
        [workspaceId, normKey, group[0].id],
      );
      aliasesWritten += 1;
      continue;
    }

    const canonical = group[0];
    for (const dup of group.slice(1)) {
      await query(
        `UPDATE kg_edges SET from_node_id = $2
         WHERE workspace_id = $1 AND from_node_id = $3`,
        [workspaceId, canonical.id, dup.id],
      );
      await query(
        `UPDATE kg_edges SET to_node_id = $2
         WHERE workspace_id = $1 AND to_node_id = $3`,
        [workspaceId, canonical.id, dup.id],
      );
      await upsertEdge({
        workspaceId,
        fromNodeId: dup.id,
        toNodeId: canonical.id,
        rel: 'same_as',
        provenance: { createdBy: actorUserId, sourceAgent: 'kg-maintenance' },
      });
      await query(
        `INSERT INTO kg_aliases (workspace_id, alias_key, canonical_node_id, source)
         VALUES ($1,$2,$3,'resolver')
         ON CONFLICT (workspace_id, alias_key) DO UPDATE SET canonical_node_id = EXCLUDED.canonical_node_id`,
        [workspaceId, dup.key, canonical.id],
      );
      await query(
        `UPDATE kg_nodes SET archived_at = now(), updated_at = now() WHERE id = $1`,
        [dup.id],
      );
      aliasesWritten += 1;
      merged += 1;
    }
  }

  const loopRes = await query(
    `DELETE FROM kg_edges
     WHERE workspace_id = $1 AND from_node_id = to_node_id AND rel <> 'same_as'`,
    [workspaceId],
  );
  edgesRepaired += loopRes.rowCount ?? 0;

  const staleRes = await query(
    `UPDATE kg_nodes SET archived_at = now(), updated_at = now()
     WHERE workspace_id = $1
       AND archived_at IS NULL
       AND valid_until IS NOT NULL
       AND valid_until < now() - interval '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM kg_edges e
         WHERE e.workspace_id = $1
           AND (e.from_node_id = kg_nodes.id OR e.to_node_id = kg_nodes.id)
           AND e.created_at > now() - interval '60 days'
       )`,
    [workspaceId],
  );
  archived += staleRes.rowCount ?? 0;

  await writeAuditLog({
    userId: actorUserId,
    workspaceId,
    action: 'kg.maintenance.run',
    resourceType: 'kg',
    resourceId: workspaceId,
    metadata: { normalized, aliasesWritten, merged, edgesRepaired, archived },
  });

  return { normalized, aliasesWritten, merged, edgesRepaired, archived };
}
