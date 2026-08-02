/**
 * Rolling conversation summary.
 *
 * `partitionTurns` and `buildTurnContext` both already handled a summary;
 * nothing generated one, so the older half of a long conversation was dropped
 * entirely. These tests hold the two properties that make a summary safe to
 * rely on: it never loses the ids that make a claim traceable, and a failure
 * leaves the previous summary standing rather than writing a degraded one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const generateJson = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { connect: vi.fn() },
}));
vi.mock('@/lib/agents/gemini', () => ({
  generateHuggingFaceJson: (...args: unknown[]) => generateJson(...args),
}));

import {
  needsRegeneration,
  generateSummary,
  loadSummary,
  refreshSummary,
} from '@/lib/intelligence/conversation-summary';
import type { ConversationTurn } from '@/lib/intelligence/conversation-context';

function turns(count: number): ConversationTurn[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `turn ${i} content about pricing`,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
  }));
}

const STORED_ROW = {
  through_message_id: null,
  turns_covered: 5,
  summary: 'Lilian repriced upward in Q1 [claim-7].',
  open_questions: ['Did packaging change?'],
  assumptions: ['Churn is price-sensitive'],
  cited_ids: ['claim-7'],
  context_version: 'ctx-v1',
};

beforeEach(() => {
  queryMock.mockReset();
  generateJson.mockReset();
  queryMock.mockResolvedValue({ rows: [] });
});

describe('deciding when to regenerate', () => {
  it('does nothing while everything still fits the verbatim window', () => {
    // Nothing has aged out, so a summary would duplicate what is already shown.
    expect(needsRegeneration({ totalTurns: 8, existing: null })).toBe(false);
    expect(needsRegeneration({ totalTurns: 10, existing: null })).toBe(false);
  });

  it('generates the first summary once turns age out', () => {
    expect(needsRegeneration({ totalTurns: 11, existing: null })).toBe(true);
  });

  it('waits for several new turns rather than regenerating every message', () => {
    // A model call per message for a paragraph that barely changes is the
    // failure mode this threshold exists to prevent.
    const existing = { turnsCovered: 5, contextVersion: 'ctx-v1' };
    expect(needsRegeneration({ totalTurns: 17, existing })).toBe(false); // 7 - 5 = 2
    expect(needsRegeneration({ totalTurns: 21, existing })).toBe(true); // 11 - 5 = 6
  });

  it('regenerates when the assembly rules changed', () => {
    // Mixing text produced under two different contracts is worse than paying
    // for one regeneration.
    expect(
      needsRegeneration({
        totalTurns: 20,
        existing: { turnsCovered: 10, contextVersion: 'ctx-v0' },
      }),
    ).toBe(true);
  });
});

describe('generating', () => {
  it('summarises only the turns that aged out', async () => {
    generateJson.mockResolvedValue({
      summary: 'Discussed pricing [claim-7].',
      openQuestions: [], assumptions: [], citedIds: ['claim-7'],
    });

    await generateSummary({ turns: turns(20) });

    const prompt = String(generateJson.mock.calls[0][1]);
    expect(prompt).toContain('turn 0');
    // The most recent ten are still shown verbatim elsewhere; summarising them
    // too would put the same content in the context twice.
    expect(prompt).not.toContain('turn 19');
  });

  it('returns nothing when there is nothing to summarise', async () => {
    expect(await generateSummary({ turns: turns(6) })).toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('preserves ids that appear in the summary text', async () => {
    generateJson.mockResolvedValue({
      summary: 'Lilian repriced [claim-7] and shipped SSO [claim-9].',
      openQuestions: [], assumptions: [], citedIds: ['claim-7', 'claim-9'],
    });

    const result = await generateSummary({ turns: turns(20) });
    expect(result?.citedIds).toEqual(['claim-7', 'claim-9']);
  });

  it('drops an id the summary text does not actually use', async () => {
    // A listed id that appears nowhere is a citation trail to nothing.
    generateJson.mockResolvedValue({
      summary: 'Lilian repriced [claim-7].',
      openQuestions: [], assumptions: [], citedIds: ['claim-7', 'claim-999'],
    });

    const result = await generateSummary({ turns: turns(20) });
    expect(result?.citedIds).toEqual(['claim-7']);
  });

  it('extends the previous summary rather than restarting', async () => {
    // Without the prior text, each regeneration re-reads the transcript and
    // quietly drops whatever it happened not to mention this time.
    generateJson.mockResolvedValue({
      summary: 'Extended.', openQuestions: [], assumptions: [], citedIds: [],
    });

    await generateSummary({
      turns: turns(20),
      previous: {
        throughMessageId: null,
        summary: 'Earlier: they repriced.',
        openQuestions: ['Did packaging change?'],
        assumptions: ['Churn is price-sensitive'],
        citedIds: [],
      },
    });

    const prompt = String(generateJson.mock.calls[0][1]);
    expect(prompt).toContain('Earlier: they repriced');
    expect(prompt).toContain('do not restart');
    expect(prompt).toContain('Did packaging change?');
  });

  it('tells the model not to drop bracketed ids', async () => {
    generateJson.mockResolvedValue({
      summary: 'x [claim-1]', openQuestions: [], assumptions: [], citedIds: ['claim-1'],
    });
    await generateSummary({ turns: turns(20) });

    const system = String(generateJson.mock.calls[0][0]);
    expect(system).toContain('Preserve any bracketed ids exactly');
    expect(system).toContain('unsourced assertion');
  });

  it('does not invent content beyond the transcript', async () => {
    generateJson.mockResolvedValue({
      summary: 'x', openQuestions: [], assumptions: [], citedIds: [],
    });
    await generateSummary({ turns: turns(20) });
    expect(String(generateJson.mock.calls[0][0])).toContain('Do not add facts');
  });
});

describe('failing safely', () => {
  it('returns nothing when the model is unavailable', async () => {
    generateJson.mockRejectedValue(new Error('model unavailable'));
    expect(await generateSummary({ turns: turns(20) })).toBeNull();
  });

  it('rejects an empty summary rather than storing a blank one', async () => {
    generateJson.mockResolvedValue({
      summary: '   ', openQuestions: [], assumptions: [], citedIds: [],
    });
    expect(await generateSummary({ turns: turns(20) })).toBeNull();
  });

  it('rejects a response that does not match the schema', async () => {
    generateJson.mockResolvedValue({ nonsense: true });
    expect(await generateSummary({ turns: turns(20) })).toBeNull();
  });

  it('keeps the existing summary when regeneration fails', async () => {
    // The old summary is stale but true. A failed regeneration must not clear
    // it, or the conversation loses its memory because of a transient error.
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM conversation_summaries')) return { rows: [STORED_ROW] };
      return { rows: [] };
    });
    generateJson.mockRejectedValue(new Error('model unavailable'));

    const result = await refreshSummary({
      userId: 'u1', sessionId: 's1', turns: turns(30),
    });

    expect(result?.summary).toBe(STORED_ROW.summary);
    // Nothing was written.
    const writes = queryMock.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO conversation_summaries'),
    );
    expect(writes).toHaveLength(0);
  });
});

describe('loading and refreshing', () => {
  it('returns null for a session with no summary', async () => {
    expect(await loadSummary({ userId: 'u1', sessionId: 's1' })).toBeNull();
  });

  it('reads a stored summary back with its ids intact', async () => {
    queryMock.mockResolvedValue({ rows: [STORED_ROW] });
    const loaded = await loadSummary({ userId: 'u1', sessionId: 's1' });

    expect(loaded?.summary).toContain('[claim-7]');
    expect(loaded?.citedIds).toEqual(['claim-7']);
    expect(loaded?.openQuestions).toEqual(['Did packaging change?']);
  });

  it('makes no model call when nothing has aged out', async () => {
    // The cheap path: one indexed read and nothing else.
    queryMock.mockResolvedValue({ rows: [] });
    await refreshSummary({ userId: 'u1', sessionId: 's1', turns: turns(5) });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('stores a freshly generated summary', async () => {
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes('SELECT through_message_id') ? { rows: [] } : { rows: [] },
    );
    generateJson.mockResolvedValue({
      summary: 'They repriced [claim-7].',
      openQuestions: ['Will they cut again?'],
      assumptions: [],
      citedIds: ['claim-7'],
    });

    const result = await refreshSummary({
      userId: 'u1', sessionId: 's1', turns: turns(20),
    });

    expect(result?.summary).toContain('repriced');

    const write = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO conversation_summaries'),
    );
    expect(write).toBeTruthy();
    // Covers everything outside the ten-turn verbatim window.
    expect((write![1] as unknown[])[3]).toBe(10);
  });
});
