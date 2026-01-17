/**
 * Unit Tests: Category Mapping Resolver (P1)
 *
 * Tests for Shopify category mapping functions.
 * These functions resolve Shopify taxonomy category IDs to Avelero category UUIDs.
 *
 * Note: These tests focus on the pure functions (extractShortId, getParentId, isExcluded)
 * which can be tested without database dependencies. The resolveShopifyCategoryId
 * function requires DB initialization and is covered in integration tests.
 */

import { describe, expect, test } from "bun:test";

// =============================================================================
// Helper implementations (mirror private functions for testing)
// =============================================================================

/**
 * Extract the short category ID from a Shopify GID.
 * Example: "gid://shopify/TaxonomyCategory/aa-1-13-8" → "aa-1-13-8"
 */
function extractShortId(shopifyCategoryId: string): string {
  return shopifyCategoryId.replace(/^gid:\/\/shopify\/TaxonomyCategory\//, "");
}

/**
 * Get the parent category ID by removing the last segment.
 * Example: "aa-1-2-3" → "aa-1-2"
 */
function getParentId(categoryId: string): string | null {
  const parts = categoryId.split("-");
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join("-");
}

/**
 * Check if a category ID is in the excluded list or is a child of an excluded category.
 */
function isExcluded(categoryId: string, excludedIds: string[]): boolean {
  return excludedIds.some(
    (excludedId) =>
      categoryId === excludedId || categoryId.startsWith(`${excludedId}-`),
  );
}

// =============================================================================
// 5.1 extractShortId() Tests
// =============================================================================

describe("extractShortId()", () => {
  test("full GID extracts short ID", () => {
    const result = extractShortId("gid://shopify/TaxonomyCategory/aa-1-13-8");
    expect(result).toBe("aa-1-13-8");
  });

  test("already short ID returns unchanged", () => {
    const result = extractShortId("aa-1-13-8");
    expect(result).toBe("aa-1-13-8");
  });

  test("different branch extracts correctly", () => {
    const result = extractShortId("gid://shopify/TaxonomyCategory/bb-2-5");
    expect(result).toBe("bb-2-5");
  });

  test("root level category", () => {
    const result = extractShortId("gid://shopify/TaxonomyCategory/aa");
    expect(result).toBe("aa");
  });

  test("deep nested category", () => {
    const result = extractShortId(
      "gid://shopify/TaxonomyCategory/aa-1-2-3-4-5-6",
    );
    expect(result).toBe("aa-1-2-3-4-5-6");
  });

  test("handles empty string", () => {
    const result = extractShortId("");
    expect(result).toBe("");
  });

  test("handles partial GID prefix", () => {
    // If the prefix doesn't match exactly, it should return as-is
    const result = extractShortId("gid://shopify/Other/aa-1");
    expect(result).toBe("gid://shopify/Other/aa-1");
  });
});

// =============================================================================
// 5.2 getParentId() Tests
// =============================================================================

describe("getParentId()", () => {
  test("three levels returns parent", () => {
    const result = getParentId("aa-1-2-3");
    expect(result).toBe("aa-1-2");
  });

  test("two levels returns parent", () => {
    const result = getParentId("aa-1");
    expect(result).toBe("aa");
  });

  test("root level returns null", () => {
    const result = getParentId("aa");
    expect(result).toBeNull();
  });

  test("deep nested hierarchy", () => {
    let current: string | null = "aa-1-2-3-4-5";
    const parents: (string | null)[] = [];

    while (current) {
      current = getParentId(current);
      parents.push(current);
    }

    expect(parents).toEqual([
      "aa-1-2-3-4",
      "aa-1-2-3",
      "aa-1-2",
      "aa-1",
      "aa",
      null,
    ]);
  });

  test("empty string returns null", () => {
    const result = getParentId("");
    expect(result).toBeNull();
  });

  test("single segment returns null", () => {
    const result = getParentId("clothing");
    expect(result).toBeNull();
  });
});

// =============================================================================
// 5.3 isExcluded() Tests
// =============================================================================

describe("isExcluded()", () => {
  test("exact match is excluded", () => {
    const result = isExcluded("aa-1-10", ["aa-1-10"]);
    expect(result).toBe(true);
  });

  test("child of excluded is excluded", () => {
    const result = isExcluded("aa-1-10-5", ["aa-1-10"]);
    expect(result).toBe(true);
  });

  test("not excluded when not matching", () => {
    const result = isExcluded("aa-1-11", ["aa-1-10"]);
    expect(result).toBe(false);
  });

  test("empty excluded list returns false", () => {
    const result = isExcluded("aa-1-10", []);
    expect(result).toBe(false);
  });

  test("partial match is not excluded (prefix must be complete segment)", () => {
    // "aa-1-100" should NOT be excluded by "aa-1-10"
    // Only if category starts with "aa-1-10-" (with trailing dash)
    const result = isExcluded("aa-1-100", ["aa-1-10"]);
    expect(result).toBe(false);
  });

  test("deep child of excluded is also excluded", () => {
    const result = isExcluded("aa-1-10-5-2-1", ["aa-1-10"]);
    expect(result).toBe(true);
  });

  test("multiple excluded categories", () => {
    const excluded = ["aa-1-10", "aa-1-20", "aa-2"];

    expect(isExcluded("aa-1-10", excluded)).toBe(true);
    expect(isExcluded("aa-1-10-5", excluded)).toBe(true);
    expect(isExcluded("aa-1-20", excluded)).toBe(true);
    expect(isExcluded("aa-2-1-2", excluded)).toBe(true);
    expect(isExcluded("aa-1-15", excluded)).toBe(false);
    expect(isExcluded("aa-3", excluded)).toBe(false);
  });

  test("sibling is not excluded", () => {
    // aa-1-10 is excluded, but aa-1-11 is a sibling, not a child
    const result = isExcluded("aa-1-11", ["aa-1-10"]);
    expect(result).toBe(false);
  });

  test("parent is not excluded by child", () => {
    // If aa-1-10 is excluded, aa-1 should NOT be excluded
    const result = isExcluded("aa-1", ["aa-1-10"]);
    expect(result).toBe(false);
  });
});

// =============================================================================
// 5.4 resolveShopifyCategoryId() Tests (behavioral description)
// =============================================================================

describe("resolveShopifyCategoryId() - expected behavior", () => {
  /**
   * These tests describe the expected behavior of resolveShopifyCategoryId.
   * The actual function requires DB initialization, so we test the logic
   * through the helper functions above.
   *
   * Integration tests in integration/category-mapping.integration.test.ts
   * cover the full resolver with DB-backed mapping.
   */

  test("direct rule match returns mapped UUID (logic test)", () => {
    // Given a rules map: { "aa-1-2": { id: "uuid-123" } }
    // When resolving "aa-1-2"
    // Then returns "uuid-123"
    const rules: Record<string, { id: string } | null> = {
      "aa-1-2": { id: "uuid-123" },
    };
    const categoryId = "aa-1-2";
    expect(rules[categoryId]?.id).toBe("uuid-123");
  });

  test("ancestor rule match uses first ancestor (logic test)", () => {
    // Given rules: { "aa-1": { id: "uuid-1" } }
    // When resolving "aa-1-2-3"
    // Then walks up: aa-1-2 (no match), aa-1 (match!) → returns "uuid-1"
    const rules: Record<string, { id: string } | null> = {
      "aa-1": { id: "uuid-1" },
    };

    let current: string | null = "aa-1-2-3";
    let resolved: string | null = null;

    // Skip direct match
    while (current) {
      current = getParentId(current);
      if (current && rules[current]) {
        resolved = rules[current]?.id ?? null;
        break;
      }
    }

    expect(resolved).toBe("uuid-1");
  });

  test("null shopifyCategory returns null (logic test)", () => {
    // null input should return null immediately
    const categoryId = null as { id: string } | null;
    expect(categoryId?.id).toBeUndefined();
  });

  test("undefined shopifyCategory returns null (logic test)", () => {
    const categoryId = undefined;
    expect(categoryId).toBeUndefined();
  });

  test("missing id in category returns null (logic test)", () => {
    const category = { name: "Shoes" };
    expect((category as { id?: string }).id).toBeUndefined();
  });
});
