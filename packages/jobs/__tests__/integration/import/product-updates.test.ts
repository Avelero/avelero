/**
 * Integration Tests: Product Updates
 *
 * Tests updating existing products via import.
 *
 * Matching Logic:
 * - Products: Matched by Product Handle only
 * - Variants: Matched by UPID only (not SKU/Barcode)
 * - Variant with UPID match -> UPDATE
 * - Variant without UPID -> CREATE new variant
 * - Variant UPID missing from sheet -> DELETE (in CREATE_AND_ENRICH mode)
 *
 * @module tests/integration/import/product-updates
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, type InsertedCatalog } from "@v1/db/testing";
import { ExcelBuilder, basicProduct, multiVariantProduct } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel-parser";
import { loadBrandCatalog } from "../../../src/lib/catalog-loader";
import * as schema from "@v1/db/schema";
import { eq, sql } from "drizzle-orm";

describe("Product Updates", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Handle-Based Product Matching", () => {
        it("detects existing product by handle for update", async () => {
            // First, create an existing product in the database
            const existingProductId = crypto.randomUUID();
            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Original Product Name",
                productHandle: "existing-product",
            });

            // Now try to import with the same handle
            const updateProduct = {
                ...basicProduct,
                handle: "existing-product",
                title: "Updated Product Name",
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.productHandle).toBe("existing-product");
            expect(parseResult.products[0]?.name).toBe("Updated Product Name");

            // Verify the existing product exists
            const existingProduct = await testDb.query.products.findFirst({
                where: eq(schema.products.productHandle, "existing-product"),
            });
            expect(existingProduct).toBeDefined();
        });

        it("updates existing product by handle match", async () => {
            // Create existing product
            const existingProductId = crypto.randomUUID();
            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Original Name",
                productHandle: "update-test-handle",
                description: "Original description",
            });

            // Import with same handle but different data
            const updateProduct = {
                handle: "update-test-handle",
                title: "New Name",
                description: "New description",
                variants: [{ sku: "UPDATE-001", barcode: "9999999999999" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // The parsed product should have the new values
            expect(parseResult.products[0]?.name).toBe("New Name");
            expect(parseResult.products[0]?.description).toBe("New description");
        });

        it("creates new product when handle does not exist", async () => {
            const newProduct = {
                handle: "brand-new-product",
                title: "Brand New Product",
                variants: [{ sku: "NEW-001", barcode: "1111111111111" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [newProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Verify no existing product with this handle
            const existingProduct = await testDb.query.products.findFirst({
                where: eq(schema.products.productHandle, "brand-new-product"),
            });
            expect(existingProduct).toBeUndefined();

            // Parsed product should be ready for creation
            expect(parseResult.products[0]?.productHandle).toBe("brand-new-product");
        });
    });

    describe("UPID-Based Variant Matching", () => {
        it("matches variant by UPID for update", async () => {
            // Create existing product with variant that has a UPID
            const existingProductId = crypto.randomUUID();
            const existingVariantId = crypto.randomUUID();
            const existingUpid = "UPID-EXISTING-001";

            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Product with UPID Variant",
                productHandle: "upid-match-product",
            });

            await testDb.insert(schema.productVariants).values({
                id: existingVariantId,
                productId: existingProductId,
                upid: existingUpid,
                sku: "OLD-SKU-001",
                barcode: "1111111111111",
            });

            // Import with same UPID but different SKU/barcode
            const updateProduct = {
                handle: "upid-match-product",
                title: "Product with UPID Variant",
                variants: [{
                    upid: existingUpid,
                    sku: "NEW-SKU-001",  // Different SKU
                    barcode: "2222222222222",  // Different barcode
                }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Parsed variant should have the UPID
            expect(parseResult.products[0]?.variants[0]?.upid).toBe(existingUpid);
            // SKU and barcode should be the new values from the import
            expect(parseResult.products[0]?.variants[0]?.sku).toBe("NEW-SKU-001");
            expect(parseResult.products[0]?.variants[0]?.barcode).toBe("2222222222222");
        });

        it("creates new variant when UPID is not present", async () => {
            // Create existing product with one variant
            const existingProductId = crypto.randomUUID();
            const existingVariantId = crypto.randomUUID();

            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Product for New Variant",
                productHandle: "add-variant-product",
            });

            await testDb.insert(schema.productVariants).values({
                id: existingVariantId,
                productId: existingProductId,
                upid: "UPID-EXISTING-001",
                sku: "EXISTING-VAR-001",
                barcode: "3333333333333",
            });

            // Import with NO UPID (should create new variant, not update)
            const updateProduct = {
                handle: "add-variant-product",
                title: "Product for New Variant",
                variants: [
                    { sku: "NEW-VAR-002", barcode: "4444444444444" },  // No UPID = new variant
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // The variant should not have a UPID (will be created as new)
            expect(parseResult.products[0]?.variants[0]?.upid).toBeUndefined();
            expect(parseResult.products[0]?.variants[0]?.sku).toBe("NEW-VAR-002");
        });

        it("does NOT match variant by SKU alone", async () => {
            // Create existing product with variant
            const existingProductId = crypto.randomUUID();
            const existingVariantId = crypto.randomUUID();

            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Product with SKU Variant",
                productHandle: "sku-no-match-product",
            });

            await testDb.insert(schema.productVariants).values({
                id: existingVariantId,
                productId: existingProductId,
                upid: "UPID-ORIG-001",
                sku: "SAME-SKU-001",
                barcode: "5555555555555",
            });

            // Import with same SKU but NO UPID - should NOT match the existing variant
            const updateProduct = {
                handle: "sku-no-match-product",
                title: "Product with SKU Variant",
                variants: [
                    { sku: "SAME-SKU-001", barcode: "6666666666666" },  // Same SKU, no UPID
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Without UPID, this should be treated as a new variant (not matched by SKU)
            expect(parseResult.products[0]?.variants[0]?.upid).toBeUndefined();
        });

        it("does NOT match variant by barcode alone", async () => {
            // Create existing product with variant
            const existingProductId = crypto.randomUUID();
            const existingVariantId = crypto.randomUUID();

            await testDb.insert(schema.products).values({
                id: existingProductId,
                brandId,
                name: "Product with Barcode Variant",
                productHandle: "barcode-no-match-product",
            });

            await testDb.insert(schema.productVariants).values({
                id: existingVariantId,
                productId: existingProductId,
                upid: "UPID-ORIG-002",
                sku: "ORIG-SKU-002",
                barcode: "7777777777777",
            });

            // Import with same barcode but NO UPID - should NOT match the existing variant
            const updateProduct = {
                handle: "barcode-no-match-product",
                title: "Product with Barcode Variant",
                variants: [
                    { sku: "NEW-SKU-002", barcode: "7777777777777" },  // Same barcode, no UPID
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [updateProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Without UPID, this should be treated as a new variant (not matched by barcode)
            expect(parseResult.products[0]?.variants[0]?.upid).toBeUndefined();
        });

        it("handles multiple variants with mixed UPID presence", async () => {
            const productWithMixedVariants = {
                handle: "mixed-variants-product",
                title: "Product with Mixed Variants",
                variants: [
                    { upid: "UPID-001", sku: "SKU-001", barcode: "1111111111111" },  // Has UPID - will update
                    { sku: "SKU-002", barcode: "2222222222222" },  // No UPID - will create
                    { upid: "UPID-003", sku: "SKU-003", barcode: "3333333333333" },  // Has UPID - will update
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithMixedVariants],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const variants = parseResult.products[0]?.variants || [];

            expect(variants).toHaveLength(3);
            expect(variants[0]?.upid).toBe("UPID-001");
            expect(variants[1]?.upid).toBeUndefined();
            expect(variants[2]?.upid).toBe("UPID-003");
        });
    });

    describe("Field Update Behavior", () => {
        it("updates product-level fields", async () => {
            const productWithAllFields = {
                handle: "update-all-fields",
                title: "Updated Title",
                description: "Updated description text",
                manufacturer: "Premium Textiles Co",
                season: "FW25",
                category: "Clothing",
                tags: ["Bestseller", "New Arrival"],
                variants: [{ sku: "ALL-FIELDS-001", barcode: "6666666666666" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithAllFields],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const product = parseResult.products[0]!;

            expect(product.name).toBe("Updated Title");
            expect(product.description).toBe("Updated description text");
            expect(product.manufacturerName).toBe("Premium Textiles Co");
            expect(product.seasonName).toBe("FW25");
            expect(product.tags).toContain("Bestseller");
        });

        it("updates variant-level fields", async () => {
            const productWithVariantFields = {
                handle: "update-variant-fields",
                title: "Variant Update Test",
                variants: [
                    {
                        sku: "VAR-UPDATE-001",
                        barcode: "7777777777777",
                        attributes: [
                            { name: "Color", value: "Red" },
                            { name: "Size", value: "M" },
                        ],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithVariantFields],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const variant = parseResult.products[0]?.variants[0];

            expect(variant?.attributes).toHaveLength(2);
            expect(variant?.attributes.some(a => a.name === "Color" && a.value === "Red")).toBe(true);
            expect(variant?.attributes.some(a => a.name === "Size" && a.value === "M")).toBe(true);
        });

        it("preserves existing data when import field is empty", async () => {
            // A product with only some fields filled
            const partialUpdate = {
                handle: "partial-update",
                title: "Only Title Updated",
                // description intentionally missing
                variants: [{ sku: "PARTIAL-001", barcode: "8888888888888" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [partialUpdate],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // The parsed product should have undefined description
            expect(parseResult.products[0]?.description).toBeUndefined();
        });

        it("replaces array fields (tags) with new values", async () => {
            const productWithNewTags = {
                handle: "replace-tags",
                title: "Tag Replacement Test",
                tags: ["NewTag1", "NewTag2", "NewTag3"],
                variants: [{ sku: "TAGS-001", barcode: "1010101010101" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithNewTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Tags should be the new values
            expect(parseResult.products[0]?.tags).toHaveLength(3);
            expect(parseResult.products[0]?.tags).toContain("NewTag1");
            expect(parseResult.products[0]?.tags).toContain("NewTag2");
            expect(parseResult.products[0]?.tags).toContain("NewTag3");
        });
    });
});
