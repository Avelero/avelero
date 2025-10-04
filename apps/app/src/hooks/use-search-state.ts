"use client";

import * as React from "react";

/**
 * Search state interface
 */
export interface SearchState {
  query: string;
  debouncedQuery: string;
}

/**
 * Search actions interface
 */
export interface SearchActions {
  setQuery: (query: string) => void;
  clearQuery: () => void;
}

/**
 * Hook for managing search state with debouncing
 *
 * Provides search query state with automatic debouncing for performance.
 * The debounced query can be used for API calls while the immediate query
 * is used for the input field.
 *
 * @param initialQuery - Initial search query
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns [searchState, searchActions]
 */
export function useSearchState(
  initialQuery: string = "",
  debounceMs: number = 300,
): [SearchState, SearchActions] {
  const [query, setQuery] = React.useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);

  // Debounce the search query
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, debounceMs]);

  // Create actions object
  const actions: SearchActions = React.useMemo(
    () => ({
      setQuery: (newQuery: string) => {
        console.log("useSearchState: setQuery called with:", newQuery);
        setQuery(newQuery);
      },
      clearQuery: () => {
        console.log("useSearchState: clearQuery called");
        setQuery("");
      },
    }),
    [],
  );

  // Create state object
  const state: SearchState = React.useMemo(
    () => ({
      query,
      debouncedQuery,
    }),
    [query, debouncedQuery],
  );

  return [state, actions];
}

/**
 * Helper hook to check if search is active
 */
export function useSearchMetadata(searchState: SearchState) {
  const hasActiveSearch = React.useMemo(() => {
    return searchState.debouncedQuery.trim().length > 0;
  }, [searchState.debouncedQuery]);

  const isSearching = React.useMemo(() => {
    return searchState.query !== searchState.debouncedQuery;
  }, [searchState.query, searchState.debouncedQuery]);

  return {
    hasActiveSearch,
    isSearching,
  };
}