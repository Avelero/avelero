/**
 * Filter Query Builder
 *
 * Converts FilterState to backend-compatible query format.
 *
 * NOTE: This is structured for future backend integration but NOT currently
 * connected to actual queries. The query format is designed but not executed.
 */

import type {
  FilterCondition,
  FilterGroup,
  FilterState,
  PassportFilterQuery,
  QueryCondition,
  QueryGroup,
} from "@/components/passports/filter-types";
import { getFieldConfig } from "@/config/filters";

/**
 * Build a complete filter query from FilterState
 *
 * @param filterState - Current filter state
 * @returns Query object ready for backend (not currently used)
 */
export function buildFilterQuery(
  filterState: FilterState,
): PassportFilterQuery {
  return {
    groups: filterState.groups.map(buildQueryGroup),
    groupOperator: "AND",
  };
}

/**
 * Build a query group (OR logic within group)
 */
function buildQueryGroup(group: FilterGroup): QueryGroup {
  return {
    operator: "OR",
    conditions: group.conditions
      .filter((condition) => isValidCondition(condition))
      .map(buildQueryCondition),
  };
}

/**
 * Check if a condition is valid and ready to be queried
 */
function isValidCondition(condition: FilterCondition): boolean {
  return !!(condition.fieldId && condition.operator && condition.value != null);
}

/**
 * Build a single query condition based on field type
 */
function buildQueryCondition(condition: FilterCondition): QueryCondition {
  const fieldConfig = getFieldConfig(condition.fieldId);

  if (!fieldConfig) {
    throw new Error(`Unknown field: ${condition.fieldId}`);
  }

  // Route to specialized builders based on input type
  switch (fieldConfig.inputType) {
    case "nested":
      return buildNestedCondition(condition, fieldConfig);
    case "hierarchical":
      return buildHierarchicalCondition(condition, fieldConfig);
    case "date":
    case "date-relative":
      return buildDateCondition(condition, fieldConfig);
    default:
      return buildSimpleCondition(condition, fieldConfig);
  }
}

/**
 * Build a simple query condition (text, number, select, multi-select)
 */
function buildSimpleCondition(
  condition: FilterCondition,
  fieldConfig: any,
): QueryCondition {
  return {
    field: condition.fieldId,
    operator: mapOperatorToBackend(condition.operator),
    value: condition.value,
  };
}

/**
 * Build a hierarchical query condition (categories with descendant support)
 */
function buildHierarchicalCondition(
  condition: FilterCondition,
  fieldConfig: any,
): QueryCondition {
  const operator = condition.operator;

  // Special handling for "is descendant of"
  if (operator === "is descendant of") {
    return {
      field: condition.fieldId,
      operator: "descendant_of",
      value: condition.value,
    };
  }

  if (operator === "is ancestor of") {
    return {
      field: condition.fieldId,
      operator: "ancestor_of",
      value: condition.value,
    };
  }

  return buildSimpleCondition(condition, fieldConfig);
}

/**
 * Build a date query condition (with relative date support)
 */
function buildDateCondition(
  condition: FilterCondition,
  fieldConfig: any,
): QueryCondition {
  const value = condition.value as any;

  // Handle relative dates
  if (value?.type === "relative") {
    return {
      field: condition.fieldId,
      operator: "relative",
      value: {
        option: value.option,
        customDays: value.customDays,
      },
    };
  }

  // Handle date ranges
  if (condition.operator === "is between" && value?.start && value?.end) {
    return {
      field: condition.fieldId,
      operator: "between",
      value: {
        start: value.start,
        end: value.end,
      },
    };
  }

  // Handle single date
  return {
    field: condition.fieldId,
    operator: mapOperatorToBackend(condition.operator),
    value: value?.date ?? value,
  };
}

/**
 * Build a nested query condition (Materials, Facilities)
 *
 * Example: "Products with Cotton where percentage > 80%"
 */
function buildNestedCondition(
  condition: FilterCondition,
  fieldConfig: any,
): QueryCondition {
  const value = condition.value as any;

  if (!value?.primarySelection) {
    return buildSimpleCondition(condition, fieldConfig);
  }

  const baseCondition: QueryCondition = {
    field: condition.fieldId,
    operator: mapOperatorToBackend(condition.operator),
    value: value.primarySelection,
  };

  // Add nested WHERE conditions if present
  if (value.whereConditions && value.whereConditions.length > 0) {
    baseCondition.nested = value.whereConditions
      .filter(isValidCondition)
      .map((nestedCondition: FilterCondition) => {
        const nestedFieldConfig = getFieldConfig(nestedCondition.fieldId);
        if (!nestedFieldConfig) {
          throw new Error(`Unknown nested field: ${nestedCondition.fieldId}`);
        }
        return buildSimpleCondition(nestedCondition, nestedFieldConfig);
      });
  }

  return baseCondition;
}

/**
 * Map frontend operators to backend format
 *
 * This ensures consistent operator naming between UI and API
 */
function mapOperatorToBackend(operator: string): string {
  const operatorMap: Record<string, string> = {
    // Text operators
    contains: "contains",
    "does not contain": "not_contains",
    is: "equals",
    "is not": "not_equals",
    "starts with": "starts_with",
    "ends with": "ends_with",
    "is empty": "is_null",
    "is not empty": "is_not_null",

    // Number operators
    "=": "equals",
    "≠": "not_equals",
    ">": "greater_than",
    "≥": "greater_than_or_equal",
    "<": "less_than",
    "≤": "less_than_or_equal",
    between: "between",

    // Multi-select operators
    "is any of": "in",
    "is none of": "not_in",

    // Relational operators
    "contains any of": "contains_any",
    "contains all of": "contains_all",

    // Boolean operators
    "is true": "is_true",
    "is false": "is_false",

    // Module completion operators
    "is complete": "is_complete",
    "is not complete": "is_not_complete",

    // Date operators
    "is before": "before",
    "is after": "after",
    "is on or before": "on_or_before",
    "is on or after": "on_or_after",
    "is between": "between",
    relative: "relative",
  };

  return operatorMap[operator] ?? operator;
}

/**
 * Check if filter state has any active filters
 */
export function hasActiveFilters(filterState: FilterState): boolean {
  return filterState.groups.some((group) =>
    group.conditions.some(isValidCondition),
  );
}

/**
 * Count active filter conditions
 */
export function countActiveFilters(filterState: FilterState): number {
  return filterState.groups.reduce(
    (total, group) => total + group.conditions.filter(isValidCondition).length,
    0,
  );
}

/**
 * Serialize filter state for URL or storage
 *
 * @param filterState - Current filter state
 * @returns Base64 encoded JSON string
 */
export function serializeFilterState(filterState: FilterState): string {
  const json = JSON.stringify(filterState);
  if (typeof window !== "undefined") {
    return btoa(json);
  }
  return Buffer.from(json).toString("base64");
}

/**
 * Deserialize filter state from URL or storage
 *
 * @param serialized - Base64 encoded filter state
 * @returns Deserialized FilterState
 */
export function deserializeFilterState(serialized: string): FilterState {
  try {
    const json =
      typeof window !== "undefined"
        ? atob(serialized)
        : Buffer.from(serialized, "base64").toString();
    return JSON.parse(json) as FilterState;
  } catch {
    return { groups: [] };
  }
}

/**
 * Generate a human-readable summary of active filters
 *
 * Useful for displaying "Filtered by: Status = Published, Color = Red"
 */
export function getFilterSummary(filterState: FilterState): string[] {
  const summaries: string[] = [];

  for (const group of filterState.groups) {
    const validConditions = group.conditions.filter(isValidCondition);

    for (const condition of validConditions) {
      const fieldConfig = getFieldConfig(condition.fieldId);
      if (!fieldConfig) continue;

      const fieldLabel = fieldConfig.label;
      const operator = condition.operator;
      const value = formatValueForDisplay(condition.value, fieldConfig);

      summaries.push(`${fieldLabel} ${operator} ${value}`);
    }
  }

  return summaries;
}

/**
 * Format filter value for human-readable display
 */
function formatValueForDisplay(value: any, fieldConfig: any): string {
  if (value == null) return "";

  // Array values (multi-select)
  if (Array.isArray(value)) {
    const options = fieldConfig.options ?? [];
    const labels = value
      .map((v) => options.find((o: any) => o.value === v)?.label ?? v)
      .join(", ");
    return labels || value.join(", ");
  }

  // Date values
  if (value?.date) {
    return new Date(value.date).toLocaleDateString();
  }

  // Relative date values
  if (value?.type === "relative") {
    return value.option;
  }

  // Range values
  if (value?.min != null && value?.max != null) {
    return `${value.min} - ${value.max}`;
  }

  // Nested values
  if (value?.primarySelection) {
    return formatValueForDisplay(value.primarySelection, fieldConfig);
  }

  // Single select
  if (fieldConfig.options) {
    const option = fieldConfig.options.find((o: any) => o.value === value);
    return option?.label ?? String(value);
  }

  return String(value);
}
