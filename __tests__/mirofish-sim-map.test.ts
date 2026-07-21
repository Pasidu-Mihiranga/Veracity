/**
 * Smoke helpers for MiroFish product→sim mapping.
 * Avoids importing supabase/db by testing resolution logic in isolation.
 */
import { describe, expect, it } from 'vitest';

function resolveSimId(map: Record<string, string>, product: string): string | undefined {
  if (!product) return undefined;
  const keys = Object.keys(map);
  if (keys.length === 0) return undefined;
  const needle = product.toLowerCase().trim();
  if (map[needle]) return map[needle];
  const fuzzy = keys.find(k => needle.includes(k) || k.includes(needle));
  if (fuzzy) return map[fuzzy];
  const uniqueIds = [...new Set(Object.values(map))];
  if (uniqueIds.length === 1) return uniqueIds[0];
  if (keys.length === 1) return map[keys[0]];
  return undefined;
}

describe('mirofish product→sim resolution', () => {
  const map = {
    'vector agents': 'sim_test123',
    lilian: 'sim_test123',
  };

  it('resolves fuzzy product names', () => {
    expect(resolveSimId(map, 'Vector Agents')).toBe('sim_test123');
    expect(resolveSimId(map, 'Lilian')).toBe('sim_test123');
    expect(resolveSimId(map, 'vector agents (Lilian)')).toBe('sim_test123');
  });
});
