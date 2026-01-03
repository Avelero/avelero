/**
 * Product Matching Tests - Phase 5
 *
 * Tests SKU/barcode matching for existing Avelero products.
 * 
 * NOTE: Per the integration-refactor-plan.md, PRIMARY integrations NEVER match
 * by identifier (SKU/barcode). They only use link-based matching.
 * SECONDARY integrations DO match by identifier.
 * 
 * These tests use SECONDARY integrations to verify matching behavior.
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

function generateUpid(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 16 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

/**
 * Create an existing Avelero product with variants (simulating PRIMARY sync).
 */
async function createExistingProduct(options: {
    brandId: string;
    name: string;
    variants: Array<{ sku: string; barcode?: string | null }>;
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
        barcode: v.barcode ?? null,
        upid: generateUpid(),
    }));

    const variants = await testDb
        .insert(productVariants)
        .values(variantData)
        .returning();

    return { product: product!, variants };
}

describe("Phase 5: Product Matching (Secondary Integration)", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");

        // Create primary integration (required)
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);

        // Create secondary integration for matching tests
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    // =========================================================================
    // Test 5.1: Match by SKU (Secondary Integration)
    // =========================================================================

    it("5.1 - secondary integration matches existing product by SKU", async () => {
        // Arrange: Pre-create an Avelero product with a specific SKU
        const existingSku = "MATCH-SKU-001";

        const { product: existingProduct, variants: existingVariants } = await createExistingProduct({
            brandId,
            name: "Existing Product",
            variants: [{ sku: existingSku, barcode: null }],
        });

        // Create mock product with matching SKU for secondary
        const mockProduct = createMockProduct({
            title: "Secondary Product with Matching SKU",
            description: "Should link to existing product",
            variants: [
                createMockVariant({
                    sku: existingSku,
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

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: No new product created (matched existing)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);

        // Verify only 1 product exists (no duplicate)
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // Verify variant link was created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(existingVariants[0]!.id);
    });

    // =========================================================================
    // Test 5.2: Match by Barcode (Secondary Integration)
    // =========================================================================

    it("5.2 - secondary integration matches existing product by barcode", async () => {
        // Arrange: Pre-create an Avelero product with a specific barcode
        const existingBarcode = "1234567890123";

        const { product: existingProduct, variants: existingVariants } = await createExistingProduct({
            brandId,
            name: "Barcode Product",
            variants: [{ sku: "BARCODE-SKU", barcode: existingBarcode }],
        });

        // Create mock product with matching barcode (but different SKU)
        const mockProduct = createMockProduct({
            title: "Secondary Product with Matching Barcode",
            variants: [
                createMockVariant({
                    sku: "DIFFERENT-SKU",
                    barcode: existingBarcode,
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

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Matched by barcode, no new product created
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);

        // Verify only 1 product exists
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // Verify links created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(existingVariants[0]!.id);
    });

    // =========================================================================
    // Test 5.3: Primary Creates New Product (No Matching)
    // =========================================================================

    it("5.3 - primary creates new product even when existing product has same barcode", async () => {
        // Arrange: Pre-create a product with a barcode
        await createExistingProduct({
            brandId,
            name: "Existing Product",
            variants: [{ sku: "EXIST-SKU", barcode: "SHARED-BARCODE" }],
        });

        // Create mock Shopify product with same barcode
        const mockProduct = createMockProduct({
            title: "New Shopify Product",
            variants: [
                createMockVariant({
                    sku: "NEW-SKU",
                    barcode: "SHARED-BARCODE", // Same barcode
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: New product created (PRIMARY never matches by identifier)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);

        // Verify 2 products exist now
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(2);
    });

    // =========================================================================
    // Test 5.4: Secondary Partial Match (Some Variants Match)
    // =========================================================================

    it("5.4 - secondary handles partial match (some variants match, unmatched are skipped)", async () => {
        // Arrange: Pre-create a product with 1 variant
        const { product: existingProduct, variants: existingVariants } = await createExistingProduct({
            brandId,
            name: "Partial Match Product",
            variants: [{ sku: "PARTIAL-1", barcode: null }],
        });

        // Mock secondary product with: 1 matching SKU, 2 unmatched SKUs
        const mockProduct = createMockProduct({
            title: "Secondary Partial Match",
            variants: [
                createMockVariant({ sku: "PARTIAL-1" }), // Matches existing
                createMockVariant({ sku: "PARTIAL-2" }), // No match
                createMockVariant({ sku: "PARTIAL-3" }), // No match
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

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: No new products/variants (secondary can't create)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);
        expect(result.variantsSkippedNoMatch).toBe(2); // 2 unmatched variants skipped

        // Verify still only 1 variant
        const allVariants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, existingProduct.id));
        expect(allVariants).toHaveLength(1);

        // Verify 1 variant link created (for matching variant)
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
    });

    // =========================================================================
    // Test 5.5: Secondary No Match Skips Product
    // =========================================================================

    it("5.5 - secondary with no matching variants skips product entirely", async () => {
        // Arrange: Pre-create a product 
        await createExistingProduct({
            brandId,
            name: "Existing Product",
            variants: [{ sku: "EXIST-001", barcode: null }],
        });

        // Mock secondary product with completely different SKU
        const mockProduct = createMockProduct({
            title: "Unmatched Secondary Product",
            variants: [
                createMockVariant({ sku: "NOMATCH-001" }),
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

        // Assert: Product skipped
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.productsSkippedNoMatch).toBe(1);

        // No links created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(0);
    });
});
