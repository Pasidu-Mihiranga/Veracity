import { describe, expect, it } from 'vitest';
import { propagateClaimConfidence, sourceTrustFromUrl } from '@/lib/kg/confidence';
import { hashClaimKey, normalizeEntityKey, sourceKeyFromUrl } from '@/lib/kg/normalize';
import { expiresAtFromConfidence, ttlMsFromConfidence } from '@/lib/kg/memory-ttl';
import { KG_RELS } from '@/lib/kg/types';

describe('Phase 7 normalize + keys', () => {
  it('collapses OpenAI variants to one key', () => {
    expect(normalizeEntityKey('OpenAI')).toBe(normalizeEntityKey('Open AI'));
    expect(normalizeEntityKey('OpenAI, Inc.')).toBe(normalizeEntityKey('OpenAI LLC'));
  });

  it('hashes claims stably', () => {
    expect(hashClaimKey('Pricing rose 10%')).toBe(hashClaimKey('Pricing rose 10%'));
    expect(hashClaimKey('A')).not.toBe(hashClaimKey('B'));
  });

  it('builds source keys from URLs', () => {
    expect(sourceKeyFromUrl('https://Example.com/Path/')).toContain('examplecom');
  });
});

describe('Phase 7 confidence propagation', () => {
  it('raises confidence with more trusted supports', () => {
    const low = propagateClaimConfidence([{ trust: 0.5 }]);
    const high = propagateClaimConfidence([
      { trust: 0.9 },
      { trust: 0.9 },
      { trust: 0.85 },
      { trust: 0.9 },
      { trust: 0.88 },
    ]);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(0.8);
    expect(high).toBeLessThanOrEqual(0.98);
  });

  it('assigns higher trust to reputable hosts', () => {
    expect(sourceTrustFromUrl('https://www.reuters.com/a')).toBeGreaterThan(
      sourceTrustFromUrl('https://reddit.com/r/x'),
    );
  });
});

describe('Phase 7 memory aging', () => {
  it('maps high confidence to longer TTL', () => {
    expect(ttlMsFromConfidence(0.9)).toBeGreaterThan(ttlMsFromConfidence(0.4));
    const exp = expiresAtFromConfidence(0.9, Date.parse('2026-01-01T00:00:00Z'));
    expect(exp.getTime()).toBeGreaterThan(Date.parse('2026-01-20T00:00:00Z'));
  });
});

describe('Phase 7 typed relationships', () => {
  it('includes enterprise relationship vocabulary', () => {
    expect(KG_RELS).toContain('supports');
    expect(KG_RELS).toContain('acquired');
    expect(KG_RELS).toContain('competes_with');
    expect(KG_RELS).toContain('same_as');
    expect(KG_RELS).toContain('invested_in');
  });
});

describe('Phase 7 feature flags', () => {
  it('exposes knowledge platform flags', async () => {
    const { featureFlags } = await import('@/lib/feature-flags');
    expect('evidenceGraph' in featureFlags).toBe(true);
    expect('competitorProfiles' in featureFlags).toBe(true);
    expect('kgExplorer' in featureFlags).toBe(true);
    expect('crossAgentMemory' in featureFlags).toBe(true);
    expect('kgMaintenance' in featureFlags).toBe(true);
    expect('kgAnalytics' in featureFlags).toBe(true);
    expect('langgraphExecutor' in featureFlags).toBe(true);

  });
});
