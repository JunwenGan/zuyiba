'use client';

/**
 * Hook for managing game state.
 */

import { useState, useCallback, useEffect } from 'react';
import type { GameState } from '@/features/game/types';
import { createGame, getGame, submitGuess, ApiError } from '@/features/game/api/client';
import type { GameMode } from '@/types/database';

const STORAGE_KEY = 'zuyiba_current_game_id';

type GameStatus = 'idle' | 'loading' | 'playing' | 'won' | 'lost' | 'error';

interface UseGameReturn {
  gameState: GameState | null;
  status: GameStatus;
  error: string | null;
  isLoading: boolean;
  startNewGame: (mode?: GameMode) => Promise<void>;
  makeGuess: (playerId: string) => Promise<void>;
  resumeGame: () => Promise<void>;
  resetToModeSelection: () => void;
}

/**
 * Get stored game ID from localStorage.
 */
function getStoredGameId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Store game ID in localStorage.
 */
function storeGameId(gameId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, gameId);
}

/**
 * Clear stored game ID from localStorage.
 */
function clearStoredGameId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function useGame(): UseGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const isLoading = status === 'loading';

  /**
   * Start a new game.
   * @param mode - Game mode: NORMAL (elite clubs) or HARD (all players)
   */
  const startNewGame = useCallback(async (mode: GameMode = 'NORMAL') => {
    setStatus('loading');
    setError(null);

    try {
      const newGame = await createGame(mode);
      storeGameId(newGame.id);

      // Fetch full game state
      const fullState = await getGame(newGame.id);
      setGameState(fullState);
      setStatus('playing');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to start game';
      setError(message);
      setStatus('error');
    }
  }, []);

  /**
   * Resume an existing game from localStorage.
   */
  const resumeGame = useCallback(async () => {
    const storedId = getStoredGameId();
    if (!storedId) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const state = await getGame(storedId);
      setGameState(state);

      if (state.status === 'PLAYING') {
        setStatus('playing');
      } else if (state.status === 'WON') {
        setStatus('won');
      } else {
        setStatus('lost');
      }
    } catch {
      // Game not found, clear storage and go to idle
      clearStoredGameId();
      setStatus('idle');
    }
  }, []);

  /**
   * Submit a guess.
   */
  const makeGuess = useCallback(
    async (playerId: string) => {
      if (!gameState || status !== 'playing') return;

      setStatus('loading');
      setError(null);

      try {
        const result = await submitGuess(gameState.id, playerId);
        setGameState(result.game);

        if (result.game.status === 'WON') {
          setStatus('won');
        } else if (result.game.status === 'LOST') {
          setStatus('lost');
        } else {
          setStatus('playing');
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to submit guess';
        setError(message);
        setStatus('playing'); // Stay in playing state on error
      }
    },
    [gameState, status]
  );

  /**
   * Reset to mode selection (idle state).
   */
  const resetToModeSelection = useCallback(() => {
    clearStoredGameId();
    setGameState(null);
    setStatus('idle');
    setError(null);
  }, []);

  /**
   * Try to resume game on mount.
   * This is a valid initialization pattern for async data fetching.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resumeGame();
  }, [resumeGame]);

  return {
    gameState,
    status,
    error,
    isLoading,
    startNewGame,
    makeGuess,
    resumeGame,
    resetToModeSelection,
  };
}
