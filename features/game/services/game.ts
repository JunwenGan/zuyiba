/**
 * Game service for database operations.
 */

import { prisma } from '@/lib/database';
import type { GameSession, Guess, Player } from '@/lib/generated/prisma/client';
import type {
  CreateGameResponse,
  GameState,
  GuessWithComparison,
  PlayerData,
} from '@/features/game/types';
import { MAX_ATTEMPTS } from '@/types/database';
import { comparePlayer } from '@/features/game/utils';
import { toPlayerData } from './player';

/**
 * Full game session with related data.
 */
type GameSessionWithRelations = GameSession & {
  answerPlayer: Player;
  guesses: (Guess & { player: Player })[];
};

/**
 * Create a new game session with a random answer player.
 */
export async function createGame(answerPlayerId: string): Promise<GameSession> {
  return prisma.gameSession.create({
    data: {
      answerPlayerId,
      maxAttempts: MAX_ATTEMPTS,
    },
  });
}

/**
 * Get a game session by ID with all related data.
 */
export async function getGameById(gameId: string): Promise<GameSessionWithRelations | null> {
  return prisma.gameSession.findUnique({
    where: { id: gameId },
    include: {
      answerPlayer: true,
      guesses: {
        include: { player: true },
        orderBy: { guessNumber: 'asc' },
      },
    },
  });
}

/**
 * Check if a player has already been guessed in a game.
 */
export async function hasPlayerBeenGuessed(gameId: string, playerId: string): Promise<boolean> {
  const existing = await prisma.guess.findUnique({
    where: {
      gameSessionId_playerId: {
        gameSessionId: gameId,
        playerId,
      },
    },
  });
  return existing !== null;
}

/**
 * Submit a guess and update game state.
 * Returns the updated game session or null if the game doesn't exist.
 */
export async function submitGuess(
  gameId: string,
  playerId: string,
  guessNumber: number,
  isCorrect: boolean,
  maxAttempts: number
): Promise<GameSessionWithRelations | null> {
  const isLastAttempt = guessNumber >= maxAttempts;
  const newStatus = isCorrect ? 'WON' : isLastAttempt ? 'LOST' : 'PLAYING';
  const completedAt = newStatus !== 'PLAYING' ? new Date() : null;

  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Create the guess
    await tx.guess.create({
      data: {
        gameSessionId: gameId,
        playerId,
        guessNumber,
      },
    });

    // Update the game session
    await tx.gameSession.update({
      where: { id: gameId },
      data: {
        attemptsUsed: guessNumber,
        status: newStatus,
        completedAt,
      },
    });

    // Return the updated game with all relations
    return tx.gameSession.findUnique({
      where: { id: gameId },
      include: {
        answerPlayer: true,
        guesses: {
          include: { player: true },
          orderBy: { guessNumber: 'asc' },
        },
      },
    });
  });
}

/**
 * Convert a game session to the public GameState.
 * Handles hiding the answer when game is still in progress.
 */
export function toGameState(game: GameSessionWithRelations): GameState {
  const referenceDate = game.createdAt;
  const answerData = toPlayerData(game.answerPlayer, referenceDate);

  const guesses: GuessWithComparison[] = game.guesses.map((guess) => {
    const playerData = toPlayerData(guess.player, referenceDate);
    const comparison = comparePlayer(playerData, answerData);

    return {
      guessNumber: guess.guessNumber,
      player: playerData,
      comparison,
      createdAt: guess.createdAt.toISOString(),
    };
  });

  // Only include the answer if the game is complete
  const answer: PlayerData | null = game.status !== 'PLAYING' ? answerData : null;

  return {
    id: game.id,
    status: game.status,
    attemptsUsed: game.attemptsUsed,
    maxAttempts: game.maxAttempts,
    guesses,
    answer,
    createdAt: game.createdAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  };
}

/**
 * Convert a new game session to CreateGameResponse.
 */
export function toCreateGameResponse(game: GameSession): CreateGameResponse {
  return {
    id: game.id,
    status: game.status,
    attemptsUsed: game.attemptsUsed,
    maxAttempts: game.maxAttempts,
    createdAt: game.createdAt.toISOString(),
  };
}
