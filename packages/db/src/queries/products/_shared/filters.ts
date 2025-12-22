/**
 * Shared filter logic for product queries.
 * 
 * Provides reusable filter WHERE clause builders.
 */

import { eq, and, type SQL } from "drizzle-orm";
import type { Database } from "../../../client";
import { products } from "../../../schema";
import { convertFilterStateToWhereClauses } from "../../../utils/filter-converter.js";
import type { ListFilters } from "../types.js";
import { buildProductSearchClause } from "./search.js";
import { safeNotInArray } from "../../_shared/selection.js";

/**
 * Builds base WHERE clauses for product queries.
 * 
 * Includes:
 * - Brand ID scoping
 * - FilterState conversion
 * - Search term handling
 * - Optional excludeIds
 * 
 * @param db - Database instance
 * @param brandId - Brand identifier for scoping
 * @param filters - Filter options
 * @param excludeIds - Optional array of IDs to exclude
 * @returns Array of WHERE clauses
 */
export function buildProductWhereClauses(
  db: Database,
  brandId: string,
  filters: ListFilters = {},
  excludeIds: string[] = [],
): SQL[] {
  const whereClauses: SQL[] = [eq(products.brandId, brandId)];

  // Convert FilterState to SQL WHERE clauses
  if (filters.filterState) {
    const filterClauses = convertFilterStateToWhereClauses(
      filters.filterState,
      db,
      brandId,
    );
    whereClauses.push(...filterClauses);
  }

  // Add search clause
  const searchClause = buildProductSearchClause(filters);
  if (searchClause) {
    whereClauses.push(searchClause);
  }

  // Add excludeIds clause
  const excludeClause = safeNotInArray(products.id, excludeIds);
  if (excludeClause) {
    whereClauses.push(excludeClause);
  }

  return whereClauses;
}









