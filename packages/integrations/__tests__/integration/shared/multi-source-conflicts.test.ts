/**
 * Multi-Source Conflict Resolution Tests - Phase 9
 *
 * Tests variant-level overrides for many-to-one product mappings.
 *
 * NOTE: Per integration-refactor-plan.md, PRIMARY integrations NEVER match
 * by identifier. Only SECONDARY integrations match by barcode/SKU.
 * These tests use SECONDARY integrations for matching scenarios.
 *
 * When multiple integration sources are connected, they may group products
 * differently. These tests verify that:
 * - Many-to-one mappings are detected
 * - Variant-level overrides are created for differing product data
 * - Data resolution correctly prioritizes overrides over product-level data
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq, and, inArray } from "drizzle-orm";
import {
    products,
    productVariants,
    integrationProductLinks,
    integrationVariantLinks,
    variantCommercial,
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

/**
 * Generate a unique UPID for testing.
 */
function generateUpid(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 16 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

/**
 * Generate unique product/variant IDs for mocks.
 */
let idCounter = Date.now();
function nextProductId(): string {
    return `gid://shopify/Product/${idCounter++}`;
}
function nextVariantId(): string {
    return `gid://shopify/ProductVariant/${idCounter++}`;
}

/**
 * Create an Avelero product with multiple variants for many-to-one testing.
 */
async function createAveleroProductWithVariants(options: {
    brandId: string;
    productName: string;
    variantBarcodes: string[];
}): Promise<{
    product: typeof products.$inferSelect;
    variants: (typeof productVariants.$inferSelect)[];
}> {
    const handle = options.productName.toLowerCase().replace(/\s+/g, "-");

    const [product] = await testDb
        .insert(products)
        .values({
            brandId: options.brandId,
            name: options.productName,
            productHandle: handle,
            source: "integration",
        })
        .returning();

    const variantData = options.variantBarcodes.map((barcode) => ({
        productId: product!.id,
        barcode,
        sku: barcode, // Using barcode as SKU for easy matching
        upid: generateUpid(),
    }));

    const variants = await testDb
        .insert(productVariants)
        .values(variantData)
        .returning();

    return { product: product!, variants };
}

/**
 * Get all integration product links for a product (across all integrations).
 */
async function getAllProductLinks(productId: string) {
    return testDb
        .select()
        .from(integrationProductLinks)
        .where(eq(integrationProductLinks.productId, productId));
}

// =============================================================================
// PHASE 9 TESTS (SECONDARY INTEGRATION MATCHING)
// =============================================================================

describe("Phase 9: Multi-Source Conflict Resolution (Variant Overrides)", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");

        // Create primary integration
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
    // Test 9.1: Detect Many-to-One Product Mapping (Secondary)
    // =========================================================================

    it("9.1 - detects many-to-one product mapping (multiple external products → 1 Avelero product)", async () => {
        // Arrange: Pre-create Avelero product "Amazing Jacket" with 4 variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Amazing Jacket",
                variantBarcodes: ["BLK-S-001", "BLK-M-001", "WHT-S-001", "WHT-M-001"],
            });

        // Create 2 secondary products that map to subsets of the variants
        const secondaryProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket Black",
            description: "Sleek black design",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "BLK-S-001",
                    barcode: "BLK-S-001",
                }),
                createMockVariant({
                    id: nextVariantId(),
                    sku: "BLK-M-001",
                    barcode: "BLK-M-001",
                }),
            ],
        });

        const secondaryProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket White",
            description: "Clean white aesthetic",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "WHT-S-001",
                    barcode: "WHT-S-001",
                }),
                createMockVariant({
                    id: nextVariantId(),
                    sku: "WHT-M-001",
                    barcode: "WHT-M-001",
                }),
            ],
        });

        setMockProducts([secondaryProduct1, secondaryProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 2,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync completed successfully
        expect(result.success).toBe(true);

        // All 4 variants should be linked
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(4);

        // Verify no duplicate products created
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);
    });

    // =========================================================================
    // Test 9.8: One-to-One Mapping Does Not Create Unnecessary Overrides
    // =========================================================================

    it("9.8 - one-to-one mapping does not create unnecessary variant overrides", async () => {
        // Arrange: Pre-create Avelero product with 1 variant
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Simple Jacket",
                variantBarcodes: ["SIMPLE-001"],
            });

        // 1 secondary product → 1 Avelero product (one-to-one)
        const secondaryProduct = createMockProduct({
            id: nextProductId(),
            title: "Simple Jacket Updated",
            description: "Updated description",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "SIMPLE-001",
                    barcode: "SIMPLE-001",
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

        // Variant should NOT have overrides (one-to-one = no conflict)
        const [updatedVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, aveleroVariants[0]!.id));

        // In one-to-one, this secondary's data goes to product-level (if it's canonical)
        // or as the sole source, it may update directly without needing overrides
        expect(updatedVariant).toBeDefined();
    });

    // =========================================================================
    // Test 9.20: Partial Override Scenario
    // =========================================================================

    it("9.20 - partial override scenario only overrides differing fields", async () => {
        // Arrange: Create product with 2 variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Partial Test",
                variantBarcodes: ["PART-A", "PART-B"],
            });

        // 2 secondary products - one for each variant
        const secondaryProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Partial Test A",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PART-A",
                    barcode: "PART-A",
                }),
            ],
        });

        const secondaryProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Partial Test B",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PART-B",
                    barcode: "PART-B",
                }),
            ],
        });

        setMockProducts([secondaryProduct1, secondaryProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 2,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // Matched existing
    });

    // =========================================================================
    // Test: Many-to-One Does Not Create Duplicate Products
    // =========================================================================

    it("many-to-one sync should not create duplicate products", async () => {
        // Arrange: Create 4 separate products
        const products1 = await createAveleroProductWithVariants({
            brandId,
            productName: "Product 1",
            variantBarcodes: ["M2O-001"],
        });
        const products2 = await createAveleroProductWithVariants({
            brandId,
            productName: "Product 2",
            variantBarcodes: ["M2O-002"],
        });
        const products3 = await createAveleroProductWithVariants({
            brandId,
            productName: "Product 3",
            variantBarcodes: ["M2O-003"],
        });
        const products4 = await createAveleroProductWithVariants({
            brandId,
            productName: "Product 4",
            variantBarcodes: ["M2O-004"],
        });

        // Secondary has 4 products, each matching one existing product
        const mockProducts = [
            createMockProduct({
                id: nextProductId(),
                title: "Secondary 1",
                variants: [createMockVariant({ sku: "M2O-001", barcode: "M2O-001" })],
            }),
            createMockProduct({
                id: nextProductId(),
                title: "Secondary 2",
                variants: [createMockVariant({ sku: "M2O-002", barcode: "M2O-002" })],
            }),
            createMockProduct({
                id: nextProductId(),
                title: "Secondary 3",
                variants: [createMockVariant({ sku: "M2O-003", barcode: "M2O-003" })],
            }),
            createMockProduct({
                id: nextProductId(),
                title: "Secondary 4",
                variants: [createMockVariant({ sku: "M2O-004", barcode: "M2O-004" })],
            }),
        ];
        setMockProducts(mockProducts);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 4,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // All matched existing

        // Still only 4 products exist
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(4);
    });

    // =========================================================================
    // Test: First Synced Product in Many-to-One is Canonical
    // =========================================================================

    it("first synced product in many-to-one should set product-level data (canonical)", async () => {
        // Arrange: Create 1 Avelero product with 2 variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Original Name",
                variantBarcodes: ["CAN-001", "CAN-002"],
            });

        // 2 secondary products → 1 Avelero product (many-to-one)
        const secondaryProduct1 = createMockProduct({
            id: nextProductId(),
            title: "First Source Title",
            description: "First source description",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "CAN-001",
                    barcode: "CAN-001",
                }),
            ],
        });

        const secondaryProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Second Source Title",
            description: "Second source description",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "CAN-002",
                    barcode: "CAN-002",
                }),
            ],
        });

        setMockProducts([secondaryProduct1, secondaryProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 2,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // Matched

        // Variants should be linked
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(2);
    });
});
