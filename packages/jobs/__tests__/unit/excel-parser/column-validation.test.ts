/**
 * Unit Tests: Excel Parser - Column Validation
 *
 * Tests validation of required and optional columns.
 * Required: Product Title, Product Handle, and at least one of Barcode/SKU.
 *
 * @group unit
 * @group excel-parser
 */

import "../setup";
import { describe, it, expect } from "bun:test";
import { validateRequiredColumns } from "../../../src/lib/excel-parser";

describe("Excel Parser - Column Validation", () => {
    it("accepts valid column names with all required columns", () => {
        const headers = [
            "Product Handle",
            "Product Title",
            "SKU",
            "Barcode",
            "Description",
        ];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("rejects missing Product Title column", () => {
        const headers = ["Product Handle", "SKU", "Barcode"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(false);
        expect(result.missingColumns).toContain("Product Title");
    });

    it("rejects missing Product Handle column", () => {
        const headers = ["Product Title", "SKU", "Barcode"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(false);
        expect(result.missingColumns).toContain("Product Handle");
    });

    it("rejects missing identifier columns (both SKU and Barcode)", () => {
        const headers = ["Product Handle", "Product Title", "Description"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(false);
        expect(result.missingColumns).toContain(
            "Barcode or SKU (at least one required)"
        );
    });

    it("accepts with only SKU as identifier", () => {
        const headers = ["Product Handle", "Product Title", "SKU"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("accepts with only Barcode as identifier", () => {
        const headers = ["Product Handle", "Product Title", "Barcode"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("ignores extra unknown columns", () => {
        const headers = [
            "Product Handle",
            "Product Title",
            "SKU",
            "Unknown Column 1",
            "Unknown Column 2",
            "Custom Field",
        ];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("handles case variations in column names", () => {
        // The parser uses COLUMN_ALIASES for case-insensitive matching
        const headers = ["product handle", "product title", "sku"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("handles alternative column name aliases", () => {
        // Testing alternative names like "Title" for "Product Title"
        const headers = ["Handle", "Title", "Barcode"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("handles EAN as alias for Barcode", () => {
        const headers = ["Product Handle", "Product Title", "EAN"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
        expect(result.missingColumns).toEqual([]);
    });

    it("returns all missing columns at once", () => {
        const headers = ["Description", "Image"]; // Missing all required

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(false);
        expect(result.missingColumns).toContain("Product Title");
        expect(result.missingColumns).toContain("Product Handle");
        expect(result.missingColumns).toContain(
            "Barcode or SKU (at least one required)"
        );
        expect(result.missingColumns).toHaveLength(3);
    });

    it("accepts optional columns being absent", () => {
        // Minimal valid headers - only required columns
        const headers = ["Product Handle", "Product Title", "SKU"];

        const result = validateRequiredColumns(headers);

        expect(result.valid).toBe(true);
    });
});
