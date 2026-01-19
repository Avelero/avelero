/**
 * Performance & Limits Tests - Phase 8
 *
 * Tests handling of large datasets and limits.
 * Covers Tests 8.1-8.3 from the integration test plan.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  brandAttributes,
  productVariantAttributes,
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
import { createColorSizeVariants } from "@v1/testing/fixtures/shopify";
import {
  clearMockProducts,
  createMockProduct,
  createMockVariant,
  setMockProducts,
} from "@v1/testing/mocks/shopify";
import { eq } from "drizzle-orm";
import { syncProducts } from "../../../src/sync/engine";

describe("Phase 8: Performance & Limits", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  // =========================================================================
  // Test 8.1: Sync 100+ Products
  // =========================================================================

  it("8.1 - syncs 100+ products successfully", async () => {
    // Arrange: Create 120 mock products
    const productCount = 120;
    const mockProducts = [];

    for (let i = 0; i < productCount; i++) {
      mockProducts.push(
        createMockProduct({
          title: `Bulk Product ${i + 1}`,
          variants: [
            createMockVariant({
              sku: `BULK-${String(i + 1).padStart(3, "0")}`,
            }),
          ],
        }),
      );
    }

    setMockProducts(mockProducts);

    // Track progress
    let progressUpdates = 0;
    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: productCount,
      onProgress: async () => {
        progressUpdates++;
      },
    });

    // Act: Run sync
    const startTime = Date.now();
    const result = await syncProducts(ctx);
    const duration = Date.now() - startTime;

    // Assert: All products synced successfully
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(productCount);
    expect(result.variantsCreated).toBe(productCount);

    // Verify products in database
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(productCount);

    // Log performance info
    console.log(
      `[PERF] Synced ${productCount} products in ${duration}ms (${Math.round(
        productCount / (duration / 1000),
      )} products/sec)`,
    );
    console.log(`[PERF] Progress updates: ${progressUpdates}`);

    // Performance expectation: Should complete in reasonable time
    // 120 products should take less than 60 seconds in test environment
    expect(duration).toBeLessThan(60000);
  });

  // =========================================================================
  // Test 8.2: Product with 50+ Variants
  // =========================================================================

  it("8.2 - syncs product with 50+ variants", async () => {
    // Arrange: Create product with 10 colors × 5 sizes = 50 variants
    const colors = [
      "Black",
      "White",
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Purple",
      "Orange",
      "Pink",
      "Gray",
    ];
    const sizes = ["XS", "S", "M", "L", "XL"];

    const variants = createColorSizeVariants("MANY", colors, sizes);
    expect(variants).toHaveLength(50);

    const mockProduct = createMockProduct({
      title: "Many Variants Product",
      variants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Color",
          position: 1,
          linkedMetafield: null,
          optionValues: colors.map((c, i) => ({
            id: String(i + 1),
            name: c,
            linkedMetafieldValue: null,
            swatch: null,
          })),
        },
        {
          id: "gid://shopify/ProductOption/2",
          name: "Size",
          position: 2,
          linkedMetafield: null,
          optionValues: sizes.map((s, i) => ({
            id: String(i + 100),
            name: s,
            linkedMetafieldValue: null,
            swatch: null,
          })),
        },
      ],
    });

    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act: Run sync
    const startTime = Date.now();
    const result = await syncProducts(ctx);
    const duration = Date.now() - startTime;

    // Assert: All variants created
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);
    expect(result.variantsCreated).toBe(50);

    // Verify variants in database
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    const allVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(allVariants).toHaveLength(50);

    // Verify attributes created
    const attributes = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId));
    expect(attributes).toHaveLength(2); // Color and Size

    // Verify each variant has 2 attribute assignments
    for (const variant of allVariants.slice(0, 5)) {
      // Check first 5 for speed
      const variantAttrs = await testDb
        .select()
        .from(productVariantAttributes)
        .where(eq(productVariantAttributes.variantId, variant.id));
      expect(variantAttrs).toHaveLength(2);
    }

    console.log(`[PERF] Synced 1 product with 50 variants in ${duration}ms`);

    // Should complete in reasonable time
    expect(duration).toBeLessThan(30000);
  });

  // =========================================================================
  // Test 8.3: Product at 100 Variant Limit
  // =========================================================================

  it("8.3 - handles product with 100 variants", async () => {
    // Arrange: Create 100 variants (10 colors × 10 sizes)
    const colors = [
      "Black",
      "White",
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Purple",
      "Orange",
      "Pink",
      "Gray",
    ];
    const sizes = [
      "XXS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "XXXL",
      "4XL",
      "5XL",
    ];

    const variants = createColorSizeVariants("HUGE", colors, sizes);
    expect(variants).toHaveLength(100);

    const mockProduct = createMockProduct({
      title: "Maximum Variants Product",
      variants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Color",
          position: 1,
          linkedMetafield: null,
          optionValues: colors.map((c, i) => ({
            id: String(i + 1),
            name: c,
            linkedMetafieldValue: null,
            swatch: null,
          })),
        },
        {
          id: "gid://shopify/ProductOption/2",
          name: "Size",
          position: 2,
          linkedMetafield: null,
          optionValues: sizes.map((s, i) => ({
            id: String(i + 100),
            name: s,
            linkedMetafieldValue: null,
            swatch: null,
          })),
        },
      ],
    });

    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act: Run sync
    const startTime = Date.now();
    const result = await syncProducts(ctx);
    const duration = Date.now() - startTime;

    // Assert: All variants created (up to limit)
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);
    expect(result.variantsCreated).toBe(100);

    // Verify variants in database
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    const allVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(allVariants).toHaveLength(100);

    console.log(`[PERF] Synced 1 product with 100 variants in ${duration}ms`);

    // Should complete in reasonable time
    expect(duration).toBeLessThan(60000);
  });

  // =========================================================================
  // Additional: Batch Size Handling
  // =========================================================================

  it("8.4 - handles multiple batches of products correctly", async () => {
    // Arrange: Create products that will span multiple batches
    // Default batch size is typically 25-50 products
    const productCount = 75; // Should span at least 2 batches
    const mockProducts = [];

    for (let i = 0; i < productCount; i++) {
      mockProducts.push(
        createMockProduct({
          title: `Batch Product ${i + 1}`,
          variants: [
            createMockVariant({
              sku: `BATCH-${String(i + 1).padStart(3, "0")}`,
            }),
          ],
        }),
      );
    }

    setMockProducts(mockProducts);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: productCount,
    });

    // Act: Run sync
    const result = await syncProducts(ctx);

    // Assert: All products from all batches synced
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(productCount);

    // Verify all products in database
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(productCount);

    // Verify products have unique handles (no collision from batching)
    const handles = allProducts.map((p) => p.productHandle);
    const uniqueHandles = new Set(handles);
    expect(uniqueHandles.size).toBe(productCount);
  });
});
