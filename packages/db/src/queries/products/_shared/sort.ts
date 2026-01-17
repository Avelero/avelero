/**
 * Shared sorting logic for product queries.
 *
 * Provides reusable ORDER BY clause builders with special handling
 * for category and season sorting (NULLS LAST).
 */

import { asc, desc, sql } from "drizzle-orm";
import { products, taxonomyCategories, brandSeasons } from "../../../schema";

/**
 * Sort field configuration map.
 */
const SORT_FIELD_MAP: Record<string, any> = {
  name: products.name,
  status: products.status,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  category: taxonomyCategories.name, // Requires join
  season: null, // Special handling required
  productHandle: products.productHandle,
} as const;

/**
 * Builds ORDER BY clause for product queries.
 *
 * Special handling for:
 * - Season sorting: Uses end date with ongoing seasons treated as most recent
 * - Category sorting: NULLS LAST
 * - Default: Uses sort field map with product ID as tie-breaker
 *
 * @param sortField - Field name to sort by
 * @param sortDirection - Sort direction ("asc" | "desc")
 * @returns ORDER BY clause(s)
 */
export function buildProductOrderBy(
  sortField?: string,
  sortDirection: "asc" | "desc" = "desc",
):
  | ReturnType<typeof asc>
  | ReturnType<typeof desc>
  | ReturnType<typeof sql>
  | Array<
      ReturnType<typeof asc> | ReturnType<typeof desc> | ReturnType<typeof sql>
    > {
  if (sortField === "season") {
    if (sortDirection === "asc") {
      return [
        sql`CASE 
          WHEN ${products.seasonId} IS NULL THEN NULL
          WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
          WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
          ELSE ${brandSeasons.endDate} 
        END ASC NULLS LAST`,
        sql`${brandSeasons.name} ASC NULLS LAST`,
        asc(products.id), // Stable tie-breaker
      ];
    }
    return [
      sql`CASE 
        WHEN ${products.seasonId} IS NULL THEN NULL
        WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
        WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
        ELSE ${brandSeasons.endDate} 
      END DESC NULLS LAST`,
      sql`${brandSeasons.name} ASC NULLS LAST`,
      desc(products.id), // Stable tie-breaker
    ];
  }

  if (sortField === "category") {
    const categorySortField = taxonomyCategories.name;
    if (sortDirection === "asc") {
      return [sql`${categorySortField} ASC NULLS LAST`, asc(products.id)];
    }
    return [sql`${categorySortField} DESC NULLS LAST`, desc(products.id)];
  }

  const field = sortField
    ? SORT_FIELD_MAP[sortField] ?? products.createdAt
    : products.createdAt;

  return sortDirection === "asc"
    ? [asc(field), asc(products.id)]
    : [desc(field), desc(products.id)];
}
