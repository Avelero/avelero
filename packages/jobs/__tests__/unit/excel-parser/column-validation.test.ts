/**
 * Unit Tests: Excel Parser - Template Validation
 *
 * Tests strict template matching for the Avelero import template.
 * All columns must match exactly (case-sensitive, no aliases).
 * UPID is the only optional column.
 *
 * @group unit
 * @group excel-parser
 */


import { describe, it, expect } from "bun:test";
import { validateTemplateMatch, EXPECTED_COLUMNS } from "../../../src/lib/excel-parser";

describe("Excel Parser - Template Validation", () => {
    // Get all expected columns as a mutable string array
    const allExpectedColumns: string[] = [...EXPECTED_COLUMNS];

    describe("Valid Templates", () => {
        it("accepts valid template without UPID (import template)", () => {
            const result = validateTemplateMatch(allExpectedColumns);

            expect(result.valid).toBe(true);
            expect(result.missingColumns).toEqual([]);
            expect(result.extraColumns).toEqual([]);
            expect(result.hasUpid).toBe(false);
        });

        it("accepts valid template with UPID (export template)", () => {
            const headersWithUpid = [...allExpectedColumns, "UPID"];

            const result = validateTemplateMatch(headersWithUpid);

            expect(result.valid).toBe(true);
            expect(result.missingColumns).toEqual([]);
            expect(result.extraColumns).toEqual([]);
            expect(result.hasUpid).toBe(true);
        });

        it("accepts columns in any order", () => {
            const shuffledHeaders = [...allExpectedColumns].reverse();

            const result = validateTemplateMatch(shuffledHeaders);

            expect(result.valid).toBe(true);
        });
    });

    describe("Missing Columns", () => {
        it("rejects when Product Title column is missing", () => {
            const headers = allExpectedColumns.filter(h => h !== "Product Title");

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Title");
            expect(result.error).toContain("Missing columns");
        });

        it("rejects when Product Handle column is missing", () => {
            const headers = allExpectedColumns.filter(h => h !== "Product Handle");

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Handle");
        });

        it("rejects when multiple columns are missing", () => {
            const headers = allExpectedColumns.filter(
                h => h !== "Product Title" && h !== "SKU" && h !== "Category"
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Title");
            expect(result.missingColumns).toContain("SKU");
            expect(result.missingColumns).toContain("Category");
            expect(result.missingColumns).toHaveLength(3);
        });

        it("rejects when any expected column is missing", () => {
            // Test that each expected column is required
            for (const column of allExpectedColumns) {
                const headers = allExpectedColumns.filter(h => h !== column);
                const result = validateTemplateMatch(headers);

                expect(result.valid).toBe(false);
                expect(result.missingColumns).toContain(column);
            }
        });
    });

    describe("Extra Columns", () => {
        it("rejects when there are extra columns", () => {
            const headers = [...allExpectedColumns, "Unknown Column"];

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.extraColumns).toContain("Unknown Column");
            expect(result.error).toContain("Unexpected columns");
        });

        it("rejects when there are multiple extra columns", () => {
            const headers = [...allExpectedColumns, "Extra 1", "Extra 2", "Custom Field"];

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.extraColumns).toContain("Extra 1");
            expect(result.extraColumns).toContain("Extra 2");
            expect(result.extraColumns).toContain("Custom Field");
            expect(result.extraColumns).toHaveLength(3);
        });

        it("does not treat UPID as an extra column", () => {
            const headers = [...allExpectedColumns, "UPID"];

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(true);
            expect(result.extraColumns).not.toContain("UPID");
        });
    });

    describe("Case Sensitivity", () => {
        it("rejects when column name has wrong case", () => {
            const headers = allExpectedColumns.map(h =>
                h === "Product Title" ? "product title" : h
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Title");
            expect(result.extraColumns).toContain("product title");
        });

        it("rejects when column name has mixed case variation", () => {
            const headers = allExpectedColumns.map(h =>
                h === "SKU" ? "Sku" : h
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("SKU");
            expect(result.extraColumns).toContain("Sku");
        });
    });

    describe("No Aliases Allowed", () => {
        it("rejects Title instead of Product Title", () => {
            const headers = allExpectedColumns.map(h =>
                h === "Product Title" ? "Title" : h
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Title");
            expect(result.extraColumns).toContain("Title");
        });

        it("rejects Handle instead of Product Handle", () => {
            const headers = allExpectedColumns.map(h =>
                h === "Product Handle" ? "Handle" : h
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Product Handle");
            expect(result.extraColumns).toContain("Handle");
        });

        it("rejects EAN instead of Barcode", () => {
            const headers = allExpectedColumns.map(h =>
                h === "Barcode" ? "EAN" : h
            );

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.missingColumns).toContain("Barcode");
            expect(result.extraColumns).toContain("EAN");
        });
    });

    describe("Error Messages", () => {
        it("includes helpful error message when template mismatches", () => {
            const headers = allExpectedColumns.filter(h => h !== "Product Title");
            headers.push("Wrong Column");

            const result = validateTemplateMatch(headers);

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain("Template mismatch");
            expect(result.error).toContain("Missing columns");
            expect(result.error).toContain("Unexpected columns");
            expect(result.error).toContain("Please use the Avelero template");
        });

        it("only mentions missing columns when no extra columns", () => {
            const headers = allExpectedColumns.filter(h => h !== "Product Title");

            const result = validateTemplateMatch(headers);

            expect(result.error).toContain("Missing columns");
            expect(result.error).not.toContain("Unexpected columns");
        });

        it("only mentions extra columns when no missing columns", () => {
            const headers = [...allExpectedColumns, "Extra Column"];

            const result = validateTemplateMatch(headers);

            expect(result.error).toContain("Unexpected columns");
            expect(result.error).not.toContain("Missing columns");
        });
    });

    describe("EXPECTED_COLUMNS Constant", () => {
        it("exports EXPECTED_COLUMNS constant", () => {
            expect(EXPECTED_COLUMNS).toBeDefined();
            expect(Array.isArray(EXPECTED_COLUMNS)).toBe(true);
        });

        it("includes essential columns", () => {
            expect(EXPECTED_COLUMNS).toContain("Product Title");
            expect(EXPECTED_COLUMNS).toContain("Product Handle");
            expect(EXPECTED_COLUMNS).toContain("SKU");
            expect(EXPECTED_COLUMNS).toContain("Barcode");
            expect(EXPECTED_COLUMNS).toContain("Category");
            expect(EXPECTED_COLUMNS).toContain("Materials");
            expect(EXPECTED_COLUMNS).toContain("Percentages");
        });

        it("does not include UPID (it is optional)", () => {
            expect(EXPECTED_COLUMNS).not.toContain("UPID");
        });
    });
});
