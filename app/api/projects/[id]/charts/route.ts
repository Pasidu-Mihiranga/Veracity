import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { loadObservations, saveChartSpec } from '@/lib/intelligence/ledger-repo';
import { planMetricChart, planEvidenceCoverageChart } from '@/lib/intelligence/chart-planner';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * Charts built from stored observations.
 *
 * This is the product's headline claim made real: every point comes from a
 * `metric_observation`, which cannot exist without an evidence span. No model
 * is asked for rows — the planner decides whether the observations can
 * legitimately be drawn and builds the spec from them.
 *
 * A refused chart returns its reasons rather than being dropped. "Observations
 * use incompatible units" tells a user something true about their data; a
 * missing chart tells them the product is broken.
 */

/** Human framing per metric key. The planner supplies everything else. */
const METRIC_PRESENTATION: Record<
  string,
  { title: string; question: string; definition: string }
> = {
  release_count: {
    title: 'Release cadence',
    question: 'How often does this competitor ship?',
    definition: 'Count of published, non-prerelease releases per month',
  },
  plan_price: {
    title: 'Advertised price',
    question: 'Has the advertised price changed?',
    definition: 'Price read from the pricing page',
  },
};

function presentationFor(metricKey: string) {
  if (METRIC_PRESENTATION[metricKey]) return METRIC_PRESENTATION[metricKey];

  // Per-tier keys arrive as `plan_price:pro`. Kept as distinct series on
  // purpose — collapsing tiers would make "$49 → $499" look like a price rise
  // when it is really two different plans.
  if (metricKey.startsWith('plan_price:')) {
    const tier = metricKey.slice('plan_price:'.length);
    const label = tier.charAt(0).toUpperCase() + tier.slice(1);
    return {
      title: `${label} plan price`,
      question: `Has the ${label} plan price changed?`,
      definition: `Advertised price of the ${label} plan, read from the pricing page`,
    };
  }

  return {
    title: metricKey,
    question: `How has ${metricKey} moved?`,
    definition: `Observations recorded for ${metricKey}`,
  };
}

export async function GET(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  const persist = req.nextUrl.searchParams.get('persist') === '1';

  const [metricKeys, entities, claimCoverage] = await Promise.all([
    query<{ metric_key: string }>(
      `SELECT DISTINCT metric_key FROM metric_observations
        WHERE user_id = $1 AND project_id = $2
        ORDER BY metric_key`,
      [user.id, id],
    ),
    query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM canonical_entities
        WHERE user_id = $1 AND scope_key = $2`,
      [user.id, `project:${id}`],
    ),
    // Coverage is derived from our own records, so it is labelled `derived`
    // rather than measured — it counts claims, not the outside world.
    query<{ supported: string; unsupported: string }>(
      `SELECT count(*) FILTER (WHERE cardinality(supporting_span_ids) > 0)::text AS supported,
              count(*) FILTER (WHERE cardinality(supporting_span_ids) = 0)::text AS unsupported
         FROM claims WHERE user_id = $1 AND project_id = $2`,
      [user.id, id],
    ),
  ]);

  const entityLabels = Object.fromEntries(
    entities.rows.map((row) => [row.id, row.display_name]),
  );

  const charts: unknown[] = [];
  const unavailable: Array<{ metricKey: string; title: string; reasons: string[] }> = [];

  for (const { metric_key: metricKey } of metricKeys.rows) {
    const observations = await loadObservations({ userId: user.id, projectId: id, metricKey });
    const presentation = presentationFor(metricKey);

    const sourceIds = [...new Set(observations.map((o) => o.evidenceSpanId))];

    const planned = planMetricChart({
      id: `${id}:${metricKey}`,
      metricKey,
      title: presentation.title,
      questionAnswered: presentation.question,
      metricDefinition: presentation.definition,
      observations,
      entityLabels,
      sourceIds,
    });

    if (!planned.ok) {
      unavailable.push({ metricKey, title: presentation.title, reasons: planned.reasons });
      continue;
    }

    charts.push(planned.spec);

    // Persisting is opt-in: a dashboard render should not write a row every
    // time someone opens the page.
    if (persist) {
      await saveChartSpec({ userId: user.id, projectId: id, spec: planned.spec });
    }
  }

  const coverage = planEvidenceCoverageChart({
    id: `${id}:evidence-coverage`,
    supported: Number(claimCoverage.rows[0]?.supported ?? 0),
    unsupported: Number(claimCoverage.rows[0]?.unsupported ?? 0),
  });
  if (coverage.ok) charts.push(coverage.spec);

  return apiSuccess({ charts, unavailable });
}
