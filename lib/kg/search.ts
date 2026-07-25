import { query } from '@/lib/db';
import { getNeighborhood, listNodes } from '@/lib/kg/store';
import type { KgNodeKind, KgNodeRow } from '@/lib/kg/types';

export type HybridHit = {
  node: KgNodeRow;
  score: number;
  reasons: string[];
};

/** Keyword + optional embedding neighborhood hybrid search. */
export async function hybridKgSearch(input: {
  workspaceId: string;
  q: string;
  kind?: KgNodeKind;
  limit?: number;
}): Promise<HybridHit[]> {
  const q = input.q.trim();
  if (!q) return [];
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  const keywordNodes = await listNodes({
    workspaceId: input.workspaceId,
    kind: input.kind,
    q,
    limit,
  });

  const scores = new Map<string, HybridHit>();
  for (const node of keywordNodes) {
    scores.set(node.id, { node, score: 3, reasons: ['keyword'] });
  }

  // Embedding similarity when column populated
  try {
    const { rows } = await query<{ id: string; dist: number }>(
      `SELECT id, (embedding <=> (
          SELECT embedding FROM kg_nodes
          WHERE workspace_id = $1 AND embedding IS NOT NULL
            AND (lower(label) LIKE $2 OR lower(key) LIKE $2)
          LIMIT 1
        )) AS dist
       FROM kg_nodes
       WHERE workspace_id = $1 AND archived_at IS NULL AND embedding IS NOT NULL
       ORDER BY dist ASC NULLS LAST
       LIMIT $3`,
      [input.workspaceId, `%${q.toLowerCase()}%`, limit],
    );
    for (const r of rows) {
      if (r.dist == null) continue;
      const existing = scores.get(r.id);
      const bump = Math.max(0, 2 - Number(r.dist));
      if (existing) {
        existing.score += bump;
        existing.reasons.push('embedding');
      }
    }
  } catch {
    // embedding column / vectors may be unavailable
  }

  // Expand neighborhood of top keyword hits
  const seeds = [...scores.values()].slice(0, 5);
  for (const seed of seeds) {
    const { nodes } = await getNeighborhood(input.workspaceId, seed.node.id, 1);
    for (const n of nodes) {
      if (n.id === seed.node.id) continue;
      const existing = scores.get(n.id);
      if (existing) {
        existing.score += 0.5;
        if (!existing.reasons.includes('neighborhood')) existing.reasons.push('neighborhood');
      } else {
        scores.set(n.id, { node: n, score: 0.8, reasons: ['neighborhood'] });
      }
    }
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
