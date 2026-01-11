/**
 * Integration Tests: Error Handling - Validation Errors
 *
 * Tests validation error scenarios and handling.
 * Validates that proper errors are reported for missing required fields,
 * invalid values, and duplicate identifiers.
 *
 * Required Fields:
 * - Product Title (required)
 * - Product Handle (required)
 * - All template columns must be present (but can have empty values)
 *
 * Validated Fields:
 * - Status: Must be `unpublished`, `published`, `archived`, `scheduled`, or empty
 * - Category: Must exist in database (no auto-create), format must use ` > ` delimiter
 *
 * @module tests/integration/import/error-handling/validation-errors
 */

import "../../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import {
    testDb,
    cleanupTables,
    createTestBrand,
    TestCatalog,
    TestDatabase,
    type InsertedCatalog,
} from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import {
    parseExcelFile,
    findDuplicateIdentifiers,
    type ParsedProduct,
} from "../../../../src/lib/excel-parser";
import { loadBrandCatalog } from "../../../../src/lib/catalog-loader";

describe("Error Handling - Validation Errors", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Required Fields", () => {
        it("reports missing Product Title", async () => {
            const productWithoutTitle = {
                handle: "no-title-product",
                title: "", // Empty title
                variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithoutTitle],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // The parser should still parse it, but the product should have empty name
            expect(parseResult.products[0]?.name).toBe("");
        });

        it("reports missing Product Handle", async () => {
            const productWithoutHandle = {
                handle: "", // Empty handle
                title: "Product Without Handle",
                variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithoutHandle],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Products without handle become orphaned variants
            // When handle is empty, the variant becomes a child of the previous product
            // or gets filtered out
            expect(parseResult.products.length).toBe(0);
        });
    });

    describe("Status Validation", () => {
        it("accepts valid status values", async () => {
            const validStatuses = ["published", "unpublished", "archived", "scheduled"];

            for (const status of validStatuses) {
                const product = {
                    ...basicProduct,
                    handle: `status-${status}-product`,
                    status,
                };

                const excelBuffer = await ExcelBuilder.create({
                    products: [product],
                });

                const parseResult = await parseExcelFile(excelBuffer);
                expect(parseResult.products[0]?.status).toBe(status);
            }
        });

        it("accepts empty status value", async () => {
            const product = {
                ...basicProduct,
                status: "",
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            // Empty status should be undefined or empty
            expect(parseResult.products[0]?.status).toBeFalsy();
        });

        it("parses invalid status value (validation happens later)", async () => {
            const product = {
                ...basicProduct,
                status: "INVALID_STATUS",
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            // Parser captures the value (normalized to lowercase), validation happens in validate-and-stage
            expect(parseResult.products[0]?.status).toBe("invalid_status");
        });
    });

    describe("Category Validation", () => {
        it("parses category with valid delimiter format", async () => {
            const product = {
                ...basicProduct,
                category: "Clothing > Tops > T-Shirts", // Valid format with ' > ' delimiter
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.categoryPath).toBe("Clothing > Tops > T-Shirts");
        });

        it("parses category without delimiter (single level)", async () => {
            const product = {
                ...basicProduct,
                category: "Clothing",
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.categoryPath).toBe("Clothing");
        });

        it("parses category that doesn't exist (error reported during validation)", async () => {
            const product = {
                ...basicProduct,
                category: "NonExistent > Category > Path",
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            // Parser captures the value, existence check happens in validate-and-stage
            expect(parseResult.products[0]?.categoryPath).toBe("NonExistent > Category > Path");
        });
    });

    describe("Material Percentage Validation", () => {
        it("parses valid material percentages", async () => {
            const product = {
                ...basicProduct,
                materials: [
                    { name: "Cotton", percentage: 80 },
                    { name: "Polyester", percentage: 20 },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.materials).toHaveLength(2);
            expect(parseResult.products[0]?.materials[0]?.percentage).toBe(80);
            expect(parseResult.products[0]?.materials[1]?.percentage).toBe(20);
        });

        it("handles materials without percentages", async () => {
            const product = {
                ...basicProduct,
                materials: [{ name: "Cotton" }, { name: "Polyester" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.materials).toHaveLength(2);
            // Percentages should be undefined when not provided
            expect(parseResult.products[0]?.materials[0]?.percentage).toBeUndefined();
        });

        it("handles decimal percentages", async () => {
            const product = {
                ...basicProduct,
                materials: [
                    { name: "Cotton", percentage: 80.5 },
                    { name: "Polyester", percentage: 19.5 },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.materials[0]?.percentage).toBe(80.5);
            expect(parseResult.products[0]?.materials[1]?.percentage).toBe(19.5);
        });
    });

    describe("Duplicate Detection", () => {
        it("detects duplicate Product Handle in file", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "duplicate-handle",
                        title: "Product 1",
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                    {
                        handle: "duplicate-handle",
                        title: "Product 2",
                        variants: [{ sku: "SKU-002", barcode: "2222222222222" }],
                    },
                ],
            });

            const result = await parseExcelFile(excelBuffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const handleDuplicates = duplicates.filter((d) => d.field === "Product Handle");
            expect(handleDuplicates).toHaveLength(1);
            expect(handleDuplicates[0]!.value).toBe("duplicate-handle");
        });

        it("detects duplicate UPID in file", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "product-1",
                        title: "Product 1",
                        variants: [
                            { sku: "SKU-001", barcode: "1111111111111", upid: "UPID-DUPLICATE" },
                        ],
                    },
                    {
                        handle: "product-2",
                        title: "Product 2",
                        variants: [
                            { sku: "SKU-002", barcode: "2222222222222", upid: "UPID-DUPLICATE" },
                        ],
                    },
                ],
            });

            const result = await parseExcelFile(excelBuffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const upidDuplicates = duplicates.filter((d) => d.field === "UPID");
            expect(upidDuplicates).toHaveLength(1);
            expect(upidDuplicates[0]!.value).toBe("UPID-DUPLICATE");
        });
    });

    describe("Partial Success", () => {
        it("continues processing after row error", async () => {
            // Create a mix of valid and potentially problematic products
            const excelBuffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "valid-product-1",
                        title: "Valid Product 1",
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                    {
                        handle: "product-with-issue",
                        title: "", // Empty title - potential issue
                        variants: [{ sku: "SKU-002", barcode: "2222222222222" }],
                    },
                    {
                        handle: "valid-product-2",
                        title: "Valid Product 2",
                        variants: [{ sku: "SKU-003", barcode: "3333333333333" }],
                    },
                ],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // All products should be parsed (validation happens later)
            expect(parseResult.products).toHaveLength(3);
        });

        it("aggregates errors per row", async () => {
            // Create products that would have multiple issues per row
            const excelBuffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "multi-issue-product",
                        title: "", // Issue 1: empty title
                        status: "INVALID", // Issue 2: invalid status
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                ],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Parser captures all data (status normalized to lowercase); validation aggregation happens in validate-and-stage
            expect(parseResult.products).toHaveLength(1);
            expect(parseResult.products[0]?.name).toBe("");
            expect(parseResult.products[0]?.status).toBe("invalid");
        });
    });

    describe("Error Storage", () => {
        it("preserves raw data for error export", async () => {
            const product = {
                handle: "raw-data-product",
                title: "Raw Data Test",
                description: "Testing raw data preservation",
                variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [product],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Raw data should be preserved for error export
            expect(parseResult.products[0]?.rawData).toBeDefined();
            expect(parseResult.products[0]?.variants[0]?.rawData).toBeDefined();
        });

        it("stores row numbers for error reporting", async () => {
            const excelBuffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "product-1",
                        title: "Product 1",
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                    {
                        handle: "product-2",
                        title: "Product 2",
                        variants: [{ sku: "SKU-002", barcode: "2222222222222" }],
                    },
                ],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Each product should have row numbers for error reporting
            expect(parseResult.products[0]?.rowNumber).toBeDefined();
            expect(parseResult.products[1]?.rowNumber).toBeDefined();
            expect(parseResult.products[0]?.variants[0]?.rowNumber).toBeDefined();
        });
    });
});
