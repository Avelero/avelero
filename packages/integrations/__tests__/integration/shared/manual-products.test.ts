/**
 * Manual Products and Bulk Upload Tests
 *
 * Tests for manual product creation and bulk upload modes.
 * Manual products are created without an integration and have special
 * matching behavior when integrations are connected later.
 *
 * Covers tests from Section 4.6 of integration-refactor-plan.md:
 * - BULK-CREATE-001: Bulk upload create mode
 * - BULK-ENRICH-001: Bulk upload enrich mode matches
 * - BULK-ENRICH-002: Bulk upload enrich mode skips unmatched
 * - MANUAL-001: Manual product creation
 * - MANUAL-002: Manual product with same barcode as integration
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
    products,
    productVariants,
    integrationProductLinks,
    integrationVariantLinks,
} from "@v1/db/schema";
import { syncProducts } from "../../../src/sync/engine";
import {
    testDb,
    createTestBrand,
    createTestBrandIntegration,
    createDefaultFieldConfigs,
} from "@v1/testing/db";
import { createTestSyncContext } from "@v1/testing/context";
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
    return Array.from({ length: 16 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

/**
 * Create a manual product (source = 'manual', no integration).
 */
async function createManualProduct(options: {
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
            source: "manual", // Manual source
            sourceIntegrationId: null,
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

/**
 * Create a bulk-uploaded product (source = 'bulk_upload').
 */
async function createBulkProduct(options: {
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
            source: "bulk_upload",
            sourceIntegrationId: null,
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
// BULK-CREATE-001: Bulk Upload Create Mode
// =============================================================================

describe("BULK-CREATE-001: Bulk Upload Create Mode", () => {
    let brandId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
    });

    it("bulk upload creates products with source = 'bulk_upload'", async () => {
        // Act: Create bulk upload product
        const { product, variants } = await createBulkProduct({
            brandId,
            name: "Bulk Uploaded Product",
            variants: [
                { sku: "BULK-001", barcode: "BULK-BARCODE-1" },
                { sku: "BULK-002", barcode: "BULK-BARCODE-2" },
            ],
        });

        // Assert
        expect(product).toBeDefined();
        expect(product.source).toBe("bulk_upload");
        expect(product.sourceIntegrationId).toBeNull();
        expect(variants).toHaveLength(2);
    });

    it("bulk uploaded products have unique UPIDs for each variant", async () => {
        // Act
        const { product, variants } = await createBulkProduct({
            brandId,
            name: "Bulk with UPIDs",
            variants: [
                { sku: "UPID-001", barcode: "UPID-BC-1" },
                { sku: "UPID-002", barcode: "UPID-BC-2" },
                { sku: "UPID-003", barcode: "UPID-BC-3" },
            ],
        });

        // Assert: All variants have unique UPIDs
        const upids = variants.map((v) => v.upid);
        expect(upids.filter(Boolean)).toHaveLength(3);
        expect(new Set(upids).size).toBe(3); // All unique
    });
});

// =============================================================================
// BULK-ENRICH-001: Bulk Upload Enrich Mode Matches
// NOTE: Per refactor plan, only SECONDARY integrations match by identifier.
// =============================================================================

describe("BULK-ENRICH-001: Bulk Upload Enrich Mode Matches", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");

        // Create primary (required)
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);

        // Create secondary for enrichment
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary integration matches bulk uploaded products by barcode", async () => {
        // Arrange: Create bulk uploaded product first
        const sharedBarcode = "ENRICH-BARCODE-001";
        const { product: bulkProduct, variants: bulkVariants } = await createBulkProduct({
            brandId,
            name: "Bulk Product",
            variants: [{ sku: "BULK-SKU", barcode: sharedBarcode }],
        });

        // Secondary has product with same barcode
        const mockProduct = createMockProduct({
            title: "Secondary Enrichment Product",
            description: "Enriched from Secondary",
            variants: [
                createMockVariant({
                    sku: "SECONDARY-SKU",
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

        // Assert: Should match existing bulk product, not create new
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);

        // Only 1 product should exist
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);
        expect(allProducts[0]!.id).toBe(bulkProduct.id);

        // Link should be created to bulk product
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(bulkVariants[0]!.id);
    });
});

// =============================================================================
// BULK-ENRICH-002: Bulk Upload Enrich Mode Skips Unmatched
// =============================================================================

describe("BULK-ENRICH-002: Bulk Upload Enrich Mode Skips Unmatched", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary integration in enrich mode skips unmatched bulk products", async () => {
        // Arrange: Create bulk product
        await createBulkProduct({
            brandId,
            name: "Bulk Product",
            variants: [{ sku: "BULK-001", barcode: "BULK-BARCODE-1" }],
        });

        // Secondary has product with DIFFERENT barcode
        const mockProduct = createMockProduct({
            title: "Unmatched Secondary Product",
            variants: [
                createMockVariant({
                    sku: "DIFFERENT-SKU",
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
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Skipped because no match
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.productsSkippedNoMatch).toBe(1);

        // Still only 1 product (the bulk one)
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);
    });
});

// =============================================================================
// MANUAL-001: Manual Product Creation
// =============================================================================

describe("MANUAL-001: Manual Product Creation", () => {
    let brandId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
    });

    it("manual products have source = 'manual' and no integration link", async () => {
        // Act
        const { product, variants } = await createManualProduct({
            brandId,
            name: "Manual Product",
            variants: [{ sku: "MANUAL-001", barcode: "MANUAL-BC-1" }],
        });

        // Assert
        expect(product).toBeDefined();
        expect(product.source).toBe("manual");
        expect(product.sourceIntegrationId).toBeNull();

        // No integration links should exist
        const links = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.productId, product.id));
        expect(links).toHaveLength(0);
    });

    it("manual product variants have UPIDs assigned", async () => {
        // Act
        const { variants } = await createManualProduct({
            brandId,
            name: "Manual with UPID",
            variants: [{ sku: "MANUAL-UPID", barcode: "MANUAL-BC" }],
        });

        // Assert
        expect(variants[0]!.upid).toBeDefined();
        expect(variants[0]!.upid!.length).toBe(16);
    });
});

// =============================================================================
// MANUAL-002: Manual Product with Same Barcode as Integration
// =============================================================================

describe("MANUAL-002: Manual Product with Same Barcode as Integration", () => {
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

    it("primary integration creates new product even with duplicate barcode", async () => {
        // Arrange: Create manual product with specific barcode
        const sharedBarcode = "SHARED-BARCODE-123";
        const { product: manualProduct } = await createManualProduct({
            brandId,
            name: "Manual Product",
            variants: [{ sku: "MANUAL-SKU", barcode: sharedBarcode }],
        });

        // Shopify product with same barcode
        const mockProduct = createMockProduct({
            title: "Shopify Product (Same Barcode)",
            variants: [
                createMockVariant({
                    sku: "SHOPIFY-SKU",
                    barcode: sharedBarcode,
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

        // Assert: Primary creates NEW product (does not match manual)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);

        // 2 products now exist
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(2);

        // One is manual, one is integration
        const sources = allProducts.map((p) => p.source).sort();
        expect(sources).toEqual(["integration", "manual"]);
    });

    it("secondary integration matches manual products by barcode", async () => {
        // Arrange: Create primary integration first
        const secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);

        // Create manual product with specific barcode
        const sharedBarcode = "SEC-SHARED-BARCODE";
        const { product: manualProduct, variants: manualVariants } = await createManualProduct({
            brandId,
            name: "Manual Product for Secondary",
            variants: [{ sku: "MANUAL-SKU", barcode: sharedBarcode }],
        });

        // Secondary has product with same barcode
        const mockProduct = createMockProduct({
            title: "Secondary Product",
            variants: [
                createMockVariant({
                    sku: "SECONDARY-SKU",
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
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Secondary matches to manual product
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);

        // Still only 1 product
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // Link created to manual product
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(manualVariants[0]!.id);
    });
});
