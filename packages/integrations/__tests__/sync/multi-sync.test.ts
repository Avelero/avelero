/**
 * Multi-Sync Scenario Tests - Phase 7
 *
 * Tests complex multi-step sync scenarios.
 * Covers Tests 7.1-7.3 from the integration test plan.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
    products,
    productVariants,
    integrationProductLinks,
    integrationVariantLinks,
    brandIntegrations,
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

describe("Phase 7: Multi-Sync Scenarios", () => {
    let brandId: string;
    let brandIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
        await createDefaultFieldConfigs(brandIntegrationId);
    });

    // =========================================================================
    // Test 7.1: Create → Sync → Edit in Avelero → Re-sync
    // =========================================================================

    it("7.1 - Avelero edits are overwritten by Shopify on re-sync", async () => {
        // Arrange: Initial sync creates product
        const productId = `gid://shopify/Product/${Date.now()}`;
        const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

        const initialProduct = createMockProduct({
            id: productId,
            title: "Original Shopify Title",
            description: "Original Shopify Description",
            variants: [
                createMockVariant({
                    id: variantId,
                    sku: "EDIT-001",
                }),
            ],
        });
        setMockProducts([initialProduct]);

        const ctx1 = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });
        await syncProducts(ctx1);

        // Simulate Avelero manual edit (directly update database)
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        await testDb
            .update(products)
            .set({
                name: "Manually Edited Title in Avelero",
                description: "Manually Edited Description in Avelero",
            })
            .where(eq(products.id, product!.id));

        // Verify manual edit was applied
        const [editedProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, product!.id))
            .limit(1);
        expect(editedProduct!.name).toBe("Manually Edited Title in Avelero");

        // Act: Shopify title changes, re-sync
        const updatedProduct = createMockProduct({
            id: productId,
            title: "New Shopify Title After Update",
            description: "New Shopify Description After Update",
            variants: [
                createMockVariant({
                    id: variantId,
                    sku: "EDIT-001",
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

        // Assert: Shopify data overwrites Avelero edits
        expect(result.success).toBe(true);
        expect(result.productsUpdated).toBe(1);

        const [finalProduct] = await testDb
            .select()
            .from(products)
            .where(eq(products.id, product!.id))
            .limit(1);

        // Both title and description should be from Shopify (manual edits overwritten)
        expect(finalProduct!.name).toBe("New Shopify Title After Update");
        expect(finalProduct!.description).toBe("New Shopify Description After Update");
    });

    // =========================================================================
    // Test 7.2: Multiple Syncs in Succession
    // =========================================================================

    it("7.2 - multiple syncs in succession do not create duplicates", async () => {
        // Arrange: Create mock product
        const productId = `gid://shopify/Product/${Date.now()}`;
        const variantId = `gid://shopify/ProductVariant/${Date.now()}`;

        const mockProduct = createMockProduct({
            id: productId,
            title: "Multi Sync Product",
            variants: [
                createMockVariant({
                    id: variantId,
                    sku: "MULTI-SYNC-001",
                }),
            ],
        });
        setMockProducts([mockProduct]);

        // Act: Run sync 3 times in succession
        const results = [];
        for (let i = 0; i < 3; i++) {
            const ctx = createTestSyncContext({
                brandId,
                brandIntegrationId,
                productsTotal: 1,
            });
            const result = await syncProducts(ctx);
            results.push(result);
        }

        // Assert: All syncs succeeded
        expect(results[0]!.success).toBe(true);
        expect(results[1]!.success).toBe(true);
        expect(results[2]!.success).toBe(true);

        // First sync creates, subsequent syncs skip
        expect(results[0]!.productsCreated).toBe(1);
        expect(results[1]!.productsCreated).toBe(0);
        expect(results[2]!.productsCreated).toBe(0);

        // Only 1 product exists (no duplicates)
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // Only 1 variant exists (no duplicates)
        const allVariants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, allProducts[0]!.id));
        expect(allVariants).toHaveLength(1);

        // Links remain consistent
        const productLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
        expect(productLinks).toHaveLength(1);

        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        expect(variantLinks).toHaveLength(1);
    });

    // =========================================================================
    // Test 7.3: Sync → Disconnect → Reconnect → Sync
    // =========================================================================

    it("7.3 - products are re-matched after disconnect/reconnect", async () => {
        // Arrange: Initial sync creates product
        const productId = `gid://shopify/Product/${Date.now()}`;
        const variantId = `gid://shopify/ProductVariant/${Date.now()}`;
        const matchingSku = "RECONNECT-001";

        const mockProduct = createMockProduct({
            id: productId,
            title: "Reconnect Test Product",
            variants: [
                createMockVariant({
                    id: variantId,
                    sku: matchingSku,
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

        // Verify initial state
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);
        expect(product).toBeDefined();

        // Simulate disconnect: Delete brand integration and all links (cascade should handle links, but be explicit)
        await testDb
            .delete(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
        await testDb
            .delete(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
        // Also delete the brand integration itself (this is what real disconnect does)
        await testDb
            .delete(brandIntegrations)
            .where(eq(brandIntegrations.id, brandIntegrationId));

        // Verify links deleted
        const linksAfterDisconnect = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
        expect(linksAfterDisconnect).toHaveLength(0);

        // Act: "Reconnect" (new brand integration) and sync again
        const newBrandIntegrationId = await createTestBrandIntegration(
            brandId,
            "shopify"
        );
        await createDefaultFieldConfigs(newBrandIntegrationId);

        // Use same mock product (simulating same Shopify store)
        const ctx2 = createTestSyncContext({
            brandId,
            brandIntegrationId: newBrandIntegrationId,
            productsTotal: 1,
        });
        const result = await syncProducts(ctx2);

        // Assert: Product re-matched by SKU (not duplicated)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // Matched existing

        // Still only 1 product
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(1);

        // New links created with new brand integration ID
        const newProductLinks = await testDb
            .select()
            .from(integrationProductLinks)
            .where(eq(integrationProductLinks.brandIntegrationId, newBrandIntegrationId));
        expect(newProductLinks).toHaveLength(1);
        expect(newProductLinks[0]!.productId).toBe(product!.id);
    });
});
