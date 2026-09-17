/**
 * POST /api/games/:gameId/guesses
 * Submit a guess for a game.
 */

import { NextResponse } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  internalErrorResponse,
  ErrorCodes,
} from '@/lib/api';
import { gameIdSchema, submitGuessSchema, parseRequestBody } from '@/lib/validation/api';
import {
  getGameById,
  getPlayerById,
  hasPlayerBeenGuessed,
  submitGuess,
  toGameState,
  toPlayerData,
} from '@/features/game/services';
import { comparePlayer, isWinningGuess } from '@/features/game/utils';
import type { SubmitGuessResponse, GuessWithComparison } from '@/features/game/types';

type RouteParams = {
  params: Promise<{ gameId: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { gameId } = await params;

    // Validate gameId
    const gameIdValidation = gameIdSchema.safeParse(gameId);
    if (!gameIdValidation.success) {
      return validationErrorResponse('Invalid game ID format');
    }

    // Parse and validate request body
    const bodyResult = await parseRequestBody(request, submitGuessSchema);
    if (!bodyResult.success) {
      return validationErrorResponse('Invalid request body', bodyResult.errors);
    }

    const { playerId } = bodyResult.data;

    // Fetch the game
    const game = await getGameById(gameId);
    if (!game) {
      return notFoundResponse(ErrorCodes.GAME_NOT_FOUND, 'Game not found');
    }

    // Check if game is already complete
    if (game.status !== 'PLAYING') {
      return conflictResponse(
        ErrorCodes.GAME_COMPLETED,
        'Cannot submit guess to a completed game'
      );
    }

    // Fetch the guessed player
    const guessedPlayer = await getPlayerById(playerId);
    if (!guessedPlayer) {
      return notFoundResponse(ErrorCodes.PLAYER_NOT_FOUND, 'Player not found');
    }

    // Check for duplicate guess
    const alreadyGuessed = await hasPlayerBeenGuessed(gameId, playerId);
    if (alreadyGuessed) {
      return conflictResponse(
        ErrorCodes.DUPLICATE_GUESS,
        'This player has already been guessed'
      );
    }

    // Calculate comparison using game creation date for consistent age
    const referenceDate = game.createdAt;
    const guessedPlayerData = toPlayerData(guessedPlayer, referenceDate);
    const answerPlayerData = toPlayerData(game.answerPlayer, referenceDate);
    const comparison = comparePlayer(guessedPlayerData, answerPlayerData);
    const isCorrect = isWinningGuess(guessedPlayer.id, game.answerPlayerId);

    // Submit the guess and update game state
    const guessNumber = game.attemptsUsed + 1;
    const updatedGame = await submitGuess(
      gameId,
      playerId,
      guessNumber,
      isCorrect,
      game.maxAttempts
    );

    if (!updatedGame) {
      return internalErrorResponse('Failed to submit guess');
    }

    // Build response
    const gameState = toGameState(updatedGame);
    const guess: GuessWithComparison = {
      guessNumber,
      player: guessedPlayerData,
      comparison,
      createdAt: new Date().toISOString(),
    };

    const response: SubmitGuessResponse = {
      game: gameState,
      guess,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Error submitting guess:', error);
    return internalErrorResponse();
  }
}
