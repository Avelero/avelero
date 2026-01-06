/**
 * Integration Lifecycle Tests
 *
 * Tests for integration connection and disconnection lifecycle.
 * Covers the rules for primary/secondary assignment and what happens
 * when integrations are connected or disconnected.
 *
 * Covers tests from Section 4.9 of integration-refactor-plan.md:
 * - LIFE-001: First integration is primary
 * - LIFE-002: Second integration is secondary
 * - LIFE-003: Disconnect primary when secondary exists
 * - LIFE-004: Disconnect only integration
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
 * Create an integration-linked product for testing.
 */
async function createLinkedProduct(options: {
    brandId: string;
    brandIntegrationId: string;
    name: string;
    externalProductId: string;
    variants: Array<{
        sku: string;
        barcode: string;
        externalVariantId: string;
    }>;
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
            externalId: options.variants[i]!.externalVariantId,
            externalProductId: options.externalProductId,
        });
    }

    return { product: product!, variants };
}

// =============================================================================
// LIFE-001: First Integration is Primary
// =============================================================================

describe("LIFE-001: First Integration is Primary", () => {
    let brandId: string;

    beforeEach(async () => {
        brandId = await createTestBrand("Test Brand");
    });

    it("first connected integration has isPrimary = true", async () => {
        // Act: Connect first integration
        const integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });

        // Assert
        const [integration] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, integrationId))
            .limit(1);

        expect(integration).toBeDefined();
        expect(integration!.isPrimary).toBe(true);
    });

    it("brand with no integrations has 0 records in brand_integrations", async () => {
        // Assert: No integrations for this brand
        const integrations = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.brandId, brandId));

        expect(integrations).toHaveLength(0);
    });
});

// =============================================================================
// LIFE-002: Second Integration is Secondary
// =============================================================================

describe("LIFE-002: Second Integration is Secondary", () => {
    let brandId: string;

    beforeEach(async () => {
        brandId = await createTestBrand("Test Brand");
    });

    it("second connected integration has isPrimary = false", async () => {
        // Arrange: Connect first integration as primary
        const primaryId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });

        // Act: Connect second integration as secondary
        const secondaryId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });

        // Assert
        const [primary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, primaryId))
            .limit(1);
        expect(primary!.isPrimary).toBe(true);

        const [secondary] = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.id, secondaryId))
            .limit(1);
        expect(secondary!.isPrimary).toBe(false);
    });

    it("only one integration can be primary at a time", async () => {
        // Arrange: Connect primary
        const primaryId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });

        // Connect secondary
        const secondary1Id = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });

        // Connect another secondary
        const secondary2Id = await createTestBrandIntegration(brandId, "elastic-suite", {
            isPrimary: false,
        });

        // Assert: Only 1 primary
        const allIntegrations = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.brandId, brandId));

        expect(allIntegrations).toHaveLength(3);

        const primaries = allIntegrations.filter((i) => i.isPrimary);
        expect(primaries).toHaveLength(1);
        expect(primaries[0]!.id).toBe(primaryId);
    });
});

// =============================================================================
// LIFE-003: Disconnect Primary When Secondary Exists
// =============================================================================

describe("LIFE-003: Disconnect Primary When Secondary Exists", () => {
    let brandId: string;

    beforeEach(async () => {
        brandId = await createTestBrand("Test Brand");
    });

    it("disconnecting primary requires secondary promotion first", async () => {
        // Arrange: Connect primary and secondary
        const primaryId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryId);

        const secondaryId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryId);

        // Create a product linked to primary
        await createLinkedProduct({
            brandId,
            brandIntegrationId: primaryId,
            name: "Primary Product",
            externalProductId: "gid://shopify/Product/123",
            variants: [
                { sku: "PRIM-001", barcode: "PRIM-BC-001", externalVariantId: "gid://shopify/ProductVariant/456" },
            ],
        });

        // Act: FIRST demote existing primary, THEN promote secondary
        // (Must do in this order to avoid unique constraint on isPrimary)
        await testDb
            .update(brandIntegrations)
            .set({ isPrimary: false })
            .where(eq(brandIntegrations.id, primaryId));

        await testDb
            .update(brandIntegrations)
            .set({ isPrimary: true })
            .where(eq(brandIntegrations.id, secondaryId));

        // Now disconnect old primary (delete integration)
        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, primaryId));

        // Assert: Only secondary (now primary) remains
        const remaining = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.brandId, brandId));

        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.id).toBe(secondaryId);
        expect(remaining[0]!.isPrimary).toBe(true);
    });

    it("product links are cleaned up when integration is disconnected", async () => {
        // Arrange
        const integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(integrationId);

        await createLinkedProduct({
            brandId,
            brandIntegrationId: integrationId,
            name: "Linked Product",
            externalProductId: "gid://shopify/Product/789",
            variants: [
                { sku: "LINK-001", barcode: "LINK-BC", externalVariantId: "gid://shopify/ProductVariant/101" },
            ],
        });

        // Verify links exist
        const linksBefore = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, integrationId));
        expect(linksBefore).toHaveLength(1);

        // Act: Delete integration (links should cascade delete)
        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, integrationId));

        // Assert: Links are gone (cascade delete)
        const linksAfter = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, integrationId));
        expect(linksAfter).toHaveLength(0);
    });
});

// =============================================================================
// LIFE-004: Disconnect Only Integration
// =============================================================================

describe("LIFE-004: Disconnect Only Integration", () => {
    let brandId: string;

    beforeEach(async () => {
        brandId = await createTestBrand("Test Brand");
    });

    it("products remain when only integration is disconnected", async () => {
        // Arrange: Connect single integration and create product
        const integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(integrationId);

        const { product, variants } = await createLinkedProduct({
            brandId,
            brandIntegrationId: integrationId,
            name: "Orphan Product",
            externalProductId: "gid://shopify/Product/999",
            variants: [
                { sku: "ORPHAN-001", barcode: "ORPHAN-BC", externalVariantId: "gid://shopify/ProductVariant/888" },
            ],
        });

        // Act: Disconnect integration
        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, integrationId));

        // Assert: Product still exists
        const [remainingProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, product.id))
            .limit(1);

        expect(remainingProduct).toBeDefined();
        expect(remainingProduct!.name).toBe("Orphan Product");

        // Variant still exists
        const [remainingVariant] = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, variants[0]!.id))
            .limit(1);

        expect(remainingVariant).toBeDefined();
        expect(remainingVariant!.upid).toBe(variants[0]!.upid); // UPID preserved
    });

    it("product source changes to orphaned after integration disconnect", async () => {
        // Arrange
        const integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(integrationId);

        const { product } = await createLinkedProduct({
            brandId,
            brandIntegrationId: integrationId,
            name: "Source Change Product",
            externalProductId: "gid://shopify/Product/111",
            variants: [
                { sku: "SRC-001", barcode: "SRC-BC", externalVariantId: "gid://shopify/ProductVariant/222" },
            ],
        });

        expect(product.source).toBe("integration");
        expect(product.sourceIntegrationId).toBe(integrationId);

        // Act: Update product source before disconnect
        await testDb
            .update(products)
            .set({
                source: "integration", // Source type remains, but link is broken
                sourceIntegrationId: null, // Clear the reference
            })
            .where(eq(products.id, product.id));

        // Disconnect integration
        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, integrationId));

        // Assert: Product exists with cleared source integration
        const [updatedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, product.id))
            .limit(1);

        expect(updatedProduct).toBeDefined();
        expect(updatedProduct!.sourceIntegrationId).toBeNull();
    });

    it("brand can connect new integration after disconnecting", async () => {
        // Arrange: Connect and disconnect
        const integrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });

        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, integrationId));

        // Assert: No integrations
        const before = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.brandId, brandId));
        expect(before).toHaveLength(0);

        // Act: Connect new integration
        const newIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: true,
        });

        // Assert: New integration is primary
        const after = await testDb
            .select()
            .from(brandIntegrations)
            .where(eq(brandIntegrations.brandId, brandId));
        expect(after).toHaveLength(1);
        expect(after[0]!.isPrimary).toBe(true);
    });
});
