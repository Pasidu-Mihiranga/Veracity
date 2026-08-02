/**
 * Answering from stored evidence.
 *
 * The cheap path's whole justification is that it is *not* a degraded sweep —
 * it answers from the ledger or admits it cannot. These tests hold that: no
 * silent escalation, no invented citations, and no answer manufactured when the
 * model fails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const generateText = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { connect: vi.fn() },
}));
vi.mock('@/lib/agents/gemini', () => ({
  generateHuggingFaceText: (...args: unknown[]) => generateText(...args),
}));

import { answerFromStored } from '@/lib/intelligence/stored-answer';

const PROJECT_ROW = {
  product: 'Vector Agents',
  competitors: ['Lilian'],
  geography: 'North America',
  decision_context: 'pricing',
};

const CLAIMS = [
  { id: 'claim-7', statement: 'Lilian cut its entry tier to $49 in March.', confidence: 'high', source_url: 'https://lilian.example/pricing' },
  { id: 'claim-9', statement: 'Lilian added SSO on the Enterprise plan.', confidence: 'medium', source_url: null },
];

/** Wire the three queries the module makes, in the order it makes them. */
function wireQueries(options: { claims?: typeof CLAIMS; newest?: string | null } = {}) {
  const claims = options.claims ?? CLAIMS;
  const newest = options.newest === undefined
    ? new Date(Date.now() - 2 * 86_400_000).toISOString()
    : options.newest;

  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM market_projects')) return { rows: [PROJECT_ROW] };
    if (sql.includes('FROM claims c')) return { rows: claims };
    if (sql.includes('max(created_at)')) return { rows: [{ newest }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  queryMock.mockReset();
  generateText.mockReset();
  wireQueries();
  generateText.mockResolvedValue('Lilian repriced downward [claim-7], and shipped SSO [claim-9].');
});

const base = { userId: 'u1', projectId: 'p1', question: 'What changed in pricing?' };

describe('mode gating', () => {
  it('answers for explain and compare', async () => {
    for (const mode of ['explain', 'compare']) {
      const result = await answerFromStored({ ...base, mode });
      expect(result.ok, mode).toBe(true);
    }
  });

  it('declines for modes that collect by design', async () => {
    // Refusing rather than answering stale is the point: verify and refresh
    // exist precisely because the user wants fresh data.
    for (const mode of ['verify', 'refresh', 'swarm']) {
      const result = await answerFromStored({ ...base, mode });
      expect(result.ok, mode).toBe(false);
      if (!result.ok) expect(result.needsCollection).toBe(true);
    }
  });

  it('makes exactly one model call', async () => {
    // The entire cost argument. A second call here would erase the saving.
    await answerFromStored({ ...base, mode: 'explain' });
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

describe('refusing rather than escalating silently', () => {
  it('explains when nothing stored matches', async () => {
    wireQueries({ claims: [] });
    const result = await answerFromStored({ ...base, mode: 'explain' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('no stored evidence');
      expect(result.needsCollection).toBe(true);
    }
    // Critically: it did not quietly run a sweep instead.
    expect(generateText).not.toHaveBeenCalled();
  });

  it('explains when the evidence is stale, with the age', async () => {
    wireQueries({ newest: new Date(Date.now() - 60 * 86_400_000).toISOString() });
    const result = await answerFromStored({ ...base, mode: 'explain' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/\d+ days old/);
  });

  it('respects a caller-supplied freshness window', async () => {
    wireQueries({ newest: new Date(Date.now() - 10 * 86_400_000).toISOString() });

    expect((await answerFromStored({ ...base, mode: 'explain' })).ok).toBe(true);
    expect(
      (await answerFromStored({ ...base, mode: 'explain', maxEvidenceAgeDays: 5 })).ok,
    ).toBe(false);
  });
});

describe('no fabrication', () => {
  it('reports a model failure instead of inventing an answer', async () => {
    generateText.mockRejectedValue(new Error('model unavailable'));
    const result = await answerFromStored({ ...base, mode: 'explain' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('model was unavailable');
  });

  it('treats an empty answer as a failure', async () => {
    generateText.mockResolvedValue('   ');
    expect((await answerFromStored({ ...base, mode: 'explain' })).ok).toBe(false);
  });

  it('drops citations to claims that do not exist', async () => {
    // A hallucinated citation is worse than none, because it looks verifiable.
    generateText.mockResolvedValue('Prices moved [claim-7] and margins fell [claim-999].');
    const result = await answerFromStored({ ...base, mode: 'explain' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.citedClaimIds).toEqual(['claim-7']);
      expect(result.citedClaimIds).not.toContain('claim-999');
    }
  });

  it('deduplicates a repeated citation', async () => {
    generateText.mockResolvedValue('[claim-7] and again [claim-7].');
    const result = await answerFromStored({ ...base, mode: 'explain' });
    if (result.ok) expect(result.citedClaimIds).toEqual(['claim-7']);
  });
});

describe('context', () => {
  it('instructs the model to answer only from the evidence', async () => {
    await answerFromStored({ ...base, mode: 'explain' });
    const prompt = String(generateText.mock.calls[0][0]);

    expect(prompt).toContain('ONLY from the stored evidence');
    expect(prompt).toContain('Do not fill the gap from your own knowledge');
  });

  it('carries the project identity so the answer is about the right company', async () => {
    await answerFromStored({ ...base, mode: 'explain' });
    const prompt = String(generateText.mock.calls[0][0]);

    expect(prompt).toContain('Vector Agents');
    expect(prompt).toContain('Lilian');
  });

  it('includes the stored claims with their ids', async () => {
    await answerFromStored({ ...base, mode: 'explain' });
    const prompt = String(generateText.mock.calls[0][0]);

    expect(prompt).toContain('[claim-7]');
    expect(prompt).toContain('entry tier to $49');
  });

  it('passes an attached artifact through', async () => {
    await answerFromStored({
      ...base,
      mode: 'explain',
      attachedArtifacts: [
        { kind: 'chart', id: 'c1', label: 'Entry-tier price', detail: 'Jan $59, Mar $49' },
      ],
    });
    const prompt = String(generateText.mock.calls[0][0]);

    expect(prompt).toContain('[chart:c1]');
    expect(prompt).toContain('Jan $59');
  });

  it('reports the context version so answers stay comparable', async () => {
    const result = await answerFromStored({ ...base, mode: 'explain' });
    if (result.ok) expect(result.contextVersion).toBe('ctx-v1');
  });
});
