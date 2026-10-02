import type { ComparisonResult, GuessWithComparison } from '../game/types';

export type OpponentField = 'nationality' | 'club' | 'league' | 'position' | 'age';
export interface OpponentGuess {
  guessNumber: number;
  results: Record<OpponentField, ComparisonResult>;
}

/** Explicit allowlist: never send the opponent's player, values or age direction. */
export function toOpponentGuess(guess: GuessWithComparison): OpponentGuess {
  return {
    guessNumber: guess.guessNumber,
    results: {
      nationality: guess.comparison.nationality,
      club: guess.comparison.club,
      league: guess.comparison.league,
      position: guess.comparison.position,
      age: guess.comparison.age.result,
    },
  };
}
