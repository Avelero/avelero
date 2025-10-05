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
  executeSearch: () => void; // Manually trigger search
}

/**
 * Hook for managing search state with manual trigger
 *
 * Provides search query state that only executes when the user explicitly
 * triggers it (via Enter key or blur event). This prevents unnecessary API
 * calls while the user is still typing.
 *
 * @param initialQuery - Initial search query
 * @returns [searchState, searchActions]
 */
export function useSearchState(
  initialQuery = "",
  debounceMs?: number, // Kept for backward compatibility but unused
): [SearchState, SearchActions] {
  const [query, setQuery] = React.useState(initialQuery);
  const [executedQuery, setExecutedQuery] = React.useState(initialQuery);

  // Create actions object
  const actions: SearchActions = React.useMemo(
    () => ({
      setQuery: (newQuery: string) => {
        setQuery(newQuery);
      },
      clearQuery: () => {
        setQuery("");
        setExecutedQuery("");
      },
      executeSearch: () => {
        setExecutedQuery(query);
      },
    }),
    [query],
  );

  // Create state object - executedQuery is used as debouncedQuery for backward compatibility
  const state: SearchState = React.useMemo(
    () => ({
      query,
      debouncedQuery: executedQuery,
    }),
    [query, executedQuery],
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
