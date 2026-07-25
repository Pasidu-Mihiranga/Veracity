import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { expiresAtFromConfidence } from '@/lib/kg/memory-ttl';
import type { Provenance } from '@/lib/kg/types';

export type AgentMemoryScope = 'product' | 'competitor' | 'domain' | 'global';

export type AgentMemoryRow = {
  id: string;
  workspace_id: string;
  session_id: string | null;
  scope: AgentMemoryScope;
  key: string;
  value: Record<string, unknown>;
  source_agent: string | null;
  confidence: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function putAgentMemory(input: {
  workspaceId: string;
  scope: AgentMemoryScope;
  key: string;
  value: Record<string, unknown>;
  confidence?: number;
  sessionId?: string | null;
  provenance?: Provenance;
}): Promise<AgentMemoryRow | null> {
  if (!featureFlags.crossAgentMemory) return null;
  const confidence = input.confidence ?? 0.55;
  const expires = expiresAtFromConfidence(confidence);
  const { rows } = await query<AgentMemoryRow>(
    `INSERT INTO agent_memory_entries (
       workspace_id, session_id, scope, key, value, source_agent, confidence,
       expires_at, created_by, job_id, model_version, updated_at
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (workspace_id, scope, key) DO UPDATE SET
       value = EXCLUDED.value,
       confidence = EXCLUDED.confidence,
       expires_at = EXCLUDED.expires_at,
       source_agent = EXCLUDED.source_agent,
       session_id = COALESCE(EXCLUDED.session_id, agent_memory_entries.session_id),
       updated_at = now()
     RETURNING *`,
    [
      input.workspaceId,
      input.sessionId ?? null,
      input.scope,
      input.key.slice(0, 200),
      JSON.stringify(input.value),
      input.provenance?.sourceAgent ?? null,
      confidence,
      expires.toISOString(),
      input.provenance?.createdBy ?? null,
      input.provenance?.jobId ?? null,
      input.provenance?.modelVersion ?? null,
    ],
  );
  return rows[0];
}

export async function listAgentMemory(input: {
  workspaceId: string;
  scope?: AgentMemoryScope;
  sessionId?: string | null;
  limit?: number;
}): Promise<AgentMemoryRow[]> {
  if (!featureFlags.crossAgentMemory) return [];
  // purge expired lazily
  await query(
    `DELETE FROM agent_memory_entries
     WHERE workspace_id = $1 AND expires_at IS NOT NULL AND expires_at < now()`,
    [input.workspaceId],
  );

  const params: unknown[] = [input.workspaceId];
  const clauses = [`workspace_id = $1`, `(expires_at IS NULL OR expires_at > now())`];
  if (input.scope) {
    params.push(input.scope);
    clauses.push(`scope = $${params.length}`);
  }
  if (input.sessionId) {
    params.push(input.sessionId);
    clauses.push(`(session_id IS NULL OR session_id = $${params.length})`);
  }
  params.push(Math.min(Math.max(input.limit ?? 40, 1), 100));
  const { rows } = await query<AgentMemoryRow>(
    `SELECT * FROM agent_memory_entries
     WHERE ${clauses.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export function formatAgentMemoryPreamble(rows: AgentMemoryRow[]): string {
  if (!rows.length) return '';
  const lines = rows.slice(0, 12).map((r) => {
    const text =
      typeof r.value.text === 'string'
        ? r.value.text
        : JSON.stringify(r.value).slice(0, 160);
    return `- [${r.scope}/${r.key}] (conf ${r.confidence.toFixed(2)}): ${text}`;
  });
  return `Cross-agent memory (durable):\n${lines.join('\n')}`;
}
