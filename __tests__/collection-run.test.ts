/**
 * Collection-run tests.
 *
 * These encode the Wave 2 exit criterion from the plan: change a controlled
 * page and exactly one traceable event appears; run again unchanged and there
 * are zero events and zero model calls.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runCollection,
  type CollectionPorts,
  type SourceDefinition,
} from '@/lib/intelligence/collection-run';
import { prepareSnapshot } from '@/lib/intelligence/snapshot-store';
import type { ExtractedSpan } from '@/lib/intelligence/evidence-extractor';

const PRICING_URL = 'https://lilian.example/pricing';

const source: SourceDefinition = {
  url: PRICING_URL,
  entityId: 'ent-lilian',
  entityLabel: 'Lilian',
  sourceType: 'page',
  isTracked: true,
  sourceTrust: 'official',
};

function priceSpan(value: number, excerpt: string): ExtractedSpan {
  return {
    excerpt,
    startOffset: 0,
    endOffset: excerpt.length,
    extractionType: 'price',
    entityMatch: 'confirmed',
    statement: `Lilian team plan costs $${value}`,
    metric: {
      key: 'plan_price',
      value,
      unit: 'USD/month',
      periodStart: null,
      periodEnd: null,
      isEstimated: false,
    },
  };
}

/** Ports backed by in-memory state, so the pipeline logic is what is tested. */
function makePorts(overrides: Partial<CollectionPorts> = {}) {
  const hashes = new Map<string, string>();
  const metrics = new Map<string, Map<string, { value: number; unit: string }>>();
  const events = new Set<string>();

  const extract = vi.fn(async () => ({ spans: [] as ExtractedSpan[], status: 'ok' as const }));
  const saveSnapshot = vi.fn(async ({ source: s, snapshot }) => {
    hashes.set(`${s.entityId}|${s.url}`, snapshot.contentHash);
    return `snap-${snapshot.contentHash.slice(0, 8)}`;
  });
  const saveEvidence = vi.fn(async ({ entityId, spans }) => {
    const forEntity = metrics.get(entityId) ?? new Map();
    for (const span of spans) {
      if (span.metric) {
        forEntity.set(span.metric.key, { value: span.metric.value, unit: span.metric.unit });
      }
    }
    metrics.set(entityId, forEntity);
  });
  const saveChangeEvent = vi.fn(async (event: { dedupeKey: string }) => {
    if (events.has(event.dedupeKey)) return false;
    events.add(event.dedupeKey);
    return true;
  });

  const ports: CollectionPorts = {
    fetchPage: vi.fn(async () => ({ content: 'Team plan is $49 per month.', title: 'Pricing' })),
    previousHash: vi.fn(async (url, entityId) => hashes.get(`${entityId}|${url}`) ?? null),
    previousMetrics: vi.fn(async (entityId) => metrics.get(entityId) ?? new Map()),
    saveSnapshot,
    extract,
    saveEvidence,
    saveChangeEvent,
    ...overrides,
  };

  // Return the ports' own functions, not the locals above: an override passed
  // by a caller replaces the default, and asserting against the default spy
  // would silently check a function the pipeline never called.
  return {
    ports,
    hashes,
    metrics,
    events,
    extract: ports.extract as typeof extract,
    saveSnapshot: ports.saveSnapshot as typeof saveSnapshot,
    saveChangeEvent: ports.saveChangeEvent as typeof saveChangeEvent,
  };
}

/** Seed the store as though a previous run had already seen this content. */
function seed(hashes: Map<string, string>, content: string) {
  const prepared = prepareSnapshot({ url: PRICING_URL, content });
  if (!prepared.ok) throw new Error('fixture content is not storable');
  hashes.set(`${source.entityId}|${PRICING_URL}`, prepared.snapshot.contentHash);
  return prepared.snapshot.contentHash;
}

describe('no-change short circuit', () => {
  it('skips extraction entirely when content is unchanged', async () => {
    // The economic heart of the product: a quiet week must cost one HTTP
    // request and zero model calls.
    const { ports, hashes, extract, saveSnapshot } = makePorts();
    seed(hashes, 'Team plan is $49 per month.');

    const result = await runCollection([source], ports);

    expect(result.outcomes[0].status).toBe('unchanged');
    expect(result.outcomes[0].skippedExpensiveWork).toBe(true);
    expect(extract).not.toHaveBeenCalled();
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(result.stats.shortCircuitRate).toBe(1);
  });

  it('treats cosmetic differences as unchanged', async () => {
    // A re-rendered timestamp must not read as a competitor changing something.
    const { ports, hashes, extract } = makePorts({
      fetchPage: async () => ({
        content: 'Team plan is $49 per month.\nGenerated 2026-08-02T11:30:45Z',
      }),
    });
    seed(hashes, 'Team plan is $49 per month.\nGenerated 2026-08-01T10:00:00Z');

    const result = await runCollection([source], ports);

    expect(result.outcomes[0].status).toBe('unchanged');
    expect(extract).not.toHaveBeenCalled();
  });

  it('reports the short-circuit rate across a mixed run', async () => {
    const { ports, hashes } = makePorts({
      fetchPage: async (url) =>
        url.includes('pricing')
          ? { content: 'Team plan is $49 per month.' }
          : { content: 'Something new' },
    });
    seed(hashes, 'Team plan is $49 per month.');

    const result = await runCollection(
      [source, { ...source, url: 'https://lilian.example/changelog' }],
      ports,
    );

    expect(result.stats.unchanged).toBe(1);
    expect(result.stats.shortCircuitRate).toBe(0.5);
  });
});

describe('detecting a real change', () => {
  it('emits exactly one traceable event when a price moves', async () => {
    const { ports, hashes, metrics, extract } = makePorts({
      fetchPage: async () => ({ content: 'Team plan is $59 per month.' }),
      extract: vi.fn(async () => ({
        spans: [priceSpan(59, 'Team plan is $59 per month')],
        status: 'ok' as const,
      })),
    });
    seed(hashes, 'Team plan is $49 per month.');
    metrics.set('ent-lilian', new Map([['plan_price', { value: 49, unit: 'USD/month' }]]));

    const result = await runCollection([source], ports, { decisionFocus: 'pricing' });

    expect(extract).toHaveBeenCalledTimes(1);
    expect(result.outcomes[0].status).toBe('changed');
    expect(result.outcomes[0].changeCount).toBe(1);

    expect(result.materialChanges).toHaveLength(1);
    const event = result.materialChanges[0].event;
    expect(event.eventType).toBe('pricing_changed');
    expect(event.beforeValue).toBe('49 USD/month');
    expect(event.afterValue).toBe('59 USD/month');
    // The score has to be explainable, not just a number.
    expect(event.materialityReason).toContain('pricing decision');
  });

  it('does not report the same change twice across runs', async () => {
    // The <2% duplicate target depends entirely on this.
    const { ports, hashes, metrics } = makePorts({
      fetchPage: async () => ({ content: 'Team plan is $59 per month.' }),
      extract: vi.fn(async () => ({
        spans: [priceSpan(59, 'Team plan is $59 per month')],
        status: 'ok' as const,
      })),
    });
    seed(hashes, 'Team plan is $49 per month.');
    metrics.set('ent-lilian', new Map([['plan_price', { value: 49, unit: 'USD/month' }]]));

    const first = await runCollection([source], ports);
    expect(first.materialChanges).toHaveLength(1);

    // Force the same comparison again, as a re-collection after a cache purge
    // would.
    hashes.set(`${source.entityId}|${PRICING_URL}`, 'stale-hash');
    metrics.set('ent-lilian', new Map([['plan_price', { value: 49, unit: 'USD/month' }]]));

    const second = await runCollection([source], ports);
    expect(second.materialChanges).toHaveLength(0);
    expect(second.outcomes[0].changeCount).toBe(0);
  });

  it('does not treat a first sighting as a change', async () => {
    const { ports } = makePorts({
      extract: vi.fn(async () => ({
        spans: [priceSpan(49, 'Team plan is $49 per month')],
        status: 'ok' as const,
      })),
    });

    const result = await runCollection([source], ports);

    expect(result.outcomes[0].status).toBe('new');
    expect(result.outcomes[0].changeCount).toBe(0);
    expect(result.materialChanges).toHaveLength(0);
  });

  it('keeps an immaterial change out of the digest while still recording it', async () => {
    const { ports, hashes, metrics } = makePorts({
      fetchPage: async () => ({ content: 'Docs updated slightly.' }),
      extract: vi.fn(async () => ({
        spans: [
          {
            ...priceSpan(101, 'Docs page word count is 101'),
            extractionType: 'other' as const,
            metric: {
              key: 'doc_words', value: 101, unit: 'words',
              periodStart: null, periodEnd: null, isEstimated: false,
            },
          },
        ],
        status: 'ok' as const,
      })),
    });
    seed(hashes, 'Docs.');
    metrics.set('ent-lilian', new Map([['doc_words', { value: 100, unit: 'words' }]]));

    const result = await runCollection(
      [{ ...source, sourceTrust: 'community' }],
      ports,
    );

    // Recorded in the ledger, but not pushed at the user.
    expect(result.outcomes[0].changeCount).toBe(1);
    expect(result.materialChanges).toHaveLength(0);
  });
});

describe('degradation', () => {
  it('continues past an unreachable source', async () => {
    const { ports } = makePorts({
      fetchPage: vi.fn(async (url) => (url.includes('pricing') ? null : { content: 'Fresh page' })),
    });

    const result = await runCollection(
      [source, { ...source, url: 'https://lilian.example/changelog' }],
      ports,
    );

    expect(result.outcomes[0].status).toBe('unreachable');
    expect(result.outcomes[1].status).toBe('new');
    expect(result.stats.unreachable).toBe(1);
  });

  it('continues past a source that throws', async () => {
    const { ports } = makePorts({
      fetchPage: vi.fn(async (url) => {
        if (url.includes('pricing')) throw new Error('connection reset');
        return { content: 'Fresh page' };
      }),
    });

    const result = await runCollection(
      [source, { ...source, url: 'https://lilian.example/changelog' }],
      ports,
    );

    expect(result.outcomes[0].status).toBe('unreachable');
    expect(result.outcomes[0].detail).toContain('connection reset');
    expect(result.outcomes[1].status).toBe('new');
  });

  it('keeps the snapshot but claims no evidence when extraction fails', async () => {
    const { ports, saveSnapshot } = makePorts({
      extract: vi.fn(async () => ({ spans: [], status: 'failed' as const })),
    });

    const result = await runCollection([source], ports);

    expect(result.outcomes[0].status).toBe('extraction-failed');
    expect(result.outcomes[0].spanCount).toBe(0);
    // The page is still a record of what the source said at that moment.
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
  });

  it('records an empty page as unreachable rather than storing it', async () => {
    // Storing a failed fetch as an empty page makes the real content look like
    // a change when it returns.
    const { ports } = makePorts({ fetchPage: async () => ({ content: '   \n ' }) });
    const result = await runCollection([source], ports);
    expect(result.outcomes[0].status).toBe('unreachable');
    expect(result.outcomes[0].detail).toBe('empty-content');
  });

  it('handles an empty source list without dividing by zero', async () => {
    const { ports } = makePorts();
    const result = await runCollection([], ports);
    expect(result.stats.shortCircuitRate).toBe(0);
    expect(result.outcomes).toEqual([]);
  });
});
