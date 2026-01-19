/**
 * Shared selection helpers for includeIds/excludeIds patterns.
 *
 * Used across products, carousel, and other query modules to normalize
 * ID inclusion/exclusion logic.
 */

import { type SQL, inArray, notInArray } from "drizzle-orm";

/**
 * Normalizes includeIds and excludeIds arrays, removing duplicates and
 * filtering out the current item if provided.
 *
 * @param includeIds - Array of IDs to include (if provided, only these are returned)
 * @param excludeIds - Array of IDs to exclude
 * @param currentId - Optional current item ID to always exclude
 * @returns Normalized arrays
 */
function normalizeSelection(
  includeIds: string[] = [],
  excludeIds: string[] = [],
  currentId?: string,
): {
  includeIds: string[];
  excludeIds: string[];
} {
  // Remove currentId from includes if present
  const filteredIncludes = currentId
    ? includeIds.filter((id) => id !== currentId)
    : includeIds;

  // Merge currentId into excludes if provided
  const allExcludes = currentId
    ? [...new Set([...excludeIds, currentId])]
    : [...new Set(excludeIds)];

  return {
    includeIds: filteredIncludes,
    excludeIds: allExcludes,
  };
}

/**
 * Safe wrapper for inArray that handles empty arrays.
 * Returns null if array is empty (allowing query to proceed without filter).
 *
 * @param column - Column to filter
 * @param values - Array of values (empty array returns null)
 */
function safeInArray(
  column: Parameters<typeof inArray>[0],
  values: string[],
): ReturnType<typeof inArray> | null {
  return values.length > 0 ? inArray(column, values) : null;
}

/**
 * Safe wrapper for notInArray that handles empty arrays.
 * Returns null if array is empty (allowing query to proceed without filter).
 *
 * @param column - Column to filter
 * @param values - Array of values (empty array returns null)
 */
export function safeNotInArray(
  column: Parameters<typeof notInArray>[0],
  values: string[],
): ReturnType<typeof notInArray> | null {
  return values.length > 0 ? notInArray(column, values) : null;
}
