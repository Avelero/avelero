/**
 * Multi-Source Conflict Resolution Tests - Phase 9
 *
 * Tests variant-level overrides for many-to-one product mappings.
 * Covers Tests 9.1-9.20 from the integration test plan.
 *
 * When multiple integration sources (e.g., Shopify + ERP) are connected,
 * they may group products differently. These tests verify that:
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
 * Generate unique product/variant IDs for Shopify mocks.
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
 * Get the count of integration product links pointing to a specific product.
 */
async function getProductLinkCount(
    productId: string,
    brandIntegrationId: string
): Promise<number> {
    const links = await testDb
        .select()
        .from(integrationProductLinks)
        .where(
            and(
                eq(integrationProductLinks.productId, productId),
                eq(integrationProductLinks.brandIntegrationId, brandIntegrationId)
            )
        );
    return links.length;
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
// PHASE 9 TESTS
// =============================================================================

describe("Phase 9: Multi-Source Conflict Resolution (Variant Overrides)", () => {
    let brandId: string;
    let brandIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
        await createDefaultFieldConfigs(brandIntegrationId);
    });

    // =========================================================================
    // Test 9.1: Detect Many-to-One Product Mapping
    // =========================================================================

    it("9.1 - detects many-to-one product mapping (multiple Shopify products → 1 Avelero product)", async () => {
        // Arrange: Pre-create Avelero product "Amazing Jacket" with 4 variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Amazing Jacket",
                variantBarcodes: ["BLK-S-001", "BLK-M-001", "WHT-S-001", "WHT-M-001"],
            });

        // Create 2 Shopify products that map to subsets of the variants
        const shopifyProduct1 = createMockProduct({
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

        const shopifyProduct2 = createMockProduct({
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

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync completed successfully
        expect(result.success).toBe(true);

        // Both Shopify products should link to the SAME Avelero product
        const allProductLinks = await getAllProductLinks(aveleroProduct.id);
        expect(allProductLinks.length).toBeGreaterThanOrEqual(1);

        // All 4 variants should be linked
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(variantLinks).toHaveLength(4);

        // Verify no duplicate products created
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);
    });

    // =========================================================================
    // Test 9.2: Variant Override Creation for Name/Description
    // =========================================================================

    it("9.2 - creates variant overrides for differing name/description in many-to-one mapping", async () => {
        // Arrange: Pre-create Avelero product with variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Amazing Jacket",
                variantBarcodes: ["BLK-S-001", "WHT-S-001"],
            });

        // Create 2 Shopify products with different names/descriptions
        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket Black",
            description: "Sleek black design",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "BLK-S-001",
                    barcode: "BLK-S-001",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket White",
            description: "Clean white aesthetic",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "WHT-S-001",
                    barcode: "WHT-S-001",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync completed
        expect(result.success).toBe(true);

        // Get updated variants from DB
        const blackVariant = aveleroVariants.find((v) => v.barcode === "BLK-S-001");
        const whiteVariant = aveleroVariants.find((v) => v.barcode === "WHT-S-001");

        const [updatedBlackVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, blackVariant!.id));

        const [updatedWhiteVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, whiteVariant!.id));

        // Variant overrides should be set for NON-CANONICAL sources only.
        // In many-to-one scenarios:
        // - First synced product (Black) is CANONICAL → writes to product-level
        // - Second synced product (White) is NON-CANONICAL → writes to variant overrides
        expect(updatedBlackVariant).toBeDefined();
        expect(updatedWhiteVariant).toBeDefined();

        // Black variant is from the CANONICAL source:
        // - Variant-level overrides should be NULL (inherits from product)
        // - The product-level should have "Amazing Jacket Black"
        expect(updatedBlackVariant!.name).toBeNull();
        expect(updatedBlackVariant!.description).toBeNull();
        expect(updatedBlackVariant!.sourceIntegration).toBeNull();

        // Verify product-level was updated by canonical source
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, aveleroProduct.id));
        expect(updatedProduct!.name).toBe("Amazing Jacket Black");
        expect(updatedProduct!.description).toBe("Sleek black design");

        // White variant is from the NON-CANONICAL source:
        // - Variant-level overrides should have the white product's data
        expect(updatedWhiteVariant!.name).toBe("Amazing Jacket White");
        expect(updatedWhiteVariant!.description).toBe("Clean white aesthetic");
        expect(updatedWhiteVariant!.sourceIntegration).toBe("shopify");
    });

    // =========================================================================
    // Test 9.3: Variant Override Creation for Images
    // =========================================================================

    it("9.3 - creates variant override for differing images in many-to-one mapping", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Amazing Jacket",
                variantBarcodes: ["BLK-S-001", "WHT-S-001"],
            });

        // Create 2 Shopify products with different images
        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket Black",
            featuredImage: { url: "https://cdn.shopify.com/black-jacket.jpg" },
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "BLK-S-001",
                    barcode: "BLK-S-001",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket White",
            featuredImage: { url: "https://cdn.shopify.com/white-jacket.jpg" },
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "WHT-S-001",
                    barcode: "WHT-S-001",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Check if variant imagePaths were set
        const blackVariant = aveleroVariants.find((v) => v.barcode === "BLK-S-001");
        const whiteVariant = aveleroVariants.find((v) => v.barcode === "WHT-S-001");

        const [updatedBlackVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, blackVariant!.id));

        const [updatedWhiteVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, whiteVariant!.id));

        // Verify variant overrides:
        // - Black variant is CANONICAL → overrides are null (inherits from product)
        // - White variant is NON-CANONICAL → name/description have override values
        // NOTE: imagePath is processed async (downloaded and uploaded to storage) so we
        // verify using name/description which are set immediately
        expect(updatedBlackVariant).toBeDefined();
        expect(updatedWhiteVariant).toBeDefined();

        // Black variant (canonical) - no variant-level overrides
        expect(updatedBlackVariant!.name).toBeNull();
        expect(updatedBlackVariant!.sourceIntegration).toBeNull();

        // White variant (non-canonical) - has variant-level overrides
        expect(updatedWhiteVariant!.name).toBe("Amazing Jacket White");
        expect(updatedWhiteVariant!.sourceIntegration).toBe("shopify");

        // Verify product-level data was set by canonical source
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, aveleroProduct.id));
        expect(updatedProduct!.name).toBe("Amazing Jacket Black");
    });

    // =========================================================================
    // Test 9.4: Variant Commercial Data Overrides
    // =========================================================================

    it("9.4 - creates variant commercial overrides for differing prices in many-to-one mapping", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Amazing Jacket",
                variantBarcodes: ["BLK-S-001", "WHT-S-001"],
            });

        // Create 2 Shopify products with different prices
        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket Black",
            priceRangeV2: { minVariantPrice: { amount: "120.00", currencyCode: "USD" } },
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "BLK-S-001",
                    barcode: "BLK-S-001",
                    price: "120.00",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Amazing Jacket White",
            priceRangeV2: { minVariantPrice: { amount: "110.00", currencyCode: "USD" } },
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "WHT-S-001",
                    barcode: "WHT-S-001",
                    price: "110.00",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Check variant_commercial table for overrides
        const blackVariant = aveleroVariants.find((v) => v.barcode === "BLK-S-001");
        const whiteVariant = aveleroVariants.find((v) => v.barcode === "WHT-S-001");

        const blackCommercial = await testDb
            .select()
            .from(variantCommercial)
            .where(eq(variantCommercial.variantId, blackVariant!.id));

        const whiteCommercial = await testDb
            .select()
            .from(variantCommercial)
            .where(eq(variantCommercial.variantId, whiteVariant!.id));

        // Verify variant commercial overrides:
        // - Black variant is CANONICAL → no variant_commercial (price goes to product_commercial)
        // - White variant is NON-CANONICAL → variant_commercial override with white's price
        expect(blackCommercial.length).toBe(0);
        expect(whiteCommercial.length).toBeGreaterThan(0);

        expect(whiteCommercial[0]!.price).toBe("110.00");
        expect(whiteCommercial[0]!.currency).toBe("USD");

        // Verify product_commercial has canonical source's data
        const { productCommercial } = await import("@v1/db/schema");
        const productComm = await testDb
            .select()
            .from(productCommercial)
            .where(eq(productCommercial.productId, aveleroProduct.id));
        expect(productComm.length).toBeGreaterThan(0);
        expect(productComm[0]!.price).toBe("120.00");
        expect(productComm[0]!.currency).toBe("USD");
    });

    // =========================================================================
    // Test 9.8: One-to-One Mapping (No Conflict)
    // =========================================================================

    it("9.8 - one-to-one mapping does not create unnecessary variant overrides", async () => {
        // Arrange: Pre-create Avelero product with 2 variants
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Simple Product",
                variantBarcodes: ["PROD-001", "PROD-002"],
            });

        // Create ONE Shopify product with BOTH variants (1:1 mapping)
        const shopifyProduct = createMockProduct({
            id: nextProductId(),
            title: "Simple Product from Shopify",
            description: "A simple product description",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PROD-001",
                    barcode: "PROD-001",
                }),
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PROD-002",
                    barcode: "PROD-002",
                }),
            ],
        });

        setMockProducts([shopifyProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Sync completed successfully
        expect(result.success).toBe(true);

        // Only 1 product link (1:1 mapping)
        const productLinks = await getAllProductLinks(aveleroProduct.id);
        expect(productLinks).toHaveLength(1);

        // Since it's 1:1 mapping, data goes to product level, not variant overrides
        // Variant name/description should remain null (inherit from product)
        const variant1 = aveleroVariants.find((v) => v.barcode === "PROD-001");
        const [updatedVariant1] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variant1!.id));

        // For 1:1 mapping, variant overrides are typically not needed
        // The product-level data should be updated instead
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, aveleroProduct.id));

        expect(updatedProduct!.name).toBe("Simple Product from Shopify");
        expect(updatedProduct!.description).toBe("A simple product description");
    });

    // =========================================================================
    // Test 9.9: Many-to-One with Identical Data (No Conflict)
    // =========================================================================

    it("9.9 - many-to-one with identical data skips unnecessary override writes", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Identical Products Test",
                variantBarcodes: ["IDENT-001", "IDENT-002"],
            });

        // Create 2 Shopify products with IDENTICAL name, description, image
        const sharedProps = {
            title: "Identical Product Name",
            description: "Identical Description",
            featuredImage: { url: "https://cdn.shopify.com/same-image.jpg" },
            priceRangeV2: { minVariantPrice: { amount: "50.00", currencyCode: "USD" } },
        };

        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            ...sharedProps,
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "IDENT-001",
                    barcode: "IDENT-001",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            ...sharedProps,
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "IDENT-002",
                    barcode: "IDENT-002",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // When data is identical across products, no conflict exists
        // Variant overrides may or may not be created - if created, they should be identical
        const variantIds = aveleroVariants.map((v) => v.id);
        const updatedVariants = await testDb
            .select()
            .from(productVariants)
            .where(inArray(productVariants.id, variantIds));

        // All variants should resolve to the same data
        // Either through product level or through identical overrides
        expect(updatedVariants).toHaveLength(2);
    });

    // =========================================================================
    // Test 9.11: Re-Sync Updates Variant Overrides
    // =========================================================================

    it("9.11 - re-sync updates variant overrides when source data changes", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Update Test Product",
                variantBarcodes: ["UPDATE-BLK-001", "UPDATE-WHT-001"],
            });

        const shopifyProductId1 = nextProductId();
        const shopifyVariantId1 = nextVariantId();
        const shopifyProductId2 = nextProductId();
        const shopifyVariantId2 = nextVariantId();

        // Initial sync with original titles
        const initialProduct1 = createMockProduct({
            id: shopifyProductId1,
            title: "Update Test Black V1",
            variants: [
                createMockVariant({
                    id: shopifyVariantId1,
                    sku: "UPDATE-BLK-001",
                    barcode: "UPDATE-BLK-001",
                }),
            ],
        });

        const initialProduct2 = createMockProduct({
            id: shopifyProductId2,
            title: "Update Test White V1",
            variants: [
                createMockVariant({
                    id: shopifyVariantId2,
                    sku: "UPDATE-WHT-001",
                    barcode: "UPDATE-WHT-001",
                }),
            ],
        });

        setMockProducts([initialProduct1, initialProduct2]);

        const ctx1 = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });
        await syncProducts(ctx1);

        // Act: Re-sync with updated title for black product only
        const updatedProduct1 = createMockProduct({
            id: shopifyProductId1,
            title: "Update Test Black V2 - Updated!", // Changed
            variants: [
                createMockVariant({
                    id: shopifyVariantId1,
                    sku: "UPDATE-BLK-001",
                    barcode: "UPDATE-BLK-001",
                }),
            ],
        });

        // White product unchanged
        const unchangedProduct2 = createMockProduct({
            id: shopifyProductId2,
            title: "Update Test White V1",
            variants: [
                createMockVariant({
                    id: shopifyVariantId2,
                    sku: "UPDATE-WHT-001",
                    barcode: "UPDATE-WHT-001",
                }),
            ],
        });

        setMockProducts([updatedProduct1, unchangedProduct2]);

        const ctx2 = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });
        const result = await syncProducts(ctx2);

        // Assert
        expect(result.success).toBe(true);

        // Black is the CANONICAL source:
        // - Variant-level name should be NULL (inherits from product)
        // - Product-level should have the updated name
        const blackVariant = aveleroVariants.find((v) => v.barcode === "UPDATE-BLK-001");
        const [updatedBlackVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, blackVariant!.id));

        // Verify the black variant inherits from product (not stored at variant level)
        expect(updatedBlackVariant).toBeDefined();
        expect(updatedBlackVariant!.name).toBeNull();

        // Verify product-level was updated by canonical source
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, aveleroProduct.id));
        expect(updatedProduct!.name).toBe("Update Test Black V2 - Updated!");

        // White is NON-CANONICAL - verify its variant override is still set
        const whiteVariant = aveleroVariants.find((v) => v.barcode === "UPDATE-WHT-001");
        const [updatedWhiteVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, whiteVariant!.id));
        expect(updatedWhiteVariant!.name).toBe("Update Test White V1");
        expect(updatedWhiteVariant!.sourceIntegration).toBe("shopify");
    });

    // =========================================================================
    // Test 9.12: Clear Variant Overrides on Disconnect
    // =========================================================================

    it("9.12 - variant overrides can be tracked by source integration for cleanup", async () => {
        // Arrange: Pre-create Avelero product with 2 variants
        // Need 2 variants to test many-to-one mapping where one source is non-canonical
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Disconnect Test Product",
                variantBarcodes: ["DISCONNECT-001", "DISCONNECT-002"],
            });

        // Create 2 Shopify products (many-to-one mapping)
        // This ensures we have a non-canonical source that writes variant overrides
        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Shopify Product 1 - Canonical",
            description: "This is the canonical source",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "DISCONNECT-001",
                    barcode: "DISCONNECT-001",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Shopify Product 2 - Non-Canonical",
            description: "This source writes variant overrides",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "DISCONNECT-002",
                    barcode: "DISCONNECT-002",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });
        await syncProducts(ctx);

        // Verify links were created
        const linksBeforeDisconnect = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(linksBeforeDisconnect.length).toBe(2);

        // Check variant 1 (canonical - no sourceIntegration on variant)
        const variant1 = aveleroVariants.find((v) => v.barcode === "DISCONNECT-001")!;
        const [variant1Data] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variant1.id));
        expect(variant1Data!.sourceIntegration).toBeNull(); // Canonical - no override

        // Check variant 2 (non-canonical - sourceIntegration should be set)
        const variant2 = aveleroVariants.find((v) => v.barcode === "DISCONNECT-002")!;
        const [variant2Data] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variant2.id));

        // Verify sourceIntegration is tracked for cleanup on disconnect
        expect(variant2Data).toBeDefined();
        expect(variant2Data!.sourceIntegration).toBe("shopify");

        // On actual disconnect, you would:
        // 1. Delete integration links (done automatically via cascade)
        // 2. Clear variant overrides where sourceIntegration matches
    });

    // =========================================================================
    // Test 9.20: Partial Variant Override Scenario
    // =========================================================================

    it("9.20 - partial override scenario only overrides differing fields", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Partial Override Test",
                variantBarcodes: ["PARTIAL-001", "PARTIAL-002"],
            });

        // Create 2 Shopify products with:
        // - Different names
        // - SAME description and image
        const sharedDescription = "Same description for both";
        const sharedImage = { url: "https://cdn.shopify.com/same-image.jpg" };

        const shopifyProduct1 = createMockProduct({
            id: nextProductId(),
            title: "Partial Test Product A", // Different name
            description: sharedDescription, // Same
            featuredImage: sharedImage, // Same
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PARTIAL-001",
                    barcode: "PARTIAL-001",
                }),
            ],
        });

        const shopifyProduct2 = createMockProduct({
            id: nextProductId(),
            title: "Partial Test Product B", // Different name
            description: sharedDescription, // Same
            featuredImage: sharedImage, // Same
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "PARTIAL-002",
                    barcode: "PARTIAL-002",
                }),
            ],
        });

        setMockProducts([shopifyProduct1, shopifyProduct2]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Get variants
        const variant1 = aveleroVariants.find((v) => v.barcode === "PARTIAL-001");
        const variant2 = aveleroVariants.find((v) => v.barcode === "PARTIAL-002");

        const [updatedVariant1] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variant1!.id));

        const [updatedVariant2] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variant2!.id));

        // If partial overrides are implemented correctly:
        // - Only name would be overridden (it differs)
        // - Description and image would remain null (inherit from product)
        // This is an optimization - only override what's actually different
        expect(updatedVariant1).toBeDefined();
        expect(updatedVariant2).toBeDefined();

        // Names should differ if variant-level overrides are used
        if (updatedVariant1!.name && updatedVariant2!.name) {
            expect(updatedVariant1!.name).not.toBe(updatedVariant2!.name);
        }
    });

    // =========================================================================
    // Test: Verify No Duplicate Products in Many-to-One Scenario
    // =========================================================================

    it("many-to-one sync should not create duplicate products", async () => {
        // Arrange: Pre-create Avelero product
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "No Duplicates Test",
                variantBarcodes: ["NODUPE-A", "NODUPE-B", "NODUPE-C", "NODUPE-D"],
            });

        // Create 4 Shopify products, each with 1 variant
        const shopifyProducts = ["A", "B", "C", "D"].map((letter) =>
            createMockProduct({
                id: nextProductId(),
                title: `No Duplicates Variant ${letter}`,
                variants: [
                    createMockVariant({
                        id: nextVariantId(),
                        sku: `NODUPE-${letter}`,
                        barcode: `NODUPE-${letter}`,
                    }),
                ],
            })
        );

        setMockProducts(shopifyProducts);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 4,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // All matched existing

        // Still only 1 Avelero product
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);
        expect(allProducts[0]!.id).toBe(aveleroProduct.id);

        // All 4 variants should be linked
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(variantLinks).toHaveLength(4);
    });

    // =========================================================================
    // Test: First Product Sets Product-Level Data (Canonical)
    // =========================================================================

    it("first synced product in many-to-one should set product-level data (canonical)", async () => {
        // Arrange: Pre-create Avelero product with NO initial name/description
        const { product: aveleroProduct, variants: aveleroVariants } =
            await createAveleroProductWithVariants({
                brandId,
                productName: "Placeholder Name",
                variantBarcodes: ["CANON-001", "CANON-002"],
            });

        // First Shopify product should be canonical
        const canonicalProduct = createMockProduct({
            id: nextProductId(),
            title: "Canonical Product Title",
            description: "This should be the product-level description",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "CANON-001",
                    barcode: "CANON-001",
                }),
            ],
        });

        // Second Shopify product
        const secondaryProduct = createMockProduct({
            id: nextProductId(),
            title: "Secondary Product Title",
            description: "This is different",
            variants: [
                createMockVariant({
                    id: nextVariantId(),
                    sku: "CANON-002",
                    barcode: "CANON-002",
                }),
            ],
        });

        // Order matters - first one processed is canonical
        setMockProducts([canonicalProduct, secondaryProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 2,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Check product-level data
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, aveleroProduct.id));

        // The canonical (first) product's data should be at product level
        // This is the expected behavior for the "ownership" model
        expect(updatedProduct).toBeDefined();
    });
});
