/**
 * Shared search logic for product queries.
 * 
 * Provides reusable search WHERE clause builders that search across
 * product fields, category names, season names, and tags.
 */

import { ilike, or, sql } from "drizzle-orm";
import {
  products,
  brandSeasons,
  taxonomyCategories,
  productTags,
  brandTags,
} from "../../../schema";
import type { ListFilters } from "../types.js";

/**
 * Builds search WHERE clauses for product queries.
 * 
 * Searches across:
 * - Product name
 * - Product handle
 * - Status
 * - Season name (via EXISTS subquery)
 * - Category name (via recursive CTE EXISTS subquery)
 * - Tag names (via EXISTS subquery)
 * 
 * @param filters - Filter options containing search term
 * @returns SQL WHERE clause or null if no search term
 */
export function buildProductSearchClause(
  filters: ListFilters,
): ReturnType<typeof or> | null {
  if (!filters.search) return null;

  const term = `%${filters.search}%`;
  const searchConditions = [
    ilike(products.name, term),
    ilike(products.productHandle, term),
    ilike(products.status, term),
  ];

  return or(
    ...searchConditions,
    // Season name search via EXISTS
    sql`EXISTS (
      SELECT 1 FROM ${brandSeasons}
      WHERE ${brandSeasons.id} = ${products.seasonId}
      AND ${brandSeasons.name} ILIKE ${term}
    )`,
    // Category name search via EXISTS (including parent categories)
    sql`EXISTS (
      WITH RECURSIVE category_hierarchy AS (
        -- Base case: the product's direct category
        SELECT id, name, parent_id FROM ${taxonomyCategories}
        WHERE ${taxonomyCategories.id} = ${products.categoryId}
        
        UNION
        
        -- Recursive case: parent categories
        SELECT c.id, c.name, c.parent_id FROM ${taxonomyCategories} c
        INNER JOIN category_hierarchy ch ON c.id = ch.parent_id
      )
      SELECT 1 FROM category_hierarchy
      WHERE name ILIKE ${term}
    )`,
    // Tag search via EXISTS
    sql`EXISTS (
      SELECT 1 FROM ${productTags}
      INNER JOIN ${brandTags} ON ${brandTags.id} = ${productTags.tagId}
      WHERE ${productTags.productId} = ${products.id}
      AND ${brandTags.name} ILIKE ${term}
    )`,
  )!;
}








