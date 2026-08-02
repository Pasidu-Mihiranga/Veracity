/**
 * Project collection: the link between a Market Project and the evidence ledger.
 *
 * Everything else in `lib/intelligence/` was reachable only from tests. This is
 * what actually populates the ledger for a real project, so the dashboard has
 * something to show. Without it the pipeline is a library, not a product.
 *
 * The shape of a run:
 *
 *   project → source definitions → collect each → snapshot/diff → ledger
 *
 * Source discovery is deliberately conservative. A guessed URL that 404s costs
 * a request and teaches nothing; worse, a guessed URL that resolves to the
 * *wrong* company produces evidence attributed to an entity it does not
 * describe. Only URLs the user supplied, or paths derived from those, are
 * fetched.
 */

import { query } from '@/lib/db';
import { safeFetch, OutboundPolicyError } from '@/lib/net/outbound-policy';
import { runCollection, type CollectionPorts, type SourceDefinition, type CollectionResult } from './collection-run';
import { extractEvidence } from './evidence-extractor';
import { saveSnapshot, saveExtractedEvidence, saveChangeEvent } from './ledger-repo';
import { extractPrices, pricesToSpans } from './connectors/pricing-extractor';
import { parseRepo, fetchReleases, releasesToMonthlyCounts, releasesToSpans } from './connectors/github-releases';
import { fetchFeed, candidateFeedUrls, feedEntriesToSpans } from './connectors/changelog-rss';
import type { ExtractedSpan } from './evidence-extractor';
import { logger } from '@/lib/logger';

export interface CollectableProject {
  id: string;
  product: string;
  product_url: string | null;
  competitors: string[];
  approved_sources: string[];
  blocked_sources: string[];
  decision_context: string | null;
}

/** Paths worth checking on a company site, in value order. */
const DERIVED_PATHS = ['/pricing', '/changelog', '/blog'];

/**
 * Resolve or create the canonical entity for a name.
 *
 * Scoped to the project so two projects tracking the same competitor keep
 * separate entities — their snapshots and change history should not interleave.
 */
async function resolveEntity(params: {
  userId: string;
  projectId: string;
  name: string;
  role: 'product' | 'competitor';
}): Promise<string> {
  const entityKey = params.name.trim().toLowerCase().replace(/\s+/g, '-');
  const scopeKey = `project:${params.projectId}`;

  const existing = await query<{ id: string }>(
    `SELECT id FROM canonical_entities
      WHERE user_id = $1 AND scope_key = $2 AND entity_key = $3 AND entity_type = $4`,
    [params.userId, scopeKey, entityKey, params.role],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query<{ id: string }>(
    `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.userId, scopeKey, entityKey, params.role, params.name.trim()],
  );
  return created.rows[0].id;
}

/** Is this URL blocked by the project's source policy? */
function isBlocked(url: string, blocked: string[]): boolean {
  if (blocked.length === 0) return false;
  const lower = url.toLowerCase();
  // Substring match on the host is what a user means by "block this domain".
  return blocked.some((pattern) => pattern && lower.includes(pattern.toLowerCase()));
}

/**
 * Build the source list for a project.
 *
 * Approved sources come first and are never filtered by the blocklist — an
 * explicit approval is a stronger signal than a pattern.
 */
export async function buildSourceDefinitions(
  userId: string,
  project: CollectableProject,
): Promise<SourceDefinition[]> {
  const sources: SourceDefinition[] = [];

  const entities: Array<{ name: string; url: string | null; role: 'product' | 'competitor' }> = [
    { name: project.product, url: project.product_url, role: 'product' },
    ...project.competitors.map((name) => ({ name, url: null, role: 'competitor' as const })),
  ];

  for (const entity of entities) {
    const entityId = await resolveEntity({
      userId,
      projectId: project.id,
      name: entity.name,
      role: entity.role,
    });

    // Approved sources the user explicitly attached to this project.
    for (const approved of project.approved_sources) {
      if (!approved.toLowerCase().includes(entity.name.toLowerCase().split(' ')[0])) continue;
      sources.push({
        url: approved,
        entityId,
        entityLabel: entity.name,
        sourceType: 'page',
        isTracked: true,
        sourceTrust: 'official',
      });
    }

    if (!entity.url) continue;

    for (const path of DERIVED_PATHS) {
      const candidate = entity.url.replace(/\/$/, '') + path;
      if (isBlocked(candidate, project.blocked_sources)) continue;
      sources.push({
        url: candidate,
        entityId,
        entityLabel: entity.name,
        sourceType: path.replace('/', '') || 'page',
        isTracked: true,
        sourceTrust: 'official',
      });
    }
  }

  // Deduplicate by URL — an approved source can repeat a derived path.
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Structured extraction that runs *before* the model.
 *
 * A pricing page yields prices by regex against its own text, a GitHub URL
 * yields release counts, a feed yields dated entries. These are measured: no
 * model reads them, so nothing can be hallucinated. The model-backed extractor
 * runs only for what these cannot cover.
 */
async function structuredSpans(
  source: SourceDefinition,
  normalizedContent: string,
): Promise<ExtractedSpan[]> {
  const spans: ExtractedSpan[] = [];

  if (source.sourceType === 'pricing') {
    spans.push(...pricesToSpans(extractPrices(normalizedContent), source.entityLabel));
  }

  const repo = parseRepo(source.url);
  if (repo) {
    const releases = await fetchReleases(source.url);
    if (releases.ok) {
      spans.push(...releasesToSpans(releasesToMonthlyCounts(releases.data), source.entityLabel));
    }
  }

  return spans;
}

/** Ports backed by real HTTP and the real ledger. */
function createProjectPorts(userId: string, projectId: string): CollectionPorts {
  return {
    async fetchPage(url) {
      try {
        const response = await safeFetch(url, {
          headers: { 'User-Agent': 'veracity-market-intelligence' },
          timeoutMs: 15_000,
        });
        if (!response.ok) return null;
        const content = await response.text();
        return { content, title: content.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() };
      } catch (err) {
        // A blocked URL is a policy outcome, not an error worth escalating —
        // the run continues and the source is reported unreachable.
        if (err instanceof OutboundPolicyError) {
          logger.warn('collection.url_blocked', { url, reason: err.reason });
          return null;
        }
        return null;
      }
    },

    async previousHash(url, entityId) {
      const { rows } = await query<{ content_hash: string }>(
        `SELECT content_hash FROM source_snapshots
          WHERE user_id = $1 AND entity_id = $2 AND source_url = $3
          ORDER BY observed_at DESC LIMIT 1`,
        [userId, entityId, url],
      );
      return rows[0]?.content_hash ?? null;
    },

    async previousMetrics(entityId) {
      // The most recent value per metric key. DISTINCT ON needs the ordering to
      // start with the partition column, hence metric_key first.
      const { rows } = await query<{ metric_key: string; value: number; unit: string }>(
        `SELECT DISTINCT ON (metric_key) metric_key, value::float8 AS value, unit
           FROM metric_observations
          WHERE user_id = $1 AND entity_id = $2
          ORDER BY metric_key, observed_at DESC`,
        [userId, entityId],
      );
      return new Map(rows.map((r) => [r.metric_key, { value: r.value, unit: r.unit }]));
    },

    async saveSnapshot({ source, snapshot }) {
      const stored = await saveSnapshot({
        userId,
        projectId,
        entityId: source.entityId,
        snapshot,
        scopeKey: `project:${projectId}`,
      });
      return stored.id;
    },

    async extract({ normalizedContent, entityName, sourceUrl }) {
      const source = { url: sourceUrl, entityLabel: entityName } as SourceDefinition;
      const structured = await structuredSpans(
        { ...source, sourceType: sourceUrl.includes('/pricing') ? 'pricing' : 'page' } as SourceDefinition,
        normalizedContent,
      );

      // Structured extraction is measured and cheap, so it is preferred. The
      // model runs only to cover what regex and APIs cannot.
      const model = await extractEvidence({ normalizedContent, entityName, sourceUrl });

      if (structured.length === 0 && model.status === 'failed') {
        return { spans: [], status: 'failed' };
      }

      return {
        spans: [...structured, ...model.spans],
        status: model.status === 'failed' ? 'partial' : model.status,
      };
    },

    async saveEvidence({ snapshotId, entityId, spans }) {
      await saveExtractedEvidence({ userId, projectId, entityId, snapshotId, spans });
    },

    async saveChangeEvent(event) {
      const result = await saveChangeEvent({ userId, projectId, event });
      return result.isNew;
    },
  };
}

/**
 * Collect a project's sources and write everything to the ledger.
 *
 * Returns the per-source outcome so a caller can report exactly what happened —
 * including which sources were unreachable, which is information the user needs
 * to distinguish "nothing changed" from "we could not look".
 */
export async function collectProject(params: {
  userId: string;
  project: CollectableProject;
}): Promise<CollectionResult & { sourcesConsidered: number }> {
  const { userId, project } = params;

  const sources = await buildSourceDefinitions(userId, project);
  const ports = createProjectPorts(userId, project.id);

  const result = await runCollection(sources, ports, {
    decisionFocus: project.decision_context,
  });

  logger.info('collection.completed', {
    projectId: project.id,
    sourcesChecked: result.stats.sourcesChecked,
    unchanged: result.stats.unchanged,
    changed: result.stats.changed,
    unreachable: result.stats.unreachable,
    shortCircuitRate: result.stats.shortCircuitRate,
    materialChanges: result.materialChanges.length,
  });

  return { ...result, sourcesConsidered: sources.length };
}

/**
 * Discover a usable changelog feed for a site.
 *
 * Tries the common paths in order and stops at the first that parses. Exported
 * so project setup can offer a discovered feed for the user to approve, rather
 * than the collector silently adopting one.
 */
export async function discoverFeed(siteUrl: string): Promise<string | null> {
  for (const candidate of candidateFeedUrls(siteUrl)) {
    const result = await fetchFeed(candidate);
    if (result.ok && result.entries.length > 0) return candidate;
  }
  return null;
}

export { feedEntriesToSpans };
