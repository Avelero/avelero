"use client";

import type {
  FilterActions,
  FilterCondition,
  FilterGroup,
  FilterState,
} from "@/components/passports/filter-types";
import * as React from "react";

/**
 * Hook for managing filter state
 *
 * Provides state and actions for the passport filtering system.
 * Supports AND logic between groups, OR logic within groups.
 *
 * @returns [filterState, filterActions]
 */
export function useFilterState(): [FilterState, FilterActions] {
  const [state, setState] = React.useState<FilterState>({
    groups: [],
  });

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
      asGroup: false,
    };
  }, [generateId, createEmptyCondition]);

  // ==========================================================================
  // Group Actions
  // ==========================================================================

  /**
   * Add a new filter group
   */
  const addGroup = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      groups: [...prev.groups, createEmptyGroup()],
    }));
  }, [createEmptyGroup]);

  /**
   * Remove a filter group by ID
   */
  const removeGroup = React.useCallback((groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((group) => group.id !== groupId),
    }));
  }, []);

  /**
   * Update a group's properties
   */
  const updateGroup = React.useCallback(
    (groupId: string, updates: Partial<FilterGroup>) => {
      setState((prev) => ({
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === groupId ? { ...group, ...updates } : group,
        ),
      }));
    },
    [],
  );

  /**
   * Set groups directly (useful for quick filters)
   */
  const setGroups = React.useCallback((groups: FilterGroup[]) => {
    setState({ groups });
  }, []);

  // ==========================================================================
  // Condition Actions
  // ==========================================================================

  /**
   * Add a new condition to a specific group
   */
  const addCondition = React.useCallback(
    (groupId: string, initial?: Partial<FilterCondition>) => {
      setState((prev) => ({
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
      setState((prev) => ({
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
      setState((prev) => {
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
    setState({ groups: [] });
  }, []);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = React.useMemo(() => {
    return state.groups.some((group) =>
      group.conditions.some(
        (condition) => condition.fieldId && condition.value != null,
      ),
    );
  }, [state.groups]);

  /**
   * Get total number of active filter conditions
   */
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

  // ==========================================================================
  // Actions Object
  // ==========================================================================

  const actions: FilterActions = React.useMemo(
    () => ({
      addGroup,
      removeGroup,
      updateGroup,
      addCondition,
      updateCondition,
      removeCondition,
      clearAll,
      setGroups,
    }),
    [
      addGroup,
      removeGroup,
      updateGroup,
      addCondition,
      updateCondition,
      removeCondition,
      clearAll,
      setGroups,
    ],
  );

  return [state, actions];
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
