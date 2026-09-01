/**
 * Client-side API functions for the game feature.
 */

import type { ApiResponse } from '@/lib/api';
import type {
  CreateGameResponse,
  GameState,
  SearchPlayersResponse,
  SubmitGuessResponse,
} from '@/features/game/types';
import type { GameMode } from '@/types/database';

/**
 * Generic fetch wrapper that handles API responses.
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, response.status);
  }

  return json.data;
}

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create a new game.
 * @param mode - Game mode: NORMAL (elite clubs) or HARD (all players)
 */
export async function createGame(mode: GameMode = 'NORMAL'): Promise<CreateGameResponse> {
  const params = new URLSearchParams({ mode });
  return fetchApi<CreateGameResponse>(`/api/games?${params}`, {
    method: 'POST',
  });
}

/**
 * Get the current state of a game.
 */
export async function getGame(gameId: string): Promise<GameState> {
  return fetchApi<GameState>(`/api/games/${gameId}`);
}

/**
 * Submit a guess for a game.
 */
export async function submitGuess(gameId: string, playerId: string): Promise<SubmitGuessResponse> {
  return fetchApi<SubmitGuessResponse>(`/api/games/${gameId}/guesses`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });
}

/**
 * Search for players by name.
 */
export async function searchPlayers(query: string): Promise<SearchPlayersResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchApi<SearchPlayersResponse>(`/api/players/search?${params}`);
}
