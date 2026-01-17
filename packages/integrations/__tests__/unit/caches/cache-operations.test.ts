/**
 * Unit Tests: Cache Operations (P2)
 *
 * Tests for sync cache functions in caches.ts.
 * These are in-memory Map operations for efficient sync lookups.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import {
  type SyncCaches,
  type CachedTag,
  type CachedProduct,
  type CachedAttribute,
  cacheTag,
  getCachedTag,
  bulkCacheTags,
  cacheProduct,
  getCachedProduct,
  markProductUpdated,
  isProductUpdated,
  getCachedAttributeId,
  getCachedAttributeValueId,
  bulkCacheAttributes,
  bulkCacheAttributeValues,
} from "../../../src/sync/caches";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create empty sync caches for testing
 */
function createEmptyCaches(): SyncCaches {
  return {
    tags: new Map(),
    products: new Map(),
    updatedProductIds: new Set(),
    attributes: new Map(),
    attributeValues: new Map(),
  };
}

// =============================================================================
// 9.1 Tag Cache Operations
// =============================================================================

describe("Tag Cache Operations", () => {
  let caches: SyncCaches;

  beforeEach(() => {
    caches = createEmptyCaches();
  });

  test("cacheTag stores with lowercase key", () => {
    cacheTag(caches, "Summer", "uuid-1", "#FF0000", true);

    // Internally stored as lowercase
    expect(caches.tags.has("summer")).toBe(true);
    expect(caches.tags.has("Summer")).toBe(false);
  });

  test("getCachedTag retrieves by lowercase lookup", () => {
    cacheTag(caches, "summer", "uuid-1", "#FF0000", false);

    // Should find regardless of input case
    expect(getCachedTag(caches, "Summer")?.id).toBe("uuid-1");
    expect(getCachedTag(caches, "SUMMER")?.id).toBe("uuid-1");
    expect(getCachedTag(caches, "summer")?.id).toBe("uuid-1");
  });

  test("getCachedTag returns undefined for missing", () => {
    expect(getCachedTag(caches, "unknown")).toBeUndefined();
  });

  test("bulkCacheTags stores multiple tags", () => {
    const tagMap = new Map([
      ["summer", "uuid-1"],
      ["winter", "uuid-2"],
    ]);
    const newlyCreated = new Set(["summer"]);

    bulkCacheTags(caches, tagMap, newlyCreated);

    expect(caches.tags.size).toBe(2);
    expect(getCachedTag(caches, "summer")?.id).toBe("uuid-1");
    expect(getCachedTag(caches, "summer")?.created).toBe(true);
    expect(getCachedTag(caches, "winter")?.id).toBe("uuid-2");
    expect(getCachedTag(caches, "winter")?.created).toBe(false);
  });

  test("created flag set correctly", () => {
    cacheTag(caches, "new-tag", "uuid-1", "#000000", true);
    cacheTag(caches, "existing-tag", "uuid-2", "#FFFFFF", false);

    expect(getCachedTag(caches, "new-tag")?.created).toBe(true);
    expect(getCachedTag(caches, "existing-tag")?.created).toBe(false);
  });

  test("hex color preserved", () => {
    cacheTag(caches, "colored", "uuid-1", "#FF5500", false);

    expect(getCachedTag(caches, "colored")?.hex).toBe("#FF5500");
  });

  test("null hex color allowed", () => {
    cacheTag(caches, "no-color", "uuid-1", null, false);

    expect(getCachedTag(caches, "no-color")?.hex).toBeNull();
  });
});

// =============================================================================
// 9.2 Product Cache Operations
// =============================================================================

describe("Product Cache Operations", () => {
  let caches: SyncCaches;

  beforeEach(() => {
    caches = createEmptyCaches();
  });

  test("cacheProduct stores correctly", () => {
    cacheProduct(caches, "ext-123", "uuid-product", "blue-shirt", true);

    expect(caches.products.has("ext-123")).toBe(true);
  });

  test("getCachedProduct retrieves by external ID", () => {
    cacheProduct(caches, "ext-123", "uuid-product", "blue-shirt", false);

    const cached = getCachedProduct(caches, "ext-123");
    expect(cached?.id).toBe("uuid-product");
    expect(cached?.productHandle).toBe("blue-shirt");
    expect(cached?.created).toBe(false);
  });

  test("getCachedProduct returns undefined for missing", () => {
    expect(getCachedProduct(caches, "nonexistent")).toBeUndefined();
  });

  test("markProductUpdated adds to set", () => {
    markProductUpdated(caches, "uuid-product");

    expect(caches.updatedProductIds.has("uuid-product")).toBe(true);
  });

  test("isProductUpdated returns correct status", () => {
    expect(isProductUpdated(caches, "uuid-product")).toBe(false);

    markProductUpdated(caches, "uuid-product");

    expect(isProductUpdated(caches, "uuid-product")).toBe(true);
  });

  test("multiple products can be marked updated", () => {
    markProductUpdated(caches, "uuid-1");
    markProductUpdated(caches, "uuid-2");
    markProductUpdated(caches, "uuid-3");

    expect(isProductUpdated(caches, "uuid-1")).toBe(true);
    expect(isProductUpdated(caches, "uuid-2")).toBe(true);
    expect(isProductUpdated(caches, "uuid-3")).toBe(true);
    expect(isProductUpdated(caches, "uuid-4")).toBe(false);
  });

  test("created flag preserved", () => {
    cacheProduct(caches, "ext-new", "uuid-new", "handle-new", true);
    cacheProduct(
      caches,
      "ext-existing",
      "uuid-existing",
      "handle-existing",
      false,
    );

    expect(getCachedProduct(caches, "ext-new")?.created).toBe(true);
    expect(getCachedProduct(caches, "ext-existing")?.created).toBe(false);
  });
});

// =============================================================================
// 9.3 Attribute Cache Operations
// =============================================================================

describe("Attribute Cache Operations", () => {
  let caches: SyncCaches;

  beforeEach(() => {
    caches = createEmptyCaches();
  });

  test("getCachedAttributeId returns ID by name", () => {
    caches.attributes.set("color", { id: "uuid-color" });

    expect(getCachedAttributeId(caches, "Color")).toBe("uuid-color");
  });

  test("getCachedAttributeId case insensitive", () => {
    caches.attributes.set("color", { id: "uuid-color" });

    expect(getCachedAttributeId(caches, "color")).toBe("uuid-color");
    expect(getCachedAttributeId(caches, "Color")).toBe("uuid-color");
    expect(getCachedAttributeId(caches, "COLOR")).toBe("uuid-color");
  });

  test("getCachedAttributeId returns undefined for missing", () => {
    expect(getCachedAttributeId(caches, "unknown")).toBeUndefined();
  });

  test("getCachedAttributeValueId returns value ID", () => {
    caches.attributeValues.set("attr-1:red", "uuid-red");

    expect(getCachedAttributeValueId(caches, "attr-1", "Red")).toBe("uuid-red");
  });

  test("getCachedAttributeValueId case insensitive for value", () => {
    caches.attributeValues.set("attr-1:medium", "uuid-medium");

    expect(getCachedAttributeValueId(caches, "attr-1", "Medium")).toBe(
      "uuid-medium",
    );
    expect(getCachedAttributeValueId(caches, "attr-1", "medium")).toBe(
      "uuid-medium",
    );
    expect(getCachedAttributeValueId(caches, "attr-1", "MEDIUM")).toBe(
      "uuid-medium",
    );
  });

  test("getCachedAttributeValueId returns undefined for missing", () => {
    expect(
      getCachedAttributeValueId(caches, "attr-1", "unknown"),
    ).toBeUndefined();
  });

  test("bulkCacheAttributes stores multiple", () => {
    const attrMap = new Map([
      ["color", "uuid-color"],
      ["size", "uuid-size"],
    ]);
    const newlyCreated = new Set(["color"]);

    bulkCacheAttributes(caches, attrMap, newlyCreated);

    expect(caches.attributes.size).toBe(2);
    expect(getCachedAttributeId(caches, "color")).toBe("uuid-color");
    expect(getCachedAttributeId(caches, "size")).toBe("uuid-size");
  });

  test("bulkCacheAttributeValues stores composite keys", () => {
    const valueMap = new Map([
      ["attr-color:red", "uuid-red"],
      ["attr-color:blue", "uuid-blue"],
      ["attr-size:medium", "uuid-medium"],
    ]);

    bulkCacheAttributeValues(caches, valueMap);

    expect(caches.attributeValues.size).toBe(3);
    expect(caches.attributeValues.get("attr-color:red")).toBe("uuid-red");
    expect(caches.attributeValues.get("attr-color:blue")).toBe("uuid-blue");
    expect(caches.attributeValues.get("attr-size:medium")).toBe("uuid-medium");
  });

  test("attribute created flag tracked", () => {
    const attrMap = new Map([
      ["color", "uuid-color"],
      ["size", "uuid-size"],
    ]);
    const newlyCreated = new Set(["color"]);

    bulkCacheAttributes(caches, attrMap, newlyCreated);

    expect(caches.attributes.get("color")?.created).toBe(true);
    expect(caches.attributes.get("size")?.created).toBe(false);
  });
});
