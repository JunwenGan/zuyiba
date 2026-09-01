/**
 * POST /api/games
 * Create a new game session.
 *
 * Query parameters:
 * - mode: 'NORMAL' (default) | 'HARD'
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  internalErrorResponse,
  errorResponse,
  ErrorCodes,
} from '@/lib/api';
import {
  createGame,
  getRandomActivePlayer,
  toCreateGameResponse,
} from '@/features/game/services';
import type { CreateGameResponse } from '@/features/game/types';
import { GAME_MODES, type GameMode } from '@/types/database';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse mode from query parameter (default to NORMAL)
    const searchParams = request.nextUrl.searchParams;
    const modeParam = searchParams.get('mode')?.toUpperCase();
    const mode: GameMode =
      modeParam && GAME_MODES.includes(modeParam as GameMode)
        ? (modeParam as GameMode)
        : 'NORMAL';

    // Select a random active player as the answer
    const answerPlayer = await getRandomActivePlayer(mode);

    if (!answerPlayer) {
      return errorResponse(
        ErrorCodes.NO_ELIGIBLE_PLAYERS,
        'No eligible players available for a new game',
        500
      );
    }

    // Create the game session
    const game = await createGame(answerPlayer.id);

    // Return safe public response (no answer revealed)
    const response: CreateGameResponse = toCreateGameResponse(game);
    return successResponse(response, 201);
  } catch (error) {
    console.error('Error creating game:', error);
    return internalErrorResponse();
  }
}
