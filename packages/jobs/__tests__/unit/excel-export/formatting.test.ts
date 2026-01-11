/**
 * Unit Tests: Excel Export Formatting
 *
 * Tests pure helper functions for data formatting in the Excel export.
 * These tests do not require database access.
 *
 * @module tests/unit/excel-export/formatting
 */


import { describe, it, expect } from "bun:test";
import {
    joinSemicolon,
    formatMaterials,
} from "../../../src/lib/excel-export-products";

describe("joinSemicolon()", () => {
    it("returns empty string for null array", () => {
        const result = joinSemicolon(null);
        expect(result).toBe("");
    });

    it("returns empty string for undefined array", () => {
        const result = joinSemicolon(undefined);
        expect(result).toBe("");
    });

    it("returns empty string for empty array", () => {
        const result = joinSemicolon([]);
        expect(result).toBe("");
    });

    it("returns single item without semicolon", () => {
        const result = joinSemicolon(["Organic"]);
        expect(result).toBe("Organic");
    });

    it("joins multiple items with '; ' separator", () => {
        const result = joinSemicolon(["Organic", "Recycled", "Fair Trade"]);
        expect(result).toBe("Organic; Recycled; Fair Trade");
    });

    it("handles items with special characters", () => {
        const result = joinSemicolon(["50% recycled", "100% organic"]);
        expect(result).toBe("50% recycled; 100% organic");
    });
});

describe("formatMaterials()", () => {
    it("returns empty strings for null materials", () => {
        const result = formatMaterials(null);
        expect(result).toEqual({ names: "", percentages: "" });
    });

    it("returns empty strings for undefined materials", () => {
        const result = formatMaterials(undefined);
        expect(result).toEqual({ names: "", percentages: "" });
    });

    it("returns empty strings for empty array", () => {
        const result = formatMaterials([]);
        expect(result).toEqual({ names: "", percentages: "" });
    });

    it("separates names and percentages correctly for single material", () => {
        const result = formatMaterials([{ name: "Cotton", percentage: 100 }]);
        expect(result).toEqual({ names: "Cotton", percentages: "100" });
    });

    it("separates names and percentages correctly for multiple materials", () => {
        const result = formatMaterials([
            { name: "Cotton", percentage: 60 },
            { name: "Polyester", percentage: 30 },
            { name: "Elastane", percentage: 10 },
        ]);
        expect(result).toEqual({
            names: "Cotton; Polyester; Elastane",
            percentages: "60; 30; 10",
        });
    });

    it("handles materials with null percentage", () => {
        const result = formatMaterials([
            { name: "Cotton", percentage: 70 },
            { name: "Unknown", percentage: null },
            { name: "Polyester", percentage: 30 },
        ]);
        expect(result).toEqual({
            names: "Cotton; Unknown; Polyester",
            percentages: "70; ; 30",
        });
    });

    it("handles all percentages null", () => {
        const result = formatMaterials([
            { name: "Organic Cotton", percentage: null },
            { name: "Hemp", percentage: null },
        ]);
        expect(result).toEqual({
            names: "Organic Cotton; Hemp",
            percentages: "; ",
        });
    });

    it("handles decimal percentages", () => {
        const result = formatMaterials([
            { name: "Cotton", percentage: 65.5 },
            { name: "Polyester", percentage: 34.5 },
        ]);
        expect(result).toEqual({
            names: "Cotton; Polyester",
            percentages: "65.5; 34.5",
        });
    });
});
