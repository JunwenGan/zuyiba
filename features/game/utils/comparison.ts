/**
 * Player comparison utilities.
 * Core game logic for comparing guessed player attributes against the hidden answer.
 */

import type {
  ComparisonDirection,
  ComparisonResult,
  GuessComparison,
  PlayerData,
} from '@/features/game/types';
import { getContinent } from './geography';

/**
 * Compare two string values for exact match.
 */
function compareExact(guessed: string, answer: string): ComparisonResult {
  return guessed === answer ? 'correct' : 'incorrect';
}

/**
 * Compare nationalities using country codes, with partial feedback for
 * different countries on the same continent.
 */
function compareNationality(
  guessedCountryCode: string,
  answerCountryCode: string
): ComparisonResult {
  if (guessedCountryCode === answerCountryCode) {
    return 'correct';
  }

  const guessedContinent = getContinent(guessedCountryCode);
  const answerContinent = getContinent(answerCountryCode);

  return guessedContinent && guessedContinent === answerContinent ? 'partial' : 'incorrect';
}

/**
 * Compare position with partial matching based on position groups.
 */
function comparePosition(
  guessedPosition: string,
  guessedGroup: string,
  answerPosition: string,
  answerGroup: string
): ComparisonResult {
  if (guessedPosition === answerPosition) {
    return 'correct';
  }
  if (guessedGroup === answerGroup) {
    return 'partial';
  }
  return 'incorrect';
}

/**
 * Compare numeric values and determine direction.
 * Direction describes the answer relative to the guess.
 */
function compareNumeric(
  guessed: number,
  answer: number
): { result: ComparisonResult; direction: ComparisonDirection } {
  if (guessed === answer) {
    return { result: 'correct', direction: 'equal' };
  }
  return {
    result: 'incorrect',
    direction: answer > guessed ? 'higher' : 'lower',
  };
}

/**
 * Compare a guessed player against the hidden answer.
 * Returns comparison results for all attributes.
 * Height and preferredFoot return null if either player's data is unknown.
 *
 * @param guessed - The player that was guessed
 * @param answer - The hidden answer player
 * @returns Full comparison results
 */
export function comparePlayer(guessed: PlayerData, answer: PlayerData): GuessComparison {
  // Height comparison - null if either is unknown
  const heightComparison =
    guessed.heightCm !== null && answer.heightCm !== null
      ? compareNumeric(guessed.heightCm, answer.heightCm)
      : null;

  // Preferred foot comparison - null if either is unknown
  const footComparison =
    guessed.preferredFoot !== null && answer.preferredFoot !== null
      ? compareExact(guessed.preferredFoot, answer.preferredFoot)
      : null;

  return {
    nationality: compareNationality(guessed.countryCode, answer.countryCode),
    club: compareExact(guessed.club, answer.club),
    league: compareExact(guessed.league, answer.league),
    position: comparePosition(
      guessed.position,
      guessed.positionGroup,
      answer.position,
      answer.positionGroup
    ),
    age: compareNumeric(guessed.age, answer.age),
    height: heightComparison,
    preferredFoot: footComparison,
  };
}

/**
 * Only the hidden player's identity determines a win.
 * Different players can share every comparison attribute.
 */
export function isWinningGuess(guessedPlayerId: string, answerPlayerId: string): boolean {
  return guessedPlayerId === answerPlayerId;
}
