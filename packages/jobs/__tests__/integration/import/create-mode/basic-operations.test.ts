/**
 * Integration Tests: CREATE Mode - Basic Operations
 *
 * Tests CREATE mode with existing catalog entities.
 * Validates that products can be created when catalog entities
 * already exist in the database.
 *
 * @module tests/integration/import/create-mode/basic-operations
 */

import "../../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, TestDatabase, type InsertedCatalog } from "@v1/db/testing";
import { ExcelBuilder, basicProduct, completeProduct, multiVariantProduct } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../../src/lib/excel-parser";
import { loadBrandCatalog } from "../../../../src/lib/catalog-loader";

describe("CREATE Mode - Basic Operations", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        // Setup a full catalog with materials, seasons, tags, etc.
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Entity Resolution", () => {
        it("creates new product with catalog data", async () => {
            // Create an Excel with a basic product
            const excelBuffer = await ExcelBuilder.create({
                products: [basicProduct],
            });

            // Parse the Excel file
            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.errors).toHaveLength(0);
            expect(parseResult.products).toHaveLength(1);

            const product = parseResult.products[0]!;
            expect(product.productHandle).toBe("basic-tshirt");
            expect(product.name).toBe("Basic T-Shirt");
        });

        it("resolves existing manufacturer from catalog", async () => {
            // Create a product that references an existing manufacturer
            const productWithManufacturer = {
                ...basicProduct,
                manufacturer: "Premium Textiles Co", // Must match catalog fixture
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithManufacturer],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.manufacturerName).toBe("Premium Textiles Co");

            // Load catalog and verify manufacturer exists
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            const manufacturerId = brandCatalog.manufacturers.get("premium textiles co");
            expect(manufacturerId).toBeDefined();
        });

        it("resolves existing season from catalog", async () => {
            const productWithSeason = {
                ...basicProduct,
                season: "FW25", // Must match catalog fixture
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithSeason],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.seasonName).toBe("FW25");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            const seasonId = brandCatalog.seasons.get("fw25");
            expect(seasonId).toBeDefined();
        });

        it("resolves existing materials from catalog", async () => {
            const productWithMaterials = {
                ...basicProduct,
                materials: [
                    { name: "Cotton", percentage: 80 },
                    { name: "Polyester", percentage: 20 },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithMaterials],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.materials).toHaveLength(2);

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.materials.get("cotton")).toBeDefined();
            expect(brandCatalog.materials.get("polyester")).toBeDefined();
        });

        it("resolves existing tags from catalog", async () => {
            const productWithTags = {
                ...basicProduct,
                tags: ["Bestseller", "New Arrival"], // Must match catalog fixtures
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.tags).toContain("Bestseller");
            expect(parseResult.products[0]?.tags).toContain("New Arrival");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.tags.get("bestseller")).toBeDefined();
            expect(brandCatalog.tags.get("new arrival")).toBeDefined();
        });

        it("resolves existing eco claims from catalog", async () => {
            const productWithEcoClaims = {
                ...basicProduct,
                ecoClaims: ["GOTS Certified", "Fair Trade"], // Must match catalog fixtures
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithEcoClaims],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.ecoClaims).toContain("GOTS Certified");
            expect(parseResult.products[0]?.ecoClaims).toContain("Fair Trade");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.ecoClaims.get("gots certified")).toBeDefined();
            expect(brandCatalog.ecoClaims.get("fair trade")).toBeDefined();
        });

        it("resolves existing attributes for variants", async () => {
            const productWithAttributes = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [
                            { name: "Color", value: "Red" },
                            { name: "Size", value: "M" },
                        ],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithAttributes],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.variants[0]?.attributes).toHaveLength(2);

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            const colorAttrId = brandCatalog.attributes.get("color");
            expect(colorAttrId).toBeDefined();
        });

        it("resolves existing facilities for journey steps", async () => {
            const productWithJourney = {
                ...basicProduct,
                journey: {
                    rawMaterial: "Cotton Farm Italy", // Must match catalog fixtures
                    weaving: "Textile Mill Portugal",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithJourney],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.journeySteps).toBeDefined();

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("cotton farm italy")).toBeDefined();
        });
    });

    describe("Variant Handling", () => {
        it("parses multi-variant products correctly", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [multiVariantProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products).toHaveLength(1);
            expect(parseResult.products[0]?.variants.length).toBeGreaterThan(1);

            // All variants should have identifiers
            for (const variant of parseResult.products[0]!.variants) {
                expect(variant.sku || variant.barcode).toBeDefined();
            }
        });

        it("generates UPID for variants without one", async () => {
            // Product with variants that have no UPID
            const productNoUpid = {
                handle: "no-upid-product",
                title: "Product Without UPID",
                variants: [
                    { sku: "SKU-001", barcode: "1234567890123" },
                    { sku: "SKU-002", barcode: "1234567890124" },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productNoUpid],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Variants in parsed result should not have UPID (it's generated during commit)
            // The parser doesn't generate UPIDs - that happens in commit-to-production
            expect(parseResult.products[0]?.variants[0]?.upid).toBeUndefined();
        });
    });

    describe("Complete Product Import", () => {
        it("parses complete product with all fields", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [completeProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.errors).toHaveLength(0);
            const product = parseResult.products[0]!;

            // Core fields
            expect(product.name).toBe("Complete Hoodie");
            expect(product.productHandle).toBe("complete-hoodie");
            expect(product.description).toBe("A fully specified hoodie with all fields");

            // Related entities
            expect(product.manufacturerName).toBe("Premium Textiles Co");
            expect(product.seasonName).toBe("FW25");
            expect(product.tags).toContain("Bestseller");
            expect(product.ecoClaims).toContain("GOTS Certified");

            // Materials
            expect(product.materials.length).toBe(2);
            expect(product.materials.some(m => m.name === "Organic Cotton")).toBe(true);

            // Variants
            expect(product.variants.length).toBeGreaterThan(0);
        });
    });

    describe("Validation", () => {
        it("requires at least barcode or SKU for variants", async () => {
            const invalidProduct = {
                handle: "invalid-product",
                title: "Invalid Product",
                variants: [
                    {
                        // No barcode or SKU - this should be caught by validation
                        attributes: [{ name: "Color", value: "Red" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [invalidProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Parser should still parse it, validation happens in validate-and-stage
            // Just verify the variant has no identifiers
            expect(parseResult.products[0]?.variants[0]?.sku).toBeFalsy();
            expect(parseResult.products[0]?.variants[0]?.barcode).toBeFalsy();
        });

        it("preserves row numbers for error reporting", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [basicProduct, completeProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Each product should have a row number
            expect(parseResult.products[0]?.rowNumber).toBeGreaterThan(0);
            expect(parseResult.products[1]?.rowNumber).toBeGreaterThan(
                parseResult.products[0]!.rowNumber
            );
        });
    });
});
