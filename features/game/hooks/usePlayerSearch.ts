'use client';

/**
 * Hook for searching players with debouncing.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PlayerSummary } from '@/features/game/types';
import { searchPlayers, ApiError } from '@/features/game/api/client';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;

interface UsePlayerSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: PlayerSummary[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

export function usePlayerSearch(): UsePlayerSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  // Derive isLoading from query length and search state
  const trimmedQuery = query.trim();
  const isQueryValid = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const isLoading = isQueryValid && isSearching;

  // Clear results when query becomes too short
  const prevQueryValidRef = useRef(isQueryValid);
  useEffect(() => {
    if (prevQueryValidRef.current && !isQueryValid) {
      // Query became too short, clear results synchronously via callback
      setResults([]);
      setError(null);
    }
    prevQueryValidRef.current = isQueryValid;
  }, [isQueryValid]);

  // Perform debounced search
  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Skip if query is too short
    if (!isQueryValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: resetting state when effect condition is not met
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      searchPlayers(trimmedQuery)
        .then((response) => {
          setResults(response.players);
          setIsSearching(false);
        })
        .catch((err) => {
          const message = err instanceof ApiError ? err.message : 'Search failed';
          setError(message);
          setResults([]);
          setIsSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [trimmedQuery, isQueryValid]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults,
  };
}
