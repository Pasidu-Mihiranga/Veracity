import { describe, expect, it } from 'vitest';
import {
  buildFallbackAnswer,
  sanitizeOutputsForSelfEvaluation,
} from '@/lib/agents/synthesize';
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

describe('self-evaluation evidence boundary', () => {
  it('removes same-name public-company evidence before synthesis', () => {
    const output = stub('competitive', [
      'Veracity AI pricing page returns 404',
      'The pricing page returns 404',
      'Glean supports enterprise search',
    ]);
    output.sources = [
      {
        title: 'Veracity AI pricing',
        url: 'https://veracityai.com/pricing',
        timestamp: new Date().toISOString(),
        tool: 'firecrawl',
      },
      {
        title: 'Glean enterprise search',
        url: 'https://glean.com/product',
        timestamp: new Date().toISOString(),
        tool: 'firecrawl',
      },
    ];
    const [sanitized] = sanitizeOutputsForSelfEvaluation(
      'If I were competing directly with Glean, what must I improve?',
      [output],
    );
    expect(sanitized.facts).toEqual(['Glean supports enterprise search']);
    expect(sanitized.sources.map((source) => source.url)).toEqual(['https://glean.com/product']);
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
    expect(p).toMatch(/closed world/i);
    expect(p).toContain('"assumptions"');
    expect(p).toContain('"unknowns"');
    expect(p).toContain('"whatWouldChangeThis"');
    expect(p).toContain('"alternativeHypotheses"');
    expect(p).toContain('"confidenceDrivers"');
    expect(p).not.toMatch(/under 120 words/i);
    expect(p).toMatch(/matched to a retrieved source title\/fact/i);
    expect(p).toMatch(/not enough evidence/i);
    expect(p).toMatch(/ENTERPRISE DECISION SUPPORT/);
    expect(p).toContain('"decisionFrame"');
    expect(p).toContain('"riskOfInaction"');
    expect(p).toContain('"falsifier"');
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

  it('treats same-name public pages as homonym noise for self-evaluation', () => {
    const p = buildSynthesizePrompt({
      query: 'If I were competing directly with ChatGPT, what must I improve?',
      product: 'Veracity AI',
      competitor: 'ChatGPT',
      priorSummary: '',
      outputSummariesJson: '[]',
      citedTitlesJson: '["Veracity Consulting"]',
      agentCount: 2,
    });
    expect(p).toMatch(/SELF-EVALUATION IDENTITY RULE/);
    expect(p).toMatch(/same-name public company/i);
    expect(p).toMatch(/evaluation requirements, not proven defects/i);
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
