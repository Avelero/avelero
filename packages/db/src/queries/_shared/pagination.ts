/**
 * Shared pagination helpers for cursor-based pagination.
 * 
 * Used across list queries to parse cursors, calculate offsets,
 * and build pagination metadata.
 */

/**
 * Parses a cursor string into an offset number.
 * 
 * @param cursor - Cursor string (typically an offset number as string)
 * @returns Offset number (defaults to 0 if invalid)
 */
export function parseCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

/**
 * Calculates pagination metadata from query results.
 * 
 * @param offset - Current offset
 * @param limit - Page limit
 * @param rowsReturned - Number of rows returned in this page
 * @param total - Total number of rows matching the query
 * @returns Pagination metadata
 */
export function buildPaginationMeta(
  offset: number,
  limit: number,
  rowsReturned: number,
  total: number,
): {
  total: number;
  cursor: string | null;
  hasMore: boolean;
} {
  const nextOffset = offset + rowsReturned;
  const hasMore = total > nextOffset;
  return {
    total,
    cursor: hasMore ? String(nextOffset) : null,
    hasMore,
  };
}

/**
 * Normalizes a limit value to be within acceptable bounds.
 * 
 * @param limit - Requested limit
 * @param min - Minimum allowed limit (default: 1)
 * @param max - Maximum allowed limit (default: 100)
 * @returns Normalized limit
 */
export function normalizeLimit(
  limit?: number | null,
  min = 1,
  max = 100,
): number {
  if (!limit || !Number.isFinite(limit)) return min;
  return Math.min(Math.max(limit, min), max);
}









