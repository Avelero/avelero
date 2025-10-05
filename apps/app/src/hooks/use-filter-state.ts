"use client";

import type {
  FilterActions,
  FilterCondition,
  FilterGroup,
  FilterState,
} from "@/components/passports/filter-types";
import * as React from "react";

/**
 * Hook for managing filter state with smart debouncing
 *
 * Provides dual state (immediate + debounced) and actions for the passport filtering system.
 * - Immediate state: Updates instantly for UI responsiveness
 * - Debounced state: Updates after delay for API calls, but only when filter menu is closed
 * Supports AND logic between groups, OR logic within groups.
 *
 * @param debounceMs - Milliseconds to wait before updating debounced state (default: 2000ms)
 * @param isFilterMenuOpen - Whether any filter menu is currently open (pauses debouncing)
 * @returns [immediateState, debouncedState, filterActions]
 */
export function useFilterState(
  debounceMs = 2000,
  isFilterMenuOpen = false,
): [FilterState, FilterState, FilterActions] {
  const [immediateState, setImmediateState] = React.useState<FilterState>({
    groups: [],
  });

  const [debouncedState, setDebouncedState] = React.useState<FilterState>({
    groups: [],
  });

  // Track if we have pending changes
  const [hasPendingChanges, setHasPendingChanges] = React.useState(false);

  // Mark as having pending changes whenever immediate state changes
  React.useEffect(() => {
    setHasPendingChanges(true);
  }, [immediateState]);

  // Smart debouncing: Only update debounced state when filter menu is closed AND we have pending changes
  React.useEffect(() => {
    // If menu is open, don't start the timer
    if (isFilterMenuOpen) {
      return;
    }

    // If no pending changes, nothing to do
    if (!hasPendingChanges) {
      return;
    }

    // Menu is closed and we have pending changes - start debounce timer
    const timer = setTimeout(() => {
      setDebouncedState(immediateState);
      setHasPendingChanges(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [immediateState, debounceMs, isFilterMenuOpen, hasPendingChanges]);

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  /**
   * Generate a unique ID for new groups/conditions
   */
  const generateId = React.useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Create a new empty filter condition
   */
  const createEmptyCondition = React.useCallback((): FilterCondition => {
    return {
      id: generateId(),
      fieldId: "",
      operator: "is" as any,
      value: null,
    };
  }, [generateId]);

  /**
   * Create a new filter group with one empty condition
   */
  const createEmptyGroup = React.useCallback((): FilterGroup => {
    return {
      id: generateId(),
      conditions: [createEmptyCondition()],
    };
  }, [generateId, createEmptyCondition]);

  // ==========================================================================
  // Group Actions
  // ==========================================================================

  /**
   * Add a new filter group
   */
  const addGroup = React.useCallback(() => {
    setImmediateState((prev) => ({
      ...prev,
      groups: [...prev.groups, createEmptyGroup()],
    }));
  }, [createEmptyGroup]);

  /**
   * Remove a filter group by ID
   */
  const removeGroup = React.useCallback((groupId: string) => {
    setImmediateState((prev) => ({
      ...prev,
      groups: prev.groups.filter((group) => group.id !== groupId),
    }));
  }, []);

  /**
   * Set groups directly (useful for quick filters)
   */
  const setGroups = React.useCallback((groups: FilterGroup[]) => {
    setImmediateState({ groups });
  }, []);

  // ==========================================================================
  // Condition Actions
  // ==========================================================================

  /**
   * Add a new condition to a specific group
   */
  const addCondition = React.useCallback(
    (groupId: string, initial?: Partial<FilterCondition>) => {
      setImmediateState((prev) => ({
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                conditions: [
                  ...group.conditions,
                  { ...createEmptyCondition(), ...(initial ?? {}) },
                ],
              }
            : group,
        ),
      }));
    },
    [createEmptyCondition],
  );

  /**
   * Update a condition within a group
   */
  const updateCondition = React.useCallback(
    (
      groupId: string,
      conditionId: string,
      updates: Partial<FilterCondition>,
    ) => {
      setImmediateState((prev) => ({
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                conditions: group.conditions.map((condition) =>
                  condition.id === conditionId
                    ? { ...condition, ...updates }
                    : condition,
                ),
              }
            : group,
        ),
      }));
    },
    [],
  );

  /**
   * Remove a condition from a group
   * If it's the last condition, remove the entire group
   */
  const removeCondition = React.useCallback(
    (groupId: string, conditionId: string) => {
      setImmediateState((prev) => {
        const updatedGroups = prev.groups
          .map((group) => {
            if (group.id !== groupId) return group;

            const updatedConditions = group.conditions.filter(
              (condition) => condition.id !== conditionId,
            );

            // If no conditions left, mark group for removal
            if (updatedConditions.length === 0) return null;

            return {
              ...group,
              conditions: updatedConditions,
            };
          })
          .filter((group): group is FilterGroup => group !== null);

        return { groups: updatedGroups };
      });
    },
    [],
  );

  // ==========================================================================
  // Bulk Actions
  // ==========================================================================

  /**
   * Clear all filters
   */
  const clearAll = React.useCallback(() => {
    setImmediateState({ groups: [] });
  }, []);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = React.useMemo(() => {
    return immediateState.groups.some((group) =>
      group.conditions.some(
        (condition) => condition.fieldId && condition.value != null,
      ),
    );
  }, [immediateState.groups]);

  /**
   * Get total number of active filter conditions
   */
  const activeFilterCount = React.useMemo(() => {
    return immediateState.groups.reduce((total, group) => {
      return (
        total +
        group.conditions.filter(
          (condition) => condition.fieldId && condition.value != null,
        ).length
      );
    }, 0);
  }, [immediateState.groups]);

  // ==========================================================================
  // Actions Object
  // ==========================================================================

  const actions: FilterActions = React.useMemo(
    () => ({
      addGroup,
      removeGroup,
      addCondition,
      updateCondition,
      removeCondition,
      clearAll,
      setGroups,
    }),
    [
      addGroup,
      removeGroup,
      addCondition,
      updateCondition,
      removeCondition,
      clearAll,
      setGroups,
    ],
  );

  // ==========================================================================
  // Debug Logging (Development Only)
  // ==========================================================================

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[useFilterState] State updated:", {
        groupCount: immediateState.groups.length,
        hasActiveFilters,
        activeFilterCount,
        immediateState,
        debouncedState,
      });
    }
  }, [immediateState, debouncedState, hasActiveFilters, activeFilterCount]);

  return [immediateState, debouncedState, actions];
}

/**
 * Helper hook to derive filter state metadata
 */
export function useFilterMetadata(state: FilterState) {
  const hasActiveFilters = React.useMemo(() => {
    return state.groups.some((group) =>
      group.conditions.some(
        (condition) => condition.fieldId && condition.value != null,
      ),
    );
  }, [state.groups]);

  const activeFilterCount = React.useMemo(() => {
    return state.groups.reduce((total, group) => {
      return (
        total +
        group.conditions.filter(
          (condition) => condition.fieldId && condition.value != null,
        ).length
      );
    }, 0);
  }, [state.groups]);

  const isEmpty = state.groups.length === 0;

  const hasIncompleteFilters = React.useMemo(() => {
    return state.groups.some((group) =>
      group.conditions.some(
        (condition) => !condition.fieldId || condition.value == null,
      ),
    );
  }, [state.groups]);

  return {
    hasActiveFilters,
    activeFilterCount,
    isEmpty,
    hasIncompleteFilters,
  };
}
