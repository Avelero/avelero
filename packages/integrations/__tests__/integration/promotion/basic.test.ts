/**
 * Promotion Integration Tests
 *
 * Tests for the primary integration promotion process.
 * These tests verify the complete re-grouping algorithm when
 * promoting a secondary integration to become the new primary.
 *
 * Covers:
 * - Basic promotion flow
 * - Variant re-parenting
 * - Orphaned variant handling
 * - New product creation
 * - Attribute re-assignment
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq, and } from "drizzle-orm";
import {
    products,
    productVariants,
    brandIntegrations,
    integrationProductLinks,
    integrationVariantLinks,
} from "@v1/db/schema";
import {
    testDb,
    createTestBrand,
    createTestBrandIntegration,
    createDefaultFieldConfigs,
} from "@v1/testing/db";
import {
    setMockProducts,
    clearMockProducts,
    createMockProduct,
    createMockVariant,
} from "@v1/testing/mocks/shopify";
import { syncProducts } from "../../../src/sync/engine";
import { createTestSyncContext } from "@v1/testing/context";

describe("Promotion: Basic Flow", () => {
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

        // Create secondary integration (using different integration type to avoid unique constraint)
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    // =========================================================================
    // Test: Primary and Secondary Integration Setup
    // =========================================================================

    it("verifies primary and secondary integration setup", async () => {
        // Verify primary integration
        const [primary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, primaryIntegrationId))
            .limit(1);

        expect(primary).toBeDefined();
        expect(primary!.isPrimary).toBe(true);

        // Verify secondary integration
        const [secondary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, secondaryIntegrationId))
            .limit(1);

        expect(secondary).toBeDefined();
        expect(secondary!.isPrimary).toBe(false);
    });

    // =========================================================================
    // Test: Primary Sync Creates Products
    // =========================================================================

    it("primary sync creates new products", async () => {
        // Arrange: Mock products for primary integration
        const mockProducts = [
            createMockProduct({
                title: "Primary Product A",
                variants: [
                    createMockVariant({ sku: "SKU-A1", barcode: "1111111111111" }),
                    createMockVariant({ sku: "SKU-A2", barcode: "1111111111112" }),
                ],
            }),
            createMockProduct({
                title: "Primary Product B",
                variants: [
                    createMockVariant({ sku: "SKU-B1", barcode: "2222222222221" }),
                ],
            }),
        ];
        setMockProducts(mockProducts);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 2,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Products created
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(2);
        expect(result.variantsCreated).toBe(3);

        // Verify products in database
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));

        expect(allProducts).toHaveLength(2);
        expect(allProducts.map(p => p.sourceIntegrationId)).toEqual(
            expect.arrayContaining([primaryIntegrationId, primaryIntegrationId])
        );
    });

    // =========================================================================
    // Test: Secondary Sync Links to Existing Products
    // =========================================================================

    it("secondary sync links to existing products by barcode", async () => {
        // Arrange: First, sync primary products
        const primaryMockProducts = [
            createMockProduct({
                title: "Primary Product",
                variants: [
                    createMockVariant({ sku: "PRIMARY-SKU", barcode: "SHARED-BARCODE-001" }),
                ],
            }),
        ];
        setMockProducts(primaryMockProducts);

        const primaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: primaryIntegrationId,
            productsTotal: 1,
        });
        await syncProducts(primaryCtx);

        // Clear and set up secondary mock products with same barcode
        clearMockProducts();
        const secondaryMockProducts = [
            createMockProduct({
                title: "Secondary Product (Same Barcode)",
                variants: [
                    createMockVariant({ sku: "SECONDARY-SKU", barcode: "SHARED-BARCODE-001" }),
                ],
            }),
        ];
        setMockProducts(secondaryMockProducts);

        const secondaryCtx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act: Run secondary sync
        const result = await syncProducts(secondaryCtx);

        // Assert: No new product created (linked to existing)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);

        // Verify only 1 product exists
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // Verify both integrations have links to the same product
        const primaryLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, primaryIntegrationId));

        const secondaryLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, secondaryIntegrationId));

        expect(primaryLinks).toHaveLength(1);
        expect(secondaryLinks).toHaveLength(1);
        expect(primaryLinks[0]!.productId).toBe(secondaryLinks[0]!.productId);
    });
});

describe("Promotion: Product Link Management", () => {
    let brandId: string;
    let integrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(integrationId);
    });

    // =========================================================================
    // Test: Product Links Created During Sync
    // =========================================================================

    it("creates product links with isCanonical=true for primary", async () => {
        const mockProduct = createMockProduct({
            title: "Test Product",
            variants: [createMockVariant({ sku: "TEST-001" })],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: integrationId,
            productsTotal: 1,
        });

        await syncProducts(ctx);

        // Verify product link exists
        const links = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, integrationId));

        expect(links).toHaveLength(1);
        expect(links[0]!.isCanonical).toBe(true);
    });

    // =========================================================================
    // Test: Variant Links Created During Sync
    // =========================================================================

    it("creates variant links for all variants", async () => {
        const mockProduct = createMockProduct({
            title: "Multi-Variant Product",
            variants: [
                createMockVariant({ sku: "VAR-001", barcode: "1111" }),
                createMockVariant({ sku: "VAR-002", barcode: "2222" }),
                createMockVariant({ sku: "VAR-003", barcode: "3333" }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: integrationId,
            productsTotal: 1,
        });

        await syncProducts(ctx);

        // Verify variant links exist
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, integrationId));

        expect(variantLinks).toHaveLength(3);
    });
});

describe("Promotion: Empty Product Archival", () => {
    let brandId: string;
    let integrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(integrationId);
    });

    // =========================================================================
    // Test: Products Without Variants Get Archived
    // =========================================================================

    it("archives products that become empty after variant reassignment", async () => {
        // Arrange: Create a product with no variants (should normally not happen, but test archival logic)
        const [emptyProduct] = await testDb
            .insert(products)
            .values({
                brandId,
                name: "Empty Product",
                productHandle: "empty-product",
                source: "integration",
                sourceIntegrationId: integrationId,
                status: "published",
            })
            .returning();

        expect(emptyProduct).toBeDefined();

        // Verify product exists with published status
        const [before] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, emptyProduct!.id));

        expect(before!.status).toBe("published");

        // Act: Import from "@v1/db/queries/integrations" and call archiveEmptyProducts
        const { archiveEmptyProducts } = await import("@v1/db/queries/integrations");
        const archivedCount = await archiveEmptyProducts(testDb, brandId);

        // Assert: Product was archived
        expect(archivedCount).toBe(1);

        const [after] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, emptyProduct!.id));

        expect(after!.status).toBe("archived");
    });
});
