import type { OrchestratorOutput } from '@/lib/agents/types';
import { query } from '@/lib/db';
import { collectMonitoringSignals } from '@/lib/monitoring/signal-collectors';
import {
  stableContentHash,
  type ContinuousScope,
} from '@/lib/continuous-intelligence/entity-utils';
import {
  continuousScopeKey,
  upsertCanonicalEntity,
  resolveCanonicalEntity,
  type CanonicalEntity,
} from '@/lib/continuous-intelligence/entities';

// Re-export pure types and functions from the DB-free utility module
// so existing imports from this file continue to work.
export {
  buildCompetitorProfileState,
  diffCompetitorProfileOutputs,
  type CompetitorProfileSnapshotRow,
  type CompetitorProfileState,
  type ProfileSnapshotDiff,
} from '@/lib/continuous-intelligence/profile-utils';

import type {
  CompetitorProfileSnapshotRow,
  ProfileSnapshotDiff,
} from '@/lib/continuous-intelligence/profile-utils';
import {
  buildCompetitorProfileState,
  diffCompetitorProfileOutputs,
} from '@/lib/continuous-intelligence/profile-utils';


export async function persistContinuousProfileSnapshot(input: ContinuousScope & {
  product: string;
  competitor: string;
  competitorUrl?: string | null;
  previous?: OrchestratorOutput | null;
  output: OrchestratorOutput;
  jobId?: string | null;
}): Promise<{
  entity: CanonicalEntity;
  snapshot: CompetitorProfileSnapshotRow;
  diff: ProfileSnapshotDiff;
}> {
  const entity = await upsertCanonicalEntity({
    userId: input.userId,
    workspaceId: input.workspaceId,
    type: 'competitor',
    displayName: input.competitor,
    aliases: [input.competitor],
    officialDomains: input.competitorUrl ? [input.competitorUrl] : [],
    props: { monitoredAgainst: input.product },
    confidence: input.competitorUrl ? 0.9 : 0.7,
  });
  const profile = buildCompetitorProfileState(input.output);
  const history = await query<CompetitorProfileSnapshotRow>(
    `SELECT * FROM competitor_profile_snapshots
     WHERE entity_id = $1
     ORDER BY observed_at DESC
     LIMIT 12`,
    [entity.id]
  );
  const diff = diffCompetitorProfileOutputs(input.previous, input.output, history.rows);
  const scopeKey = continuousScopeKey(input);
  const sourceSnapshotIds: string[] = [];
  for (const source of uniqueSources(input.output)) {
    const extracted = collectMonitoringSignals(input.output)
      .filter((signal) => signal.sourceUrls.includes(source.url))
      .map((signal) => ({
        id: signal.id,
        category: signal.category,
        summary: signal.summary,
        materialityScore: signal.materialityScore,
      }));
    const hash = stableContentHash({
      url: source.url,
      title: source.title,
      extracted,
    });
    const { rows } = await query<{ id: string }>(
      `INSERT INTO source_snapshots (
         entity_id, user_id, workspace_id, scope_key, job_id, source_type,
         source_url, source_title, content_hash, extracted, observed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       ON CONFLICT (entity_id, source_url, content_hash) DO UPDATE SET
         observed_at = GREATEST(source_snapshots.observed_at, EXCLUDED.observed_at)
       RETURNING id`,
      [
        entity.id,
        input.userId,
        input.workspaceId ?? null,
        scopeKey,
        input.jobId ?? null,
        inferSourceType(source.url, source.title),
        source.url,
        source.title,
        hash,
        JSON.stringify({ signals: extracted, tool: source.tool }),
        validTimestamp(source.timestamp) ? source.timestamp : input.output.generatedAt,
      ],
    );
    if (rows[0]) sourceSnapshotIds.push(rows[0].id);
  }
  const { rows } = await query<CompetitorProfileSnapshotRow>(
    `INSERT INTO competitor_profile_snapshots (
       entity_id, user_id, workspace_id, job_id, profile_hash, profile, diff,
       material_event_count, source_snapshot_ids, observed_at
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10)
     ON CONFLICT (entity_id, profile_hash) DO UPDATE SET
       observed_at = GREATEST(competitor_profile_snapshots.observed_at, EXCLUDED.observed_at),
       source_snapshot_ids = EXCLUDED.source_snapshot_ids
     RETURNING *`,
    [
      entity.id,
      input.userId,
      input.workspaceId ?? null,
      input.jobId ?? null,
      diff.profileHash,
      JSON.stringify(profile),
      JSON.stringify(diff),
      diff.materialEvents.length,
      JSON.stringify(sourceSnapshotIds),
      input.output.generatedAt,
    ],
  );
  return { entity, snapshot: rows[0], diff };
}

export async function listLatestProfileSnapshots(
  scope: ContinuousScope,
  limit = 50,
): Promise<Array<CompetitorProfileSnapshotRow & {
  display_name: string;
  official_domains: string[];
}>> {
  const { rows } = await query<CompetitorProfileSnapshotRow & {
    display_name: string;
    official_domains: string[];
  }>(
    `SELECT DISTINCT ON (s.entity_id)
       s.*, e.display_name, e.official_domains
     FROM competitor_profile_snapshots s
     JOIN canonical_entities e ON e.id = s.entity_id
     WHERE e.scope_key = $1
     ORDER BY s.entity_id, s.observed_at DESC
     LIMIT $2`,
    [continuousScopeKey(scope), Math.min(Math.max(limit, 1), 100)],
  );
  return rows;
}

export async function getLatestProfileSnapshot(
  scope: ContinuousScope,
  nameOrAlias: string,
): Promise<(CompetitorProfileSnapshotRow & {
  display_name: string;
  official_domains: string[];
}) | null> {
  const entity = await resolveCanonicalEntity(scope, nameOrAlias);
  if (!entity) return null;
  const { rows } = await query<CompetitorProfileSnapshotRow & {
    display_name: string;
    official_domains: string[];
  }>(
    `SELECT s.*, e.display_name, e.official_domains
     FROM competitor_profile_snapshots s
     JOIN canonical_entities e ON e.id = s.entity_id
     WHERE s.entity_id = $1
     ORDER BY s.observed_at DESC
     LIMIT 1`,
    [entity.id],
  );
  return rows[0] ?? null;
}

function uniqueSources(output: OrchestratorOutput) {
  return [...new Map(
    (output.outputs ?? [])
      .flatMap((agentOutput) => agentOutput.sources ?? [])
      .filter((source) => source.url)
      .map((source) => [source.url, source]),
  ).values()];
}

function inferSourceType(url: string, title: string): string {
  const value = `${url} ${title}`.toLowerCase();
  if (/pric|plans?|packag/.test(value)) return 'pricing';
  if (/changelog|release|docs/.test(value)) return 'product';
  if (/jobs?|career|greenhouse|lever/.test(value)) return 'hiring';
  if (/trust|security|cve|status/.test(value)) return 'security';
  if (/reddit|hacker news|news\.ycombinator/.test(value)) return 'sentiment';
  return 'web';
}

function validTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

