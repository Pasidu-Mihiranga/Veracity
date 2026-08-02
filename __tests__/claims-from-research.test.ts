/**
 * Turning agent output into verified claims.
 *
 * The decision under test is the classification: an agent calling something a
 * "fact" is the model's opinion of its own output. Trusting that label is how
 * "the market is consolidating" ends up in the ledger as an established fact
 * with a URL beside it. A statement is only stored as a fact when a stored
 * excerpt actually supports it.
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
  storeResearchClaims,
  excerptSupports,
} from '@/lib/intelligence/claims-from-research';

const SPAN_ROWS = [
  {
    id: 'span-price',
    snapshot_id: 'snap-1',
    excerpt: 'The Team plan is $59 per month for up to ten seats.',
    entity_match: 'confirmed',
    extraction_type: 'price',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'span-sso',
    snapshot_id: 'snap-1',
    excerpt: 'SSO and SCIM are available on the Enterprise plan.',
    entity_match: 'probable',
    extraction_type: 'feature',
    created_at: '2026-08-01T00:00:00.000Z',
  },
];

function wireQueries(spans = SPAN_ROWS) {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM evidence_spans')) return { rows: spans };
    if (sql.includes('FROM metric_observations')) return { rows: [] };
    return { rows: [] };
  });
}

/** The claims handed to the repo, for inspecting classification. */
function claimsPassed() {
  return saveVerifiedClaims.mock.calls[0][0].claims as Array<{
    statement: string;
    claimType: string;
    confidence: string;
    supportingSpanIds: string[];
    agentId?: string;
  }>;
}

beforeEach(() => {
  queryMock.mockReset();
  saveVerifiedClaims.mockReset();
  wireQueries();
  saveVerifiedClaims.mockResolvedValue({ saved: [{ id: 'c1', statement: 'x' }], rejected: [] });
});

const base = { userId: 'u1', projectId: 'p1', sessionId: 's1' };

describe('excerpt support', () => {
  it('accepts a statement the excerpt actually says', () => {
    expect(
      excerptSupports(
        'The Team plan costs $59 per month',
        'The Team plan is $59 per month for up to ten seats.',
      ),
    ).toBe(true);
  });

  it('rejects a statement whose number differs', () => {
    // The critical case. These two share almost every word, and a purely
    // lexical check would bind the first to the second.
    expect(
      excerptSupports(
        'The Team plan costs $99 per month',
        'The Team plan is $59 per month for up to ten seats.',
      ),
    ).toBe(false);
  });

  it('rejects a statement about something else entirely', () => {
    expect(
      excerptSupports(
        'They opened an office in Berlin',
        'The Team plan is $59 per month for up to ten seats.',
      ),
    ).toBe(false);
  });

  it('is not fooled by shared filler words', () => {
    expect(excerptSupports('this is for the of and to', 'a completely different sentence')).toBe(false);
  });

  it('accepts a qualitative statement with strong overlap', () => {
    expect(
      excerptSupports('SSO is available on the Enterprise plan', 'SSO and SCIM are available on the Enterprise plan.'),
    ).toBe(true);
  });
});

describe('classification', () => {
  it('stores a supported statement as a fact with its span', async () => {
    await storeResearchClaims({
      ...base,
      agents: [{ agentId: 'pricing', facts: ['The Team plan costs $59 per month'], interpretation: [] }],
    });

    const [claim] = claimsPassed();
    expect(claim.claimType).toBe('fact');
    expect(claim.supportingSpanIds).toEqual(['span-price']);
  });

  it('demotes an unsupported "fact" to interpretation rather than dropping it', async () => {
    // Neither discarded nor promoted. It is analyst synthesis, which is a
    // legitimate thing to produce and does not require evidence.
    await storeResearchClaims({
      ...base,
      agents: [{
        agentId: 'market-trends',
        facts: ['The category is consolidating rapidly'],
        interpretation: [],
      }],
    });

    const [claim] = claimsPassed();
    expect(claim.claimType).toBe('interpretation');
    expect(claim.supportingSpanIds).toEqual([]);
  });

  it('never promotes an interpretation line to a fact', async () => {
    await storeResearchClaims({
      ...base,
      agents: [{
        agentId: 'pricing',
        facts: [],
        // Deliberately worded to match a real excerpt — it must still stay an
        // interpretation, because the agent classified it as one.
        interpretation: ['The Team plan is $59 per month for up to ten seats.'],
      }],
    });

    expect(claimsPassed()[0].claimType).toBe('interpretation');
  });

  it('drops synthesis-failure markers', async () => {
    // Diagnostics, not analysis. Storing them would pollute the Explain path
    // with error text presented as findings.
    await storeResearchClaims({
      ...base,
      agents: [{
        agentId: 'pricing',
        facts: [],
        interpretation: ['SYNTHESIS_ERROR: model unavailable', 'Real analysis here'],
      }],
    });

    const claims = claimsPassed();
    expect(claims).toHaveLength(1);
    expect(claims[0].statement).toBe('Real analysis here');
  });

  it('ignores blank statements', async () => {
    await storeResearchClaims({
      ...base,
      agents: [{ agentId: 'pricing', facts: ['   ', ''], interpretation: ['  '] }],
    });
    expect(saveVerifiedClaims).not.toHaveBeenCalled();
  });

  it('records which agent produced each claim', async () => {
    await storeResearchClaims({
      ...base,
      agents: [
        { agentId: 'pricing', facts: ['The Team plan costs $59 per month'], interpretation: [] },
        { agentId: 'competitive', facts: [], interpretation: ['They are moving upmarket'] },
      ],
    });

    const claims = claimsPassed();
    expect(claims.find((c) => c.agentId === 'pricing')).toBeTruthy();
    expect(claims.find((c) => c.agentId === 'competitive')).toBeTruthy();
  });
});

describe('confidence', () => {
  it('never labels a single-source fact high', async () => {
    // Taken from the deterministic deriver, not from the agent's own opinion.
    await storeResearchClaims({
      ...base,
      agents: [{ agentId: 'pricing', facts: ['The Team plan costs $59 per month'], interpretation: [] }],
    });
    expect(claimsPassed()[0].confidence).toBe('medium');
  });

  it('lowers confidence when the entity match is unconfirmed', async () => {
    await storeResearchClaims({
      ...base,
      agents: [{
        agentId: 'competitive',
        facts: ['SSO is available on the Enterprise plan'],
        interpretation: [],
      }],
    });
    // span-sso is only 'probable', so the claim cannot reach medium.
    expect(claimsPassed()[0].confidence).toBe('low');
  });
});

describe('reporting', () => {
  it('returns the fact and interpretation split', async () => {
    const result = await storeResearchClaims({
      ...base,
      agents: [{
        agentId: 'pricing',
        facts: ['The Team plan costs $59 per month', 'The market is consolidating'],
        interpretation: ['We should hold price'],
      }],
    });

    expect(result.asFacts).toBe(1);
    expect(result.asInterpretation).toBe(2);
  });

  it('passes rejections through rather than swallowing them', async () => {
    saveVerifiedClaims.mockResolvedValue({
      saved: [],
      rejected: [{ statement: 'Prices rose 40%', reasons: ['unsupported-numeric-claim: ...'] }],
    });

    const result = await storeResearchClaims({
      ...base,
      agents: [{ agentId: 'pricing', facts: ['Prices rose 40%'], interpretation: [] }],
    });

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reasons[0]).toContain('unsupported-numeric-claim');
  });

  it('does nothing when the project has no evidence yet', async () => {
    wireQueries([]);
    const result = await storeResearchClaims({
      ...base,
      agents: [{ agentId: 'pricing', facts: ['The Team plan costs $59 per month'], interpretation: [] }],
    });

    // Still stored, but as interpretation — nothing supports it yet.
    expect(result.asFacts).toBe(0);
    expect(result.asInterpretation).toBe(1);
  });
});
