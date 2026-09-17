import { describe, expect, it } from 'vitest';
import { calculateAge } from '@/features/game/utils/age';

describe('age at the game reference date', () => {
  it.each([
    ['2004-09-08', '2026-09-07T23:59:59Z', 21],
    ['2004-09-08', '2026-09-08T00:00:00Z', 22],
    ['2004-09-08', '2026-09-09T00:00:00Z', 22],
    ['2000-12-31', '2026-01-01T00:00:00Z', 25],
    ['2000-02-29', '2025-02-28T00:00:00Z', 24],
    ['2000-02-29', '2025-03-01T00:00:00Z', 25],
    ['2000-02-29', '2024-02-29T00:00:00Z', 24],
    ['2004-09-08', '2026-09-08T01:00:00+10:00', 21],
  ])('%s as of %s is %i', (birth, reference, expected) => {
    expect(calculateAge(new Date(birth), new Date(reference))).toBe(expected);
  });
});
