/**
 * Field Configuration Tests - Phase 4
 *
 * Tests that field enable/disable settings are respected during sync.
 * When a field is disabled, changes from Shopify should be ignored for that field.
 *
 * Covers Tests 4.1-4.4 from the integration test plan.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
  products,
  productVariants,
  productVariantAttributes,
  brandAttributes,
  brandAttributeValues,
  productTags,
} from "@v1/db/schema";
import { syncProducts } from "../../../src/sync/engine";
import {
  testDb,
  createTestBrand,
  createTestBrandIntegration,
  createDefaultFieldConfigs,
} from "@v1/db/testing";
import { createTestSyncContext, createFieldConfigs } from "@v1/db/testing";
import {
  setMockProducts,
  clearMockProducts,
  createMockProduct,
  createMockVariant,
} from "@v1/testing/mocks/shopify";

describe("Phase 4: Field Configuration", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  // =========================================================================
  // Test 4.1: Disable Description Field
  // =========================================================================

  it("4.1 - disabled description field is not synced from Shopify", async () => {
    // Arrange: Initial sync with description enabled
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Original description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "CONFIG-001",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    // Initial sync with all fields enabled
    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial description
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product!.description).toBe("Original description");

    // Act: Update Shopify with new description, but sync with description DISABLED
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Updated description from Shopify",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "CONFIG-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    // Create context with description field disabled
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "product.description": false, // Disable description sync
      },
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Sync succeeds
    expect(result2.success).toBe(true);

    // Verify: Description was NOT updated (preserved original)
    const [unchangedProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(unchangedProduct!.description).toBe("Original description");
  });

  it("4.1b - other fields still sync when description is disabled", async () => {
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
          sku: "CONFIG-002",
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

    // Act: Update both title and description, sync with description disabled
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Updated Title",
      description: "Updated description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "CONFIG-002",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "product.description": false,
      },
    });
    await syncProducts(ctx2);

    // Assert: Title updated but description preserved
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product!.name).toBe("Updated Title");
    expect(product!.description).toBe("Original description");
  });

  // =========================================================================
  // Test 4.2: Attributes Field is Always Enabled
  // Per integration-refactor-plan.md Section 2.2:
  // "Attributes are NO LONGER a selectable field. Attributes are intrinsic
  // to product/variant structure."
  // =========================================================================

  it("4.2 - attributes are always synced regardless of field config (alwaysEnabled)", async () => {
    // Arrange: Initial sync with attributes
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantIdS = `gid://shopify/ProductVariant/${Date.now()}-S`;
    const variantIdM = `gid://shopify/ProductVariant/${Date.now()}-M`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Attribute Test Product",
      variants: [
        createMockVariant({
          id: variantIdS,
          sku: "ATTR-S",
          selectedOptions: [{ name: "Size", value: "S" }],
        }),
        createMockVariant({
          id: variantIdM,
          sku: "ATTR-M",
          selectedOptions: [{ name: "Size", value: "M" }],
        }),
      ],
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
    setMockProducts([mockProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify attributes were created
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const variants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(variants).toHaveLength(2);

    // Check attribute assignments exist
    const initialAttrs = await testDb.select().from(productVariantAttributes);
    expect(initialAttrs.length).toBeGreaterThanOrEqual(2);

    // Act: Add new variant L - even with attributes set to false in config,
    // it should STILL sync because attributes have alwaysEnabled = true
    const variantIdL = `gid://shopify/ProductVariant/${Date.now()}-L`;
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Attribute Test Product",
      variants: [
        createMockVariant({
          id: variantIdS,
          sku: "ATTR-S",
          selectedOptions: [{ name: "Size", value: "S" }],
        }),
        createMockVariant({
          id: variantIdM,
          sku: "ATTR-M",
          selectedOptions: [{ name: "Size", value: "M" }],
        }),
        createMockVariant({
          id: variantIdL,
          sku: "ATTR-L",
          selectedOptions: [{ name: "Size", value: "L" }],
        }),
      ],
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
    setMockProducts([updatedProduct]);

    // Even with attributes "disabled" in config, they should still sync
    // because variant.attributes has alwaysEnabled = true
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "variant.attributes": false, // This is IGNORED for alwaysEnabled fields
      },
    });
    const result2 = await syncProducts(ctx2);

    // Assert: New variant created
    expect(result2.success).toBe(true);
    expect(result2.variantsCreated).toBe(1);

    // Verify L variant exists
    const finalVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(finalVariants).toHaveLength(3);

    const lVariant = finalVariants.find((v) => v.sku === "ATTR-L");
    expect(lVariant).toBeDefined();

    // L variant SHOULD have attribute assignments because attributes are alwaysEnabled
    // The field config "disabled" setting is ignored for structural fields
    const lVariantAttrs = await testDb
      .select()
      .from(productVariantAttributes)
      .where(eq(productVariantAttributes.variantId, lVariant!.id));
    expect(lVariantAttrs.length).toBeGreaterThanOrEqual(1); // Has L assignment

    // Verify the L value was created
    const allAttrAssignments = await testDb
      .select()
      .from(productVariantAttributes);
    expect(allAttrAssignments.length).toBeGreaterThanOrEqual(3); // S, M, L
  });

  // =========================================================================
  // Test 4.3: Re-enable Description Field
  // =========================================================================

  it("4.3 - re-enabled description field resumes syncing from Shopify", async () => {
    // Arrange: Initial sync with description
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Initial description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "REENABLE-001",
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

    // Sync with description disabled (changes ignored)
    const updatedProduct1 = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Updated description (should be ignored)",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "REENABLE-001",
        }),
      ],
    });
    setMockProducts([updatedProduct1]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "product.description": false,
      },
    });
    await syncProducts(ctx2);

    // Verify description not updated
    const [product1] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product1!.description).toBe("Initial description");

    // Act: Re-enable description and sync with new value
    const updatedProduct2 = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Final description (should sync)",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "REENABLE-001",
        }),
      ],
    });
    setMockProducts([updatedProduct2]);

    const ctx3 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      // All fields enabled by default (description re-enabled)
    });
    const result3 = await syncProducts(ctx3);

    // Assert: Description now updated
    expect(result3.success).toBe(true);
    expect(result3.productsUpdated).toBe(1);

    const [product2] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product2!.description).toBe("Final description (should sync)");
  });

  // =========================================================================
  // Test 4.4: SKU Field is Always Enabled
  // Per integration-refactor-plan.md Section 2.2:
  // "SKU and Barcode are NO LONGER selectable fields. Instead, each secondary
  // integration must choose ONE identifier for matching. Both are always
  // synced as structural identifiers."
  // =========================================================================

  it("4.4 - SKU is always synced regardless of field config (alwaysEnabled)", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "ORIGINAL-SKU",
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

    // Verify initial SKU
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const [variant1] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(variant1!.sku).toBe("ORIGINAL-SKU");

    // Act: Change SKU in Shopify - even with SKU "disabled" in config,
    // it should STILL sync because SKU has alwaysEnabled = true
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "CHANGED-SKU",
          barcode: "1234567890",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    // Even with SKU "disabled" in config, it should still sync
    // because variant.sku has alwaysEnabled = true
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "variant.sku": false, // This is IGNORED for alwaysEnabled fields
      },
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Sync succeeds
    expect(result2.success).toBe(true);

    // SKU SHOULD be updated because SKU is alwaysEnabled
    // The field config "disabled" setting is ignored for structural fields
    const [variant2] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(variant2!.sku).toBe("CHANGED-SKU"); // Updated despite "disabled" config

    // Barcode should also be synced (it's also alwaysEnabled)
    expect(variant2!.barcode).toBe("1234567890");
  });

  it("4.4b - disabled SKU field allows barcode changes while preserving SKU", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "FIXED-SKU",
          barcode: "OLD-BARCODE",
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

    // Act: Change barcode in Shopify, SKU disabled
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "FIXED-SKU",
          barcode: "NEW-BARCODE",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "variant.sku": false,
      },
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Variant updated (barcode change detected)
    expect(result2.success).toBe(true);
    expect(result2.variantsUpdated).toBe(1);

    // Verify: Barcode updated, SKU preserved
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const [variant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(variant!.sku).toBe("FIXED-SKU");
    expect(variant!.barcode).toBe("NEW-BARCODE");
  });

  // =========================================================================
  // Additional Edge Cases
  // =========================================================================

  it("4.5 - disabling all product fields still allows variant data to sync", async () => {
    // Arrange: Initial sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Test Product",
      description: "Test description",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "PROD-DISABLED-001",
          barcode: "111",
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

    // Act: Disable all product fields, change variant barcode
    const updatedProduct = createMockProduct({
      id: productId,
      title: "New Title (ignored)",
      description: "New description (ignored)",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "PROD-DISABLED-001",
          barcode: "222",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "product.name": false,
        "product.description": false,
        "product.imagePath": false,
        "product.webshopUrl": false,
        "product.salesStatus": false,
      },
    });
    const result2 = await syncProducts(ctx2);

    // Assert: Variant updated
    expect(result2.success).toBe(true);
    expect(result2.variantsUpdated).toBe(1);

    // Verify: Product fields preserved, variant barcode updated
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product!.name).toBe("Test Product");
    expect(product!.description).toBe("Test description");

    const [variant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id))
      .limit(1);
    expect(variant!.barcode).toBe("222");
  });

  it("4.6 - disabled tags field preserves existing tags", async () => {
    // Arrange: Initial sync with tags
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const mockProduct = createMockProduct({
      id: productId,
      title: "Tagged Product",
      tags: ["Original", "Tags"],
      variants: [
        createMockVariant({
          id: variantId,
          sku: "TAG-001",
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

    // Act: Change tags in Shopify, but disable tags sync
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Tagged Product",
      tags: ["New", "Different", "Tags"],
      variants: [
        createMockVariant({
          id: variantId,
          sku: "TAG-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      enabledFields: {
        "product.tags": false,
      },
    });
    await syncProducts(ctx2);

    // Assert: Verify we still have the original 2 tags (not 3 new tags)
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    const tags = await testDb
      .select()
      .from(productTags)
      .where(eq(productTags.productId, product!.id));

    // Should have exactly 2 tags (the original ones, not the 3 new ones)
    expect(tags).toHaveLength(2);
  });
});
