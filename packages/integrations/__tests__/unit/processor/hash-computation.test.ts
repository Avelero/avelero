/**
 * Unit Tests: Hash Computation (P1)
 *
 * Tests for computeHash() and computeProductHash() functions.
 * These are deterministic cryptographic functions for change detection.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  computeHash,
  extractValues,
  type EffectiveFieldMapping,
} from "../../../src/sync/processor";
import type { ExtractedValues } from "../../../src/types";

// =============================================================================
// Helper: computeProductHash (mirrors internal function)
// =============================================================================

/**
 * Compute product hash like the internal function does
 */
function computeProductHash(
  extracted: ExtractedValues,
  tagIds: string[],
): string {
  const data = {
    product: extracted.product,
    referenceEntities: extracted.referenceEntities,
    tags: tagIds.sort(),
  };
  const str = JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

// =============================================================================
// 3.1 computeHash() Tests
// =============================================================================

describe("computeHash()", () => {
  test("same input produces same hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Test Product", description: "Desc" },
      variant: { sku: "SKU-001" },
      referenceEntities: {},
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Test Product", description: "Desc" },
      variant: { sku: "SKU-001" },
      referenceEntities: {},
      relations: {},
    };

    expect(computeHash(values1)).toBe(computeHash(values2));
  });

  test("different input produces different hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Product A" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Product B" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    expect(computeHash(values1)).not.toBe(computeHash(values2));
  });

  test("object property order affects hash (JSON.stringify preserves order)", () => {
    // Note: JSON.stringify() in JavaScript DOES preserve property order.
    // Objects with different property orders produce different JSON strings and thus different hashes.
    // This is expected behavior - the hash is a content hash of the JSON serialization.
    const values1: ExtractedValues = {
      product: { name: "Product", description: "Desc" },
      variant: { sku: "SKU", barcode: "BAR" },
      referenceEntities: {},
      relations: {},
    };

    // Different property order = different JSON = different hash
    const values2: ExtractedValues = {
      product: { description: "Desc", name: "Product" },
      variant: { barcode: "BAR", sku: "SKU" },
      referenceEntities: {},
      relations: {},
    };

    // Hashes WILL be different due to property order
    expect(computeHash(values1)).not.toBe(computeHash(values2));
  });

  test("nested object hashing", () => {
    const values: ExtractedValues = {
      product: {
        name: "Product",
        metadata: { nested: { deep: { value: 123 } } } as unknown as string,
      },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash = computeHash(values);

    // Should produce valid hash
    expect(hash).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test("empty input produces valid hash", () => {
    const values: ExtractedValues = {
      product: {},
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash = computeHash(values);

    expect(hash).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test("null values affect hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Product", description: null as unknown as string },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    // null is different from missing
    expect(computeHash(values1)).not.toBe(computeHash(values2));
  });

  test("array ordering matters", () => {
    const values1: ExtractedValues = {
      product: {},
      variant: {},
      referenceEntities: {},
      relations: { tags: ["a", "b", "c"] },
    };

    const values2: ExtractedValues = {
      product: {},
      variant: {},
      referenceEntities: {},
      relations: { tags: ["c", "b", "a"] },
    };

    expect(computeHash(values1)).not.toBe(computeHash(values2));
  });

  test("hash is deterministic across runs", () => {
    const values: ExtractedValues = {
      product: { name: "Deterministic Test" },
      variant: { sku: "DET-001" },
      referenceEntities: { categoryId: "cat-123" },
      relations: { tags: ["test"] },
    };

    // Run multiple times
    const hashes = [
      computeHash(values),
      computeHash(values),
      computeHash(values),
    ];

    expect(new Set(hashes).size).toBe(1);
  });
});

// =============================================================================
// 3.2 computeProductHash() Tests
// =============================================================================

describe("computeProductHash()", () => {
  test("product data changes affect hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Original Name" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Changed Name" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash1 = computeProductHash(values1, []);
    const hash2 = computeProductHash(values2, []);

    expect(hash1).not.toBe(hash2);
  });

  test("tag order is normalized (sorted)", () => {
    const values: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash1 = computeProductHash(values, ["c", "a", "b"]);
    const hash2 = computeProductHash(values, ["a", "b", "c"]);

    // Should be same because tags are sorted
    expect(hash1).toBe(hash2);
  });

  test("category changes affect hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: { categoryId: "cat-a" },
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: { categoryId: "cat-b" },
      relations: {},
    };

    const hash1 = computeProductHash(values1, []);
    const hash2 = computeProductHash(values2, []);

    expect(hash1).not.toBe(hash2);
  });

  test("variant data NOT included in product hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Product" },
      variant: { sku: "SKU-A" },
      referenceEntities: {},
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Product" },
      variant: { sku: "SKU-B" },
      referenceEntities: {},
      relations: {},
    };

    const hash1 = computeProductHash(values1, []);
    const hash2 = computeProductHash(values2, []);

    // Variant changes should NOT affect product hash
    expect(hash1).toBe(hash2);
  });

  test("empty tags produce valid hash", () => {
    const values: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash = computeProductHash(values, []);

    expect(hash).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test("same tags with same content produce same hash", () => {
    const values1: ExtractedValues = {
      product: { name: "Product", description: "Description" },
      variant: { sku: "ignored" },
      referenceEntities: { categoryId: "cat-1" },
      relations: {},
    };

    const values2: ExtractedValues = {
      product: { name: "Product", description: "Description" },
      variant: { sku: "also-ignored" },
      referenceEntities: { categoryId: "cat-1" },
      relations: {},
    };

    const hash1 = computeProductHash(values1, ["tag1", "tag2"]);
    const hash2 = computeProductHash(values2, ["tag1", "tag2"]);

    expect(hash1).toBe(hash2);
  });

  test("different tags produce different hash", () => {
    const values: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hash1 = computeProductHash(values, ["tag1"]);
    const hash2 = computeProductHash(values, ["tag2"]);

    expect(hash1).not.toBe(hash2);
  });

  test("tag addition/removal changes hash", () => {
    const values: ExtractedValues = {
      product: { name: "Product" },
      variant: {},
      referenceEntities: {},
      relations: {},
    };

    const hashWithTags = computeProductHash(values, ["tag1", "tag2"]);
    const hashWithMoreTags = computeProductHash(values, [
      "tag1",
      "tag2",
      "tag3",
    ]);

    expect(hashWithTags).not.toBe(hashWithMoreTags);
  });
});
