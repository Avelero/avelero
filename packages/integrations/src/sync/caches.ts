/**
 * Sync Cache Management
 *
 * Pre-warms and manages in-memory caches for efficient sync operations.
 * Caches are loaded at the start of a sync session and updated as new
 * entities are created, eliminating redundant database lookups.
 * 
 * Note: Color and size caches removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed via generic brand attributes and don't need
 * special caching for the sync engine (variants no longer have colorId/sizeId).
 */

import type { Database } from "@v1/db/client";
import {
  loadTagsMap,
} from "@v1/db/queries/catalog";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tag cache entry with ID and hex value.
 */
export interface CachedTag {
  id: string;
  hex: string | null;
  /** Whether this entity was created during this sync session */
  created?: boolean;
}

/**
 * Product cache entry for tracking synced products.
 */
export interface CachedProduct {
  id: string;
  productHandle: string;
  /** Whether this product was created during this sync session */
  created: boolean;
}

/**
 * In-memory caches to avoid redundant database lookups during a sync session.
 * These are pre-warmed at sync start and shared across all processing.
 * 
 * Note: colors and sizes caches removed - variants no longer have colorId/sizeId.
 */
export interface SyncCaches {
  /**
   * Cache of tag name (lowercase) -> { id, hex, created }
   * Pre-warmed from brand_tags table.
   */
  tags: Map<string, CachedTag>;

  /**
   * Cache of external product ID -> { id, productHandle, created }
   * Built during sync, not pre-warmed.
   */
  products: Map<string, CachedProduct>;

  /**
   * Set of product IDs that have already been updated this sync session.
   * Prevents redundant updates when processing multiple variants of the same product.
   */
  updatedProductIds: Set<string>;
}

// =============================================================================
// CACHE INITIALIZATION
// =============================================================================

/**
 * Initialize sync caches by pre-warming from database.
 *
 * This loads all existing tags for the brand into memory maps for O(1) lookup
 * during sync processing.
 * 
 * Note: Color and size caching removed - variants no longer have colorId/sizeId.
 *
 * @param db - Database connection
 * @param brandId - Brand ID to load caches for
 * @returns Initialized SyncCaches object
 */
export async function initializeCaches(
  db: Database,
  brandId: string
): Promise<SyncCaches> {
  // Pre-warm tags cache
  const tagsMap = await loadTagsMap(db, brandId);

  const tags = new Map<string, CachedTag>();
  for (const [name, data] of tagsMap) {
    tags.set(name, { id: data.id, hex: data.hex, created: false });
  }

  return {
    tags,
    products: new Map(),
    updatedProductIds: new Set(),
  };
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Add a tag to the cache.
 */
export function cacheTag(
  caches: SyncCaches,
  name: string,
  id: string,
  hex: string | null,
  created: boolean
): void {
  caches.tags.set(name.toLowerCase(), { id, hex, created });
}

/**
 * Get a tag from the cache.
 */
export function getCachedTag(
  caches: SyncCaches,
  name: string
): CachedTag | undefined {
  return caches.tags.get(name.toLowerCase());
}

/**
 * Add a product to the cache.
 */
export function cacheProduct(
  caches: SyncCaches,
  externalId: string,
  id: string,
  productHandle: string,
  created: boolean
): void {
  caches.products.set(externalId, { id, productHandle, created });
}

/**
 * Get a product from the cache.
 */
export function getCachedProduct(
  caches: SyncCaches,
  externalId: string
): CachedProduct | undefined {
  return caches.products.get(externalId);
}

/**
 * Mark a product as updated in this sync session.
 */
export function markProductUpdated(caches: SyncCaches, productId: string): void {
  caches.updatedProductIds.add(productId);
}

/**
 * Check if a product has been updated in this sync session.
 */
export function isProductUpdated(caches: SyncCaches, productId: string): boolean {
  return caches.updatedProductIds.has(productId);
}

// =============================================================================
// BULK CACHE UPDATES
// =============================================================================

/**
 * Bulk add tags to the cache from batch create result.
 */
export function bulkCacheTags(
  caches: SyncCaches,
  tagMap: Map<string, string>,
  newlyCreated: Set<string>
): void {
  for (const [name, id] of tagMap) {
    const existing = caches.tags.get(name);
    caches.tags.set(name, {
      id,
      hex: existing?.hex ?? null,
      created: newlyCreated.has(name),
    });
  }
}


