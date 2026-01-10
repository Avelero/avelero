/**
 * Unit Tests: Excel Parser - Duplicate Detection
 *
 * Tests detection of duplicate SKUs, Barcodes, and UPIDs within the import file.
 *
 * @group unit
 * @group excel-parser
 */

import "../setup";
import { describe, it, expect } from "bun:test";
import { ExcelBuilder } from "@v1/testing/bulk-import";
import {
    parseExcelFile,
    findDuplicateIdentifiers,
    type ParsedProduct,
} from "../../../src/lib/excel-parser";

describe("Excel Parser - Duplicate Detection", () => {
    it("detects duplicate SKUs within file", async () => {
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

        const skuDuplicates = duplicates.filter((d) => d.field === "SKU");
        expect(skuDuplicates).toHaveLength(1);
        expect(skuDuplicates[0].value).toBe("DUPLICATE-SKU");
        expect(skuDuplicates[0].rows).toHaveLength(2);
    });

    it("detects duplicate barcodes within file", async () => {
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

        const barcodeDuplicates = duplicates.filter((d) => d.field === "Barcode");
        expect(barcodeDuplicates).toHaveLength(1);
        expect(barcodeDuplicates[0].value).toBe("SAME-BARCODE-123");
        expect(barcodeDuplicates[0].rows).toHaveLength(2);
    });

    it("detects duplicate UPIDs within file", async () => {
        const buffer = await ExcelBuilder.create({
            products: [
                {
                    handle: "product-1",
                    title: "Product 1",
                    variants: [
                        { sku: "SKU-001", barcode: "1111111111111", upid: "UPID-001" },
                    ],
                },
                {
                    handle: "product-2",
                    title: "Product 2",
                    variants: [
                        { sku: "SKU-002", barcode: "2222222222222", upid: "UPID-001" },
                    ],
                },
            ],
        });

        const result = await parseExcelFile(buffer);
        const duplicates = findDuplicateIdentifiers(result.products);

        const upidDuplicates = duplicates.filter((d) => d.field === "UPID");
        expect(upidDuplicates).toHaveLength(1);
        expect(upidDuplicates[0].value).toBe("UPID-001");
        expect(upidDuplicates[0].rows).toHaveLength(2);
    });

    it("reports all duplicate locations with row numbers", async () => {
        const buffer = await ExcelBuilder.create({
            products: [
                {
                    handle: "product-1",
                    title: "Product 1",
                    variants: [{ sku: "DUP-SKU", barcode: "1111111111111" }],
                },
                {
                    handle: "product-2",
                    title: "Product 2",
                    variants: [{ sku: "DUP-SKU", barcode: "2222222222222" }],
                },
                {
                    handle: "product-3",
                    title: "Product 3",
                    variants: [{ sku: "DUP-SKU", barcode: "3333333333333" }],
                },
            ],
        });

        const result = await parseExcelFile(buffer);
        const duplicates = findDuplicateIdentifiers(result.products);

        const skuDuplicates = duplicates.filter((d) => d.field === "SKU");
        expect(skuDuplicates).toHaveLength(1);
        // Should report all 3 rows that have the duplicate
        expect(skuDuplicates[0].rows).toHaveLength(3);
        // Rows should be in order (row 4, 5, 6 for data starting at row 4)
        expect(skuDuplicates[0].rows[0]).toBeLessThan(skuDuplicates[0].rows[1]);
        expect(skuDuplicates[0].rows[1]).toBeLessThan(skuDuplicates[0].rows[2]);
    });

    it("returns empty array when no duplicates exist", async () => {
        const buffer = await ExcelBuilder.create({
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

        const result = await parseExcelFile(buffer);
        const duplicates = findDuplicateIdentifiers(result.products);

        expect(duplicates).toEqual([]);
    });

    it("handles duplicates within same product variants", async () => {
        const buffer = await ExcelBuilder.create({
            products: [
                {
                    handle: "product-1",
                    title: "Product 1",
                    variants: [
                        { sku: "VARIANT-SKU", barcode: "1111111111111" },
                        { sku: "VARIANT-SKU", barcode: "1111111111112" }, // Same SKU in same product
                    ],
                },
            ],
        });

        const result = await parseExcelFile(buffer);
        const duplicates = findDuplicateIdentifiers(result.products);

        const skuDuplicates = duplicates.filter((d) => d.field === "SKU");
        expect(skuDuplicates).toHaveLength(1);
        expect(skuDuplicates[0].value).toBe("VARIANT-SKU");
        expect(skuDuplicates[0].rows).toHaveLength(2);
    });

    it("detects multiple types of duplicates at once", async () => {
        const buffer = await ExcelBuilder.create({
            products: [
                {
                    handle: "product-1",
                    title: "Product 1",
                    variants: [
                        {
                            sku: "DUP-SKU",
                            barcode: "DUP-BARCODE",
                            upid: "DUP-UPID",
                        },
                    ],
                },
                {
                    handle: "product-2",
                    title: "Product 2",
                    variants: [
                        {
                            sku: "DUP-SKU",
                            barcode: "DUP-BARCODE",
                            upid: "DUP-UPID",
                        },
                    ],
                },
            ],
        });

        const result = await parseExcelFile(buffer);
        const duplicates = findDuplicateIdentifiers(result.products);

        // Should find duplicates for all three fields
        expect(duplicates.filter((d) => d.field === "SKU")).toHaveLength(1);
        expect(duplicates.filter((d) => d.field === "Barcode")).toHaveLength(1);
        expect(duplicates.filter((d) => d.field === "UPID")).toHaveLength(1);
    });

    it("ignores empty/undefined identifiers", async () => {
        // Products with missing identifiers should not cause false duplicate detection
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
                        sku: undefined, // No SKU
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
                        sku: undefined, // No SKU
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

        // No duplicates because undefined SKUs are ignored
        expect(duplicates.filter((d) => d.field === "SKU")).toHaveLength(0);
    });
});
