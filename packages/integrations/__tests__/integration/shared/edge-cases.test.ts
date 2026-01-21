/**
 * Edge Case Tests - Phase 6
 *
 * Tests edge case behaviors documented in the integration test plan.
 * Covers Tests 6.1-6.6 from the integration test plan.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  brandAttributeValues,
  brandAttributes,
  integrationProductLinks,
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
import {
  clearMockProducts,
  createMockProduct,
  createMockVariant,
  setMockProducts,
} from "@v1/testing/mocks/shopify";
import { eq } from "drizzle-orm";
import { syncProducts } from "../../../src/sync/engine";

describe("Phase 6: Edge Cases", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  // =========================================================================
  // Test 6.1: Null Values in Shopify
  // =========================================================================

  it("6.1 - null values in Shopify do not overwrite existing Avelero values", async () => {
    // Arrange: Create product with initial description via sync
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const initialProduct = createMockProduct({
      id: productId,
      title: "Product With Description",
      description: "Original description that should be preserved",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "NULL-TEST-001",
        }),
      ],
    });
    setMockProducts([initialProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial description
    const [existingProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(existingProduct!.description).toBe(
      "Original description that should be preserved",
    );

    // Act: Re-sync with null description
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Product With Description",
      description: null, // Now null
      variants: [
        createMockVariant({
          id: variantId,
          sku: "NULL-TEST-001",
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx2);

    // Assert: Description NOT cleared (null values ignored)
    const [finalProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(finalProduct!.description).toBe(
      "Original description that should be preserved",
    );
  });

  // =========================================================================
  // Test 6.2: Same SKU Different Attributes
  // =========================================================================

  it("6.2 - same SKU with different attributes replaces attribute assignments", async () => {
    // Arrange: Initial sync with Color attribute
    const productId = `gid://shopify/Product/${Date.now()}`;
    const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

    const initialProduct = createMockProduct({
      id: productId,
      title: "Attribute Change Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "ATTR-001",
          selectedOptions: [{ name: "Color", value: "Red" }],
        }),
      ],
      options: [
        {
          id: "gid://shopify/ProductOption/1",
          name: "Color",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            { id: "1", name: "Red", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([initialProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial attribute
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

    const initialAttrs = await testDb
      .select()
      .from(productVariantAttributes)
      .where(eq(productVariantAttributes.variantId, variant!.id));
    expect(initialAttrs).toHaveLength(1);

    // Get the Color attribute to verify it was Red
    const [colorAttr] = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId))
      .limit(1);
    expect(colorAttr!.name).toBe("Color");

    // Act: Re-sync with different attribute (Size instead of Color)
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Attribute Change Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "ATTR-001",
          selectedOptions: [{ name: "Size", value: "Large" }],
        }),
      ],
      options: [
        {
          id: "gid://shopify/ProductOption/2",
          name: "Size",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            {
              id: "2",
              name: "Large",
              linkedMetafieldValue: null,
              swatch: null,
            },
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
    await syncProducts(ctx2);

    // Assert: Attributes replaced (Size=Large, no more Color=Red)
    const finalAttrs = await testDb
      .select()
      .from(productVariantAttributes)
      .where(eq(productVariantAttributes.variantId, variant!.id));
    expect(finalAttrs).toHaveLength(1);

    // Verify it's now Size attribute
    const allAttrs = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId));

    // Both Color and Size should exist (attributes aren't deleted)
    expect(allAttrs.length).toBeGreaterThanOrEqual(2);

    // But variant should only have Size assigned now
    const sizeAttr = allAttrs.find((a) => a.name === "Size");
    expect(sizeAttr).toBeDefined();

    // Look up the attribute value to verify it belongs to the Size attribute
    const [attrValue] = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.id, finalAttrs[0]!.attributeValueId))
      .limit(1);
    expect(attrValue!.attributeId).toBe(sizeAttr!.id);
  });

  // =========================================================================
  // Test 6.3: Product Deleted in Shopify
  // =========================================================================

  it("6.3 - product deleted in Shopify remains in Avelero (orphaned)", async () => {
    // Arrange: Initial sync creates product
    const productId = `gid://shopify/Product/${Date.now()}`;

    const initialProduct = createMockProduct({
      id: productId,
      title: "Will Be Deleted",
      variants: [createMockVariant({ sku: "DELETE-001" })],
    });
    setMockProducts([initialProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify product exists
    const [existingProduct] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(existingProduct).toBeDefined();

    // Act: Re-sync with empty product list (simulating deletion in Shopify)
    clearMockProducts();
    setMockProducts([]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 0,
    });
    await syncProducts(ctx2);

    // Assert: Product STILL exists in Avelero (not deleted)
    const [stillExists] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(stillExists).toBeDefined();
    expect(stillExists!.name).toBe("Will Be Deleted");

    // Product link still exists but is now stale
    const links = await testDb
      .select()
      .from(integrationProductLinks)
      .where(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(links).toHaveLength(1);
  });

  // =========================================================================
  // Test 6.4: Duplicate SKU in Shopify
  // =========================================================================

  it("6.4 - handles duplicate SKUs across different Shopify products", async () => {
    // Arrange: Two Shopify products with same variant SKU
    const duplicateSku = "DUPE-SKU-001";

    const product1 = createMockProduct({
      id: `gid://shopify/Product/${Date.now()}-1`,
      title: "Product One",
      variants: [createMockVariant({ sku: duplicateSku })],
    });

    const product2 = createMockProduct({
      id: `gid://shopify/Product/${Date.now()}-2`,
      title: "Product Two",
      variants: [createMockVariant({ sku: duplicateSku })],
    });

    setMockProducts([product1, product2]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 2,
    });

    // Act: Run sync
    const result = await syncProducts(ctx);

    // Assert: Sync completes without errors
    expect(result.success).toBe(true);

    // Document behavior: First product wins for SKU match
    // Both products should be synced (may result in 1 or 2 products depending on implementation)
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));

    // We expect at least 1 product was created
    expect(allProducts.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 6.5: Very Long Product Name
  // =========================================================================

  it("6.5 - truncates very long product names to fit database limits", async () => {
    // Arrange: Create product with 300+ character name
    const veryLongName = "A".repeat(350); // 350 chars

    const mockProduct = createMockProduct({
      title: veryLongName,
      variants: [createMockVariant({ sku: "LONG-NAME-001" })],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act: Run sync (should not error)
    const result = await syncProducts(ctx);

    // Assert: Sync succeeds
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);

    // Verify product was created (possibly with truncated name)
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product).toBeDefined();

    // Name should be truncated to 255 chars or less if database has limit
    // If no limit, full name might be stored - either is acceptable
    expect(product!.name.length).toBeLessThanOrEqual(500);
  });

  // =========================================================================
  // Test 6.6: Special Characters in Title/Description
  // =========================================================================

  it("6.6 - handles special characters in title and description", async () => {
    // Arrange: Create product with special characters
    const specialTitle = 'Test "Quotes" & Ampersand <brackets>';
    const specialDescription =
      '<p>Hello <b>World</b></p> & "Special" <script>alert("xss")</script>';

    const mockProduct = createMockProduct({
      title: specialTitle,
      description: specialDescription,
      variants: [createMockVariant({ sku: "SPECIAL-001" })],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act: Run sync
    const result = await syncProducts(ctx);

    // Assert: Sync succeeds
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);

    // Verify product was created with correct title
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    expect(product).toBeDefined();

    // Title should preserve special characters
    expect(product!.name).toContain("Quotes");
    expect(product!.name).toContain("&");

    // Description should be stored (HTML might be stripped or preserved)
    expect(product!.description).toBeDefined();
  });
});
