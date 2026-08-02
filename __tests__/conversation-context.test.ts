/**
 * Bounded context assembly.
 *
 * CLAUDE.md is emphatic that this is not a popup chatbot: context must never
 * reset between messages, and the product must not ask again for something the
 * user already established. These tests hold both properties under a budget,
 * which is where naive "send the whole transcript" approaches break.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTurnContext,
  partitionTurns,
  requiresCollection,
  canAnswerFromStored,
  DEFAULT_BUDGET,
  CONTEXT_VERSION,
  type ConversationTurn,
  type ProjectState,
} from '@/lib/intelligence/conversation-context';

const projectState: ProjectState = {
  product: 'Vector Agents',
  competitors: ['Lilian', 'Acme'],
  geography: 'North America',
  decisionContext: 'pricing',
  corrections: ['Lilian is the AI SDR company, not the design agency'],
  openQuestions: ['Does Lilian charge per seat or per conversation?'],
  assumptions: ['Their enterprise tier is quote-only'],
};

function turns(count: number, size = 50): ConversationTurn[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `turn ${i} ${'x'.repeat(size)}`,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
  }));
}

describe('layer assembly', () => {
  it('always carries the product and competitors forward', () => {
    // The anti-pattern CLAUDE.md names directly: agents must never ask again
    // which product is being researched.
    const context = buildTurnContext({
      question: 'What changed?',
      projectState,
    });
    expect(context.text).toContain('Vector Agents');
    expect(context.text).toContain('Lilian');
    expect(context.contextVersion).toBe(CONTEXT_VERSION);
  });

  it('presents user corrections as overriding inference', () => {
    const context = buildTurnContext({ question: 'Compare pricing', projectState });
    expect(context.text).toContain('override anything inferred');
    expect(context.text).toContain('not the design agency');
  });

  it('labels assumptions as assumptions rather than facts', () => {
    const context = buildTurnContext({ question: 'x', projectState });
    expect(context.text).toContain('not established facts');
  });

  it('includes attached artifacts with their own text', () => {
    // "Ask about this chart" only works if the chart's content travels with the
    // question; otherwise the model guesses which chart was meant.
    const context = buildTurnContext({
      question: 'Why did this move?',
      attachedArtifacts: [
        {
          kind: 'chart',
          id: 'chart-1',
          label: 'Entry-tier price',
          detail: '2026-01: $49, 2026-03: $59',
        },
      ],
    });
    expect(context.text).toContain('[chart:chart-1]');
    expect(context.text).toContain('2026-03: $59');
  });

  it('preserves evidence ids through the rolling summary', () => {
    // A summarised claim that loses its ids becomes an unsourced assertion.
    const context = buildTurnContext({
      question: 'x',
      rollingSummary: {
        throughMessageId: 'm-40',
        summary: 'Lilian repriced upward in Q1.',
        openQuestions: ['Did packaging change too?'],
        assumptions: [],
        citedIds: ['claim-7', 'span-12'],
      },
    });
    expect(context.text).toContain('claim-7');
    expect(context.text).toContain('span-12');
  });

  it('records what each layer contributed', () => {
    const context = buildTurnContext({
      question: 'What changed?',
      projectState,
      recentTurns: turns(4),
      retrievedEvidence: [{ claimId: 'c1', statement: 'Price is $59', sourceUrl: 'https://x' }],
    });
    expect(context.layerSizes.question).toBeGreaterThan(0);
    expect(context.layerSizes['project-state']).toBeGreaterThan(0);
    expect(context.layerSizes['recent-turns']).toBeGreaterThan(0);
    expect(context.layerSizes['retrieved-evidence']).toBeGreaterThan(0);
    expect(context.totalChars).toBe(context.text.length);
  });
});

describe('budgets', () => {
  it('keeps project state even when the transcript is enormous', () => {
    // The failure this guards against: an agent that has forgotten which
    // product it is researching, and confidently answers about another company.
    const context = buildTurnContext({
      question: 'What changed?',
      projectState,
      recentTurns: turns(400, 500),
    });
    expect(context.text).toContain('Vector Agents');
    expect(context.totalChars).toBeLessThanOrEqual(DEFAULT_BUDGET.total);
  });

  it('stays inside the total budget', () => {
    const context = buildTurnContext({
      question: 'x'.repeat(5_000),
      projectState,
      recentTurns: turns(200, 400),
      retrievedEvidence: Array.from({ length: 100 }, (_, i) => ({
        claimId: `c${i}`,
        statement: 'y'.repeat(300),
      })),
      budget: { total: 6_000, perLayer: { question: 1_000, 'project-state': 1_500 } },
    });
    expect(context.totalChars).toBeLessThanOrEqual(6_000);
  });

  it('drops the oldest turns rather than truncating mid-turn', () => {
    const context = buildTurnContext({
      question: 'x',
      recentTurns: turns(30, 200),
      budget: { total: 20_000, perLayer: { 'recent-turns': 2_000 } },
    });
    // The newest exchange is what the question follows on from, so it survives.
    expect(context.text).toContain('turn 29');
    expect(context.text).not.toContain('turn 0 ');
    expect(context.trimmed).toContain('recent-turns');
  });

  it('reports which layers were trimmed', () => {
    const context = buildTurnContext({
      question: 'x',
      projectState,
      recentTurns: turns(100, 300),
      budget: { total: 3_000, perLayer: { question: 500, 'project-state': 800 } },
    });
    expect(context.trimmed.length).toBeGreaterThan(0);
  });

  it('handles an empty input without producing junk', () => {
    const context = buildTurnContext({ question: 'Hello' });
    expect(context.text).toContain('Hello');
    expect(context.trimmed).toEqual([]);
  });
});

describe('turn partitioning', () => {
  it('keeps a short conversation entirely verbatim', () => {
    const { recent, toSummarize } = partitionTurns(turns(6));
    expect(recent).toHaveLength(6);
    expect(toSummarize).toHaveLength(0);
  });

  it('summarises everything older than the window', () => {
    const { recent, toSummarize } = partitionTurns(turns(25), 10);
    expect(recent).toHaveLength(10);
    expect(toSummarize).toHaveLength(15);
    // Older turns are folded in, not discarded — the conversation keeps its
    // shape without keeping its length.
    expect(recent[0].content).toContain('turn 15');
  });
});

describe('cheap modes', () => {
  it('answers explain and compare from stored evidence', () => {
    // Running six agents to answer "what did you mean by that?" costs as much
    // as the original sweep and is not more correct.
    expect(requiresCollection('explain')).toBe(false);
    expect(requiresCollection('compare')).toBe(false);
  });

  it('collects for verify, refresh, and swarm', () => {
    for (const mode of ['verify', 'refresh', 'swarm']) {
      expect(requiresCollection(mode), mode).toBe(true);
    }
  });

  it('allows a stored answer when fresh evidence exists', () => {
    const result = canAnswerFromStored({
      mode: 'explain',
      retrievedEvidence: [{ claimId: 'c1', statement: 'Price is $59' }],
      freshestEvidenceAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    expect(result.ok).toBe(true);
  });

  it('explains why it cannot answer from stale evidence', () => {
    // Silently escalating to an expensive sweep the user did not ask for is
    // worse than saying why.
    const result = canAnswerFromStored({
      mode: 'explain',
      retrievedEvidence: [{ claimId: 'c1', statement: 'Price is $59' }],
      freshestEvidenceAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('days old');
  });

  it('explains when nothing stored matches', () => {
    const result = canAnswerFromStored({ mode: 'explain', retrievedEvidence: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('no stored evidence');
  });

  it('does not claim a collecting mode can be answered from store', () => {
    const result = canAnswerFromStored({
      mode: 'refresh',
      retrievedEvidence: [{ claimId: 'c1', statement: 'x' }],
    });
    expect(result.ok).toBe(false);
  });
});
