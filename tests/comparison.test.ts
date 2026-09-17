import { describe, expect, it } from 'vitest';
import { comparePlayer, isWinningGuess } from '@/features/game/utils';
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

describe('winning guesses', () => {
  it.each([
    { heightCm: 180, preferredFoot: 'RIGHT' as const },
    { heightCm: null, preferredFoot: null },
  ])('does not award a win to an identical-attribute player (%j)', (attributes) => {
    const answer = player(attributes);
    const guessed = player({ ...attributes, id: 'player-2', name: 'Another Player' });

    // Feedback is indistinguishable from guessing the answer, but identity differs.
    expect(comparePlayer(guessed, answer)).toEqual(comparePlayer(answer, answer));
    expect(isWinningGuess(guessed.id, answer.id)).toBe(false);
  });

  it('awards a win to the answer even when optional attributes are missing', () => {
    const answer = player({ heightCm: null, preferredFoot: null });
    const guessed = { ...answer };

    expect(isWinningGuess(guessed.id, answer.id)).toBe(true);
  });
});

describe('nationality comparison', () => {
  it.each([
    ['ES', 'ES', 'correct'],
    ['XX', 'ES', 'incorrect'],
    ['ES', 'XX', 'incorrect'],
    ['XX', 'ZZ', 'incorrect'],
    ['NG', 'EG', 'partial'],
    ['AR', 'BR', 'partial'],
  ])('%s against %s returns %s', (guessed, answer, expected) => {
    expect(
      comparePlayer(player({ countryCode: guessed }), player({ countryCode: answer })).nationality
    ).toBe(expected);
  });
  it('returns partial for different countries on the same continent', () => {
    const comparison = comparePlayer(player({ countryCode: 'ES' }), player({ countryCode: 'PT' }));

    expect(comparison.nationality).toBe('partial');
  });

  it('returns incorrect for countries on different continents', () => {
    const comparison = comparePlayer(player({ countryCode: 'ES' }), player({ countryCode: 'BR' }));

    expect(comparison.nationality).toBe('incorrect');
  });
});

describe('all comparison fields', () => {
  it.each(['club', 'league'] as const)('%s matches exactly', (field) => {
    expect(comparePlayer(player(), player())[field]).toBe('correct');
    const different = field === 'club' ? { club: 'Other Club' } : { league: 'SERIE_A' as const };
    expect(comparePlayer(player(different), player())[field]).toBe('incorrect');
  });

  it.each([
    ['Midfielder', 'MIDFIELDER', 'correct'],
    ['Attacking Midfielder', 'MIDFIELDER', 'partial'],
    ['Defender', 'DEFENDER', 'incorrect'],
  ] as const)('position %s returns %s', (position, positionGroup, expected) => {
    expect(comparePlayer(player({ position, positionGroup }), player()).position).toBe(expected);
  });

  for (const field of ['age', 'heightCm'] as const) {
    it.each([-1, 0, 1])(`${field}: guess offset %s points toward the answer`, (offset) => {
      const value = field === 'age' ? 25 : 180;
      const comparison = comparePlayer(player({ [field]: value + offset }), player());
      expect(comparison[field === 'age' ? 'age' : 'height']).toEqual({
        result: offset === 0 ? 'correct' : 'incorrect',
        direction: offset === 0 ? 'equal' : offset < 0 ? 'higher' : 'lower',
      });
    });
  }

  for (const guessed of ['LEFT', 'RIGHT', 'BOTH'] as const) {
    it.each(['LEFT', 'RIGHT', 'BOTH'] as const)(`foot ${guessed} against %s`, (answer) => {
      expect(
        comparePlayer(player({ preferredFoot: guessed }), player({ preferredFoot: answer }))
          .preferredFoot
      ).toBe(guessed === answer ? 'correct' : 'incorrect');
    });
  }

  it.each(['guess', 'answer', 'both'])('optional fields missing from %s return null', (side) => {
    const missing = { heightCm: null, preferredFoot: null };
    const comparison = comparePlayer(
      player(side !== 'answer' ? missing : {}),
      player(side !== 'guess' ? missing : {})
    );
    expect(comparison.height).toBeNull();
    expect(comparison.preferredFoot).toBeNull();
  });
});
