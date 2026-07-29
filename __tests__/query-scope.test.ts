import { describe, expect, it } from 'vitest';
import { extractEntitiesFromQuery } from '@/lib/agents/extract-entities';
import {
  isMetaOrGreetingWithoutEntities,
  isSelfComparisonQuery,
} from '@/lib/agents/classify';
import {
  entityTokens,
  filterHistoryForQueryScope,
  gateMemoryContext,
  reconcileResearchTier,
  textMentionsAnyToken,
} from '@/lib/agents/query-scope';

describe('query-scope (universal)', () => {
  it('does not route external self-comparisons to the Tier 0 meta shortcut', () => {
    const query =
      'If I were competing directly with ChatGPT, Claude, Gemini, Perplexity, and Glean Enterprise, what would I need to improve? Be critical of yourself.';
    expect(isMetaOrGreetingWithoutEntities(query, extractEntitiesFromQuery(query))).toBe(false);
    expect(isSelfComparisonQuery(query)).toBe(true);
  });

  it('extracts entity tokens for overlap checks', () => {
    expect(entityTokens('SyscoLabs', 'WSO2')).toEqual(expect.arrayContaining(['syscolabs', 'wso2']));
  });

  it('drops memory when it does not mention query entities', () => {
    const memory = 'User Company: Acme\nTracked Competitors: OtherCo\n  - Fact about OtherCo';
    const q = 'Compare WSO2 and SyscoLabs';
    const h = extractEntitiesFromQuery(q);
    expect(gateMemoryContext(q, memory, h)).toBeUndefined();
  });

  it('keeps memory when profile company matches query', () => {
    const memory = 'User Company: WSO2\nTracked Competitors: SyscoLabs';
    const q = 'How is WSO2 positioned?';
    const h = extractEntitiesFromQuery('WSO2 vs SyscoLabs');
    expect(gateMemoryContext(q, memory, { product: 'WSO2' })).toBe(memory);
  });

  it('drops memory for vague prompts with no extracted entities', () => {
    const memory = 'User Company: Lilian';
    expect(gateMemoryContext('help me decide', memory, {})).toBeUndefined();
  });

  it('filters history to overlapping entities only', () => {
    const history = [
      { role: 'user' as const, content: 'Is Lilian competitive?' },
      { role: 'user' as const, content: 'Compare WSO2 and SyscoLabs' },
    ];
    const h = extractEntitiesFromQuery('Compare WSO2 and SyscoLabs');
    const scoped = filterHistoryForQueryScope(history, h, 4);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].content).toMatch(/WSO2/);
  });

  it('reconcileResearchTier: dual compare defaults to tier 2 when classifier omits needsResearch', () => {
    const h = extractEntitiesFromQuery('can comapre facebook and tiktok');
    const { tier, domains } = reconcileResearchTier(h, {
      tier: 0,
      needsResearch: undefined,
      domains: [],
    });
    expect(tier).toBe(2);
    expect(domains.length).toBeGreaterThan(0);
  });

  it('reconcileResearchTier: respects needsResearch false for conceptual answers', () => {
    const h = extractEntitiesFromQuery('WSO2 vs SyscoLabs');
    const { tier, domains } = reconcileResearchTier(h, {
      tier: 2,
      needsResearch: false,
      domains: ['competitive'],
    });
    expect(tier).toBe(0);
    expect(domains).toEqual([]);
  });

  it('reconcileResearchTier: needsResearch true lifts tier 0', () => {
    const h = { product: 'A', competitor: 'B' };
    const { tier } = reconcileResearchTier(h, {
      tier: 0,
      needsResearch: true,
      domains: [],
    });
    expect(tier).toBe(2);
  });

  it('textMentionsAnyToken matches substrings case-insensitively', () => {
    expect(textMentionsAnyToken('Facebook ads revenue', ['facebook'])).toBe(true);
  });
});
