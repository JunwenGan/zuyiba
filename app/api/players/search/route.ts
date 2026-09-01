/**
 * GET /api/players/search?q=
 * Search for players by name.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { searchQuerySchema } from '@/lib/validation/api';
import { searchPlayers, toPlayerSummary } from '@/features/game/services';
import type { SearchPlayersResponse } from '@/features/game/types';

const SEARCH_RESULT_LIMIT = 10;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('q') ?? '';

    // Validate query
    const validationResult = searchQuerySchema.safeParse(rawQuery);
    if (!validationResult.success) {
      return validationErrorResponse(
        validationResult.error.issues[0]?.message ?? 'Invalid search query'
      );
    }

    const query = validationResult.data;

    // Search for players
    const players = await searchPlayers(query, SEARCH_RESULT_LIMIT);

    const response: SearchPlayersResponse = {
      players: players.map(toPlayerSummary),
      query,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Error searching players:', error);
    return internalErrorResponse();
  }
}
