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

export interface CachedTag {
  id: string;
  hex: string | null;
  created?: boolean;
}

export interface CachedProduct {
  id: string;
  productHandle: string;
  created: boolean;
}

export interface CachedAttribute {
  id: string;
  created?: boolean;
}

/**
 * In-memory caches to avoid redundant database lookups during a sync session.
 */
export interface SyncCaches {
  /** Tag name (lowercase) -> { id, hex, created } */
  tags: Map<string, CachedTag>;
  /** External product ID -> { id, productHandle, created } */
  products: Map<string, CachedProduct>;
  /** Product IDs that have been updated this sync session */
  updatedProductIds: Set<string>;
  /** Attribute name (lowercase) -> { id, created } */
  attributes: Map<string, CachedAttribute>;
  /** (attributeId:valueName_lowercase) -> value ID */
  attributeValues: Map<string, string>;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize sync caches by pre-warming from database.
 */
export async function initializeCaches(
  db: Database,
  brandId: string
): Promise<SyncCaches> {
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
// TAG OPERATIONS
// =============================================================================

export function cacheTag(caches: SyncCaches, name: string, id: string, hex: string | null, created: boolean): void {
  caches.tags.set(name.toLowerCase(), { id, hex, created });
}

export function getCachedTag(caches: SyncCaches, name: string): CachedTag | undefined {
  return caches.tags.get(name.toLowerCase());
}

export function bulkCacheTags(caches: SyncCaches, tagMap: Map<string, string>, newlyCreated: Set<string>): void {
  for (const [name, id] of tagMap) {
    const existing = caches.tags.get(name);
    caches.tags.set(name, { id, hex: existing?.hex ?? null, created: newlyCreated.has(name) });
  }
}

// =============================================================================
// PRODUCT OPERATIONS
// =============================================================================

export function cacheProduct(caches: SyncCaches, externalId: string, id: string, productHandle: string, created: boolean): void {
  caches.products.set(externalId, { id, productHandle, created });
}

export function getCachedProduct(caches: SyncCaches, externalId: string): CachedProduct | undefined {
  return caches.products.get(externalId);
}

export function markProductUpdated(caches: SyncCaches, productId: string): void {
  caches.updatedProductIds.add(productId);
}

export function isProductUpdated(caches: SyncCaches, productId: string): boolean {
  return caches.updatedProductIds.has(productId);
}

// =============================================================================
// ATTRIBUTE OPERATIONS
// =============================================================================

export function getCachedAttributeId(caches: SyncCaches, name: string): string | undefined {
  return caches.attributes.get(name.toLowerCase())?.id;
}

export function getCachedAttributeValueId(caches: SyncCaches, attributeId: string, valueName: string): string | undefined {
  return caches.attributeValues.get(`${attributeId}:${valueName.toLowerCase()}`);
}

export function bulkCacheAttributes(caches: SyncCaches, attributeMap: Map<string, string>, newlyCreated: Set<string>): void {
  for (const [name, id] of attributeMap) {
    caches.attributes.set(name, { id, created: newlyCreated.has(name) });
  }
}

export function bulkCacheAttributeValues(caches: SyncCaches, valueMap: Map<string, string>): void {
  for (const [key, id] of valueMap) {
    caches.attributeValues.set(key, id);
  }
}
