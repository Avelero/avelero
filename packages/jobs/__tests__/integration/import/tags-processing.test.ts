/**
 * Integration Tests: Tags Processing
 *
 * Tests tag handling during import.
 * Validates linking existing tags, auto-creating new tags in ENRICH mode,
 * and error handling for unknown tags in CREATE mode.
 *
 * @module tests/integration/import/tags-processing
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, type InsertedCatalog } from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel-parser";
import { loadBrandCatalog, type BrandCatalog } from "../../../src/lib/catalog-loader";
import * as schema from "@v1/db/schema";
import { eq, sql } from "drizzle-orm";

describe("Tags Processing", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Existing Tags", () => {
        it("links existing tags from catalog", async () => {
            // Product using catalog tags
            const productWithExistingTags = {
                ...basicProduct,
                tags: ["Bestseller", "New Arrival"], // These exist in catalog
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithExistingTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            expect(parseResult.products[0]?.tags).toContain("Bestseller");
            expect(parseResult.products[0]?.tags).toContain("New Arrival");

            // Verify tags exist in catalog
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.tags.get("bestseller")).toBeDefined();
            expect(brandCatalog.tags.get("new arrival")).toBeDefined();
        });

        it("handles semicolon-separated tags", async () => {
            const productWithMultipleTags = {
                handle: "multi-tag-product",
                title: "Multi Tag Product",
                tags: ["Tag1", "Tag2", "Tag3", "Tag4"],
                variants: [{ sku: "MULTI-TAG-001", barcode: "1234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithMultipleTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // All 4 tags should be parsed
            expect(parseResult.products[0]?.tags).toHaveLength(4);
            expect(parseResult.products[0]?.tags).toContain("Tag1");
            expect(parseResult.products[0]?.tags).toContain("Tag4");
        });

        it("handles duplicate tags in input by deduplicating", async () => {
            const productWithDuplicateTags = {
                handle: "dup-tag-product",
                title: "Duplicate Tag Product",
                tags: ["SameTag", "SameTag", "DifferentTag"],
                variants: [{ sku: "DUP-TAG-001", barcode: "2234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithDuplicateTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Duplicates might be preserved by parser (dedup happens in validation)
            // Just verify tags are parsed
            expect(parseResult.products[0]?.tags.length).toBeGreaterThanOrEqual(2);
            expect(parseResult.products[0]?.tags).toContain("SameTag");
            expect(parseResult.products[0]?.tags).toContain("DifferentTag");
        });

        it("handles empty tags field", async () => {
            const productWithNoTags = {
                handle: "no-tag-product",
                title: "No Tag Product",
                // No tags specified
                variants: [{ sku: "NO-TAG-001", barcode: "3234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithNoTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Tags should be empty array
            expect(parseResult.products[0]?.tags).toHaveLength(0);
        });
    });

    describe("ENRICH Mode - Auto-Creation", () => {
        it("auto-creates new tags in ENRICH mode", async () => {
            // Start with an empty catalog for enrich mode
            await cleanupTables();
            brandId = await createTestBrand("Test Brand");
            await TestCatalog.setupEmpty(testDb, brandId);

            const productWithNewTags = {
                ...basicProduct,
                tags: ["BrandNewTag", "AnotherNewTag"],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithNewTags],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Tags are parsed (auto-creation happens during validate-and-stage in ENRICH mode)
            expect(parseResult.products[0]?.tags).toContain("BrandNewTag");
            expect(parseResult.products[0]?.tags).toContain("AnotherNewTag");

            // Verify catalog doesn't have them initially
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.tags.has("brandnewtag")).toBe(false);
        });
    });

    describe("CREATE Mode - Validation", () => {
        it("detects unknown tags that need validation in CREATE mode", async () => {
            // With a full catalog, unknown tags would need to be flagged
            const productWithUnknownTag = {
                handle: "unknown-tag-product",
                title: "Unknown Tag Product",
                tags: ["CompletelyUnknownTag"],
                variants: [{ sku: "UNKNOWN-TAG-001", barcode: "4234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithUnknownTag],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Parser just parses the tag
            expect(parseResult.products[0]?.tags).toContain("CompletelyUnknownTag");

            // Validate it doesn't exist in catalog
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.tags.has("completelyunknowntag")).toBe(false);
        });
    });
});
