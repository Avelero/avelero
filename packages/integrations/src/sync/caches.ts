/**
 * Sync Cache Management
 *
 * Pre-warms and manages in-memory caches for efficient sync operations.
 * Caches are loaded at the start of a sync session and updated as new
 * entities are created, eliminating redundant database lookups.
 */

import type { Database } from "@v1/db/client";
import {
  loadColorsMap,
  loadSizesMap,
  loadTagsMap,
} from "@v1/db/queries/catalog";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Color cache entry with ID and hex value.
 */
export interface CachedColor {
  id: string;
  hex: string | null;
  /** Whether this entity was created during this sync session */
  created?: boolean;
}

/**
 * Size cache entry.
 */
export interface CachedSize {
  id: string;
  /** Whether this entity was created during this sync session */
  created?: boolean;
}

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
 */
export interface SyncCaches {
  /**
   * Cache of color name (lowercase) -> { id, hex, created }
   * Pre-warmed from brand_colors table.
   */
  colors: Map<string, CachedColor>;

  /**
   * Cache of size name (lowercase) -> { id, created }
   * Pre-warmed from brand_sizes table.
   */
  sizes: Map<string, CachedSize>;

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
 * This loads all existing colors, sizes, and tags for the brand
 * into memory maps for O(1) lookup during sync processing.
 *
 * @param db - Database connection
 * @param brandId - Brand ID to load caches for
 * @returns Initialized SyncCaches object
 */
export async function initializeCaches(
  db: Database,
  brandId: string
): Promise<SyncCaches> {
  // Pre-warm all caches in parallel
  const [colorsMap, sizesMap, tagsMap] = await Promise.all([
    loadColorsMap(db, brandId),
    loadSizesMap(db, brandId),
    loadTagsMap(db, brandId),
  ]);

  // Transform to SyncCaches format
  const colors = new Map<string, CachedColor>();
  for (const [name, data] of colorsMap) {
    colors.set(name, { id: data.id, hex: data.hex, created: false });
  }

  const sizes = new Map<string, CachedSize>();
  for (const [name, id] of sizesMap) {
    sizes.set(name, { id, created: false });
  }

  const tags = new Map<string, CachedTag>();
  for (const [name, data] of tagsMap) {
    tags.set(name, { id: data.id, hex: data.hex, created: false });
  }

  return {
    colors,
    sizes,
    tags,
    products: new Map(),
    updatedProductIds: new Set(),
  };
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Add a color to the cache.
 */
export function cacheColor(
  caches: SyncCaches,
  name: string,
  id: string,
  hex: string | null,
  created: boolean
): void {
  caches.colors.set(name.toLowerCase(), { id, hex, created });
}

/**
 * Get a color from the cache.
 */
export function getCachedColor(
  caches: SyncCaches,
  name: string
): CachedColor | undefined {
  return caches.colors.get(name.toLowerCase());
}

/**
 * Add a size to the cache.
 */
export function cacheSize(
  caches: SyncCaches,
  name: string,
  id: string,
  created: boolean
): void {
  caches.sizes.set(name.toLowerCase(), { id, created });
}

/**
 * Get a size from the cache.
 */
export function getCachedSize(
  caches: SyncCaches,
  name: string
): CachedSize | undefined {
  return caches.sizes.get(name.toLowerCase());
}

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
 * Bulk add colors to the cache from batch create result.
 */
export function bulkCacheColors(
  caches: SyncCaches,
  colorMap: Map<string, string>,
  newlyCreated: Set<string>
): void {
  for (const [name, id] of colorMap) {
    const existing = caches.colors.get(name);
    caches.colors.set(name, {
      id,
      hex: existing?.hex ?? null,
      created: newlyCreated.has(name),
    });
  }
}

/**
 * Bulk add sizes to the cache from batch create result.
 */
export function bulkCacheSizes(
  caches: SyncCaches,
  sizeMap: Map<string, string>,
  newlyCreated: Set<string>
): void {
  for (const [name, id] of sizeMap) {
    caches.sizes.set(name, {
      id,
      created: newlyCreated.has(name),
    });
  }
}

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


