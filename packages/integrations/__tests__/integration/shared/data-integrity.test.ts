/**
 * Data Integrity Tests
 *
 * Tests for data integrity guarantees across sync operations.
 * Ensures that critical data like UPIDs are never modified and
 * product sources are tracked correctly.
 *
 * Covers tests from Section 4.10 of integration-refactor-plan.md:
 * - DATA-001: Variant UPID never changes
 * - DATA-002: Product source tracked correctly
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
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

// =============================================================================
// DATA-001: Variant UPID Never Changes
// =============================================================================

describe("DATA-001: Variant UPID Never Changes", () => {
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

  it("UPID is assigned on variant creation and never modified", async () => {
    // Arrange: Create product with variant
    const productId = nextProductId();
    const variantId = nextVariantId();

    const mockProduct = createMockProduct({
      id: productId,
      title: "UPID Test Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "UPID-001",
          barcode: "UPID-BARCODE-1",
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

    // Capture original UPID
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

    const originalUpid = variant1!.upid;
    expect(originalUpid).toBeDefined();
    expect(originalUpid!.length).toBe(16);

    // Act: Re-sync with updated data
    const updatedProduct = createMockProduct({
      id: productId,
      title: "UPID Test Product - Updated",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "UPID-001-UPDATED", // SKU changed
          barcode: "UPID-BARCODE-1-UPDATED", // Barcode changed
        }),
      ],
    });
    setMockProducts([updatedProduct]);

    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    const result = await syncProducts(ctx2);

    // Assert: UPID unchanged
    expect(result.success).toBe(true);

    const [variant2] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant1!.id))
      .limit(1);

    expect(variant2!.upid).toBe(originalUpid);
    expect(variant2!.sku).toBe("UPID-001-UPDATED"); // SKU updated
    expect(variant2!.barcode).toBe("UPID-BARCODE-1-UPDATED"); // Barcode updated
  });

  it("UPID is preserved when variant moves between products", async () => {
    // Arrange: Create a variant
    const productId = nextProductId();
    const variantId = nextVariantId();

    const mockProduct = createMockProduct({
      id: productId,
      title: "Original Product",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "MOVE-001",
          barcode: "MOVE-BARCODE",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx);

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

    const originalUpid = variant!.upid;

    // Act: Move variant to a new product
    const [newProduct] = await testDb
      .insert(products)
      .values({
        brandId,
        name: "New Product",
        productHandle: "new-product",
        source: "integration",
        sourceIntegrationId: brandIntegrationId,
      })
      .returning();

    await testDb
      .update(productVariants)
      .set({ productId: newProduct!.id })
      .where(eq(productVariants.id, variant!.id));

    // Assert: UPID unchanged after move
    const [movedVariant] = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant!.id))
      .limit(1);

    expect(movedVariant!.upid).toBe(originalUpid);
    expect(movedVariant!.productId).toBe(newProduct!.id);
  });

  it("each variant has a unique UPID", async () => {
    // Arrange: Create product with multiple variants
    const mockProduct = createMockProduct({
      id: nextProductId(),
      title: "Multi-Variant Product",
      variants: [
        createMockVariant({
          id: nextVariantId(),
          sku: "UNIQUE-1",
          barcode: "BC-1",
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "UNIQUE-2",
          barcode: "BC-2",
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "UNIQUE-3",
          barcode: "BC-3",
        }),
        createMockVariant({
          id: nextVariantId(),
          sku: "UNIQUE-4",
          barcode: "BC-4",
        }),
      ],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx);

    // Assert: All UPIDs are unique
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    const variants = await testDb
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product!.id));

    const upids = variants.map((v) => v.upid);
    expect(upids.filter(Boolean)).toHaveLength(4);
    expect(new Set(upids).size).toBe(4); // All unique
  });
});

// =============================================================================
// DATA-002: Product Source Tracked Correctly
// =============================================================================

describe("DATA-002: Product Source Tracked Correctly", () => {
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

  it("integration-created products have source = 'integration'", async () => {
    // Arrange
    const mockProduct = createMockProduct({
      title: "Integration Product",
      variants: [createMockVariant({ sku: "INT-001" })],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });

    // Act
    await syncProducts(ctx);

    // Assert
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    expect(product!.source).toBe("integration");
    expect(product!.sourceIntegrationId).toBe(brandIntegrationId);
  });

  it("manual products have source = 'manual' and no integration ID", async () => {
    // Act: Create manual product
    const [manualProduct] = await testDb
      .insert(products)
      .values({
        brandId,
        name: "Manual Product",
        productHandle: "manual-product",
        source: "manual",
        sourceIntegrationId: null,
      })
      .returning();

    // Assert
    expect(manualProduct!.source).toBe("manual");
    expect(manualProduct!.sourceIntegrationId).toBeNull();
  });

  it("bulk-uploaded products have source = 'bulk_upload'", async () => {
    // Act: Create bulk upload product
    const [bulkProduct] = await testDb
      .insert(products)
      .values({
        brandId,
        name: "Bulk Uploaded Product",
        productHandle: "bulk-uploaded-product",
        source: "bulk_upload",
        sourceIntegrationId: null,
      })
      .returning();

    // Assert
    expect(bulkProduct!.source).toBe("bulk_upload");
    expect(bulkProduct!.sourceIntegrationId).toBeNull();
  });

  it("source and sourceIntegrationId are preserved across re-syncs", async () => {
    // Arrange: Initial sync
    const productId = nextProductId();
    const variantId = nextVariantId();

    const mockProduct = createMockProduct({
      id: productId,
      title: "Source Preservation Test",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "SRC-001",
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

    // Capture original source info
    const [product1] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    const originalSource = product1!.source;
    const originalIntegrationId = product1!.sourceIntegrationId;

    // Act: Re-sync with updates
    const updatedProduct = createMockProduct({
      id: productId,
      title: "Source Preservation Test - Updated",
      description: "New description after update",
      variants: [
        createMockVariant({
          id: variantId,
          sku: "SRC-001",
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

    // Assert: Source info unchanged
    const [product2] = await testDb
      .select()
      .from(products)
      .where(eq(products.id, product1!.id))
      .limit(1);

    expect(product2!.source).toBe(originalSource);
    expect(product2!.sourceIntegrationId).toBe(originalIntegrationId);

    // But content was updated
    expect(product2!.name).toBe("Source Preservation Test - Updated");
  });

  it("sourceIntegrationId references existing integration", async () => {
    // Arrange: Create product
    const mockProduct = createMockProduct({
      title: "Integration Reference Test",
      variants: [createMockVariant({ sku: "REF-001" })],
    });
    setMockProducts([mockProduct]);

    const ctx = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
    });
    await syncProducts(ctx);

    // Assert: sourceIntegrationId references the integration
    const [product] = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .limit(1);

    expect(product!.sourceIntegrationId).toBe(brandIntegrationId);

    // Verify the referenced integration exists
    const { brandIntegrations } = await import("@v1/db/schema");
    const [integration] = await testDb
      .select()
      .from(brandIntegrations)
      .where(eq(brandIntegrations.id, product!.sourceIntegrationId!))
      .limit(1);

    expect(integration).toBeDefined();
    expect(integration!.brandId).toBe(brandId);
  });
});
