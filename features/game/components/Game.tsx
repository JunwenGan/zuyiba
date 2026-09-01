'use client';

/**
 * Main game component that orchestrates the game flow.
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGame } from '@/features/game/hooks';
import { PlayerSearch } from './PlayerSearch';
import { GuessTable } from './GuessTable';
import { GameResultModal } from './GameResultModal';
import type { PlayerSummary } from '@/features/game/types';
import type { GameMode } from '@/types/database';
import { zh } from '@/lib/i18n';

export function Game() {
  const { gameState, status, error, isLoading, startNewGame, makeGuess, resetToModeSelection } =
    useGame();

  // Set of player IDs that have already been guessed
  const guessedPlayerIds = useMemo(() => {
    if (!gameState) return new Set<string>();
    return new Set(gameState.guesses.map((g) => g.player.id));
  }, [gameState]);

  // Handle player selection from search
  const handleSelectPlayer = async (player: PlayerSummary) => {
    await makeGuess(player.id);
  };

  // Handle starting game with selected mode
  const handleStartGame = (mode: GameMode) => {
    void startNewGame(mode);
  };

  // Render idle state (no active game) - show mode selection
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center gap-8">
        <p className="text-muted-foreground text-lg">{zh.subtitle}</p>
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">{zh.selectMode}</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Card
              className="w-64 cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => handleStartGame('NORMAL')}
            >
              <CardContent className="flex flex-col items-center gap-2 py-6">
                <span className="text-2xl">⚽</span>
                <span className="text-lg font-semibold">{zh.normalMode}</span>
                <span className="text-sm text-muted-foreground text-center">
                  {zh.normalModeDesc}
                </span>
              </CardContent>
            </Card>
            <Card
              className="w-64 cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => handleStartGame('HARD')}
            >
              <CardContent className="flex flex-col items-center gap-2 py-6">
                <span className="text-2xl">🔥</span>
                <span className="text-lg font-semibold">{zh.hardMode}</span>
                <span className="text-sm text-muted-foreground text-center">
                  {zh.hardModeDesc}
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state for initial game load
  if (status === 'loading' && !gameState) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-muted-foreground">{zh.startingGame}</p>
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error' && !gameState) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-destructive">{error || zh.errors.genericError}</p>
        <Button size="lg" onClick={resetToModeSelection}>
          {zh.startGame}
        </Button>
      </div>
    );
  }

  // Main game UI
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-6">
      {/* Attempt counter */}
      {gameState && (
        <div className="flex w-full max-w-md items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{zh.attemptsRemaining}:</span>
            <span className="font-bold text-foreground">
              {gameState.maxAttempts - gameState.attemptsUsed}
            </span>
            <span>/ {gameState.maxAttempts}</span>
          </div>
          {status === 'playing' && (
            <Button variant="outline" size="sm" onClick={resetToModeSelection} disabled={isLoading}>
              {zh.restartGame}
            </Button>
          )}
        </div>
      )}

      {/* Player search */}
      {status === 'playing' && (
        <Card className="w-full max-w-md overflow-visible">
          <CardContent className="pt-4">
            <PlayerSearch
              onSelect={handleSelectPlayer}
              disabled={isLoading}
              guessedPlayerIds={guessedPlayerIds}
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Loading indicator during guess submission */}
      {isLoading && gameState && (
        <p className="text-sm text-muted-foreground">{zh.loading}</p>
      )}

      {/* Guess history table */}
      {gameState && gameState.guesses.length > 0 && (
        <Card className="w-full">
          <CardContent className="pt-4">
            <GuessTable guesses={gameState.guesses} />
          </CardContent>
        </Card>
      )}

      {/* Result modal */}
      <GameResultModal
        isOpen={status === 'won' || status === 'lost'}
        isWin={status === 'won'}
        answer={gameState?.answer ?? null}
        attemptsUsed={gameState?.attemptsUsed ?? 0}
        onNewGame={resetToModeSelection}
      />
    </div>
  );
}
