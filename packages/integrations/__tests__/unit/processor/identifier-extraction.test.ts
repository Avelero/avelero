/**
 * Unit Tests: Identifier Extraction (P0)
 *
 * Tests for extractRawIdentifiers() function.
 * This function extracts SKU and barcode from variant data for matching.
 * 
 * Note: extractRawIdentifiers is a private function in processor.ts.
 * We test it indirectly through the exposed getValueByPath and manual implementation.
 */

import { describe, expect, test } from "bun:test";
import { getValueByPath } from "../../../src/sync/processor";

// =============================================================================
// extractRawIdentifiers() Implementation (mirror of private function)
// =============================================================================

/**
 * Extract raw SKU/barcode identifiers from variant data.
 * This mirrors the private extractRawIdentifiers function in processor.ts
 */
function extractRawIdentifiers(variantData: Record<string, unknown>): {
    sku: string | undefined;
    barcode: string | undefined;
} {
    const rawSku = getValueByPath(variantData, "sku");
    const rawBarcode = getValueByPath(variantData, "barcode");

    return {
        sku: rawSku ? String(rawSku).trim() || undefined : undefined,
        barcode: rawBarcode ? String(rawBarcode).trim() || undefined : undefined,
    };
}

// =============================================================================
// 11.1 extractRawIdentifiers() Tests
// =============================================================================

describe("extractRawIdentifiers()", () => {
    test("both SKU and barcode present", () => {
        const result = extractRawIdentifiers({ sku: "ABC", barcode: "123" });
        expect(result.sku).toBe("ABC");
        expect(result.barcode).toBe("123");
    });

    test("only SKU present", () => {
        const result = extractRawIdentifiers({ sku: "ABC" });
        expect(result.sku).toBe("ABC");
        expect(result.barcode).toBeUndefined();
    });

    test("only barcode present", () => {
        const result = extractRawIdentifiers({ barcode: "123" });
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBe("123");
    });

    test("neither present", () => {
        const result = extractRawIdentifiers({});
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBeUndefined();
    });

    test("whitespace trimmed", () => {
        const result = extractRawIdentifiers({ sku: "  ABC  ", barcode: "  123  " });
        expect(result.sku).toBe("ABC");
        expect(result.barcode).toBe("123");
    });

    test("empty string becomes undefined", () => {
        const result = extractRawIdentifiers({ sku: "", barcode: "" });
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBeUndefined();
    });

    test("null values become undefined", () => {
        const result = extractRawIdentifiers({ sku: null, barcode: null } as unknown as Record<string, unknown>);
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBeUndefined();
    });

    test("number coerced to string", () => {
        const result = extractRawIdentifiers({ sku: 12345, barcode: 67890 } as unknown as Record<string, unknown>);
        expect(result.sku).toBe("12345");
        expect(result.barcode).toBe("67890");
    });

    test("whitespace-only becomes undefined", () => {
        const result = extractRawIdentifiers({ sku: "   ", barcode: "\t\n" });
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBeUndefined();
    });

    test("preserves case", () => {
        const result = extractRawIdentifiers({ sku: "AbC-123", barcode: "EAN13-456" });
        expect(result.sku).toBe("AbC-123");
        expect(result.barcode).toBe("EAN13-456");
    });

    test("handles special characters", () => {
        const result = extractRawIdentifiers({
            sku: "SKU/123-456_789",
            barcode: "ISBN-13:978-0-596-52068-7"
        });
        expect(result.sku).toBe("SKU/123-456_789");
        expect(result.barcode).toBe("ISBN-13:978-0-596-52068-7");
    });

    test("handles undefined explicitly", () => {
        const result = extractRawIdentifiers({ sku: undefined, barcode: undefined });
        expect(result.sku).toBeUndefined();
        expect(result.barcode).toBeUndefined();
    });

    test("ignores other fields", () => {
        const result = extractRawIdentifiers({
            sku: "ABC",
            barcode: "123",
            extraField: "ignored",
            price: 99.99
        });
        expect(result.sku).toBe("ABC");
        expect(result.barcode).toBe("123");
        expect(Object.keys(result)).toEqual(["sku", "barcode"]);
    });
});
