import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playerCsvRowSchema, validatePlayerCsv } from '@/lib/validation/player';

const validRow = {
  name: 'Test Player',
  slug: 'test-player',
  nationality: 'Spain',
  countryCode: 'ES',
  club: 'Test Club',
  league: 'LA_LIGA',
  position: 'Midfielder',
  positionGroup: 'MIDFIELDER',
  birthDate: '2000-02-29',
  heightCm: '',
  preferredFoot: '',
  active: 'true',
};

describe('player import validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T00:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it.each(['2000-02-29', '2012-09-08', '1965-09-09', '1966-09-08'])(
    'accepts valid dates and inclusive age boundaries: %s',
    (birthDate) => {
      expect(playerCsvRowSchema.safeParse({ ...validRow, birthDate }).success).toBe(true);
    }
  );

  it.each(['', 'not-a-date', '2001-02-29', '2000-04-31', '2000-13-01', '2000-2-01'])(
    'rejects invalid calendar dates: %s',
    (birthDate) => {
      expect(playerCsvRowSchema.safeParse({ ...validRow, birthDate }).success).toBe(false);
    }
  );

  it.each(['2026-09-09', '2025-06-30', '2012-09-09', '1965-09-08'])(
    'rejects future dates and ineligible ages: %s',
    (birthDate) => {
      expect(playerCsvRowSchema.safeParse({ ...validRow, birthDate }).success).toBe(false);
    }
  );

  it('rejects the entire batch and identifies the invalid birth-date field', () => {
    const result = validatePlayerCsv([
      validRow,
      { ...validRow, slug: 'invalid-player', birthDate: '2025-06-30' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        expect.stringContaining('Row 2: birthDate - Player age must be between 14 and 60'),
      ]);
    }
  });

  it.each([
    [false, false],
    ['false', false],
    [true, true],
    ['true', true],
  ])('preserves the active flag %s as %s', (active, expected) => {
    expect(playerCsvRowSchema.parse({ ...validRow, active }).active).toBe(expected);
  });

  it('rejects unrecognized boolean text', () => {
    expect(playerCsvRowSchema.safeParse({ ...validRow, active: 'unknown' }).success).toBe(false);
  });

  it.each([
    ['name', ''],
    ['slug', 'Bad Slug'],
    ['nationality', ''],
    ['countryCode', 'ESP'],
    ['club', ''],
    ['league', 'UNKNOWN'],
    ['position', ''],
    ['positionGroup', 'UNKNOWN'],
    ['heightCm', 149],
    ['heightCm', 221],
    ['heightCm', 180.5],
    ['heightCm', 'tall'],
    ['preferredFoot', 'UNKNOWN'],
    ['popularity', 0],
    ['popularity', 101],
    ['popularity', 1.5],
    ['imageUrl', 'not-a-url'],
    ['clubLogoUrl', 'not-a-url'],
  ])('rejects invalid %s: %s', (field, value) => {
    const result = playerCsvRowSchema.safeParse({ ...validRow, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each([150, 220])('accepts height boundary %s', (heightCm) => {
    expect(playerCsvRowSchema.parse({ ...validRow, heightCm }).heightCm).toBe(heightCm);
  });

  it.each(['', null, undefined])('accepts unavailable optional attributes: %s', (value) => {
    const row = playerCsvRowSchema.parse({ ...validRow, heightCm: value, preferredFoot: value });
    expect(row.heightCm).toBeNull();
    expect(row.preferredFoot).toBeNull();
  });

  it('rejects duplicate slugs', () => {
    const result = validatePlayerCsv([validRow, validRow]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors).toContain('Row 2: Duplicate slug "test-player"');
  });
});
