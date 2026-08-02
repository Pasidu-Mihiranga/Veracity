/**
 * Project collection — source derivation and policy.
 *
 * This module is the link that makes the whole pipeline reachable for a real
 * project, so the tests focus on the decisions that determine what gets fetched
 * at all: source derivation, the blocklist, approval precedence, and dedupe.
 *
 * Fetching and persistence are covered by collection-run and the ledger smoke
 * suites; repeating them here would test the mocks rather than the logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { connect: vi.fn() },
}));

import {
  buildSourceDefinitions,
  type CollectableProject,
} from '@/lib/intelligence/project-collection';

function project(over: Partial<CollectableProject> = {}): CollectableProject {
  return {
    id: 'proj-1',
    product: 'Vector Agents',
    product_url: 'https://vectoragents.ai',
    competitors: ['Lilian'],
    approved_sources: [],
    blocked_sources: [],
    decision_context: 'pricing',
    ...over,
  };
}

beforeEach(() => {
  queryMock.mockReset();
  // Entity resolution: first SELECT misses, the INSERT returns a new id.
  let n = 0;
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM canonical_entities')) return { rows: [] };
    if (sql.includes('INSERT INTO canonical_entities')) {
      n += 1;
      return { rows: [{ id: `ent-${n}` }] };
    }
    return { rows: [] };
  });
});

describe('source derivation', () => {
  it('derives the high-value paths from a product URL', async () => {
    const sources = await buildSourceDefinitions('user-1', project());
    const urls = sources.map((s) => s.url);

    expect(urls).toContain('https://vectoragents.ai/pricing');
    expect(urls).toContain('https://vectoragents.ai/changelog');
    expect(urls).toContain('https://vectoragents.ai/blog');
  });

  it('does not invent URLs for a competitor with no site', async () => {
    // A guessed URL that resolves to the wrong company produces evidence
    // attributed to an entity it does not describe — worse than no evidence.
    const sources = await buildSourceDefinitions('user-1', project());
    expect(sources.every((s) => s.url.startsWith('https://vectoragents.ai'))).toBe(true);
  });

  it('returns nothing when there is no URL and no approved source', async () => {
    const sources = await buildSourceDefinitions(
      'user-1',
      project({ product_url: null, competitors: [] }),
    );
    expect(sources).toEqual([]);
  });

  it('gives every source an entity and a label', async () => {
    const sources = await buildSourceDefinitions('user-1', project());
    expect(sources.every((s) => Boolean(s.entityId) && Boolean(s.entityLabel))).toBe(true);
  });

  it('marks derived sources as official and tracked', async () => {
    // They come from the user's own declared product URL, so materiality should
    // not discount them as untrusted.
    const sources = await buildSourceDefinitions('user-1', project());
    expect(sources.every((s) => s.sourceTrust === 'official' && s.isTracked)).toBe(true);
  });

  it('tags a pricing page so the structured extractor runs on it', async () => {
    const sources = await buildSourceDefinitions('user-1', project());
    const pricing = sources.find((s) => s.url.endsWith('/pricing'));
    expect(pricing?.sourceType).toBe('pricing');
  });
});

describe('source policy', () => {
  it('honours the blocklist for derived paths', async () => {
    const sources = await buildSourceDefinitions(
      'user-1',
      project({ blocked_sources: ['vectoragents.ai/blog'] }),
    );
    expect(sources.map((s) => s.url)).not.toContain('https://vectoragents.ai/blog');
    expect(sources.map((s) => s.url)).toContain('https://vectoragents.ai/pricing');
  });

  it('lets an explicit approval outrank the blocklist', async () => {
    // An explicit approval is a stronger signal than a pattern. A user who
    // approved a specific URL means it.
    const sources = await buildSourceDefinitions(
      'user-1',
      project({
        approved_sources: ['https://vectoragents.ai/blog/pricing-update'],
        blocked_sources: ['vectoragents.ai/blog'],
      }),
    );
    expect(sources.map((s) => s.url)).toContain('https://vectoragents.ai/blog/pricing-update');
  });

  it('blocks an entire domain when asked', async () => {
    const sources = await buildSourceDefinitions(
      'user-1',
      project({ blocked_sources: ['vectoragents.ai'] }),
    );
    expect(sources).toEqual([]);
  });
});

describe('deduplication', () => {
  it('does not fetch the same URL twice', async () => {
    // An approved source often repeats a path the deriver would produce anyway.
    const sources = await buildSourceDefinitions(
      'user-1',
      project({ approved_sources: ['https://vectoragents.ai/pricing'] }),
    );
    const pricing = sources.filter((s) => s.url.replace(/\/$/, '').endsWith('/pricing'));
    expect(pricing).toHaveLength(1);
  });

  it('treats a trailing slash as the same URL', async () => {
    const sources = await buildSourceDefinitions(
      'user-1',
      project({ approved_sources: ['https://vectoragents.ai/pricing/'] }),
    );
    const pricing = sources.filter((s) => s.url.toLowerCase().includes('/pricing'));
    expect(pricing).toHaveLength(1);
  });
});

describe('entity resolution', () => {
  it('reuses an existing entity rather than creating a duplicate', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM canonical_entities')) return { rows: [{ id: 'ent-existing' }] };
      if (sql.includes('INSERT INTO canonical_entities')) {
        throw new Error('should not insert when the entity already exists');
      }
      return { rows: [] };
    });

    const sources = await buildSourceDefinitions('user-1', project());
    expect(sources.every((s) => s.entityId === 'ent-existing')).toBe(true);
  });

  it('scopes entities per project', async () => {
    // Two projects tracking the same competitor must keep separate entities, or
    // their snapshots and change history interleave.
    await buildSourceDefinitions('user-1', project({ id: 'proj-abc' }));
    const scopeArgs = queryMock.mock.calls
      .filter(([sql]) => String(sql).includes('canonical_entities'))
      .map(([, params]) => (params as unknown[])[1]);
    expect(scopeArgs.every((s) => s === 'project:proj-abc')).toBe(true);
  });
});
