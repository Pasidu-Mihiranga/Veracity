import { describe, it, expect } from 'vitest';
import { toPgVectorLiteral } from '@/lib/pgvector';

describe('toPgVectorLiteral', () => {
  it('formats a numeric embedding for pgvector casts', () => {
    expect(toPgVectorLiteral([0.1, -0.2, 0.3])).toBe('[0.1,-0.2,0.3]');
  });

  it('rejects empty vectors', () => {
    expect(() => toPgVectorLiteral([])).toThrow(/non-empty/);
  });

  it('rejects non-finite values', () => {
    expect(() => toPgVectorLiteral([1, Number.NaN])).toThrow(/non-finite/);
  });
});
