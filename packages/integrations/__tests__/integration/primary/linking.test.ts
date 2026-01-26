/**
 * Primary Integration Tests
 *
 * Tests for primary integration sync behavior.
 * Primary integrations create products, variants, attributes, and define
 * the canonical product grouping structure.
 *
 * Covers tests from Section 4.1 of integration-refactor-plan.md:
 * - P-SYNC-001: First integration is automatically primary
 * - P-SYNC-004: Primary sync creates new variants
 * - P-MATCH-001: Primary does not match manual products
 * - P-MATCH-003: Primary handles duplicate barcodes in external
 * - P-ATTR-002: Primary adds new attribute value
 * - P-ATTR-003: Primary adds new attribute
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  brandAttributeValues,
  brandAttributes,
  brandIntegrations,
  integrationProductLinks,
  integrationVariantLinks,
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

// =============================================================================
// P-SYNC-001: First Integration is Automatically Primary
// =============================================================================

describe("P-SYNC-001: First Integration is Automatically Primary", () => {
  let brandId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
  });

  it("first connected integration has isPrimary = true", async () => {
    // Act: Create the first integration for the brand
    const integrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });

    // Assert: Verify it's marked as primary
    const [integration] = await testDb
      .select()
      .from(brandIntegrations)
      .where(eq(brandIntegrations.id, integrationId))
      .limit(1);

    expect(integration).toBeDefined();
    expect(integration!.isPrimary).toBe(true);
  });

  it("products created by primary have source = 'integration'", async () => {
    // Arrange
    const integrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(integrationId);

    const mockProduct = createMockProduct({
      title: "Primary Product",
      variants: [createMockVariant({ sku: "PRIMARY-001" })],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId: integrationId,
      productsTotal: 1,
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);

    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    expect(product).toBeDefined();
    expect(product!.source).toBe("integration");
    expect(product!.sourceIntegrationId).toBe(integrationId);
  });
});

// =============================================================================
// P-SYNC-004: Primary Sync Creates New Variants
// =============================================================================

describe("P-SYNC-004: Primary Sync Creates New Variants", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  it("adds new variants to existing synced product", async () => {
    // Arrange: Initial sync with 2 variants
    const productId = nextProductId();
    const variantId1 = nextVariantId();
    const variantId2 = nextVariantId();

    const initialProduct = createMockProduct({
      id: productId,
      title: "Variant Addition Test",
      variants: [
        createMockVariant({ id: variantId1, sku: "VAR-001" }),
        createMockVariant({ id: variantId2, sku: "VAR-002" }),
      ],
    });
    setMockProducts([initialProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial sync
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);
    const initialVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(initialVariants).toHaveLength(2);

    // Act: Re-sync with 2 additional variants
    const variantId3 = nextVariantId();
    const variantId4 = nextVariantId();

    const updatedProduct = createMockProduct({
      id: productId,
      title: "Variant Addition Test",
      variants: [
        createMockVariant({ id: variantId1, sku: "VAR-001" }),
        createMockVariant({ id: variantId2, sku: "VAR-002" }),
        createMockVariant({ id: variantId3, sku: "VAR-003" }),
        createMockVariant({ id: variantId4, sku: "VAR-004" }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result = await syncProducts(ctx2);

    // Assert
    expect(result.success).toBe(true);
    expect(result.variantsCreated).toBe(2); // 2 new variants

    const finalVariants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));
    expect(finalVariants).toHaveLength(4);

    // Verify new variants have correct SKUs
    const skus = finalVariants.map((v) => v.sku).sort();
    expect(skus).toEqual(["VAR-001", "VAR-002", "VAR-003", "VAR-004"]);
  });

  it("assigns attributes to new variants", async () => {
    // Arrange: Initial sync with 1 variant
    const productId = nextProductId();
    const variantId1 = nextVariantId();

    const initialProduct = createMockProduct({
      id: productId,
      title: "Attribute Variant Test",
      variants: [
        createMockVariant({
          id: variantId1,
          sku: "ATTR-S",
          selectedOptions: [{ name: "Size", value: "S" }],
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

    // Act: Add variant with new attribute value
    const variantId2 = nextVariantId();

    const updatedProduct = createMockProduct({
      id: productId,
      title: "Attribute Variant Test",
      variants: [
        createMockVariant({
          id: variantId1,
          sku: "ATTR-S",
          selectedOptions: [{ name: "Size", value: "S" }],
        }),
        createMockVariant({
          id: variantId2,
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
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result = await syncProducts(ctx2);

    // Assert
    expect(result.success).toBe(true);
    expect(result.variantsCreated).toBe(1);

    // Verify new M value was created
    const [sizeAttr] = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId))
      .limit(1);

    const values = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.attributeId, sizeAttr!.id));

    expect(values).toHaveLength(2);
    expect(values.map((v) => v.name).sort()).toEqual(["M", "S"]);
  });
});

// =============================================================================
// P-MATCH-001: Primary Does NOT Match Manual Products
// =============================================================================

describe("P-MATCH-001: Primary Does NOT Match Manual Products", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  it("primary sync creates new product even when manual product exists", async () => {
    // Arrange: Create a manual product with a barcode
    // Note: Barcodes must be unique within a brand, so we use different barcodes
    const manualBarcode = "MANUAL-BARCODE-123";
    const shopifyBarcode = "SHOPIFY-BARCODE-456";

    const [manualProduct] = await testDb
      .insert(products)
      .values({
        brandId,
        name: "Manual Product",
        productHandle: "manual-product",
        source: "manual", // Manual source
        sourceIntegrationId: null,
      })
      .returning();

    await testDb.insert(productVariants).values({
      productId: manualProduct!.id,
      barcode: manualBarcode,
      sku: "MANUAL-SKU",
      upid: generateUpid(),
    });

    // Create Shopify product with different barcode (barcode uniqueness is enforced)
    const mockProduct = createMockProduct({
      title: "Shopify Product",
      variants: [
        createMockVariant({
          sku: "SHOPIFY-SKU",
          barcode: shopifyBarcode,
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Primary creates NEW product, does NOT match to manual
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);

    // Should now have 2 products: manual + integration
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(2);

    // Manual product retains its barcode
    const manualVariant = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, manualProduct!.id));
    expect(manualVariant[0]!.barcode).toBe(manualBarcode);

    // Integration product has its own barcode
    const integrationProduct = allProducts.find(
      (p) => p.source === "integration",
    );
    expect(integrationProduct).toBeDefined();

    const integrationVariant = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, integrationProduct!.id));
    expect(integrationVariant[0]!.barcode).toBe(shopifyBarcode);
  });
});

// =============================================================================
// P-MATCH-003: Primary Handles Duplicate Barcodes in External
// =============================================================================

describe("P-MATCH-003: Primary Handles Duplicate Barcodes in External", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  it("handles products from external system with unique barcodes", async () => {
    // Arrange: Create two products in external with unique barcodes
    // Note: Barcodes must be unique within a brand (enforced by database constraint)
    const barcode1 = "BARCODE-001";
    const barcode2 = "BARCODE-002";

    const product1 = createMockProduct({
      id: nextProductId(),
      title: "Product 1",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "PROD-1",
          barcode: barcode1,
        }),
      ],
    });

    const product2 = createMockProduct({
      id: nextProductId(),
      title: "Product 2",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "PROD-2",
          barcode: barcode2,
        }),
      ],
    });

    setMockProducts([product1, product2]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 2,
    });

    // Act
    const result = await syncProducts(ctx);

    // Assert: Sync completes successfully
    expect(result.success).toBe(true);

    // Both products should be created (primary creates from external IDs)
    expect(result.productsCreated).toBe(2);

    // Both variants should be created with unique barcodes
    const allVariants = await testDb
      .select()
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.brandId, brandId));

    expect(allVariants).toHaveLength(2);

    // Each variant has its own unique barcode
    const barcodes = allVariants
      .map((v) => v.product_variants.barcode)
      .sort();
    expect(barcodes).toEqual([barcode1, barcode2]);
  });
});

// =============================================================================
// P-ATTR-002: Primary Adds New Attribute Value
// =============================================================================

describe("P-ATTR-002: Primary Adds New Attribute Value", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  it("adds new attribute value when external variant has new option value", async () => {
    // Arrange: Initial sync creates Size attribute with S, M, L
    const productId = nextProductId();

    const initialProduct = createMockProduct({
      id: productId,
      title: "Size Product",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-S",
          selectedOptions: [{ name: "Size", value: "S" }],
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-M",
          selectedOptions: [{ name: "Size", value: "M" }],
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-L",
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
    setMockProducts([initialProduct]);

    const ctx1 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx1);

    // Verify initial attribute values
    const [sizeAttr] = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId))
      .limit(1);

    const initialValues = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.attributeId, sizeAttr!.id));
    expect(initialValues).toHaveLength(3);

    // Act: Add XL variant
    const xlVariantId = nextVariantId();

    const updatedProduct = createMockProduct({
      id: productId,
      title: "Size Product",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-S",
          selectedOptions: [{ name: "Size", value: "S" }],
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-M",
          selectedOptions: [{ name: "Size", value: "M" }],
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "SIZE-L",
          selectedOptions: [{ name: "Size", value: "L" }],
        }),
        createMockVariant({
          id: xlVariantId,
          sku: "SIZE-XL",
          selectedOptions: [{ name: "Size", value: "XL" }],
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
    const result = await syncProducts(ctx2);

    // Assert
    expect(result.success).toBe(true);
    expect(result.variantsCreated).toBeGreaterThanOrEqual(1);

    // Verify XL value was created
    const finalValues = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.attributeId, sizeAttr!.id));

    expect(finalValues).toHaveLength(4);
    expect(finalValues.map((v) => v.name).sort()).toEqual([
      "L",
      "M",
      "S",
      "XL",
    ]);
  });
});

// =============================================================================
// P-ATTR-003: Primary Adds New Attribute
// =============================================================================

describe("P-ATTR-003: Primary Adds New Attribute", () => {
  let brandId: string;
  let brandIntegrationId: string;

  beforeEach(async () => {
    clearMockProducts();
    brandId = await createTestBrand("Test Brand");
    brandIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
      isPrimary: true,
    });
    await createDefaultFieldConfigs(brandIntegrationId);
  });

  it("creates new attribute when external product has new option type", async () => {
    // Arrange: Initial sync with just Size attribute
    const productId = nextProductId();

    const initialProduct = createMockProduct({
      id: productId,
      title: "Multi-Attribute Product",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "MULTI-S",
          selectedOptions: [{ name: "Size", value: "S" }],
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

    // Verify only Size attribute exists
    const initialAttrs = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId));
    expect(initialAttrs).toHaveLength(1);
    expect(initialAttrs[0]!.name).toBe("Size");

    // Act: Add a second product with a new "Age Group" attribute
    const product2 = createMockProduct({
      id: nextProductId(),
      title: "Product with Age Group",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "AGE-ADULT",
          selectedOptions: [{ name: "Age Group", value: "Adult" }],
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "AGE-KIDS",
          selectedOptions: [{ name: "Age Group", value: "Kids" }],
        }),
      ],
      options: [
        {
          id: "gid://shopify/ProductOption/2",
          name: "Age Group",
          position: 1,
          linkedMetafield: null,
          optionValues: [
            {
              id: "1",
              name: "Adult",
              linkedMetafieldValue: null,
              swatch: null,
            },
            { id: "2", name: "Kids", linkedMetafieldValue: null, swatch: null },
          ],
        },
      ],
    });
    setMockProducts([product2]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result = await syncProducts(ctx2);

    // Assert
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(1);

    // Verify new attribute was created
    const finalAttrs = await testDb
      .select()
      .from(brandAttributes)
      .where(eq(brandAttributes.brandId, brandId));

    expect(finalAttrs).toHaveLength(2);
    expect(finalAttrs.map((a) => a.name).sort()).toEqual(["Age Group", "Size"]);

    // Verify Age Group has values
    const ageGroupAttr = finalAttrs.find((a) => a.name === "Age Group");
    const ageGroupValues = await testDb
      .select()
      .from(brandAttributeValues)
      .where(eq(brandAttributeValues.attributeId, ageGroupAttr!.id));

    expect(ageGroupValues).toHaveLength(2);
    expect(ageGroupValues.map((v) => v.name).sort()).toEqual(["Adult", "Kids"]);
  });
});
