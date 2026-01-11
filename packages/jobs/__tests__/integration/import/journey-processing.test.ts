/**
 * Integration Tests: Journey Processing
 *
 * Tests supply chain journey handling during import.
 * Validates linking facilities to journey steps and auto-creation
 * in ENRICH mode.
 *
 * @module tests/integration/import/journey-processing
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, type InsertedCatalog } from "@v1/db/testing";
import { ExcelBuilder, basicProduct, completeProduct } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel-parser";
import { loadBrandCatalog, type BrandCatalog } from "../../../src/lib/catalog-loader";
import * as schema from "@v1/db/schema";
import { eq } from "drizzle-orm";

describe("Journey Processing", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Individual Journey Steps", () => {
        it("links Raw Material facility", async () => {
            const productWithRawMaterial = {
                ...basicProduct,
                journey: {
                    rawMaterial: "Cotton Farm Italy",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithRawMaterial],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Raw Material"]).toBe("Cotton Farm Italy");

            // Verify facility exists in catalog
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("cotton farm italy")).toBeDefined();
        });

        it("links Weaving facility", async () => {
            const productWithWeaving = {
                ...basicProduct,
                journey: {
                    weaving: "Textile Mill Portugal",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithWeaving],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Weaving"]).toBe("Textile Mill Portugal");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("textile mill portugal")).toBeDefined();
        });

        it("links Dyeing/Printing facility", async () => {
            const productWithDyeing = {
                ...basicProduct,
                journey: {
                    dyeingPrinting: "Dyeing Factory Spain",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithDyeing],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Dyeing / Printing"]).toBe("Dyeing Factory Spain");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("dyeing factory spain")).toBeDefined();
        });

        it("links Stitching facility", async () => {
            const productWithStitching = {
                ...basicProduct,
                journey: {
                    stitching: "Stitching Workshop Poland",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithStitching],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Stitching"]).toBe("Stitching Workshop Poland");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("stitching workshop poland")).toBeDefined();
        });

        it("links Assembly facility", async () => {
            const productWithAssembly = {
                ...basicProduct,
                journey: {
                    assembly: "Assembly Plant Germany",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithAssembly],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Assembly"]).toBe("Assembly Plant Germany");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("assembly plant germany")).toBeDefined();
        });

        it("links Finishing facility", async () => {
            const productWithFinishing = {
                ...basicProduct,
                journey: {
                    finishing: "Finishing Center Netherlands",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithFinishing],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            expect(parseResult.products[0]?.journeySteps["Finishing"]).toBe("Finishing Center Netherlands");

            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.get("finishing center netherlands")).toBeDefined();
        });
    });

    describe("Full Journey", () => {
        it("parses complete journey with all steps", async () => {
            // Use completeProduct which has full journey
            const excelBuffer = await ExcelBuilder.create({
                products: [completeProduct],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const journeySteps = parseResult.products[0]?.journeySteps;

            expect(journeySteps?.["Raw Material"]).toBe("Cotton Farm Italy");
            expect(journeySteps?.["Weaving"]).toBe("Textile Mill Portugal");
            expect(journeySteps?.["Dyeing / Printing"]).toBe("Dyeing Factory Spain");
            expect(journeySteps?.["Stitching"]).toBe("Stitching Workshop Poland");
            expect(journeySteps?.["Assembly"]).toBe("Assembly Plant Germany");
            expect(journeySteps?.["Finishing"]).toBe("Finishing Center Netherlands");
        });

        it("handles missing journey steps (partial journey)", async () => {
            const productWithPartialJourney = {
                handle: "partial-journey",
                title: "Partial Journey Product",
                journey: {
                    rawMaterial: "Cotton Farm Italy",
                    // Missing: weaving, dyeingPrinting, stitching, assembly
                    finishing: "Finishing Center Netherlands",
                },
                variants: [{ sku: "PARTIAL-J-001", barcode: "1234567890123" }],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithPartialJourney],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const journeySteps = parseResult.products[0]?.journeySteps;

            expect(journeySteps?.["Raw Material"]).toBe("Cotton Farm Italy");
            expect(journeySteps?.["Finishing"]).toBe("Finishing Center Netherlands");
            // Other steps should be undefined or empty
            expect(journeySteps?.["Weaving"]).toBeFalsy();
            expect(journeySteps?.["Dyeing / Printing"]).toBeFalsy();
        });
    });

    describe("ENRICH Mode - Auto-Creation", () => {
        it("creates facility in ENRICH mode when not found", async () => {
            // Start with empty catalog
            await cleanupTables();
            brandId = await createTestBrand("Test Brand");
            await TestCatalog.setupEmpty(testDb, brandId);

            const productWithNewFacility = {
                ...basicProduct,
                journey: {
                    rawMaterial: "Brand New Farm Location",
                    weaving: "New Weaving Mill",
                },
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithNewFacility],
            });

            const parseResult = await parseExcelFile(excelBuffer);

            // Facilities are parsed
            expect(parseResult.products[0]?.journeySteps["Raw Material"]).toBe("Brand New Farm Location");
            expect(parseResult.products[0]?.journeySteps["Weaving"]).toBe("New Weaving Mill");

            // Verify they don't exist in catalog yet
            const brandCatalog = await loadBrandCatalog(testDb, brandId);
            expect(brandCatalog.operators.has("brand new farm location")).toBe(false);
            expect(brandCatalog.operators.has("new weaving mill")).toBe(false);
        });
    });
});
