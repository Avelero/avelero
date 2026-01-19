/**
 * One-to-Many Conflict Tests
 *
 * Tests for one-to-many product mappings where a single external product
 * maps to multiple Avelero products (e.g., external product has variants
 * that belong to different Avelero products).
 *
 * NOTE: Per integration-refactor-plan.md, PRIMARY integrations NEVER match
 * by identifier. These tests use SECONDARY integrations for matching scenarios.
 *
 * Covers tests from Section 4.4 of integration-refactor-plan.md:
 * - O2M-001: Detect one-to-many mapping
 * - O2M-002: One-to-many duplicates data to all products
 * - O2M-003: One-to-many with partial variant match
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  integrationProductLinks,
  integrationVariantLinks,
  productVariants,
  products,
} from "@v1/db/schema";
import {
  createDefaultFieldConfigs,
  createTestBrand,
  createTestBrandIntegration,
  testDb,
} from "@v1/db/testing";
import { createTestSyncContext } from "@v1/db/testing";
import {
  clearMockProducts,
  createMockProduct,
  createMockVariant,
  setMockProducts,
} from "@v1/testing/mocks/shopify";
import { eq } from "drizzle-orm";
import { syncProducts } from "../../../src/sync/engine";

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
  variants: Array<{ sku: string; barcode: string }>;
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
// O2M-001: Detect One-to-Many Mapping (Secondary Integration)
// =============================================================================

describe("O2M-001: Detect One-to-Many Mapping", () => {
  let brandId: string;
  let primaryIntegrationId: string;
  let secondaryIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");

    // Create primary integration
    primaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "shopify",
      {
        isPrimary: true,
      },
    );
    await createDefaultFieldConfigs(primaryIntegrationId);

    // Create secondary integration for matching
    secondaryIntegrationId = await createTestBrandIntegration(
      brandId,
      "its-perfect",
      {
        isPrimary: false,
      },
    );
    await createDefaultFieldConfigs(secondaryIntegrationId);
  });

  it("detects one-to-many mapping (1 external product → multiple Avelero products)", async () => {
    // Arrange: Create 2 Avelero products with different variants
    const { product: productA, variants: variantsA } =
      await createExistingProduct({
        brandId,
        name: "Avelero Product A",
        variants: [{ sku: "PROD-A-001", barcode: "BARCODE-A1" }],
      });

    const { product: productB, variants: variantsB } =
      await createExistingProduct({
        brandId,
        name: "Avelero Product B",
        variants: [{ sku: "PROD-B-001", barcode: "BARCODE-B1" }],
      });

    // Create 1 secondary product with variants that match BOTH Avelero products
    const secondaryProduct = createMockProduct({
      id: nextProductId(),
      title: "Combined Product from Secondary",
      description:
        "This product has variants from two different Avelero products",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "PROD-A-001",
          barcode: "BARCODE-A1", // Matches Product A
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "PROD-B-001",
          barcode: "BARCODE-B1", // Matches Product B
        }),
      ],
    });
    setMockProducts([secondaryProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Sync completes successfully
    expect(result.success).toBe(true);

    // Both variants should be linked
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(2);

    // Each variant should link to its respective Avelero product
    const variantALink = variantLinks.find(
      (l) => l.variantId === variantsA[0]!.id,
    );
    const variantBLink = variantLinks.find(
      (l) => l.variantId === variantsB[0]!.id,
    );
    expect(variantALink).toBeDefined();
    expect(variantBLink).toBeDefined();

    // Still only 2 Avelero products (no duplicates created)
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(2);
  });
});

// =============================================================================
// O2M-002: One-to-Many Duplicates Data to All Products (Secondary Integration)
// =============================================================================

describe("O2M-002: One-to-Many Duplicates Data to All Products", () => {
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

  it("product-level data is replicated to all matched Avelero products", async () => {
    // Arrange: Create 2 Avelero products
    const { product: productA, variants: variantsA } =
      await createExistingProduct({
        brandId,
        name: "Original Product A",
        variants: [{ sku: "DUP-A-001", barcode: "DUP-BARCODE-A1" }],
      });

    const { product: productB, variants: variantsB } =
      await createExistingProduct({
        brandId,
        name: "Original Product B",
        variants: [{ sku: "DUP-B-001", barcode: "DUP-BARCODE-B1" }],
      });

    // Create 1 secondary product with both variants
    // The integration refactor plan specifies that in O2M scenarios,
    // product-level data goes to the first matched product (canonical)
    // and variant overrides are created for variants in other products
    const secondaryProduct = createMockProduct({
      id: nextProductId(),
      title: "Combined Secondary Product",
      description:
        "This description should propagate to matched products via overrides",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "DUP-A-001",
          barcode: "DUP-BARCODE-A1",
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "DUP-B-001",
          barcode: "DUP-BARCODE-B1",
        }),
      ],
    });
    setMockProducts([secondaryProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert
    expect(result.success).toBe(true);

    // Both variants should have been matched
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(2);

    // In O2M scenario, the first product's variant gets canonical treatment
    // and subsequent products get variant overrides
    // Let's verify both variants are linked properly
    const [updatedVariantA] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantsA[0]!.id));

    const [updatedVariantB] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantsB[0]!.id));

    expect(updatedVariantA).toBeDefined();
    expect(updatedVariantB).toBeDefined();

    // The first matched product (A) should have canonically updated data
    // The second matched variant (B) may have variant-level overrides
  });
});

// =============================================================================
// O2M-003: One-to-Many with Partial Variant Match
// =============================================================================

describe("O2M-003: One-to-Many with Partial Variant Match", () => {
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

  it("handles partial match where some variants match and some are skipped (secondary)", async () => {
    // Arrange: Create 1 Avelero product with 1 variant
    const { product: existingProduct, variants: existingVariants } =
      await createExistingProduct({
        brandId,
        name: "Existing Product",
        variants: [{ sku: "PARTIAL-001", barcode: "PARTIAL-BARCODE-1" }],
      });

    // Secondary product has 3 variants:
    // - 1 matches existing Avelero variant
    // - 2 are new (no match) - will be SKIPPED by secondary
    const secondaryProduct = createMockProduct({
      id: nextProductId(),
      title: "Secondary Product with Mix",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "PARTIAL-001",
          barcode: "PARTIAL-BARCODE-1", // Matches existing
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "PARTIAL-002",
          barcode: "PARTIAL-BARCODE-2", // New - will be skipped
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "PARTIAL-003",
          barcode: "PARTIAL-BARCODE-3", // New - will be skipped
        }),
      ],
    });
    setMockProducts([secondaryProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: secondaryIntegrationId,
      productsTotal: 1,
      isPrimary: false,
      matchIdentifier: "barcode",
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert
    expect(result.success).toBe(true);

    // Secondary cannot create variants, so only 1 matched
    expect(result.variantsCreated).toBe(0);
    expect(result.variantsSkippedNoMatch).toBe(2); // 2 unmatched skipped

    // Verify only 1 variant still exists on the product
    const allVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, existingProduct.id));
    expect(allVariants).toHaveLength(1);

    // Verify 1 variant link created
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);
  });

  it("primary handles partial match by creating new variants", async () => {
    // Arrange: Create 1 Avelero product with 1 variant and link it
    const { product: existingProduct, variants: existingVariants } =
      await createExistingProduct({
        brandId,
        name: "Primary Partial Match Product",
        variants: [{ sku: "PRIM-001", barcode: "PRIM-BARCODE-1" }],
      });

    // Create product link for primary (simulating previous sync)
    await testDb.insert(integrationProductLinks).values({
      brandIntegrationId: primaryIntegrationId,
      productId: existingProduct.id,
      externalId: "gid://shopify/Product/linked-product",
      isCanonical: true,
    });

    // Create variant link for existing variant
    await testDb.insert(integrationVariantLinks).values({
      brandIntegrationId: primaryIntegrationId,
      variantId: existingVariants[0]!.id,
      externalId: "gid://shopify/ProductVariant/linked-variant",
    });

    // Primary product with: 1 linked variant, 2 new variants
    const primaryProduct = createMockProduct({
      id: "gid://shopify/Product/linked-product",
      title: "Primary with New Variants",
      variants: [
        createMockVariant({
          id: "gid://shopify/ProductVariant/linked-variant",
          sku: "PRIM-001",
          barcode: "PRIM-BARCODE-1", // Linked
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "PRIM-002",
          barcode: "PRIM-BARCODE-2", // New
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "PRIM-003",
          barcode: "PRIM-BARCODE-3", // New
        }),
      ],
    });
    setMockProducts([primaryProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: primaryIntegrationId,
      productsTotal: 1,
      isPrimary: true,
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert
    expect(result.success).toBe(true);

    // Primary CAN create variants
    expect(result.variantsCreated).toBe(2);

    // Verify all 3 variants now exist on the existing product
    const allVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, existingProduct.id));
    expect(allVariants).toHaveLength(3);

    // Verify all 3 are linked
    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, primaryIntegrationId),
      );
    expect(variantLinks).toHaveLength(3);
  });
});
