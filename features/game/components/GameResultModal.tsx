'use client';

/**
 * Game result modal for win/loss states.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PlayerData } from '@/features/game/types';
import { zh } from '@/lib/i18n';

interface GameResultModalProps {
  isOpen: boolean;
  isWin: boolean;
  answer: PlayerData | null;
  attemptsUsed: number;
  onNewGame: () => void;
}

export function GameResultModal({
  isOpen,
  isWin,
  answer,
  attemptsUsed,
  onNewGame,
}: GameResultModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className={isWin ? 'text-green-600' : 'text-red-600'}>
            {isWin ? zh.win : zh.loss}
          </DialogTitle>
          <DialogDescription>
            {isWin
              ? `${attemptsUsed} ${zh.attempt}`
              : answer?.name}
          </DialogDescription>
        </DialogHeader>

        {answer && (
          <div className="space-y-3 py-4">
            <div className="text-center">
              <h3 className="text-xl font-bold">{answer.name}</h3>
              <p className="text-sm text-muted-foreground">
                {answer.club} · {zh.leagues[answer.league as keyof typeof zh.leagues]}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">{zh.attributes.nationality}</span>
                <p className="font-medium">{answer.nationality}</p>
              </div>
              <div className="rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">{zh.attributes.position}</span>
                <p className="font-medium">{answer.position}</p>
              </div>
              <div className="rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">{zh.attributes.age}</span>
                <p className="font-medium">{answer.age}</p>
              </div>
              <div className="rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">{zh.attributes.height}</span>
                <p className="font-medium">{answer.heightCm}cm</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Button onClick={onNewGame} size="lg">
            {zh.newGame}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
