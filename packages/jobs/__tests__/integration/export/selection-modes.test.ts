/**
 * Integration Tests: Selection Modes
 *
 * Tests product ID resolution from different selection modes.
 * Verifies that explicit mode, all mode, and filter combinations
 * work correctly for export.
 *
 * @module tests/integration/export/selection-modes
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand } from "@v1/db/testing";
import {
    createTestProductForExport,
    createTestVariantWithOverrides,
} from "@v1/db/testing";
import { getProductsForExport } from "@v1/db/queries/products";

describe("Selection Modes", () => {
    let brandId: string;
    let productIds: string[] = [];

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        productIds = [];

        // Create 5 test products with variants
        for (let i = 1; i <= 5; i++) {
            const productId = await createTestProductForExport(brandId, {
                name: `Product ${i}`,
                handle: `product-${i}`,
                status: i <= 3 ? "published" : "draft",
                tags: [`tag-${i % 2 === 0 ? "even" : "odd"}`],
            });
            await createTestVariantWithOverrides(productId, brandId, {
                upid: `UPID-SELECT-${i.toString().padStart(3, "0")}`,
            });
            productIds.push(productId);
        }
    });

    it("explicit mode returns exactly specified product IDs", async () => {
        // Only request specific products
        const selectedIds = [productIds[0]!, productIds[2]!, productIds[4]!];

        const products = await getProductsForExport(testDb, brandId, selectedIds);

        expect(products.length).toBe(3);

        // Should have exactly the products we requested
        const names = products.map(p => p.name);
        expect(names).toContain("Product 1");
        expect(names).toContain("Product 3");
        expect(names).toContain("Product 5");

        // Should NOT have the others
        expect(names).not.toContain("Product 2");
        expect(names).not.toContain("Product 4");
    });

    it("all mode with no excludeIds returns all products (via full ID list)", async () => {
        // Simulate "all" mode by passing all product IDs
        const products = await getProductsForExport(testDb, brandId, productIds);

        expect(products.length).toBe(5);

        const names = products.map(p => p.name);
        for (let i = 1; i <= 5; i++) {
            expect(names).toContain(`Product ${i}`);
        }
    });

    it("all mode with excludeIds filters out excluded products", async () => {
        // Simulate "all" mode with exclusions by filtering IDs before query
        const excludeIds = [productIds[1]!, productIds[3]!]; // Exclude product 2 and 4
        const filteredIds = productIds.filter(id => !excludeIds.includes(id));

        const products = await getProductsForExport(testDb, brandId, filteredIds);

        expect(products.length).toBe(3);

        const names = products.map(p => p.name);
        expect(names).toContain("Product 1");
        expect(names).toContain("Product 3");
        expect(names).toContain("Product 5");
        expect(names).not.toContain("Product 2");
        expect(names).not.toContain("Product 4");
    });

    it("empty selection returns empty result gracefully", async () => {
        const products = await getProductsForExport(testDb, brandId, []);

        expect(products).toEqual([]);
    });

    it("non-existent product IDs are silently ignored", async () => {
        // Use valid UUIDs that don't exist in the database
        const nonExistentUuid1 = crypto.randomUUID();
        const nonExistentUuid2 = crypto.randomUUID();

        const mixedIds = [
            productIds[0]!,
            nonExistentUuid1,
            productIds[2]!,
            nonExistentUuid2,
        ];

        const products = await getProductsForExport(testDb, brandId, mixedIds);

        // Should only return the valid products
        expect(products.length).toBe(2);

        const names = products.map(p => p.name);
        expect(names).toContain("Product 1");
        expect(names).toContain("Product 3");
    });

    it("single product selection works correctly", async () => {
        const products = await getProductsForExport(testDb, brandId, [productIds[0]!]);

        expect(products.length).toBe(1);
        expect(products[0]!.name).toBe("Product 1");
    });

    it("preserves all product data when using ID-based selection", async () => {
        // Create a product with full data
        const fullProductId = await createTestProductForExport(brandId, {
            name: "Full Data Product",
            handle: "full-data-product",
            description: "Complete product for selection test",
            tags: ["test-tag"],
            materials: [{ name: "Organic Cotton", percentage: 100 }],
            carbonKg: 5.5,
            manufacturerName: "Test Manufacturer",
        });
        await createTestVariantWithOverrides(fullProductId, brandId, {
            upid: "UPID-FULL-DATA",
            sku: "SKU-FULL",
            attributes: [{ name: "Size", value: "Large" }],
        });

        const products = await getProductsForExport(testDb, brandId, [fullProductId]);

        expect(products.length).toBe(1);
        const product = products[0]!;

        // All data should be preserved
        expect(product.name).toBe("Full Data Product");
        expect(product.description).toBe("Complete product for selection test");
        expect(product.tags).toContain("test-tag");
        expect(product.materials.length).toBe(1);
        expect(product.carbonKg).toBe(5.5);
        expect(product.manufacturerName).toBe("Test Manufacturer");

        // Variant data should be preserved
        expect(product.variants.length).toBe(1);
        expect(product.variants[0]!.upid).toBe("UPID-FULL-DATA");
        expect(product.variants[0]!.sku).toBe("SKU-FULL");
        expect(product.variants[0]!.attributes.length).toBe(1);
    });
});
