/**
 * Filter Converter Utilities
 *
 * Functions for converting between quick filter format (Record<string, string[]>)
 * and FilterState format, and for identifying filter types.
 */

import { getQuickFilterFields } from "@/config/filters";
import type {
  FilterCondition,
  FilterGroup,
  FilterState,
} from "@/components/passports/filter-types";

/**
 * Get all quick filter field IDs (Tier 1 fields)
 */
export function getQuickFilterFieldIds(): string[] {
  return getQuickFilterFields().map((field) => field.id);
}

/**
 * Check if a filter group is a quick filter group
 * Quick filter groups have:
 * - Single condition with fieldId matching a quick filter field
 * - Operator is "is any of"
 * - Value is an array of strings
 */
export function isQuickFilterGroup(group: FilterGroup): boolean {
  if (group.conditions.length !== 1) return false;

  const condition = group.conditions[0]!;
  const quickFilterFieldIds = getQuickFilterFieldIds();

  return (
    quickFilterFieldIds.includes(condition.fieldId) &&
    condition.operator === "is any of" &&
    Array.isArray(condition.value)
  );
}

/**
 * Check if FilterState contains quick filter groups
 */
export function hasQuickFilters(filterState: FilterState): boolean {
  return filterState.groups.some((group) => isQuickFilterGroup(group));
}

/**
 * Check if FilterState contains advanced filter groups
 * (groups that are NOT quick filter groups)
 */
export function hasAdvancedFilters(filterState: FilterState): boolean {
  return filterState.groups.some((group) => !isQuickFilterGroup(group));
}

/**
 * Extract quick filter selections from FilterState
 * Returns Record<fieldId, string[]> format
 */
export function extractQuickFiltersFromFilterState(
  filterState: FilterState,
): Record<string, string[]> {
  const quickFilters: Record<string, string[]> = {};

  for (const group of filterState.groups) {
    if (isQuickFilterGroup(group)) {
      const condition = group.conditions[0]!;
      if (
        Array.isArray(condition.value) &&
        condition.value.length > 0
      ) {
        quickFilters[condition.fieldId] = condition.value as string[];
      }
    }
  }

  return quickFilters;
}

/**
 * Convert quick filter selections to FilterState format
 * Each quick filter field becomes its own AND group with "is any of" operator
 */
export function convertQuickFiltersToFilterState(
  quickFilters: Record<string, string[]>,
): FilterState {
  const groups: FilterGroup[] = [];

  for (const [fieldId, values] of Object.entries(quickFilters)) {
    if (values.length === 0) continue;

    // Create a group with one condition using "is any of" operator
    const condition: FilterCondition = {
      id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fieldId,
      operator: "is any of",
      value: values, // Array of selected values
    };

    groups.push({
      id: `group-${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conditions: [condition],
      asGroup: false,
    });
  }

  return { groups };
}

/**
 * Get only advanced filter groups from FilterState
 * (excludes quick filter groups)
 */
export function getAdvancedFilterGroups(
  filterState: FilterState,
): FilterGroup[] {
  return filterState.groups.filter((group) => !isQuickFilterGroup(group));
}

