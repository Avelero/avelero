/**
 * Sync Cache Management
 *
 * Pre-warms and manages in-memory caches for efficient sync operations.
 * Caches are loaded at the start of a sync session and updated as new
 * entities are created, eliminating redundant database lookups.
 */

import type { Database } from "@v1/db/client";
import {
  loadTagsMap,
  loadBrandAttributesMap,
  loadAllBrandAttributeValuesMap,
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
 * Brand attribute cache entry.
 */
export interface CachedAttribute {
  id: string;
  created?: boolean;
}

/**
 * In-memory caches to avoid redundant database lookups during a sync session.
 * These are pre-warmed at sync start and shared across all processing.
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

  /**
   * Cache of attribute name (lowercase) -> attribute ID
   * Pre-warmed from brand_attributes table.
   */
  attributes: Map<string, CachedAttribute>;

  /**
   * Cache of attribute values: (attributeId:valueName_lowercase) -> value ID
   * Pre-warmed from brand_attribute_values table.
   */
  attributeValues: Map<string, string>;
}

// =============================================================================
// CACHE INITIALIZATION
// =============================================================================

/**
 * Initialize sync caches by pre-warming from database.
 *
 * This loads all existing tags and attributes for the brand into memory maps
 * for O(1) lookup during sync processing.
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
  const [tagsMap, attributesMap, attributeValuesMap] = await Promise.all([
    loadTagsMap(db, brandId),
    loadBrandAttributesMap(db, brandId),
    loadAllBrandAttributeValuesMap(db, brandId),
  ]);

  const tags = new Map<string, CachedTag>();
  for (const [name, data] of tagsMap) {
    tags.set(name, { id: data.id, hex: data.hex, created: false });
  }

  const attributes = new Map<string, CachedAttribute>();
  for (const [name, data] of attributesMap) {
    attributes.set(name, { id: data.id, created: false });
  }

  // Flatten nested attribute values map to single Map with composite key
  const attributeValues = new Map<string, string>();
  for (const [attrId, valuesMap] of attributeValuesMap) {
    for (const [nameLower, valueId] of valuesMap) {
      attributeValues.set(`${attrId}:${nameLower}`, valueId);
    }
  }

  return {
    tags,
    products: new Map(),
    updatedProductIds: new Set(),
    attributes,
    attributeValues,
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

/**
 * Get an attribute ID from the cache by name.
 */
export function getCachedAttributeId(
  caches: SyncCaches,
  name: string
): string | undefined {
  return caches.attributes.get(name.toLowerCase())?.id;
}

/**
 * Get an attribute value ID from the cache.
 */
export function getCachedAttributeValueId(
  caches: SyncCaches,
  attributeId: string,
  valueName: string
): string | undefined {
  return caches.attributeValues.get(`${attributeId}:${valueName.toLowerCase()}`);
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

/**
 * Bulk add attributes to the cache from batch create result.
 */
export function bulkCacheAttributes(
  caches: SyncCaches,
  attributeMap: Map<string, string>,
  newlyCreated: Set<string>
): void {
  for (const [name, id] of attributeMap) {
    caches.attributes.set(name, {
      id,
      created: newlyCreated.has(name),
    });
  }
}

/**
 * Bulk add attribute values to the cache from batch create result.
 */
export function bulkCacheAttributeValues(
  caches: SyncCaches,
  valueMap: Map<string, string>
): void {
  for (const [key, id] of valueMap) {
    caches.attributeValues.set(key, id);
  }
}
