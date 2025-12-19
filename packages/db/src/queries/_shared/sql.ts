/**
 * Shared SQL helper functions for common query patterns.
 * 
 * Provides reusable SQL fragments and utilities for case-insensitive
 * comparisons, existence checks, and other common patterns.
 */

import { sql, type SQL } from "drizzle-orm";

/**
 * Creates a case-insensitive equality comparison.
 * 
 * @param column - Column to compare
 * @param value - Value to compare against
 * @returns SQL fragment for case-insensitive comparison
 */
export function ciEquals(column: SQL, value: string): SQL {
  return sql`LOWER(${column}) = LOWER(${value})`;
}

/**
 * Creates a case-insensitive LIKE comparison.
 * 
 * @param column - Column to search
 * @param pattern - Search pattern (should include % wildcards)
 * @returns SQL fragment for case-insensitive LIKE
 */
export function ciLike(column: SQL, pattern: string): SQL {
  return sql`${column} ILIKE ${pattern}`;
}

/**
 * Checks if a category name matches (case-insensitive) including parent categories.
 * Uses a recursive CTE to traverse up the category hierarchy.
 * 
 * @param categoryIdColumn - Column containing the category ID
 * @param categoriesTable - Categories table reference
 * @param searchTerm - Search term (will be wrapped with %)
 * @returns SQL EXISTS fragment
 */
export function existsCategoryNameSearch(
  categoryIdColumn: SQL,
  categoriesTable: SQL,
  searchTerm: string,
): SQL {
  const term = `%${searchTerm}%`;
  return sql`EXISTS (
    WITH RECURSIVE category_hierarchy AS (
      -- Base case: the product's direct category
      SELECT id, name, parent_id FROM ${categoriesTable}
      WHERE ${categoriesTable}.id = ${categoryIdColumn}
      
      UNION
      
      -- Recursive case: parent categories
      SELECT c.id, c.name, c.parent_id FROM ${categoriesTable} c
      INNER JOIN category_hierarchy ch ON c.id = ch.parent_id
    )
    SELECT 1 FROM category_hierarchy
    WHERE name ILIKE ${term}
  )`;
}





