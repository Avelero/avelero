/**
 * Unit Tests: Excel Parser - Duplicate Detection
 *
 * Tests detection of duplicate Product Handles and UPIDs within the import file.
 * SKU and Barcode duplicates are NOT checked (user's responsibility).
 *
 * @group unit
 * @group excel-parser
 */


import { describe, it, expect } from "bun:test";
import { ExcelBuilder } from "@v1/testing/bulk-import";
import {
    parseExcelFile,
    findDuplicateIdentifiers,
    type ParsedProduct,
} from "../../../src/lib/excel-parser";

describe("Excel Parser - Duplicate Detection", () => {
    describe("Product Handle Duplicates", () => {
        it("detects duplicate Product Handles within file", async () => {
            const buffer = await ExcelBuilder.create({
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

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const handleDuplicates = duplicates.filter((d) => d.field === "Product Handle");
            expect(handleDuplicates).toHaveLength(1);
            expect(handleDuplicates[0]!.value).toBe("duplicate-handle");
            expect(handleDuplicates[0]!.rows).toHaveLength(2);
        });

        it("reports all locations of duplicate handles with row numbers", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "triple-handle",
                        title: "Product 1",
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                    {
                        handle: "triple-handle",
                        title: "Product 2",
                        variants: [{ sku: "SKU-002", barcode: "2222222222222" }],
                    },
                    {
                        handle: "triple-handle",
                        title: "Product 3",
                        variants: [{ sku: "SKU-003", barcode: "3333333333333" }],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const handleDuplicates = duplicates.filter((d) => d.field === "Product Handle");
            expect(handleDuplicates).toHaveLength(1);
            expect(handleDuplicates[0]!.rows).toHaveLength(3);
            // Rows should be in order
            expect(handleDuplicates[0]!.rows[0]).toBeLessThan(handleDuplicates[0]!.rows[1]!);
            expect(handleDuplicates[0]!.rows[1]).toBeLessThan(handleDuplicates[0]!.rows[2]!);
        });

        it("returns empty array when no duplicate handles exist", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "unique-handle-1",
                        title: "Product 1",
                        variants: [{ sku: "SKU-001", barcode: "1111111111111" }],
                    },
                    {
                        handle: "unique-handle-2",
                        title: "Product 2",
                        variants: [{ sku: "SKU-002", barcode: "2222222222222" }],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            expect(duplicates.filter((d) => d.field === "Product Handle")).toEqual([]);
        });
    });

    describe("UPID Duplicates", () => {
        it("detects duplicate UPIDs within file", async () => {
            const buffer = await ExcelBuilder.create({
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

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const upidDuplicates = duplicates.filter((d) => d.field === "UPID");
            expect(upidDuplicates).toHaveLength(1);
            expect(upidDuplicates[0]!.value).toBe("UPID-DUPLICATE");
            expect(upidDuplicates[0]!.rows).toHaveLength(2);
        });

        it("detects UPID duplicates within same product variants", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "product-1",
                        title: "Product 1",
                        variants: [
                            { sku: "SKU-001", barcode: "1111111111111", upid: "SAME-UPID" },
                            { sku: "SKU-002", barcode: "2222222222222", upid: "SAME-UPID" },
                        ],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            const upidDuplicates = duplicates.filter((d) => d.field === "UPID");
            expect(upidDuplicates).toHaveLength(1);
            expect(upidDuplicates[0]!.value).toBe("SAME-UPID");
        });

        it("ignores empty/undefined UPIDs", async () => {
            // Products with missing UPIDs should not cause false duplicate detection
            const products: ParsedProduct[] = [
                {
                    rowNumber: 4,
                    productHandle: "product-1",
                    name: "Product 1",
                    tags: [],
                    ecoClaims: [],
                    materials: [],
                    journeySteps: {},
                    variants: [
                        {
                            rowNumber: 4,
                            upid: undefined, // No UPID
                            sku: "SKU-001",
                            barcode: "1111111111111",
                            attributes: [],
                            ecoClaimsOverride: [],
                            materialsOverride: [],
                            journeyStepsOverride: {},
                            rawData: {},
                        },
                    ],
                    rawData: {},
                },
                {
                    rowNumber: 5,
                    productHandle: "product-2",
                    name: "Product 2",
                    tags: [],
                    ecoClaims: [],
                    materials: [],
                    journeySteps: {},
                    variants: [
                        {
                            rowNumber: 5,
                            upid: undefined, // No UPID
                            sku: "SKU-002",
                            barcode: "2222222222222",
                            attributes: [],
                            ecoClaimsOverride: [],
                            materialsOverride: [],
                            journeyStepsOverride: {},
                            rawData: {},
                        },
                    ],
                    rawData: {},
                },
            ];

            const duplicates = findDuplicateIdentifiers(products);

            // No duplicates because undefined UPIDs are ignored
            expect(duplicates.filter((d) => d.field === "UPID")).toHaveLength(0);
        });
    });

    describe("SKU and Barcode Duplicates - NOT Checked", () => {
        it("does NOT detect duplicate SKUs (user responsibility)", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "product-1",
                        title: "Product 1",
                        variants: [{ sku: "DUPLICATE-SKU", barcode: "1111111111111" }],
                    },
                    {
                        handle: "product-2",
                        title: "Product 2",
                        variants: [{ sku: "DUPLICATE-SKU", barcode: "2222222222222" }],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            // SKU duplicates should NOT be detected - the function only returns
            // "Product Handle" and "UPID" fields, so there should be no duplicates
            expect(duplicates).toHaveLength(0);
        });

        it("does NOT detect duplicate Barcodes (user responsibility)", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "product-1",
                        title: "Product 1",
                        variants: [{ sku: "SKU-001", barcode: "SAME-BARCODE-123" }],
                    },
                    {
                        handle: "product-2",
                        title: "Product 2",
                        variants: [{ sku: "SKU-002", barcode: "SAME-BARCODE-123" }],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            // Barcode duplicates should NOT be detected - the function only returns
            // "Product Handle" and "UPID" fields, so there should be no duplicates
            expect(duplicates).toHaveLength(0);
        });
    });

    describe("Multiple Duplicate Types", () => {
        it("detects both handle and UPID duplicates at once", async () => {
            const buffer = await ExcelBuilder.create({
                products: [
                    {
                        handle: "dup-handle",
                        title: "Product 1",
                        variants: [
                            { sku: "SKU-001", barcode: "1111111111111", upid: "DUP-UPID" },
                        ],
                    },
                    {
                        handle: "dup-handle",
                        title: "Product 2",
                        variants: [
                            { sku: "SKU-002", barcode: "2222222222222", upid: "DUP-UPID" },
                        ],
                    },
                ],
            });

            const result = await parseExcelFile(buffer);
            const duplicates = findDuplicateIdentifiers(result.products);

            expect(duplicates.filter((d) => d.field === "Product Handle")).toHaveLength(1);
            expect(duplicates.filter((d) => d.field === "UPID")).toHaveLength(1);
        });
    });
});
