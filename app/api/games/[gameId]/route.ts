/**
 * GET /api/games/:gameId
 * Get the current state of a game session.
 */

import { NextResponse } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  ErrorCodes,
} from '@/lib/api';
import { gameIdSchema } from '@/lib/validation/api';
import { getGameById, toGameState } from '@/features/game/services';
import type { GameState } from '@/features/game/types';

type RouteParams = {
  params: Promise<{ gameId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { gameId } = await params;

    // Validate gameId
    const validationResult = gameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      return validationErrorResponse('Invalid game ID format');
    }

    // Fetch the game
    const game = await getGameById(gameId);

    if (!game) {
      return notFoundResponse(ErrorCodes.GAME_NOT_FOUND, 'Game not found');
    }

    // Convert to public state (hides answer if game is still playing)
    const gameState: GameState = toGameState(game);
    return successResponse(gameState);
  } catch (error) {
    console.error('Error fetching game:', error);
    return internalErrorResponse();
  }
}
