import { describe, expect, it } from 'vitest';
import {
  extractEntitiesFromQuery,
  resolveCompetitorName,
  resolveProductName,
} from '@/lib/agents/extract-entities';
import {
  SYNTHESIS_ERROR_PREFIX,
  formatSynthesisError,
  isSynthesisFailureInterpretation,
  synthesisFailureInterpretation,
} from '@/lib/agents/synthesis-fallback';

describe('extractEntitiesFromQuery', () => {
  it('parses How does X compete with Y', () => {
    const r = extractEntitiesFromQuery(
      'How does Notion compete with Linear for product teams?',
    );
    expect(r.product).toBe('Notion');
    expect(r.competitor).toBe('Linear');
  });

  it('parses X vs Y', () => {
    const r = extractEntitiesFromQuery('Slack vs Microsoft Teams pricing');
    expect(r.product).toBe('Slack');
    expect(r.competitor).toBe('Microsoft Teams');
  });

  it('parses Compare X and Y', () => {
    const r = extractEntitiesFromQuery('Compare Intercom and Zendesk for support teams');
    expect(r.product).toBe('Intercom');
    expect(r.competitor).toBe('Zendesk');
  });

  it('resolves placeholders using heuristic', () => {
    const heuristic = extractEntitiesFromQuery('Notion vs Linear');
    expect(resolveProductName('the current product', heuristic)).toBe('Notion');
    expect(resolveCompetitorName(null, heuristic)).toBe('Linear');
  });
});

describe('synthesisFailureInterpretation', () => {
  it('exposes the real exception message', () => {
    const lines = synthesisFailureInterpretation(
      new Error('Gemini JSON generateContent failed (404): model not found'),
    );
    expect(lines[0]).toContain(SYNTHESIS_ERROR_PREFIX);
    expect(lines[0]).toContain('404');
    expect(isSynthesisFailureInterpretation(lines)).toBe(true);
    expect(formatSynthesisError(new Error('boom'))).toBe(`${SYNTHESIS_ERROR_PREFIX} boom`);
  });
});
