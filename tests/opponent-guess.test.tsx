import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GuessWithComparison } from '@/features/game/types';
import { toOpponentGuess } from '@/features/multiplayer/opponent-guess';
import { OpponentGuessTable } from '@/features/multiplayer/OpponentGuessTable';

const guess: GuessWithComparison = {
  guessNumber: 2,
  createdAt: '2026-10-01T00:00:00Z',
  player: {
    id: 'secret-id',
    name: 'Secret Player',
    nationality: 'Spain',
    countryCode: 'ES',
    club: 'Secret Club',
    league: 'LA_LIGA',
    position: 'Forward',
    positionGroup: 'FORWARD',
    age: 25,
    heightCm: null,
    preferredFoot: null,
    imageUrl: null,
    clubLogoUrl: null,
  },
  comparison: {
    nationality: 'partial',
    club: 'incorrect',
    league: 'correct',
    position: 'partial',
    age: { result: 'incorrect', direction: 'higher' },
    height: null,
    preferredFoot: null,
  },
};
afterEach(cleanup);

it('exposes only the guess number and five result classifications', () => {
  expect(toOpponentGuess(guess)).toEqual({
    guessNumber: 2,
    results: {
      nationality: 'partial',
      club: 'incorrect',
      league: 'correct',
      position: 'partial',
      age: 'incorrect',
    },
  });
  expect(JSON.stringify(toOpponentGuess(guess))).not.toMatch(
    /secret|direction|higher|createdAt|height/i
  );
});

it('renders correct, partial and incorrect cells with accessible result labels', () => {
  render(<OpponentGuessTable guesses={[toOpponentGuess(guess)]} />);
  expect(screen.getByLabelText('国籍：相近')).toHaveClass('bg-yellow-500/20');
  expect(screen.getByLabelText('俱乐部：错误')).toHaveClass('bg-red-500/20');
  expect(screen.getByLabelText('联赛：正确')).toHaveClass('bg-green-500/20');
  expect(screen.getByLabelText('年龄：错误')).toHaveClass('bg-red-500/20');
  expect(screen.queryByText('Secret Player')).not.toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(6);
});

it('shows an empty state before the opponent guesses', () => {
  render(<OpponentGuessTable guesses={[]} />);
  expect(screen.getByText('朋友还没有猜测')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('keeps a row for every guess rather than only the latest result', () => {
  render(
    <OpponentGuessTable
      guesses={[toOpponentGuess({ ...guess, guessNumber: 1 }), toOpponentGuess(guess)]}
    />
  );
  expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['1', '2']);
  expect(screen.getByRole('status')).toHaveTextContent('朋友已猜 2 次');
});
