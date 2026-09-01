'use client';

/**
 * Player search autocomplete component.
 * Allows users to search and select a player to guess.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerSearch } from '@/features/game/hooks';
import type { PlayerSummary } from '@/features/game/types';
import { zh } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PlayerSearchProps {
  onSelect: (player: PlayerSummary) => void;
  disabled?: boolean;
  guessedPlayerIds?: Set<string>;
}

export function PlayerSearch({ onSelect, disabled, guessedPlayerIds = new Set() }: PlayerSearchProps) {
  const { query, setQuery, results, isLoading, error, clearResults } = usePlayerSearch();
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out already guessed players
  const availableResults = results.filter((p) => !guessedPlayerIds.has(p.id));

  // Derive isOpen from state - show dropdown when focused and there's something to show
  const shouldShowDropdown = isFocused && query.length >= 1;
  const hasContent = isLoading || error || availableResults.length > 0;
  const isOpen = shouldShowDropdown && hasContent;

  // Clamp selectedIndex to valid range
  const validSelectedIndex = availableResults.length > 0
    ? Math.min(selectedIndex, availableResults.length - 1)
    : 0;

  const handleSelect = useCallback(
    (player: PlayerSummary) => {
      onSelect(player);
      setQuery('');
      clearResults();
      setIsFocused(false);
      setSelectedIndex(0);
    },
    [onSelect, setQuery, clearResults]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || availableResults.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % availableResults.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + availableResults.length) % availableResults.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (availableResults[validSelectedIndex]) {
            handleSelect(availableResults[validSelectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, availableResults, validSelectedIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-md">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        placeholder={zh.searchPlaceholder}
        disabled={disabled}
        className="w-full"
        aria-label={zh.searchPlaceholder}
        aria-expanded={isOpen ? true : undefined}
        aria-autocomplete="list"
        role="combobox"
      />

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-x-hidden overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
          role="listbox"
        >
          {isLoading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && error && (
            <div className="p-3 text-center text-sm text-destructive">{error}</div>
          )}

          {!isLoading && !error && availableResults.length === 0 && query.length >= 1 && (
            <div className="p-3 text-center text-sm text-muted-foreground">{zh.noResults}</div>
          )}

          {!isLoading && !error && availableResults.map((player, index) => (
            <PlayerSearchItem
              key={player.id}
              player={player}
              isSelected={index === validSelectedIndex}
              onSelect={() => handleSelect(player)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PlayerSearchItemProps {
  player: PlayerSummary;
  isSelected: boolean;
  onSelect: () => void;
}

function PlayerSearchItem({ player, isSelected, onSelect }: PlayerSearchItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{player.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {player.club} · {player.nationality}
        </span>
      </div>
    </button>
  );
}
