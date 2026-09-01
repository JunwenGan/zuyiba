/**
 * Game feature types.
 * These define the public API contract - what clients see.
 */

import type { GameStatus, League, PositionGroup, PreferredFoot } from '@/types/database';

/**
 * Public player summary for search results and display.
 * Does not include sensitive game state information.
 */
export interface PlayerSummary {
  id: string;
  name: string;
  club: string;
  league: League;
  nationality: string;
  countryCode: string;
  imageUrl: string | null;
  clubLogoUrl: string | null;
}

/**
 * Full player data for comparison results.
 * Sent after a guess is made.
 */
export interface PlayerData {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  club: string;
  league: League;
  position: string;
  positionGroup: PositionGroup;
  age: number;
  heightCm: number | null;      // Nullable - not all data sources provide height
  preferredFoot: PreferredFoot | null; // Nullable - not all data sources provide preferred foot
  imageUrl: string | null;
  clubLogoUrl: string | null;
}

/**
 * Comparison result for a single attribute.
 */
export type ComparisonResult = 'correct' | 'partial' | 'incorrect';

/**
 * Direction for numeric comparisons.
 * Describes the hidden answer relative to the guess.
 */
export type ComparisonDirection = 'higher' | 'lower' | 'equal';

/**
 * Full comparison result for a guess.
 * Height and preferredFoot are optional - null means data is unknown.
 */
export interface GuessComparison {
  nationality: ComparisonResult;
  club: ComparisonResult;
  league: ComparisonResult;
  position: ComparisonResult;
  age: {
    result: ComparisonResult;
    direction: ComparisonDirection;
  };
  height: {
    result: ComparisonResult;
    direction: ComparisonDirection;
  } | null; // null if either player's height is unknown
  preferredFoot: ComparisonResult | null; // null if either player's foot is unknown
}

/**
 * A guess with its comparison results.
 */
export interface GuessWithComparison {
  guessNumber: number;
  player: PlayerData;
  comparison: GuessComparison;
  createdAt: string;
}

/**
 * Public game state returned by API.
 * The answer is only included when the game is complete.
 */
export interface GameState {
  id: string;
  status: GameStatus;
  attemptsUsed: number;
  maxAttempts: number;
  guesses: GuessWithComparison[];
  answer: PlayerData | null; // Only set when status is WON or LOST
  createdAt: string;
  completedAt: string | null;
}

/**
 * Response from creating a new game.
 */
export interface CreateGameResponse {
  id: string;
  status: GameStatus;
  attemptsUsed: number;
  maxAttempts: number;
  createdAt: string;
}

/**
 * Response from submitting a guess.
 */
export interface SubmitGuessResponse {
  game: GameState;
  guess: GuessWithComparison;
}

/**
 * Player search results.
 */
export interface SearchPlayersResponse {
  players: PlayerSummary[];
  query: string;
}
