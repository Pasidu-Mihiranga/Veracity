import { describe, expect, it } from 'vitest';
import {
  buildChatErrorPayload,
  formatChatErrorForDisplay,
} from '@/lib/errors/chat-error';

describe('chat-error', () => {
  it('maps 429 to rate_limit user message', () => {
    const p = buildChatErrorPayload(new Error('Gemini failed 429'), 'corr-1');
    expect(p.code).toBe('rate_limit');
    expect(p.userMessage).toMatch(/rate-limited/i);
    expect(p.correlationId).toBe('corr-1');
  });

  it('maps fetch failed to network', () => {
    const p = buildChatErrorPayload(new Error('fetch failed'));
    expect(p.code).toBe('network');
  });

  it('hides technical detail outside developer mode', () => {
    const p = buildChatErrorPayload(new Error('secret stack'), 'abc');
    expect(formatChatErrorForDisplay(p, false)).toBe(p.userMessage);
    expect(formatChatErrorForDisplay(p, true)).toMatch(/secret stack/);
    expect(formatChatErrorForDisplay(p, true)).toMatch(/abc/);
  });
});
