import { describe, it, expect } from 'vitest';
import { normalizeBeltRank } from '@/lib/models/student';

describe('Legacy Schema Parity & Hydration Compatibility', () => {
  it('strips redundant "Belt" suffix from legacy belt ranks', () => {
    expect(normalizeBeltRank('Yellow Belt')).toBe('Yellow');
    expect(normalizeBeltRank('Orange belt')).toBe('Orange');
    expect(normalizeBeltRank('Green   Belt')).toBe('Green');
    expect(normalizeBeltRank('Black Belt')).toBe('Black');
    expect(normalizeBeltRank('White')).toBe('White');
  });

  it('falls back to "White" for unknown or malformed belt ranks', () => {
    expect(normalizeBeltRank('')).toBe('White');
    expect(normalizeBeltRank(null)).toBe('White');
    expect(normalizeBeltRank(undefined)).toBe('White');
    expect(normalizeBeltRank('Rainbow Belt')).toBe('White');
  });
});
