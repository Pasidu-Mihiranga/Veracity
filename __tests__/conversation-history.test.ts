import { describe, expect, it } from 'vitest';
import { splitStoredMessages } from '@/hooks/useDashboardSessions';
import type { StoredMessage } from '@/lib/conversations';

function stored(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {},
): StoredMessage {
  return {
    id,
    session_id: 'session-1',
    role,
    content,
    metadata,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('conversation history hydration', () => {
  it('keeps legacy follow-up rows in the chronological message timeline', () => {
    const result = splitStoredMessages([
      stored('1', 'user', 'Initial market question'),
      stored('2', 'assistant', 'Initial answer', { type: 'intelligence' }),
      stored('3', 'user', 'What evidence supports that?', { isFollowUp: true }),
      stored('4', 'assistant', 'Here is the supporting evidence.', {
        isFollowUp: true,
        sources: [{ title: 'Source', url: 'https://example.com/source' }],
      }),
    ]);

    expect(result.loadedFollowUps).toEqual([]);
    expect(result.mainMessages.map((message) => [message.role, message.content])).toEqual([
      ['user', 'Initial market question'],
      ['assistant', 'Initial answer'],
      ['user', 'What evidence supports that?'],
      ['assistant', 'Here is the supporting evidence.'],
    ]);
    expect(result.mainMessages[3]?.sources).toEqual([
      { title: 'Source', url: 'https://example.com/source' },
    ]);
  });

  it('preserves structured follow-up output so it can become the current report', () => {
    const orchestratorOutput = {
      query: 'Compare option A and B',
      product: 'Example',
      outputs: [],
      agentRuns: [],
      synthesizedAnswer: 'Option A is stronger.',
      topRecommendations: [],
      suggestedFollowUps: [],
      metrics: {
        totalLatencyMs: 1,
        estimatedCostUsd: 0,
        geminiCallCount: 0,
        toolCallCount: 0,
      },
    };

    const result = splitStoredMessages([
      stored('1', 'assistant', 'Option A is stronger.', {
        isFollowUp: true,
        type: 'intelligence',
        orchestratorOutput,
      }),
    ]);

    expect(result.mainMessages[0]?.type).toBe('intelligence');
    expect(result.mainMessages[0]?.orchestratorOutput?.synthesizedAnswer).toBe('Option A is stronger.');
  });
});

