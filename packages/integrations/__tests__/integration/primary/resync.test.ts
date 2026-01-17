/**
 * Re-Sync Tests - Phase 2 & 3
 *
 * Phase 2: Tests re-sync efficiency when no changes occur (hash matching).
 * Phase 3: Tests that changes in Shopify are detected and synced correctly.
 *
 * Covers Tests 2.1, 3.1-3.5 from the integration test plan.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
  products,
  productVariants,
  productVariantAttributes,
  brandAttributes,
  brandAttributeValues,
  integrationVariantLinks,
  integrationProductLinks,
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
  type ShopifyProductNode,
} from "@v1/testing/mocks/shopify";
import { createSizeVariants } from "@v1/testing/fixtures/shopify";

describe("Phase 2: Re-Sync (No Changes)", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  // =========================================================================
  // Test 2.1: Re-sync Without Changes
  // =========================================================================

  it("2.1 - re-sync without changes skips all variants (hash matching)", async () => {
    // Arrange: Create a product and sync it
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Original description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "RESYNC-001",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    // Initial sync
    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result1 = await syncProducts(ctx1);

    expect(result1.success).toBe(true);
    expect(result1.productsCreated).toBe(1);
    expect(result1.variantsCreated).toBe(1);

    // Act: Re-sync with the exact same data (no modifications)
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: All variants skipped due to hash match
    expect(result2.success).toBe(true);
    expect(result2.productsCreated).toBe(0);
    expect(result2.productsUpdated).toBe(0);
    expect(result2.variantsCreated).toBe(0);
    expect(result2.variantsUpdated).toBe(0);
    expect(result2.variantsSkipped).toBe(1);

    // Verify no duplicate products/variants
    const productCount = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(productCount).toHaveLength(1);

    const variantCount = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productCount[0]!.id));
    expect(variantCount).toHaveLength(1);
  });

  it("2.1b - re-sync with multiple variants skips all when unchanged", async () => {
    // Arrange: Product with 3 size variants
    const productId = `gid://shopify/Product/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Size Product",
      variants: createSizeVariants("SIZE", ["S", "M", "L"]),
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
            { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
            { id: "3", name: "L", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([mockProduct]);

    // Initial sync
    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Act: Re-sync without changes
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: All 3 variants skipped
    expect(result2.success).toBe(true);
    expect(result2.variantsSkipped).toBe(3);
    expect(result2.variantsUpdated).toBe(0);
    expect(result2.variantsCreated).toBe(0);
  });
});

describe("Phase 3: Re-Sync (With Changes)", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  // =========================================================================
  // Test 3.1: Update Product Title
  // =========================================================================

  it("3.1 - detects and syncs product title change", async () => {
    // Arrange: Initial sync with original title
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Original Title",
      description: "Test description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "TITLE-001",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial state
    const [initialProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(initialProduct!.name).toBe("Original Title");

    // Act: Update mock with new title and re-sync
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Updated Title",
      description: "Test description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "TITLE-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Product updated, not created
    expect(result2.success).toBe(true);
    expect(result2.productsCreated).toBe(0);
    expect(result2.productsUpdated).toBe(1);

    // Verify database has updated title
    const [updatedProductDb] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(updatedProductDb!.name).toBe("Updated Title");

    // Ensure only one product exists (no duplicates)
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(1);
  });

  // =========================================================================
  // Test 3.2: Update Variant SKU
  // =========================================================================

  it("3.2 - detects and syncs variant SKU change", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "OLD-SKU-001",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial SKU
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const [initialVariant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(initialVariant!.sku).toBe("OLD-SKU-001");

    // Act: Update SKU and re-sync
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "NEW-SKU-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Variant updated
    expect(result2.success).toBe(true);
    expect(result2.variantsUpdated).toBe(1);
    expect(result2.variantsCreated).toBe(0);

    // Verify database has updated SKU
    const [updatedVariant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(updatedVariant!.sku).toBe("NEW-SKU-001");
  });

  // =========================================================================
  // Test 3.3: Add New Variant
  // =========================================================================

  it("3.3 - adds new variant when Shopify product gains a size", async () => {
    // Arrange: Initial sync with S, M, L sizes
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantIds = [
      `gid://shopify/ProductVariant/${Date.now()}-S`,
      `gid://shopify/ProductVariant/${Date.now()}-M`,
      `gid://shopify/ProductVariant/${Date.now()}-L`,
    ];

    const initialVariants = ["S", "M", "L"].map((size, i) =>
      createMockVariant({
        id: variantIds[i],
        sku: `SIZE-${size}`,
        selectedOptions: [{ name: "Size", value: size }],
      }),
    );

    const mockProduct = createMockProduct({
      id: productId,
      title: "Size Product",
      variants: initialVariants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
            { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
            { id: "3", name: "L", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial state
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const initialDbVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(initialDbVariants).toHaveLength(3);

    // Act: Add XL variant and re-sync
    const xlVariantId = `gid://shopify/ProductVariant/${Date.now()}-XL`;
    const updatedVariants = [
      ...initialVariants,
      createMockVariant({
        id: xlVariantId,
        sku: "SIZE-XL",
        selectedOptions: [{ name: "Size", value: "XL" }],
      }),
    ];

    const updatedProduct = createMockProduct({
      id: productId,
      title: "Size Product",
      variants: updatedVariants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
            { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
            { id: "3", name: "L", linkedMetafieldValue: null, swatch: null },
            { id: "4", name: "XL", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: 1 new variant created, 3 skipped (unchanged)
    expect(result2.success).toBe(true);
    expect(result2.productsCreated).toBe(0);
    expect(result2.variantsCreated).toBe(1);
    expect(result2.variantsSkipped).toBe(3);

    // Verify 4 variants in database
    const finalVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(finalVariants).toHaveLength(4);

    // Verify XL variant exists with correct SKU
    const xlVariant = finalVariants.find((v) => v.sku === "SIZE-XL");
    expect(xlVariant).toBeDefined();

    // Verify XL attribute value was created
    const [sizeAttr] = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId))
      .limit(1);
    const sizeValues = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.attributeId, sizeAttr!.id));
    expect(sizeValues).toHaveLength(4);
    const valueNames = sizeValues.map((v) => v.name).sort();
    expect(valueNames).toEqual(["L", "M", "S", "XL"]);
  });

  // =========================================================================
  // Test 3.4: Remove Variant in Shopify
  // =========================================================================

  it("3.4 - orphans variant when removed from Shopify (does not delete)", async () => {
    // Arrange: Initial sync with S, M, L sizes
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantIds = [
      `gid://shopify/ProductVariant/${Date.now()}-S`,
      `gid://shopify/ProductVariant/${Date.now()}-M`,
      `gid://shopify/ProductVariant/${Date.now()}-L`,
    ];

    const initialVariants = ["S", "M", "L"].map((size, i) =>
      createMockVariant({
        id: variantIds[i],
        sku: `ORPHAN-${size}`,
        selectedOptions: [{ name: "Size", value: size }],
      }),
    );

    const mockProduct = createMockProduct({
      id: productId,
      title: "Orphan Test Product",
      variants: initialVariants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
            { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
            { id: "3", name: "L", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial state: 3 variants, all linked
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const initialDbVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(initialDbVariants).toHaveLength(3);

    const initialLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(initialLinks).toHaveLength(3);

    // Act: Remove L variant from Shopify and re-sync
    const remainingVariants = initialVariants.slice(0, 2); // Only S and M
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Orphan Test Product",
      variants: remainingVariants,
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
            { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Sync succeeds (no errors about missing variant)
    expect(result2.success).toBe(true);

    // Verify: 3 variants STILL exist in Avelero (orphan not deleted)
    const finalVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(finalVariants).toHaveLength(3);

    // Orphan variant (L) still exists
    const orphanVariant = finalVariants.find((v) => v.sku === "ORPHAN-L");
    expect(orphanVariant).toBeDefined();

    // But only S and M are linked now (L link is stale/not updated)
    // The sync doesn't delete links for variants no longer in Shopify,
    // but the L variant's link won't be updated
    const finalLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
      );
    // Links for S and M should still exist
    expect(finalLinks.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // Test 3.5: Update Product Description
  // =========================================================================

  it("3.5 - detects and syncs product description change", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Original description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "DESC-001",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial description
    const [initialProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(initialProduct!.description).toBe("Original description");

    // Act: Update description and re-sync
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Updated description with more details",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "DESC-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Product updated
    expect(result2.success).toBe(true);
    expect(result2.productsUpdated).toBe(1);
    expect(result2.productsCreated).toBe(0);

    // Verify updated description in database
    const [updatedProductDb] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(updatedProductDb!.description).toBe(
      "Updated description with more details",
    );
  });

  // =========================================================================
  // Additional Edge Case: Multiple field changes in one sync
  // =========================================================================

  it("3.6 - handles multiple field changes in single re-sync", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Original Title",
      description: "Original description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "MULTI-001",
          barcode: "1234567890",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Act: Update multiple fields and re-sync
    const updatedProduct = createMockProduct({
      id: productId,
      title: "New Title",
      description: "New description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "MULTI-002",
          barcode: "0987654321",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Both product and variant updated
    expect(result2.success).toBe(true);
    expect(result2.productsUpdated).toBe(1);
    expect(result2.variantsUpdated).toBe(1);

    // Verify all changes in database
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product!.name).toBe("New Title");
    expect(product!.description).toBe("New description");

    const [variant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(variant!.sku).toBe("MULTI-002");
    expect(variant!.barcode).toBe("0987654321");
  });
});
