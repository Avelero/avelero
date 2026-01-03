/**
 * Promotion Re-Grouping Integration Tests
 *
 * Tests for the primary integration promotion process and product re-grouping.
 * When a secondary integration is promoted to primary, products are re-grouped
 * according to the new primary's external structure.
 *
 * This file tests the ACTUAL promoteIntegrationToPrimary() function end-to-end.
 *
 * Covers Phase 2 of Test-refactor-plan.md:
 * - Full promotion workflow calling promoteIntegrationToPrimary()
 * - Variant re-parenting
 * - Product archives (empty products archived)
 * - Attribute re-creation
 * - Link updates
 * - Orphaned variants stay in place
 * - UPIDs never change
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { eq, and } from "drizzle-orm";
import {
    products,
    productVariants,
    brandIntegrations,
    integrationProductLinks,
    integrationVariantLinks,
    brandAttributes,
    brandAttributeValues,
    productVariantAttributes,
} from "@v1/db/schema";
import {
    testDb,
    createTestBrand,
    createTestBrandIntegration,
    createDefaultFieldConfigs,
} from "@v1/testing/db";
import { promoteIntegrationToPrimary } from "../../../src/sync/promotion";
import { registerConnector, unregisterConnector } from "../../../src/connectors/registry";
import { syncProducts } from "../../../src/sync/engine";
import { createTestSyncContext } from "@v1/testing/context";
import {
    setMockProducts,
    clearMockProducts,
    createMockProduct,
    createMockVariant,
} from "@v1/testing/mocks/shopify";
import {
    setItsPerfectMockProducts,
    clearItsPerfectMockProducts,
    createItsPerfectMockProduct,
    createItsPerfectMockVariant,
    getMockItsPerfectConnector,
} from "@v1/testing/mocks/its-perfect";

// Register mock It's Perfect connector for promotion tests
beforeAll(() => {
    registerConnector(getMockItsPerfectConnector() as Parameters<typeof registerConnector>[0]);
});

afterAll(() => {
    unregisterConnector("its-perfect");
});

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
 * Create an Avelero product with variants and links to an integration.
 */
async function createLinkedProduct(options: {
    brandId: string;
    brandIntegrationId: string;
    name: string;
    variants: Array<{
        sku: string;
        barcode: string;
        externalId: string;
        externalProductId: string;
        attributes?: Array<{ name: string; value: string }>;
    }>;
    externalProductId: string;
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
            sourceIntegrationId: options.brandIntegrationId,
        })
        .returning();

    // Create product link
    await testDb.insert(integrationProductLinks).values({
        brandIntegrationId: options.brandIntegrationId,
        productId: product!.id,
        externalId: options.externalProductId,
        isCanonical: true,
    });

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

    // Create variant links
    for (let i = 0; i < variants.length; i++) {
        await testDb.insert(integrationVariantLinks).values({
            brandIntegrationId: options.brandIntegrationId,
            variantId: variants[i]!.id,
            externalId: options.variants[i]!.externalId,
            externalProductId: options.variants[i]!.externalProductId,
        });
    }

    return { product: product!, variants };
}

/**
 * Create mock credentials for testing.
 */
function createMockCredentials() {
    return {
        accessToken: "test-access-token",
        shopDomain: "test-shop.myshopify.com",
    };
}

// =============================================================================
// FULL PROMOTION WORKFLOW TESTS
// =============================================================================

describe("Promotion: Full End-to-End Workflow", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

        brandId = await createTestBrand("Test Brand");

        // Create primary (Shopify) integration
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);

        // Create secondary (It's Perfect) integration - will be promoted
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("successfully completes promotion and returns success status", async () => {
        // Arrange: Create a product via primary sync
        const primaryVariant = createMockVariant({
            sku: "PROMO-001",
            barcode: "BARCODE-001",
        });
        setMockProducts([
            createMockProduct({
                title: "Primary Product",
                variants: [primaryVariant],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary mock - same barcode, different grouping (name)
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Secondary Product Name",
                variants: [
                    createItsPerfectMockVariant({
                        sku: "SEC-001",
                        barcode: "BARCODE-001", // Same barcode as primary
                    }),
                ],
            }),
        ]);

        // Act: Promote secondary to primary
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.operationId).toBeDefined();
        expect(result.stats.phase).toBe("completed");
    });

    it("updates isPrimary flags after promotion", async () => {
        // Arrange: Set up products
        setMockProducts([
            createMockProduct({
                title: "Test Product",
                variants: [createMockVariant({ barcode: "BC-001" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary mock
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Secondary Product",
                variants: [
                    createItsPerfectMockVariant({ barcode: "BC-001" }),
                ],
            }),
        ]);

        // Act: Promote secondary
        await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert: Check isPrimary flags
        const [oldPrimary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, primaryIntegrationId));

        const [newPrimary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, secondaryIntegrationId));

        expect(oldPrimary!.isPrimary).toBe(false);
        expect(newPrimary!.isPrimary).toBe(true);
    });
});

// =============================================================================
// VARIANT RE-PARENTING TESTS
// =============================================================================

describe("Promotion: Variant Re-Parenting", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("moves variants to match new primary's grouping (3→1 merge)", async () => {
        // Arrange: Create 3 products in primary (by color)
        // Primary has: Product Black (BLK-S), Product White (WHT-S), Product Red (RED-S)
        const blkProduct = createMockProduct({
            title: "Product Black",
            variants: [createMockVariant({ sku: "BLK-S", barcode: "BC-BLK-S" })],
        });
        const whtProduct = createMockProduct({
            title: "Product White",
            variants: [createMockVariant({ sku: "WHT-S", barcode: "BC-WHT-S" })],
        });
        const redProduct = createMockProduct({
            title: "Product Red",
            variants: [createMockVariant({ sku: "RED-S", barcode: "BC-RED-S" })],
        });
        setMockProducts([blkProduct, whtProduct, redProduct]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 3,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Get initial product count
        const productsBefore = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(productsBefore).toHaveLength(3);

        // Set up secondary mock - single product with all 3 variants
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Universal Jacket",
                variants: [
                    createItsPerfectMockVariant({ sku: "UNI-BLK", barcode: "BC-BLK-S" }),
                    createItsPerfectMockVariant({ sku: "UNI-WHT", barcode: "BC-WHT-S" }),
                    createItsPerfectMockVariant({ sku: "UNI-RED", barcode: "BC-RED-S" }),
                ],
            }),
        ]);

        // Act: Promote secondary
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        expect(result.success).toBe(true);

        // Assert: All 3 variants should now be in one product
        const allVariants = await testDb
            .select()
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(eq(products.brandId, brandId));

        expect(allVariants).toHaveLength(3);

        // All variants should have the same productId (merged into one product)
        const productIds = [...new Set(allVariants.map((v) => v.product_variants.productId))];
        expect(productIds).toHaveLength(1);

        // Stats should show variants moved
        expect(result.stats.variantsMoved).toBeGreaterThanOrEqual(2); // At least 2 needed to move
    });

    it("splits variants when new primary has finer granularity (1→3 split)", async () => {
        // Arrange: Create 1 product in primary with 3 variants
        const combinedProduct = createMockProduct({
            title: "Combined Product",
            variants: [
                createMockVariant({ sku: "BLK-S", barcode: "BC-BLK" }),
                createMockVariant({ sku: "WHT-S", barcode: "BC-WHT" }),
                createMockVariant({ sku: "RED-S", barcode: "BC-RED" }),
            ],
        });
        setMockProducts([combinedProduct]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Verify initial state: 1 product with 3 variants
        const productsBefore = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(productsBefore).toHaveLength(1);

        // Set up secondary mock - 3 separate products (by color)
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Black Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-BLK" })],
            }),
            createItsPerfectMockProduct({
                name: "White Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-WHT" })],
            }),
            createItsPerfectMockProduct({
                name: "Red Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-RED" })],
            }),
        ]);

        // Act: Promote secondary
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        expect(result.success).toBe(true);

        // Assert: Now 3 products should exist (excluding archived ones)
        const productsAfter = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));

        expect(productsAfter).toHaveLength(3);

        // Each product should have 1 variant
        for (const product of productsAfter) {
            const variants = await testDb
                .select()
                .from(productVariants)
                .where(eq(productVariants.productId, product.id));
            expect(variants).toHaveLength(1);
        }
    });
});

// =============================================================================
// UPID PRESERVATION TESTS
// =============================================================================

describe("Promotion: UPID Preservation", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("preserves UPIDs when variants are re-parented", async () => {
        // Arrange: Create products
        setMockProducts([
            createMockProduct({
                title: "Product A",
                variants: [createMockVariant({ sku: "VAR-1", barcode: "BC-1" })],
            }),
            createMockProduct({
                title: "Product B",
                variants: [createMockVariant({ sku: "VAR-2", barcode: "BC-2" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 2,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Capture UPIDs before promotion
        const variantsBefore = await testDb
            .select()
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(eq(products.brandId, brandId));

        const upidMap = new Map<string, string>();
        for (const v of variantsBefore) {
            upidMap.set(v.product_variants.barcode!, v.product_variants.upid!);
        }
        expect(upidMap.size).toBe(2);

        // Set up secondary mock - merge into one product
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Merged Product",
                variants: [
                    createItsPerfectMockVariant({ barcode: "BC-1" }),
                    createItsPerfectMockVariant({ barcode: "BC-2" }),
                ],
            }),
        ]);

        // Act: Promote
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        expect(result.success).toBe(true);

        // Assert: UPIDs should be unchanged
        const variantsAfter = await testDb
            .select()
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(eq(products.brandId, brandId));

        for (const v of variantsAfter) {
            const originalUpid = upidMap.get(v.product_variants.barcode!) ?? null;
            expect(v.product_variants.upid).toBe(originalUpid);
        }
    });
});

// =============================================================================
// ORPHANED VARIANTS TESTS
// =============================================================================

describe("Promotion: Orphaned Variants", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("keeps orphaned variants in their current products", async () => {
        // Arrange: Create product with 3 variants
        setMockProducts([
            createMockProduct({
                title: "Product with Orphan",
                variants: [
                    createMockVariant({ sku: "KEEP-1", barcode: "BC-KEEP-1" }),
                    createMockVariant({ sku: "KEEP-2", barcode: "BC-KEEP-2" }),
                    createMockVariant({ sku: "ORPHAN", barcode: "BC-ORPHAN" }),
                ],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Get original product ID
        const [originalProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));

        // Set up secondary mock - only 2 of the 3 variants
        // ORPHAN barcode is NOT in new primary
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "New Primary Product",
                variants: [
                    createItsPerfectMockVariant({ barcode: "BC-KEEP-1" }),
                    createItsPerfectMockVariant({ barcode: "BC-KEEP-2" }),
                    // BC-ORPHAN is NOT included
                ],
            }),
        ]);

        // Act: Promote
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        expect(result.success).toBe(true);
        expect(result.stats.variantsOrphaned).toBe(1);

        // Assert: Orphaned variant stays in its original product
        const [orphanedVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.barcode, "BC-ORPHAN"));

        expect(orphanedVariant).toBeDefined();
        expect(orphanedVariant!.productId).toBe(originalProduct!.id);
    });
});

// =============================================================================
// EMPTY PRODUCT ARCHIVAL TESTS
// =============================================================================

describe("Promotion: Empty Product Archival", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("archives products that become empty after re-grouping", async () => {
        // Arrange: Create 2 products in primary
        setMockProducts([
            createMockProduct({
                title: "Product A",
                variants: [createMockVariant({ sku: "VAR-A", barcode: "BC-A" })],
            }),
            createMockProduct({
                title: "Product B",
                variants: [createMockVariant({ sku: "VAR-B", barcode: "BC-B" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 2,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Verify 2 products exist (created with default status 'unpublished')
        const productsBefore = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(productsBefore).toHaveLength(2);

        // Set up secondary mock - merge both variants into one product
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Merged Product",
                variants: [
                    createItsPerfectMockVariant({ barcode: "BC-A" }),
                    createItsPerfectMockVariant({ barcode: "BC-B" }),
                ],
            }),
        ]);

        // Act: Promote
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        expect(result.success).toBe(true);

        // Assert: One product should be archived (the one that got emptied)
        expect(result.stats.productsArchived).toBeGreaterThanOrEqual(1);

        // Check database state
        const archivedProducts = await testDb
            .select()
            .from(products)
            .where(
                and(
                    eq(products.brandId, brandId),
                    eq(products.status, "archived")
                )
            );

        expect(archivedProducts.length).toBeGreaterThanOrEqual(1);

        // Non-archived products should have variants
        const activeProducts = await testDb
            .select()
            .from(products)
            .where(
                and(
                    eq(products.brandId, brandId),
                    // Products with non-archived status should have variants
                    // The sync engine creates products with 'unpublished' by default
                )
            )
            .then(prods => prods.filter(p => p.status !== "archived"));

        for (const product of activeProducts) {
            const variants = await testDb
                .select()
                .from(productVariants)
                .where(eq(productVariants.productId, product.id));
            expect(variants.length).toBeGreaterThan(0);
        }
    });
});

// =============================================================================
// LINK UPDATES TESTS
// =============================================================================

describe("Promotion: Link Updates", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("creates product links for new primary", async () => {
        // Arrange
        setMockProducts([
            createMockProduct({
                title: "Test Product",
                variants: [createMockVariant({ barcode: "BC-LINK" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                id: "itsp-product-999",
                name: "Secondary Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-LINK" })],
            }),
        ]);

        // Act: Promote
        await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert: New primary should have product links
        const newPrimaryLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, secondaryIntegrationId));

        expect(newPrimaryLinks.length).toBeGreaterThanOrEqual(1);
        expect(newPrimaryLinks[0]!.isCanonical).toBe(true);
    });

    it("creates variant links for new primary", async () => {
        // Arrange
        setMockProducts([
            createMockProduct({
                title: "Test Product",
                variants: [
                    createMockVariant({ barcode: "BC-V1" }),
                    createMockVariant({ barcode: "BC-V2" }),
                ],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Secondary Product",
                variants: [
                    createItsPerfectMockVariant({ id: "itsp-var-1", barcode: "BC-V1" }),
                    createItsPerfectMockVariant({ id: "itsp-var-2", barcode: "BC-V2" }),
                ],
            }),
        ]);

        // Act: Promote
        await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert: New primary should have variant links
        const newPrimaryVariantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));

        expect(newPrimaryVariantLinks).toHaveLength(2);
    });

    it("clears canonical status from old primary links", async () => {
        // Arrange
        setMockProducts([
            createMockProduct({
                title: "Test Product",
                variants: [createMockVariant({ barcode: "BC-CANON" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Verify old primary has canonical links
        const oldLinksBefore = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, primaryIntegrationId));
        expect(oldLinksBefore[0]!.isCanonical).toBe(true);

        // Set up secondary
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Secondary Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-CANON" })],
            }),
        ]);

        // Act: Promote
        await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert: Old primary links should no longer be canonical
        const oldLinksAfter = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, primaryIntegrationId));

        for (const link of oldLinksAfter) {
            expect(link.isCanonical).toBe(false);
        }
    });
});

// =============================================================================
// PROGRESS TRACKING TESTS
// =============================================================================

describe("Promotion: Progress Tracking", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        clearItsPerfectMockProducts();
        idCounter = Date.now();

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

    it("calls onProgress callback during promotion", async () => {
        // Arrange
        setMockProducts([
            createMockProduct({
                title: "Test Product",
                variants: [createMockVariant({ barcode: "BC-PROGRESS" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Secondary Product",
                variants: [createItsPerfectMockVariant({ barcode: "BC-PROGRESS" })],
            }),
        ]);

        // Track progress updates
        const progressUpdates: string[] = [];
        const onProgress = async (progress: { phase: string }) => {
            progressUpdates.push(progress.phase);
        };

        // Act: Promote with progress callback
        await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect",
            onProgress
        );

        // Assert: Should have received progress updates
        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates).toContain("preparing");
    });

    it("returns accurate statistics in result", async () => {
        // Arrange: Create 2 products that will be merged
        setMockProducts([
            createMockProduct({
                title: "Product 1",
                variants: [createMockVariant({ barcode: "BC-STAT-1" })],
            }),
            createMockProduct({
                title: "Product 2",
                variants: [createMockVariant({ barcode: "BC-STAT-2" })],
            }),
        ]);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 2,
            isPrimary: true,
        });
        await syncProducts(primaryCtx);

        // Set up secondary - merge
        clearMockProducts();
        setItsPerfectMockProducts([
            createItsPerfectMockProduct({
                name: "Merged Product",
                variants: [
                    createItsPerfectMockVariant({ barcode: "BC-STAT-1" }),
                    createItsPerfectMockVariant({ barcode: "BC-STAT-2" }),
                ],
            }),
        ]);

        // Act: Promote
        const result = await promoteIntegrationToPrimary(
            testDb,
            {
                brandId,
                newPrimaryIntegrationId: secondaryIntegrationId,
                oldPrimaryIntegrationId: primaryIntegrationId,
            },
            createMockCredentials(),
            "its-perfect"
        );

        // Assert: Stats should reflect the merge
        expect(result.stats.totalVariants).toBe(2);
        expect(result.stats.variantsMoved).toBeGreaterThanOrEqual(1);
        expect(result.stats.productsArchived).toBeGreaterThanOrEqual(1);
    });
});
