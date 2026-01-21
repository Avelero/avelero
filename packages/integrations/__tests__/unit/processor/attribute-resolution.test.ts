/**
 * Unit Tests: Attribute Resolution (P1)
 *
 * Tests for resolveAttributeValueIds() function.
 * This function resolves variant option names/values to attribute value UUIDs using cache.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { SyncCaches } from "../../../src/sync/caches";
import { resolveAttributeValueIds } from "../../../src/sync/processor";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create sync caches with pre-populated attributes and values
 */
function createTestCaches(
  attributes: Array<{ name: string; id: string }>,
  values: Array<{ attributeId: string; valueName: string; valueId: string }>,
): SyncCaches {
  const attrs = new Map<string, { id: string; created?: boolean }>();
  for (const attr of attributes) {
    attrs.set(attr.name.toLowerCase(), { id: attr.id });
  }

  const attrValues = new Map<string, string>();
  for (const val of values) {
    attrValues.set(
      `${val.attributeId}:${val.valueName.toLowerCase()}`,
      val.valueId,
    );
  }

  return {
    tags: new Map(),
    products: new Map(),
    updatedProductIds: new Set(),
    attributes: attrs,
    attributeValues: attrValues,
  };
}

// =============================================================================
// 10.1 resolveAttributeValueIds() Tests
// =============================================================================

describe("resolveAttributeValueIds()", () => {
  test("single option resolves to ID", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "M", valueId: "uuid-1" }],
    );

    const result = resolveAttributeValueIds(
      [{ name: "Size", value: "M" }],
      caches,
    );

    expect(result).toEqual(["uuid-1"]);
  });

  test("multiple options resolve to multiple IDs", () => {
    const caches = createTestCaches(
      [
        { name: "Color", id: "attr-color" },
        { name: "Size", id: "attr-size" },
      ],
      [
        { attributeId: "attr-color", valueName: "Red", valueId: "uuid-red" },
        { attributeId: "attr-size", valueName: "M", valueId: "uuid-m" },
      ],
    );

    const result = resolveAttributeValueIds(
      [
        { name: "Color", value: "Red" },
        { name: "Size", value: "M" },
      ],
      caches,
    );

    expect(result).toEqual(["uuid-red", "uuid-m"]);
  });

  test("missing attribute returns empty for that option", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "M", valueId: "uuid-1" }],
    );

    const result = resolveAttributeValueIds(
      [{ name: "Unknown", value: "X" }],
      caches,
    );

    expect(result).toEqual([]);
  });

  test("missing value returns empty for that option", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "M", valueId: "uuid-1" }],
    );

    const result = resolveAttributeValueIds(
      [{ name: "Size", value: "XXXL" }], // XXXL not cached
      caches,
    );

    expect(result).toEqual([]);
  });

  test("empty options returns empty array", () => {
    const caches = createTestCaches([], []);

    const result = resolveAttributeValueIds([], caches);

    expect(result).toEqual([]);
  });

  test("partial match returns only matched IDs", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "M", valueId: "uuid-m" }],
    );

    const result = resolveAttributeValueIds(
      [
        { name: "Size", value: "M" }, // Matches
        { name: "Color", value: "Red" }, // No attribute
      ],
      caches,
    );

    expect(result).toEqual(["uuid-m"]);
  });

  test("case insensitive attribute lookup", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "M", valueId: "uuid-1" }],
    );

    // "SIZE" in input should match "size" in cache (lowercase)
    const result = resolveAttributeValueIds(
      [{ name: "SIZE", value: "M" }],
      caches,
    );

    expect(result).toEqual(["uuid-1"]);
  });

  test("case insensitive value lookup", () => {
    const caches = createTestCaches(
      [{ name: "Size", id: "attr-size" }],
      [{ attributeId: "attr-size", valueName: "medium", valueId: "uuid-1" }],
    );

    // "MEDIUM" in input should match "medium" in cache
    const result = resolveAttributeValueIds(
      [{ name: "Size", value: "MEDIUM" }],
      caches,
    );

    expect(result).toEqual(["uuid-1"]);
  });

  test("preserves order of matched options", () => {
    const caches = createTestCaches(
      [
        { name: "Color", id: "attr-color" },
        { name: "Size", id: "attr-size" },
        { name: "Material", id: "attr-material" },
      ],
      [
        { attributeId: "attr-color", valueName: "Red", valueId: "uuid-color" },
        { attributeId: "attr-size", valueName: "M", valueId: "uuid-size" },
        {
          attributeId: "attr-material",
          valueName: "Cotton",
          valueId: "uuid-material",
        },
      ],
    );

    const result = resolveAttributeValueIds(
      [
        { name: "Material", value: "Cotton" },
        { name: "Color", value: "Red" },
        { name: "Size", value: "M" },
      ],
      caches,
    );

    // Order should match input order
    expect(result).toEqual(["uuid-material", "uuid-color", "uuid-size"]);
  });

  test("handles mixed matched and unmatched options", () => {
    const caches = createTestCaches(
      [
        { name: "Size", id: "attr-size" },
        { name: "Color", id: "attr-color" },
      ],
      [
        { attributeId: "attr-size", valueName: "M", valueId: "uuid-m" },
        // Color:Blue not in cache
      ],
    );

    const result = resolveAttributeValueIds(
      [
        { name: "Size", value: "M" }, // Matches
        { name: "Color", value: "Blue" }, // Attribute exists, value doesn't
        { name: "Style", value: "Modern" }, // Attribute doesn't exist
      ],
      caches,
    );

    expect(result).toEqual(["uuid-m"]);
  });

  test("all options unmatched returns empty array", () => {
    const caches = createTestCaches([], []);

    const result = resolveAttributeValueIds(
      [
        { name: "Size", value: "M" },
        { name: "Color", value: "Red" },
      ],
      caches,
    );

    expect(result).toEqual([]);
  });
});
