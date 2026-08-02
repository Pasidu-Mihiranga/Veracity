/**
 * The shared evidence pack.
 *
 * A citation the agent made is testimony about what it used; a similarity score
 * computed afterwards is an inference about what it might have used. The pack
 * exists to get the first kind. These tests hold the line that citing is
 * preferred but never trusted blindly — an invented id is stripped exactly as a
 * hallucinated URL would be, and a cited excerpt still has to support the
 * statement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const saveVerifiedClaims = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { connect: vi.fn() },
}));
vi.mock('@/lib/intelligence/ledger-repo', () => ({
  saveVerifiedClaims: (...args: unknown[]) => saveVerifiedClaims(...args),
}));

import {
  buildEvidencePack,
  extractCitations,
  spanById,
  EMPTY_PACK,
  type EvidencePack,
} from '@/lib/intelligence/evidence-pack';
import { storeResearchClaims } from '@/lib/intelligence/claims-from-research';

const SPAN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const PACK_ROWS = [
  {
    id: SPAN_ID,
    excerpt: 'The Team plan is $59 per month for up to ten seats.',
    entity_match: 'confirmed',
    source_url: 'https://lilian.example/pricing',
    entity_label: 'Lilian',
    metric_key: 'plan_price',
    metric_value: 59,
    metric_unit: 'USD/month',
  },
  {
    id: OTHER_ID,
    excerpt: 'SSO and SCIM are available on the Enterprise plan.',
    entity_match: 'probable',
    source_url: 'https://lilian.example/enterprise',
    entity_label: 'Lilian',
    metric_key: null,
    metric_value: null,
    metric_unit: null,
  },
];

function pack(): EvidencePack {
  return {
    projectId: 'p1',
    spans: PACK_ROWS.map((r) => ({
      id: r.id,
      excerpt: r.excerpt,
      sourceUrl: r.source_url,
      entityLabel: r.entity_label!,
      entityMatch: r.entity_match,
      metric: r.metric_key
        ? { key: r.metric_key, value: r.metric_value!, unit: r.metric_unit! }
        : undefined,
    })),
    promptBlock: 'stub',
    validIds: new Set(PACK_ROWS.map((r) => r.id)),
  };
}

beforeEach(() => {
  queryMock.mockReset();
  saveVerifiedClaims.mockReset();
  saveVerifiedClaims.mockResolvedValue({ saved: [{ id: 'c1', statement: 'x' }], rejected: [] });
});

describe('building the pack', () => {
  beforeEach(() => {
    queryMock.mockResolvedValue({ rows: PACK_ROWS });
  });

  it('renders ids the agent can cite', async () => {
    const built = await buildEvidencePack({ userId: 'u1', projectId: 'p1' });
    expect(built.promptBlock).toContain(`[${SPAN_ID}]`);
    expect(built.promptBlock).toContain('Team plan is $59');
    expect(built.validIds.has(SPAN_ID)).toBe(true);
  });

  it('surfaces a backing measurement so the agent can state it exactly', () => {
    return buildEvidencePack({ userId: 'u1', projectId: 'p1' }).then((built) => {
      expect(built.promptBlock).toContain('measured: plan_price = 59 USD/month');
    });
  });

  it('tells the agent not to cite where the excerpt does not support', async () => {
    // Without this, models cite the nearest-looking span on every line, which
    // produces confident citations that do not support what they are attached
    // to — worse than none, because it looks checked.
    const built = await buildEvidencePack({ userId: 'u1', projectId: 'p1' });
    expect(built.promptBlock).toContain('Cite only');
    expect(built.promptBlock).toContain('never invent an id');
  });

  it('excludes spans matched to the wrong entity', async () => {
    const sql = queryMock.mock.calls[0]?.[0] ?? '';
    await buildEvidencePack({ userId: 'u1', projectId: 'p1' });
    expect(String(queryMock.mock.calls[0][0])).toContain("entity_match <> 'mismatch'");
    expect(String(sql)).toBeDefined();
  });

  it('renders nothing for a project with no evidence', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const built = await buildEvidencePack({ userId: 'u1', projectId: 'p1' });
    expect(built.promptBlock).toBe('');
    expect(built.spans).toEqual([]);
  });
});

describe('citation extraction', () => {
  it('pulls out ids the agent was actually given', () => {
    const result = extractCitations(`The Team plan is $59 per month [${SPAN_ID}]`, pack());
    expect(result.citedSpanIds).toEqual([SPAN_ID]);
    expect(result.hallucinatedIds).toEqual([]);
  });

  it('strips the markup so bracket ids never reach the user', () => {
    const result = extractCitations(`The Team plan is $59 per month [${SPAN_ID}]`, pack());
    expect(result.statement).toBe('The Team plan is $59 per month');
    expect(result.statement).not.toContain('[');
  });

  it('drops an id the agent invented', () => {
    // Exactly as a hallucinated URL would be dropped.
    const ghost = '99999999-9999-4999-8999-999999999999';
    const result = extractCitations(`Revenue tripled [${ghost}]`, pack());
    expect(result.citedSpanIds).toEqual([]);
    expect(result.hallucinatedIds).toEqual([ghost]);
  });

  it('deduplicates a repeated citation', () => {
    const result = extractCitations(`A [${SPAN_ID}] and again [${SPAN_ID}]`, pack());
    expect(result.citedSpanIds).toEqual([SPAN_ID]);
  });

  it('leaves an uncited statement untouched', () => {
    const result = extractCitations('The market is consolidating', pack());
    expect(result.statement).toBe('The market is consolidating');
    expect(result.citedSpanIds).toEqual([]);
  });

  it('looks a span up by id', () => {
    expect(spanById(pack(), SPAN_ID)?.excerpt).toContain('Team plan');
    expect(spanById(pack(), 'nope')).toBeUndefined();
  });

  it('treats the empty pack as citing nothing', () => {
    const result = extractCitations(`Anything [${SPAN_ID}]`, EMPTY_PACK);
    expect(result.citedSpanIds).toEqual([]);
    expect(result.hallucinatedIds).toEqual([SPAN_ID]);
  });
});

describe('citations reaching the ledger', () => {
  function wireSpans() {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_spans')) {
        return {
          rows: PACK_ROWS.map((r) => ({
            id: r.id,
            snapshot_id: 'snap-1',
            excerpt: r.excerpt,
            entity_match: r.entity_match,
            extraction_type: 'price',
            created_at: '2026-08-01T00:00:00.000Z',
          })),
        };
      }
      if (sql.includes('FROM metric_observations')) return { rows: [] };
      return { rows: [] };
    });
  }

  function claimsPassed() {
    return saveVerifiedClaims.mock.calls[0][0].claims as Array<{
      statement: string;
      claimType: string;
      supportingSpanIds: string[];
    }>;
  }

  beforeEach(wireSpans);

  it('uses the agent’s own citation when the excerpt supports it', async () => {
    const result = await storeResearchClaims({
      userId: 'u1',
      projectId: 'p1',
      agents: [{
        agentId: 'pricing',
        facts: [`The Team plan is $59 per month [${SPAN_ID}]`],
        interpretation: [],
      }],
      pack: pack(),
    });

    const [claim] = claimsPassed();
    expect(claim.claimType).toBe('fact');
    expect(claim.supportingSpanIds).toEqual([SPAN_ID]);
    expect(result.citedByAgent).toBe(1);
    expect(result.matchedHeuristically).toBe(0);
    // The stored statement is clean prose, not markup.
    expect(claim.statement).not.toContain('[');
  });

  it('refuses a citation whose excerpt does not support the statement', async () => {
    // Citing is preferred, never trusted blindly. The agent pointed at a real
    // span that says something else.
    const result = await storeResearchClaims({
      userId: 'u1',
      projectId: 'p1',
      agents: [{
        agentId: 'pricing',
        facts: [`Revenue grew 300 percent last quarter [${SPAN_ID}]`],
        interpretation: [],
      }],
      pack: pack(),
    });

    expect(claimsPassed()[0].claimType).toBe('interpretation');
    expect(result.citedByAgent).toBe(0);
  });

  it('counts invented ids so the instruction can be monitored', async () => {
    const result = await storeResearchClaims({
      userId: 'u1',
      projectId: 'p1',
      agents: [{
        agentId: 'pricing',
        facts: ['Something [99999999-9999-4999-8999-999999999999]'],
        interpretation: [],
      }],
      pack: pack(),
    });
    expect(result.hallucinatedCitations).toBe(1);
  });

  it('still matches heuristically when the agent does not cite', async () => {
    // The fallback stays, so this raises the ceiling without lowering the floor.
    const result = await storeResearchClaims({
      userId: 'u1',
      projectId: 'p1',
      agents: [{
        agentId: 'pricing',
        facts: ['The Team plan is $59 per month'],
        interpretation: [],
      }],
      pack: pack(),
    });

    expect(claimsPassed()[0].claimType).toBe('fact');
    expect(result.matchedHeuristically).toBe(1);
    expect(result.citedByAgent).toBe(0);
  });

  it('works with no pack at all', async () => {
    const result = await storeResearchClaims({
      userId: 'u1',
      projectId: 'p1',
      agents: [{ agentId: 'pricing', facts: ['The Team plan is $59 per month'], interpretation: [] }],
    });
    expect(result.asFacts).toBe(1);
    expect(result.hallucinatedCitations).toBe(0);
  });
});
