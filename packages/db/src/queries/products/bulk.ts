/**
 * Bulk product operations.
 * 
 * Provides functions for bulk updates and deletes on products,
 * either by filter criteria or explicit IDs.
 */

import { and, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { products } from "../../schema";
import { buildProductWhereClauses } from "./_shared/where.js";
import type {
  BulkDeleteResult,
  BulkUpdateFields,
  BulkUpdateResult,
  ListFilters,
} from "./types.js";

/**
 * Bulk delete products matching filters.
 *
 * Deletes all products matching the given filters and search term,
 * optionally excluding specific IDs. This is efficient because it
 * performs the delete directly without fetching all IDs first.
 */
export async function bulkDeleteProductsByFilter(
  db: Database,
  brandId: string,
  options: {
    filterState?: ListFilters["filterState"];
    search?: string;
    excludeIds?: string[];
  } = {},
): Promise<BulkDeleteResult> {
  const filters: ListFilters = {
    search: options.search,
    filterState: options.filterState,
  };
  const whereClauses = buildProductWhereClauses(
    db,
    brandId,
    filters,
    options.excludeIds ?? [],
  );

  // Delete and return the image paths for cleanup
  const deleted = await db
    .delete(products)
    .where(and(...whereClauses))
    .returning({
      id: products.id,
      primaryImagePath: products.primaryImagePath,
    });

  return {
    deleted: deleted.length,
    imagePaths: deleted
      .map((row) => row.primaryImagePath)
      .filter((path): path is string => path !== null),
  };
}

/**
 * Get count of products matching filters.
 *
 * Used to show the user how many products will be affected by a bulk operation
 * before they confirm.
 */
export async function countProductsByFilter(
  db: Database,
  brandId: string,
  options: {
    filterState?: ListFilters["filterState"];
    search?: string;
    excludeIds?: string[];
  } = {},
): Promise<number> {
  const filters: ListFilters = {
    search: options.search,
    filterState: options.filterState,
  };
  const whereClauses = buildProductWhereClauses(
    db,
    brandId,
    filters,
    options.excludeIds ?? [],
  );

  const [result] = await db
    .select({ value: count(products.id) })
    .from(products)
    .where(and(...whereClauses));

  return result?.value ?? 0;
}

/**
 * Bulk update products matching filters.
 *
 * Updates all products matching the given filters and search term,
 * optionally excluding specific IDs. This is efficient because it
 * performs the update directly without fetching all IDs first.
 */
export async function bulkUpdateProductsByFilter(
  db: Database,
  brandId: string,
  updates: BulkUpdateFields,
  options: {
    filterState?: ListFilters["filterState"];
    search?: string;
    excludeIds?: string[];
  } = {},
): Promise<BulkUpdateResult> {
  const filters: ListFilters = {
    search: options.search,
    filterState: options.filterState,
  };
  const whereClauses = buildProductWhereClauses(
    db,
    brandId,
    filters,
    options.excludeIds ?? [],
  );

  // Build update data - only include fields that are explicitly provided
  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.seasonId !== undefined) updateData.seasonId = updates.seasonId;

  // If no fields to update, return early
  if (Object.keys(updateData).length === 0) {
    return { updated: 0 };
  }

  const updated = await db
    .update(products)
    .set(updateData)
    .where(and(...whereClauses))
    .returning({ id: products.id });

  return {
    updated: updated.length,
  };
}

/**
 * Bulk update products by explicit IDs.
 *
 * Updates specific products by their IDs. More efficient than
 * individual updates when modifying multiple products.
 */
export async function bulkUpdateProductsByIds(
  db: Database,
  brandId: string,
  ids: string[],
  updates: BulkUpdateFields,
): Promise<BulkUpdateResult> {
  if (ids.length === 0) {
    return { updated: 0 };
  }

  // Build update data - only include fields that are explicitly provided
  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.seasonId !== undefined) updateData.seasonId = updates.seasonId;

  // If no fields to update, return early
  if (Object.keys(updateData).length === 0) {
    return { updated: 0 };
  }

  const updated = await db
    .update(products)
    .set(updateData)
    .where(and(eq(products.brandId, brandId), inArray(products.id, ids)))
    .returning({ id: products.id });

  return {
    updated: updated.length,
  };
}

/**
 * Bulk delete products by explicit IDs.
 *
 * Deletes specific products by their IDs. Returns image paths for cleanup.
 */
export async function bulkDeleteProductsByIds(
  db: Database,
  brandId: string,
  ids: string[],
): Promise<BulkDeleteResult> {
  if (ids.length === 0) {
    return { deleted: 0, imagePaths: [] };
  }

  const deleted = await db
    .delete(products)
    .where(and(eq(products.brandId, brandId), inArray(products.id, ids)))
    .returning({
      id: products.id,
      primaryImagePath: products.primaryImagePath,
    });

  return {
    deleted: deleted.length,
    imagePaths: deleted
      .map((row) => row.primaryImagePath)
      .filter((path): path is string => path !== null),
  };
}

