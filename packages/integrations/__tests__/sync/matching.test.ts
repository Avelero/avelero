/**
 * Product Matching Tests - Phase 5
 *
 * Tests SKU/barcode matching for existing Avelero products.
 * Covers Tests 5.1-5.4 from the integration test plan.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
    products,
    productVariants,
    integrationProductLinks,
    integrationVariantLinks,
} from "@v1/db/schema";
import { syncProducts } from "../../src/sync/engine";
import {
    testDb,
    createTestBrand,
    createTestBrandIntegration,
    createDefaultFieldConfigs,
} from "../utils/test-db";
import { createTestSyncContext } from "../utils/sync-context";
import {
    setMockProducts,
    clearMockProducts,
    createMockProduct,
    createMockVariant,
} from "../utils/mock-shopify";

describe("Phase 5: Product Matching (Existing Products)", () => {
    let brandId: string;
    let brandIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
        await createDefaultFieldConfigs(brandIntegrationId);
    });

    // =========================================================================
    // Test 5.1: Match by SKU
    // =========================================================================

    it("5.1 - matches existing Avelero product by SKU (no duplicate created)", async () => {
        // Arrange: Pre-create an Avelero product with a specific SKU
        const existingSku = "MATCH-SKU-001";

        const [manualProduct] = await testDb
            .insert(products)
            .values({
                brandId,
                name: "Manual Product",
                productHandle: "manual-product",
            })
            .returning();

        const [manualVariant] = await testDb
            .insert(productVariants)
            .values({
                productId: manualProduct!.id,
                sku: existingSku,
                upid: `UPID${Date.now()}`,
            })
            .returning();

        // Create mock Shopify product with matching SKU
        const mockProduct = createMockProduct({
            title: "Shopify Product with Matching SKU",
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
            brandIntegrationId,
            productsTotal: 1,
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

        // Verify product link was created
        const productLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
        expect(productLinks).toHaveLength(1);
        expect(productLinks[0]!.productId).toBe(manualProduct!.id);

        // Verify variant link was created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(manualVariant!.id);
    });

    // =========================================================================
    // Test 5.2: Match by Barcode
    // =========================================================================

    it("5.2 - matches existing Avelero product by barcode", async () => {
        // Arrange: Pre-create an Avelero product with a specific barcode
        const existingBarcode = "1234567890123";

        const [manualProduct] = await testDb
            .insert(products)
            .values({
                brandId,
                name: "Barcode Product",
                productHandle: "barcode-product",
            })
            .returning();

        const [manualVariant] = await testDb
            .insert(productVariants)
            .values({
                productId: manualProduct!.id,
                sku: "BARCODE-SKU",
                barcode: existingBarcode,
                upid: `UPID${Date.now()}`,
            })
            .returning();

        // Create mock Shopify product with matching barcode (but different SKU)
        const mockProduct = createMockProduct({
            title: "Shopify Product with Matching Barcode",
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
            brandIntegrationId,
            productsTotal: 1,
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
        const productLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
        expect(productLinks).toHaveLength(1);
        expect(productLinks[0]!.productId).toBe(manualProduct!.id);
    });

    // =========================================================================
    // Test 5.3: No Match (New Product Created)
    // =========================================================================

    it("5.3 - creates new product when no SKU/barcode match found", async () => {
        // Arrange: Pre-create a product with a different SKU
        await testDb.insert(products).values({
            brandId,
            name: "Existing Product",
            productHandle: "existing-product",
        });

        // Create mock Shopify product with completely unique SKU
        const mockProduct = createMockProduct({
            title: "Brand New Shopify Product",
            variants: [
                createMockVariant({
                    sku: "UNIQUE-NEW-001",
                    barcode: "9999999999999",
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: New product created
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);

        // Verify 2 products exist now
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(2);

        // Verify new product has correct title
        const newProduct = allProducts.find(
            (p) => p.name === "Brand New Shopify Product"
        );
        expect(newProduct).toBeDefined();
    });

    // =========================================================================
    // Test 5.4: Partial SKU Match (Some Variants Match)
    // =========================================================================

    it("5.4 - handles partial SKU match (some variants match, others are new)", async () => {
        // Arrange: Pre-create a product with 3 variants
        const [manualProduct] = await testDb
            .insert(products)
            .values({
                brandId,
                name: "Partial Match Product",
                productHandle: "partial-match",
            })
            .returning();

        // Create 3 existing variants with known SKUs
        await testDb.insert(productVariants).values([
            {
                productId: manualProduct!.id,
                sku: "PARTIAL-1",
                upid: `UPID${Date.now()}A`,
            },
            {
                productId: manualProduct!.id,
                sku: "PARTIAL-2",
                upid: `UPID${Date.now()}B`,
            },
            {
                productId: manualProduct!.id,
                sku: "PARTIAL-3",
                upid: `UPID${Date.now()}C`,
            },
        ]);

        // Mock Shopify product with: 1 matching SKU, 2 new SKUs
        const mockProduct = createMockProduct({
            title: "Partial Match Shopify Product",
            variants: [
                createMockVariant({ sku: "PARTIAL-1" }), // Matches existing
                createMockVariant({ sku: "PARTIAL-4" }), // New
                createMockVariant({ sku: "PARTIAL-5" }), // New
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Product matched, not created
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);

        // Assert: 2 new variants created
        expect(result.variantsCreated).toBe(2);

        // Verify total variants: 3 original + 2 new = 5
        const allVariants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, manualProduct!.id));
        expect(allVariants).toHaveLength(5);

        // Verify the 2 new SKUs exist
        const skus = allVariants.map((v) => v.sku).sort();
        expect(skus).toEqual([
            "PARTIAL-1",
            "PARTIAL-2",
            "PARTIAL-3",
            "PARTIAL-4",
            "PARTIAL-5",
        ]);

        // Verify links: Only 3 variants are linked (1 matched + 2 new from Shopify)
        // PARTIAL-2 and PARTIAL-3 remain unlinked (orphaned)
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(variantLinks).toHaveLength(3);
    });
});
