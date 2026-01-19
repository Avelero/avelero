/**
 * Multi-Sync Scenario Tests - Phase 7
 *
 * Tests complex multi-step sync scenarios.
 * Covers Tests 7.1-7.3 from the integration test plan.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  brandIntegrations,
  integrationProductLinks,
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
    expect(finalProduct!.description).toBe(
      "New Shopify Description After Update",
    );
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
      .where(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(productLinks).toHaveLength(1);

    const variantLinks = await testDb
      .select()
      .from(integrationVariantLinks)
      .where(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(variantLinks).toHaveLength(1);
  });

  // =========================================================================
  // Test 7.3: Sync → Disconnect → Reconnect → Sync (Ghost Links)
  // =========================================================================

  it("7.3 - primary matches existing product after disconnect/reconnect via preserved ghost link", async () => {
    // NOTE: Per integration-refactor-plan.md, links are preserved as "ghost links" on disconnect.
    // When reconnecting the SAME integration, sync matches via external ID link (not identifier).
    // This prevents duplicate products when a user disconnects and reconnects the same store.

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
    const originalProductId = product!.id;

    // Verify links exist
    const linksBeforeDisconnect = await testDb
      .select()
      .from(integrationProductLinks)
      .where(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(linksBeforeDisconnect).toHaveLength(1);

    // Simulate disconnect: Keep the links (ghost links) but mark integration as disconnected
    // In a real disconnect, we would update status but NOT delete links
    // For this test, we keep the links and just sync again to verify matching works

    // Act: Re-sync with the SAME integration and SAME external product
    // Since links are preserved, it should match via external ID, not create new
    const ctx2 = createTestSyncContext({
      brandId,
      brandIntegrationId,
      productsTotal: 1,
      isPrimary: true,
    });
    const result = await syncProducts(ctx2);

    // Assert: PRIMARY matches existing product via link (no new product created)
    expect(result.success).toBe(true);
    expect(result.productsCreated).toBe(0); // No new product - matched via link
    expect(result.productsUpdated).toBe(0); // No update if data unchanged

    // Still only 1 product exists (matched, not duplicated)
    const allProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.brandId, brandId));
    expect(allProducts).toHaveLength(1);
    expect(allProducts[0]!.id).toBe(originalProductId);

    // Links still point to the same product
    const linksAfterReconnect = await testDb
      .select()
      .from(integrationProductLinks)
      .where(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
      );
    expect(linksAfterReconnect).toHaveLength(1);
    expect(linksAfterReconnect[0]!.productId).toBe(originalProductId);
  });
});
