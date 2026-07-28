import { describe, expect, it } from 'vitest';
import { buildFallbackAnswer } from '@/lib/agents/synthesize';
import { safeParseJson, stripJsonFences } from '@/lib/agents/json-parse';
import {
  buildSynthesizePrompt,
  buildMindMapUserPrompt,
  DIRECT_ANSWER_SYSTEM_PROMPT,
  MIND_MAP_SYSTEM_PROMPT,
} from '@/lib/agents/prompts/synthesis';
import type { AgentOutput } from '@/lib/agents/types';

function stub(domain: string, facts: string[], interpretation: string[] = ['ok']): AgentOutput {
  return {
    agentId: domain,
    domain: domain as AgentOutput['domain'],
    confidence: 'medium',
    confidenceScore: 0.6,
    facts,
    interpretation,
    sources: [],
    generatedAt: new Date().toISOString(),
    artifactType: 'competitive-matrix',
  };
}

describe('json-parse helpers', () => {
  it('strips fences and parses', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(safeParseJson('```json\n{"answer":"hi"}\n```').answer).toBe('hi');
  });

  it('returns empty object on invalid json', () => {
    expect(safeParseJson('not json')).toEqual({});
  });
});

describe('buildFallbackAnswer', () => {
  it('handles empty outputs', () => {
    expect(buildFallbackAnswer([], 'q')).toMatch(/couldn't retrieve/i);
  });

  it('surfaces synthesis failures', () => {
    const out = buildFallbackAnswer(
      [stub('competitive', [], ['SYNTHESIS_ERROR: quota'])],
      'Compare X',
    );
    expect(out).toMatch(/AI analysis failed/i);
    expect(out).toMatch(/quota/);
  });

  it('lists clean facts when present', () => {
    const out = buildFallbackAnswer([stub('pricing', ['Price is $99'])], 'pricing?');
    expect(out).toContain('Price is $99');
  });
});

describe('prompt assets', () => {
  it('includes anti-hallucination rules in synthesize prompt', () => {
    const p = buildSynthesizePrompt({
      query: 'What should we build?',
      product: 'Acme',
      priorSummary: '',
      outputSummariesJson: '[]',
      citedTitlesJson: '[]',
      agentCount: 0,
    });
    expect(p).toMatch(/ANTI-HALLUCINATION/);
    expect(p).toContain('Acme');
    expect(p).toMatch(/interest score|estimated/i);
  });

  it('adds buyer-vs-builder follow-up rule for compares', () => {
    const p = buildSynthesizePrompt({
      query: 'Compare ChatGPT and Claude',
      product: 'ChatGPT',
      competitor: 'Claude',
      priorSummary: '',
      outputSummariesJson: '[]',
      citedTitlesJson: '[]',
      agentCount: 2,
    });
    expect(p).toMatch(/choosing as a buyer or positioning/i);
  });

  it('exports mind-map and direct-answer system prompts', () => {
    expect(MIND_MAP_SYSTEM_PROMPT).toMatch(/mind maps/i);
    expect(DIRECT_ANSWER_SYSTEM_PROMPT).toMatch(/Veracity AI/);
    expect(DIRECT_ANSWER_SYSTEM_PROMPT).toMatch(/Do NOT mention companies or products from memory/i);
  });

  it('switches mind-map pillars to identity-first when requested', () => {
    const identity = buildMindMapUserPrompt({
      product: 'Lilian',
      query: 'Is Lilian competitive?',
      outputSummariesJson: '[]',
      identityFirst: true,
    });
    expect(identity).toMatch(/IDENTITY-FIRST/i);
    expect(identity).toMatch(/Confirm official URL/);
    expect(identity).not.toMatch(/Specialize \/ ICP/);

    const normal = buildMindMapUserPrompt({
      product: 'Clay',
      query: 'What to build?',
      outputSummariesJson: '[]',
    });
    expect(normal).toMatch(/Specialize \/ ICP/);
  });
});
