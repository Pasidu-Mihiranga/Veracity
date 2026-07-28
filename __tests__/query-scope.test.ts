import { describe, expect, it } from 'vitest';
import { extractEntitiesFromQuery } from '@/lib/agents/extract-entities';
import {
  filterHistoryForQueryScope,
  gateMemoryContext,
  isConceptualCompareQuery,
  isGenericContinuePrompt,
  isResearchCompareIntent,
} from '@/lib/agents/query-scope';

describe('query-scope', () => {
  it('treats WSO2 vs SyscoLabs as conceptual Tier-0 compare (no agents)', () => {
    const q = 'Compare WSO2 and SyscoLabs';
    const h = extractEntitiesFromQuery(q);
    expect(h.product).toMatch(/WSO2/i);
    expect(h.competitor).toMatch(/SyscoLabs/i);
    expect(isConceptualCompareQuery(q, h)).toBe(true);
    expect(isResearchCompareIntent(q)).toBe(false);
  });

  it('treats research compares as not conceptual', () => {
    const q = 'Compare Notion and Linear positioning and pricing';
    const h = extractEntitiesFromQuery(q);
    expect(isConceptualCompareQuery(q, h)).toBe(false);
    expect(isResearchCompareIntent(q)).toBe(true);
  });

  it('detects generic dig-deeper continue prompts', () => {
    expect(isGenericContinuePrompt('What product or competitor would you like to analyze today?')).toBe(true);
    expect(isGenericContinuePrompt('Compare WSO2 and SyscoLabs')).toBe(false);
  });

  it('drops Lilian profile memory when query is about other companies', () => {
    const memory = [
      '[USER PROFILE & PERSONAL MEMORY — persistent baseline]',
      'User Company: Lilian',
      'Tracked Competitors: Clay',
      'Durable Facts:',
      '  - Lilian targets AI SDR buyers',
    ].join('\n');
    const q = 'Compare WSO2 and SyscoLabs';
    const h = extractEntitiesFromQuery(q);
    expect(gateMemoryContext(q, memory, h)).toBeUndefined();
  });

  it('keeps memory when query is about the profile company', () => {
    const memory = 'User Company: Lilian\nTracked Competitors: Clay';
    const q = 'Is Lilian competitive against Clay?';
    const h = extractEntitiesFromQuery(q);
    expect(gateMemoryContext(q, memory, h)).toBe(memory);
  });

  it('filters history to same-topic messages only', () => {
    const history = [
      { role: 'user' as const, content: 'Is Lilian competitive?' },
      { role: 'assistant' as const, content: 'Analyze Clay for Lilian positioning.' },
      { role: 'user' as const, content: 'Compare WSO2 and SyscoLabs' },
      { role: 'assistant' as const, content: 'WSO2 sells middleware; SyscoLabs is captive engineering.' },
    ];
    const h = extractEntitiesFromQuery('Compare WSO2 and SyscoLabs');
    const scoped = filterHistoryForQueryScope(history, h, 4);
    expect(scoped.every((m) => /WSO2|SyscoLabs/i.test(m.content))).toBe(true);
    expect(scoped.some((m) => /Lilian|Clay/i.test(m.content))).toBe(false);
  });
});
