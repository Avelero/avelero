/**
 * Identifier Matching Tests
 *
 * Tests for barcode and SKU matching behavior during sync.
 * Covers edge cases like duplicate identifiers, case sensitivity,
 * and missing identifiers.
 *
 * Covers tests from Section 4.8 of integration-refactor-plan.md:
 * - ID-003: Duplicate identifier in Avelero
 * - ID-004: Missing identifier skips variant
 * - ID-005: Identifier case sensitivity
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
  products,
  productVariants,
  integrationVariantLinks,
} from "@v1/db/schema";
import { syncProducts } from "../../../src/sync/engine";
import {
  testDb,
  createTestBrand,
  createTestBrandIntegration,
  createDefaultFieldConfigs,
} from "@v1/db/testing";
import { createTestSyncContext } from "@v1/db/testing";
import {
  setMockProducts,
  clearMockProducts,
  createMockProduct,
  createMockVariant,
} from "@v1/testing/mocks/shopify";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let idCounter = Date.now();
function nextProductId(): string {
  return `gid://shopify/Product/${idCounter++}`;
}
function nextVariantId(): string {
  return `gid://shopify/ProductVariant/${idCounter++}`;
}

function generateUpid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length: 16 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/**
 * Create an existing Avelero product with variants.
 */
async function createExistingProduct(options: {
  brandId: string;
  name: string;
  variants: Array<{ sku: string | null; barcode: string | null }>;
}): Promise<{
  product: typeof products.$inferSelect;
  variants: (typeof productVariants.$inferSelect)[];
}> {
  const handle = options.name.toLowerCase().replace(/\s+/g, "-");

  const [product] = await testDb
    .insert(products)
    .values({
      brandId: options.brandId,
      name: options.name,
      productHandle: handle,
      source: "integration",
    })
    .returning();

  const variantData = options.variants.map((v) => ({
    productId: product!.id,
    sku: v.sku,
    barcode: v.barcode,
    upid: generateUpid(),
  }));

  const variants = await testDb
    .insert(productVariants)
    .values(variantData)
    .returning();

  return { product: product!, variants };
}

// =============================================================================
// ID-003: Duplicate Identifier in Avelero
// =============================================================================

describe("ID-003: Duplicate Identifier in Avelero", () => {
  let brandId: string;
  let primaryIntegrationId: string;
  let secondaryIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    // Create primary integration (required for product creation)
    primaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "shopify",
      {
        isPrimary: true,
      },
    );
    await createDefaultFieldConfigs(primaryIntegrationId);
    // Create secondary integration for testing identifier matching
    secondaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "its-perfect",
      {
        isPrimary: false,
      },
    );
    await createDefaultFieldConfigs(secondaryIntegrationId);
  });

  it("matches first variant when multiple variants have same barcode", async () => {
    // Arrange: Create 2 products, each with a variant sharing the same barcode
    // This simulates a data integrity issue or intentional duplicate
    const sharedBarcode = "DUPLICATE-BARCODE-001";

    const { product: product1, variants: variants1 } =
      await createExistingProduct({
        brandId,
        name: "Product 1 with Duplicate",
        variants: [{ sku: "PROD1-SKU", barcode: sharedBarcode }],
      });

    const { product: product2, variants: variants2 } =
      await createExistingProduct({
        brandId,
        name: "Product 2 with Duplicate",
        variants: [{ sku: "PROD2-SKU", barcode: sharedBarcode }],
      });

    // Shopify product with same barcode
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Shopify Duplicate Test",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "SHOP-SKU",
          barcode: sharedBarcode,
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Sync completes (first match wins)
    expect(result.success).toBe(true);

    // Only 1 variant link created (to first matched variant)
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);

    // Should match one of the existing variants (typically first one found)
    const matchedVariantId = variantLinks[0]!.variantId;
    expect([variants1[0]!.id, variants2[0]!.id]).toContain(matchedVariantId);
  });

  it("handles duplicate SKUs by matching first occurrence", async () => {
    // Arrange: Create product with 2 variants sharing same SKU
    const sharedSku = "DUPLICATE-SKU-001";

    const { product, variants } = await createExistingProduct({
      brandId,
      name: "Product with SKU Duplicates",
      variants: [
        { sku: sharedSku, barcode: "BARCODE-1" },
        { sku: sharedSku, barcode: "BARCODE-2" }, // Same SKU!
      ],
    });

    // Shopify product with same SKU
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Shopify SKU Duplicate Test",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: sharedSku,
          barcode: "DIFFERENT-BARCODE",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "sku",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Sync completes
    expect(result.success).toBe(true);

    // Link created to one of the variants
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);
  });
});

// =============================================================================
// ID-004: Missing Identifier Skips Variant
// =============================================================================

describe("ID-004: Missing Identifier Skips Variant", () => {
  let brandId: string;
  let primaryIntegrationId: string;
  let secondaryIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    primaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "shopify",
      {
        isPrimary: true,
      },
    );
    await createDefaultFieldConfigs(primaryIntegrationId);
    secondaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "its-perfect",
      {
        isPrimary: false,
      },
    );
    await createDefaultFieldConfigs(secondaryIntegrationId);
  });

  it("secondary sync skips external variants with null barcode", async () => {
    // Arrange: Create existing product with barcode
    await createExistingProduct({
      brandId,
      name: "Existing Product",
      variants: [{ sku: "EXISTING-SKU", barcode: "EXISTING-BARCODE" }],
    });

    // Secondary has variant with null barcode
    const mockProduct = createMockProduct({
      title: "Product with No Barcode",
      variants: [
        createMockVariant({
          sku: "NO-BARCODE-SKU",
          barcode: null, // Missing barcode
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Skipped because no barcode to match
    expect(result.success).toBe(true);
    expect(result.variantsCreated).toBe(0);
    expect(result.variantsSkippedNoMatch).toBeGreaterThanOrEqual(1);

    // No variant links created
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(0);
  });

  it("secondary sync skips external variants with empty string barcode", async () => {
    // Arrange
    await createExistingProduct({
      brandId,
      name: "Existing Product",
      variants: [{ sku: "EXISTING-SKU", barcode: "EXISTING-BARCODE" }],
    });

    // Secondary has variant with empty barcode
    const mockProduct = createMockProduct({
      title: "Product with Empty Barcode",
      variants: [
        createMockVariant({
          sku: "EMPTY-BARCODE-SKU",
          barcode: "", // Empty barcode
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Skipped because empty barcode can't match
    expect(result.success).toBe(true);
    expect(result.variantsSkippedNoMatch).toBeGreaterThanOrEqual(1);
  });

  it("primary sync creates variants even with missing identifiers", async () => {
    // Arrange: Primary integration with variant that has no barcode
    const mockProduct = createMockProduct({
      title: "New Product No Barcode",
      variants: [
        createMockVariant({
          sku: "NEW-SKU",
          barcode: null, // Primary can still create
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: primaryIntegrationId,
      productsTotal: 1,
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Primary creates product even without barcode
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);
    expect(result.variantsCreated).toBe(1);

    // Verify variant was created with null barcode
    const allVariants = await testDb
      .select()
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.brandId, brandId));
    expect(allVariants).toHaveLength(1);
    expect(allVariants[0]!.product_variants.barcode).toBeNull();
  });
});

// =============================================================================
// ID-005: Identifier Case Sensitivity
// NOTE: Current implementation uses CASE-SENSITIVE matching.
// These tests verify that behavior for SECONDARY integrations.
// Primary integrations never match by identifier, so case sensitivity is N/A for primary.
// =============================================================================

describe("ID-005: Identifier Case Sensitivity", () => {
  let brandId: string;
  let primaryIntegrationId: string;
  let secondaryIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    // Create primary (required)
    primaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "shopify",
      {
        isPrimary: true,
      },
    );
    await createDefaultFieldConfigs(primaryIntegrationId);
    // Create secondary for case sensitivity tests
    secondaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "its-perfect",
      {
        isPrimary: false,
      },
    );
    await createDefaultFieldConfigs(secondaryIntegrationId);
  });

  it("barcode matching is case-sensitive (different case = no match for secondary)", async () => {
    // Arrange: Create existing product with lowercase barcode
    await createExistingProduct({
      brandId,
      name: "Case Test Product",
      variants: [{ sku: "CASE-SKU", barcode: "abc123xyz" }], // lowercase
    });

    // Secondary product with UPPERCASE barcode (different case)
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Secondary Case Test",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "SECONDARY-CASE-SKU",
          barcode: "ABC123XYZ", // UPPERCASE - different case
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Secondary finds NO match (case-sensitive barcode does not match)
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(0); // Secondary cannot create products
    expect(result.variantsSkippedNoMatch).toBe(1); // Variant skipped due to no match

    // Still only 1 product exists (the manually created one)
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(1);
  });

  it("exact case barcode DOES match for secondary", async () => {
    // Arrange: Create existing product with specific barcode
    const exactBarcode = "ABC123XYZ";
    const { variants } = await createExistingProduct({
      brandId,
      name: "Exact Case Test",
      variants: [{ sku: "EXACT-SKU", barcode: exactBarcode }],
    });

    // Secondary product with EXACT same barcode
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Secondary Exact Match",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "SECONDARY-EXACT-SKU",
          barcode: exactBarcode, // Exact same case
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Secondary matches (exact case barcode matches)
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(0); // Matched existing

    // Link created to existing variant
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);
    expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
  });

  it("exact case SKU matching works for secondary sync", async () => {
    // Create existing product with specific SKU
    const exactSku = "EXACT-SKU-123";
    const { variants } = await createExistingProduct({
      brandId,
      name: "SKU Match Product",
      variants: [{ sku: exactSku, barcode: null }],
    });

    // Secondary product with EXACT same SKU
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Secondary Exact SKU",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: exactSku, // Exact match
          barcode: null,
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "sku",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Secondary matches (exact case)
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(0); // Matched existing

    // Link created to existing variant
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);
    expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
  });
});
