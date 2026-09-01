import { describe, expect, it } from 'vitest';
import { comparePlayer } from '@/features/game/utils';
import type { PlayerData } from '@/features/game/types';

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: 'player-1',
    name: 'Test Player',
    nationality: 'Spain',
    countryCode: 'ES',
    club: 'Test Club',
    league: 'LA_LIGA',
    position: 'Midfielder',
    positionGroup: 'MIDFIELDER',
    age: 25,
    heightCm: 180,
    preferredFoot: 'RIGHT',
    imageUrl: null,
    clubLogoUrl: null,
    ...overrides,
  };
}

describe('nationality comparison', () => {
  it('returns partial for different countries on the same continent', () => {
    const comparison = comparePlayer(player({ countryCode: 'ES' }), player({ countryCode: 'PT' }));

    expect(comparison.nationality).toBe('partial');
  });

  it('returns incorrect for countries on different continents', () => {
    const comparison = comparePlayer(player({ countryCode: 'ES' }), player({ countryCode: 'BR' }));

    expect(comparison.nationality).toBe('incorrect');
  });
});
