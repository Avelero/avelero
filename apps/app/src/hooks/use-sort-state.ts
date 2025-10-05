"use client";

import * as React from "react";

/**
 * Sort direction type
 */
export type SortDirection = "asc" | "desc";

/**
 * Available sort fields for passports
 */
export type PassportSortField =
  | "createdAt"
  | "updatedAt"
  | "name"
  | "passportStatus";

/**
 * Sort state interface
 */
export interface SortState {
  field: PassportSortField;
  direction: SortDirection;
}

/**
 * Sort actions interface
 */
export interface SortActions {
  setSort: (field: PassportSortField, direction: SortDirection) => void;
  setSortField: (field: PassportSortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  toggleDirection: () => void;
  resetSort: () => void;
}

/**
 * Sort option for display in UI
 */
export interface SortOption {
  id: string;
  label: string;
  field: PassportSortField;
  direction: SortDirection;
  icon?: string;
}

/**
 * Available sort options for the UI
 */
export const SORT_OPTIONS: SortOption[] = [
  {
    id: "name-asc",
    label: "Name (A-Z)",
    field: "name",
    direction: "asc",
    icon: "ArrowUp",
  },
  {
    id: "name-desc",
    label: "Name (Z-A)",
    field: "name",
    direction: "desc",
    icon: "ChevronDown",
  },
  {
    id: "created-desc",
    label: "Newest first",
    field: "createdAt",
    direction: "desc",
    icon: "Calendar",
  },
  {
    id: "created-asc",
    label: "Oldest first",
    field: "createdAt",
    direction: "asc",
    icon: "Calendar",
  },
  {
    id: "updated-desc",
    label: "Recently updated",
    field: "updatedAt",
    direction: "desc",
    icon: "Edit",
  },
];

/**
 * Hook for managing sort state
 *
 * Provides sort state management for passport table with predefined
 * sort options and easy state manipulation.
 *
 * @param initialField - Initial sort field (default: "createdAt")
 * @param initialDirection - Initial sort direction (default: "desc")
 * @returns [sortState, sortActions]
 */
export function useSortState(
  initialField: PassportSortField = "createdAt",
  initialDirection: SortDirection = "desc",
): [SortState, SortActions] {
  const [field, setField] = React.useState<PassportSortField>(initialField);
  const [direction, setDirection] =
    React.useState<SortDirection>(initialDirection);

  // Create actions object
  const actions: SortActions = React.useMemo(
    () => ({
      setSort: (newField: PassportSortField, newDirection: SortDirection) => {
        setField(newField);
        setDirection(newDirection);
      },
      setSortField: (newField: PassportSortField) => {
        setField(newField);
      },
      setSortDirection: (newDirection: SortDirection) => {
        setDirection(newDirection);
      },
      toggleDirection: () => {
        setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      },
      resetSort: () => {
        setField(initialField);
        setDirection(initialDirection);
      },
    }),
    [initialField, initialDirection],
  );

  // Create state object
  const state: SortState = React.useMemo(
    () => ({
      field,
      direction,
    }),
    [field, direction],
  );

  return [state, actions];
}

/**
 * Helper hook to get sort metadata and utilities
 */
export function useSortMetadata(sortState: SortState) {
  // Find the current sort option that matches the state
  const currentSortOption = React.useMemo(() => {
    return SORT_OPTIONS.find(
      (option) =>
        option.field === sortState.field &&
        option.direction === sortState.direction,
    );
  }, [sortState.field, sortState.direction]);

  // Check if using default sort
  const isDefaultSort = React.useMemo(() => {
    return sortState.field === "createdAt" && sortState.direction === "desc";
  }, [sortState.field, sortState.direction]);

  // Get display label for current sort
  const sortLabel = React.useMemo(() => {
    return (
      currentSortOption?.label || `${sortState.field} (${sortState.direction})`
    );
  }, [currentSortOption, sortState.field, sortState.direction]);

  return {
    currentSortOption,
    isDefaultSort,
    sortLabel,
    availableOptions: SORT_OPTIONS,
  };
}
