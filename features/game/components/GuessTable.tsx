'use client';

/**
 * Guess results table component.
 * Displays all guesses with comparison feedback.
 */

import type { GuessWithComparison, ComparisonResult, ComparisonDirection } from '@/features/game/types';
import { zh } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Check, X, Minus, HelpCircle } from 'lucide-react';

interface GuessTableProps {
  guesses: GuessWithComparison[];
}

export function GuessTable({ guesses }: GuessTableProps) {
  if (guesses.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="sticky left-0 bg-background px-2 py-2 text-left font-medium">#</th>
            <th className="sticky left-8 bg-background px-2 py-2 text-left font-medium min-w-[120px]">
              {zh.attributes.name}
            </th>
            <th className="px-2 py-2 text-left font-medium">{zh.attributes.nationality}</th>
            <th className="px-2 py-2 text-left font-medium">{zh.attributes.club}</th>
            <th className="px-2 py-2 text-left font-medium">{zh.attributes.league}</th>
            <th className="px-2 py-2 text-left font-medium">{zh.attributes.position}</th>
            <th className="px-2 py-2 text-left font-medium">{zh.attributes.age}</th>
            {/* Height and preferred foot hidden - data not available from API */}
            {/* <th className="px-2 py-2 text-left font-medium">{zh.attributes.height}</th> */}
            {/* <th className="px-2 py-2 text-left font-medium">{zh.attributes.preferredFoot}</th> */}
          </tr>
        </thead>
        <tbody>
          {guesses.map((guess) => (
            <GuessRow key={guess.guessNumber} guess={guess} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GuessRowProps {
  guess: GuessWithComparison;
}

function GuessRow({ guess }: GuessRowProps) {
  const { player, comparison } = guess;

  return (
    <tr className="border-b">
      {/* Guess number */}
      <td className="sticky left-0 bg-background px-2 py-3 font-medium">
        {guess.guessNumber}
      </td>

      {/* Player name */}
      <td className="sticky left-8 bg-background px-2 py-3 font-medium">
        {player.name}
      </td>

      {/* Nationality */}
      <td className="px-2 py-3">
        <ComparisonCell result={comparison.nationality} value={player.nationality} />
      </td>

      {/* Club */}
      <td className="px-2 py-3">
        <ComparisonCell result={comparison.club} value={player.club} />
      </td>

      {/* League */}
      <td className="px-2 py-3">
        <ComparisonCell
          result={comparison.league}
          value={zh.leagues[player.league as keyof typeof zh.leagues] || player.league}
        />
      </td>

      {/* Position */}
      <td className="px-2 py-3">
        <ComparisonCell result={comparison.position} value={player.position} />
      </td>

      {/* Age */}
      <td className="px-2 py-3">
        <NumericComparisonCell
          result={comparison.age.result}
          direction={comparison.age.direction}
          value={player.age}
        />
      </td>

      {/* Height and preferred foot hidden - data not available from API */}
      {/* <td className="px-2 py-3">
        {comparison.height && player.heightCm !== null ? (
          <NumericComparisonCell
            result={comparison.height.result}
            direction={comparison.height.direction}
            value={`${player.heightCm}cm`}
          />
        ) : (
          <UnknownCell />
        )}
      </td> */}

      {/* <td className="px-2 py-3">
        {comparison.preferredFoot !== null && player.preferredFoot !== null ? (
          <ComparisonCell
            result={comparison.preferredFoot}
            value={zh.foot[player.preferredFoot as keyof typeof zh.foot] || player.preferredFoot}
          />
        ) : (
          <UnknownCell />
        )}
      </td> */}
    </tr>
  );
}

interface ComparisonCellProps {
  result: ComparisonResult;
  value: string | number;
}

function ComparisonCell({ result, value }: ComparisonCellProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        result === 'correct' && 'bg-green-500/20 text-green-700 dark:text-green-400',
        result === 'partial' && 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
        result === 'incorrect' && 'bg-red-500/20 text-red-700 dark:text-red-400'
      )}
    >
      <ResultIcon result={result} />
      <span className="truncate max-w-[100px]">{value}</span>
    </div>
  );
}

interface NumericComparisonCellProps {
  result: ComparisonResult;
  direction: ComparisonDirection;
  value: string | number;
}

function NumericComparisonCell({ result, direction, value }: NumericComparisonCellProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        result === 'correct' && 'bg-green-500/20 text-green-700 dark:text-green-400',
        result === 'incorrect' && 'bg-red-500/20 text-red-700 dark:text-red-400'
      )}
    >
      {result === 'correct' ? (
        <Check className="size-3" aria-label={zh.correct} />
      ) : direction === 'higher' ? (
        <ArrowUp className="size-3" aria-label={zh.higher} />
      ) : (
        <ArrowDown className="size-3" aria-label={zh.lower} />
      )}
      <span>{value}</span>
    </div>
  );
}

function ResultIcon({ result }: { result: ComparisonResult }) {
  switch (result) {
    case 'correct':
      return <Check className="size-3" aria-label={zh.correct} />;
    case 'partial':
      return <Minus className="size-3" aria-label={zh.partial} />;
    case 'incorrect':
      return <X className="size-3" aria-label={zh.incorrect} />;
  }
}

/**
 * Cell for unknown/unavailable data.
 */
function UnknownCell() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      <HelpCircle className="size-3" aria-label={zh.unknown} />
      <span>?</span>
    </div>
  );
}
