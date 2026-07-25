import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';

export type KgAnalytics = {
  mostReferencedCompetitors: Array<{ label: string; refs: number }>;
  mostTrustedEvidence: Array<{ label: string; confidence: number }>;
  emergingCompanies: Array<{ label: string; created_at: string }>;
  frequentlyChanging: Array<{ label: string; versions: number }>;
  centralEntities: Array<{ label: string; degree: number }>;
};

export async function getKgAnalytics(workspaceId: string): Promise<KgAnalytics> {
  if (!featureFlags.kgAnalytics && !featureFlags.kgExplorer) {
    return {
      mostReferencedCompetitors: [],
      mostTrustedEvidence: [],
      emergingCompanies: [],
      frequentlyChanging: [],
      centralEntities: [],
    };
  }

  const mostReferencedCompetitors = (
    await query<{ label: string; refs: string }>(
      `SELECT n.label, count(e.id)::text AS refs
       FROM kg_nodes n
       JOIN kg_edges e ON e.to_node_id = n.id AND e.workspace_id = n.workspace_id
       WHERE n.workspace_id = $1 AND n.kind = 'competitor' AND n.archived_at IS NULL
       GROUP BY n.id, n.label
       ORDER BY count(e.id) DESC
       LIMIT 8`,
      [workspaceId],
    )
  ).rows.map((r) => ({ label: r.label, refs: Number(r.refs) }));

  const mostTrustedEvidence = (
    await query<{ label: string; confidence: number }>(
      `SELECT label, confidence FROM kg_nodes
       WHERE workspace_id = $1 AND kind = 'source' AND archived_at IS NULL
       ORDER BY confidence DESC
       LIMIT 8`,
      [workspaceId],
    )
  ).rows;

  const emergingCompanies = (
    await query<{ label: string; created_at: string }>(
      `SELECT label, created_at FROM kg_nodes
       WHERE workspace_id = $1 AND kind = 'competitor' AND archived_at IS NULL
         AND created_at > now() - interval '30 days'
       ORDER BY created_at DESC
       LIMIT 8`,
      [workspaceId],
    )
  ).rows;

  const frequentlyChanging = (
    await query<{ label: string; versions: string }>(
      `SELECT n.label, count(v.id)::text AS versions
       FROM kg_nodes n
       JOIN kg_node_versions v ON v.node_id = n.id
       WHERE n.workspace_id = $1 AND n.kind IN ('product', 'claim') AND n.archived_at IS NULL
       GROUP BY n.id, n.label
       HAVING count(v.id) > 1
       ORDER BY count(v.id) DESC
       LIMIT 8`,
      [workspaceId],
    )
  ).rows.map((r) => ({ label: r.label, versions: Number(r.versions) }));

  const centralEntities = (
    await query<{ label: string; degree: string }>(
      `SELECT n.label, (
          (SELECT count(*) FROM kg_edges e WHERE e.workspace_id = $1 AND e.from_node_id = n.id) +
          (SELECT count(*) FROM kg_edges e WHERE e.workspace_id = $1 AND e.to_node_id = n.id)
        )::text AS degree
       FROM kg_nodes n
       WHERE n.workspace_id = $1 AND n.archived_at IS NULL
       ORDER BY degree DESC
       LIMIT 8`,
      [workspaceId],
    )
  ).rows.map((r) => ({ label: r.label, degree: Number(r.degree) }));

  return {
    mostReferencedCompetitors,
    mostTrustedEvidence,
    emergingCompanies,
    frequentlyChanging,
    centralEntities,
  };
}
