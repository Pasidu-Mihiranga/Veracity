import { randomUUID } from 'node:crypto';
import { query as dbQuery } from '@/lib/db';
import type { OrchestratorOutput } from '@/lib/agents/types';
import { processMonitoringJobResult } from '@/lib/monitoring/process-result';

const userId = randomUUID();
const previousJobId = randomUUID();
const currentJobId = randomUUID();
const executionPrefix = `phase5-b5-${randomUUID()}`;
const product = 'Synthetic Product';
const competitor = 'Synthetic Competitor';

async function main() {
  const previous = monitoringOutput([
    'Enterprise pricing is $20 per user per month.',
    'Documentation describes the platform as easy to use.',
  ]);
  const current = monitoringOutput([
    'Enterprise pricing increased from $20 to $25 per user per month.',
    'Documentation wording now describes the platform as simple to use.',
  ]);

  try {
    await dbQuery(
      `INSERT INTO research_jobs (
         id, execution_id, user_id, status, request, result, finished_at
       ) VALUES
       ($1, $2, $3, 'completed', $4::jsonb, $5::jsonb, now() - interval '1 minute'),
       ($6, $7, $3, 'completed', $4::jsonb, $8::jsonb, now())`,
      [
        previousJobId,
        `${executionPrefix}-previous`,
        userId,
        JSON.stringify({ kind: 'monitoring', competitor }),
        JSON.stringify(previous),
        currentJobId,
        `${executionPrefix}-current`,
        JSON.stringify(current),
      ],
    );

    await processMonitoringJobResult({
      userId,
      jobId: currentJobId,
      product,
      competitor,
      output: current,
      succeeded: true,
    });

    const { rows: alerts } = await dbQuery<{
      severity: string;
      diff: {
        category?: string;
        sourceUrls?: string[];
        materialityScore?: number;
        suppressedSignalCount?: number;
        materialityBasis?: string;
        profileSnapshotId?: string;
      };
    }>(
      `SELECT severity, diff FROM alert_events WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    const { rows: timeline } = await dbQuery<{
      category: string;
      materiality_score: number;
    }>(
      `SELECT category, materiality_score
       FROM competitive_events
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId],
    );
    const { rows: profiles } = await dbQuery<{
      material_event_count: number;
      diff: { changedFields?: string[] };
    }>(
      `SELECT material_event_count, diff
       FROM competitor_profile_snapshots
       WHERE user_id = $1`,
      [userId],
    );
    const { rows: boardPacks } = await dbQuery<{
      event_count: number;
      pack: { source?: string };
    }>(
      `SELECT event_count, pack
       FROM board_pack_snapshots
       WHERE user_id = $1`,
      [userId],
    );

    const pricingAlerts = alerts.filter((alert) => alert.diff.category === 'pricing');
    const passed = alerts.length === 1
      && pricingAlerts.length === 1
      && (pricingAlerts[0].diff.materialityScore ?? 0) >= 0.65
      && (pricingAlerts[0].diff.suppressedSignalCount ?? 0) >= 1
      && pricingAlerts[0].diff.sourceUrls?.includes('https://example.com/pricing') === true
      && pricingAlerts[0].diff.materialityBasis === 'profile-diff'
      && Boolean(pricingAlerts[0].diff.profileSnapshotId)
      && timeline.length === 1
      && timeline[0].category === 'pricing'
      && profiles.length === 1
      && profiles[0].material_event_count === 1
      && profiles[0].diff.changedFields?.includes('pricing') === true
      && boardPacks.length === 1
      && boardPacks[0].event_count === 1
      && boardPacks[0].pack.source === 'continuous-intelligence';

    console.log(JSON.stringify({
      benchmark: 'B5',
      passed,
      alerts: alerts.length,
      pricingAlerts: pricingAlerts.length,
      copyOnlySignalsSuppressed: pricingAlerts[0]?.diff.suppressedSignalCount ?? 0,
      timelineEvents: timeline.length,
      materialityScore: timeline[0]?.materiality_score ?? null,
      profileSnapshots: profiles.length,
      boardPacks: boardPacks.length,
    }, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    await dbQuery(`DELETE FROM board_pack_snapshots WHERE user_id = $1`, [userId]).catch(() => {});
    await dbQuery(
      `DELETE FROM canonical_entities WHERE user_id = $1`,
      [userId],
    ).catch(() => {});
    await dbQuery(`DELETE FROM competitive_events WHERE user_id = $1`, [userId]).catch(() => {});
    await dbQuery(`DELETE FROM alert_events WHERE user_id = $1`, [userId]).catch(() => {});
    await dbQuery(
      `DELETE FROM research_jobs WHERE id = ANY($1::uuid[])`,
      [[previousJobId, currentJobId]],
    ).catch(() => {});
  }
}

function monitoringOutput(facts: string[]): OrchestratorOutput {
  return {
    query: `Report only material changes for ${competitor}.`,
    product,
    competitor,
    agentRuns: [],
    outputs: [{
      agentId: 'pricing',
      domain: 'pricing',
      confidence: 'high',
      confidenceScore: 0.9,
      facts,
      interpretation: [],
      sources: [{
        title: 'Official pricing and product update',
        url: 'https://example.com/pricing',
        timestamp: '2026-07-29T00:00:00.000Z',
        tool: 'firecrawl',
      }],
      generatedAt: '2026-07-29T00:00:00.000Z',
      artifactType: 'pricing-table',
    }],
    synthesizedAnswer: facts.join(' '),
    topRecommendations: [],
    suggestedFollowUps: [],
    totalConfidence: 'high',
    generatedAt: '2026-07-29T00:00:00.000Z',
  };
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

