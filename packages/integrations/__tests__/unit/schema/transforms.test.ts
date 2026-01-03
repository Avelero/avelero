/**
 * Unit Tests: Shopify Schema Transformations (P0)
 *
 * Tests for transform functions in shopify/schema.ts.
 * These are pure functions for data normalization.
 */

import { describe, expect, test } from "bun:test";
import {
    transformSalesStatus,
    parseShopifyPrice,
    truncateString,
    stripHtmlTags,
    transformTags,
} from "../../../src/connectors/shopify/schema";

// =============================================================================
// 6.1 transformSalesStatus() Tests
// =============================================================================

describe("transformSalesStatus()", () => {
    test("ACTIVE returns 'active'", () => {
        expect(transformSalesStatus("ACTIVE")).toBe("active");
    });

    test("DRAFT returns 'inactive'", () => {
        expect(transformSalesStatus("DRAFT")).toBe("inactive");
    });

    test("ARCHIVED returns 'discontinued'", () => {
        expect(transformSalesStatus("ARCHIVED")).toBe("discontinued");
    });

    test("lowercase 'active' returns 'active'", () => {
        expect(transformSalesStatus("active")).toBe("active");
    });

    test("unknown status returns 'inactive' (default)", () => {
        expect(transformSalesStatus("PENDING")).toBe("inactive");
        expect(transformSalesStatus("UNKNOWN")).toBe("inactive");
        expect(transformSalesStatus("PAUSED")).toBe("inactive");
    });

    test("null input returns 'inactive' (default)", () => {
        expect(transformSalesStatus(null)).toBe("inactive");
    });

    test("empty string returns 'inactive' (default)", () => {
        expect(transformSalesStatus("")).toBe("inactive");
    });

    test("mixed case handling", () => {
        expect(transformSalesStatus("Active")).toBe("active");
        expect(transformSalesStatus("draft")).toBe("inactive");
        expect(transformSalesStatus("Archived")).toBe("discontinued");
    });

    test("undefined input returns 'inactive' (default)", () => {
        expect(transformSalesStatus(undefined)).toBe("inactive");
    });
});

// =============================================================================
// 6.2 parseShopifyPrice() Tests
// =============================================================================

describe("parseShopifyPrice()", () => {
    test("string number parses correctly", () => {
        expect(parseShopifyPrice("99.99")).toBe(99.99);
    });

    test("already a number returns same number", () => {
        expect(parseShopifyPrice(99.99)).toBe(99.99);
    });

    test("integer parses correctly", () => {
        expect(parseShopifyPrice(100)).toBe(100);
        expect(parseShopifyPrice("100")).toBe(100);
    });

    test("zero parses correctly", () => {
        expect(parseShopifyPrice("0")).toBe(0);
        expect(parseShopifyPrice(0)).toBe(0);
    });

    test("invalid string returns null", () => {
        expect(parseShopifyPrice("not-a-price")).toBeNull();
        expect(parseShopifyPrice("abc")).toBeNull();
    });

    test("null returns null", () => {
        expect(parseShopifyPrice(null)).toBeNull();
    });

    test("empty string returns null", () => {
        expect(parseShopifyPrice("")).toBeNull();
    });

    test("currency prefix returns null (strict parsing)", () => {
        expect(parseShopifyPrice("$99.99")).toBeNull();
        expect(parseShopifyPrice("€100")).toBeNull();
    });

    test("undefined returns null", () => {
        expect(parseShopifyPrice(undefined)).toBeNull();
    });

    test("handles decimal variations", () => {
        expect(parseShopifyPrice("0.99")).toBe(0.99);
        expect(parseShopifyPrice("123.456")).toBe(123.456);
        expect(parseShopifyPrice(".99")).toBe(0.99);
    });

    test("handles negative numbers", () => {
        expect(parseShopifyPrice("-10")).toBe(-10);
        expect(parseShopifyPrice("-99.99")).toBe(-99.99);
    });
});

// =============================================================================
// 6.3 truncateString() Tests
// =============================================================================

describe("truncateString()", () => {
    test("string within limit unchanged", () => {
        expect(truncateString("Short", 255)).toBe("Short");
    });

    test("string at limit unchanged", () => {
        const str = "a".repeat(255);
        expect(truncateString(str, 255)).toBe(str);
        expect(truncateString(str, 255)?.length).toBe(255);
    });

    test("string over limit is truncated", () => {
        const str = "a".repeat(300);
        const result = truncateString(str, 255);
        expect(result?.length).toBe(255);
        expect(result).toBe("a".repeat(255));
    });

    test("null input returns null", () => {
        expect(truncateString(null, 255)).toBeNull();
    });

    test("empty string returns empty string (trimmed)", () => {
        const result = truncateString("", 255);
        expect(result).toBe("");
    });

    test("non-string converted but typed as null", () => {
        // truncateString converts numbers to strings via String()
        const result = truncateString(12345, 10);
        expect(result).toBe("12345");
    });

    test("whitespace is trimmed", () => {
        expect(truncateString("  hello  ", 255)).toBe("hello");
    });

    test("handles unicode correctly", () => {
        const str = "café".repeat(100);
        const result = truncateString(str, 50);
        expect(result?.length).toBe(50);
    });

    test("undefined returns null", () => {
        expect(truncateString(undefined, 255)).toBeNull();
    });
});

// =============================================================================
// 6.4 stripHtmlTags() Tests
// =============================================================================

describe("stripHtmlTags()", () => {
    test("simple tags removed", () => {
        expect(stripHtmlTags("<p>Hello</p>")).toBe("Hello");
    });

    test("nested tags removed", () => {
        expect(stripHtmlTags("<div><p>Text</p></div>")).toBe("Text");
    });

    test("self-closing tags removed", () => {
        expect(stripHtmlTags("Line 1<br/>Line 2")).toBe("Line 1Line 2");
        expect(stripHtmlTags("Line 1<br />Line 2")).toBe("Line 1Line 2");
    });

    test("no tags returns same text", () => {
        expect(stripHtmlTags("Plain text")).toBe("Plain text");
    });

    test("empty string returns null (falsy input)", () => {
        // Empty string is falsy, so treated as "no input" and returns null
        expect(stripHtmlTags("")).toBeNull();
    });

    test("only tags returns empty string", () => {
        expect(stripHtmlTags("<div></div>")).toBe("");
        expect(stripHtmlTags("<span><br/></span>")).toBe("");
    });

    test("attributes removed with tags", () => {
        expect(stripHtmlTags("<a href='x'>Link</a>")).toBe("Link");
        expect(stripHtmlTags('<a href="https://example.com" class="btn">Click</a>')).toBe("Click");
    });

    test("script tags content included (basic regex)", () => {
        // Note: stripHtmlTags uses basic regex, doesn't remove script content
        // The implementation removes tags but not content between script tags
        const result = stripHtmlTags("<script>alert('x')</script>");
        expect(result).toBe("alert('x')");
    });

    test("null input returns null", () => {
        expect(stripHtmlTags(null)).toBeNull();
    });

    test("non-string input returns null", () => {
        expect(stripHtmlTags(123 as unknown as string)).toBeNull();
        expect(stripHtmlTags({} as unknown as string)).toBeNull();
    });

    test("multiple spaces preserved", () => {
        const result = stripHtmlTags("<p>Hello   World</p>");
        expect(result).toBe("Hello   World");
    });

    test("newlines preserved", () => {
        const result = stripHtmlTags("<p>Line1\nLine2</p>");
        expect(result).toBe("Line1\nLine2");
    });
});

// =============================================================================
// 6.5 transformTags() Tests
// =============================================================================

describe("transformTags()", () => {
    test("array input unchanged", () => {
        expect(transformTags(["summer", "sports"])).toEqual(["summer", "sports"]);
    });

    test("comma-separated string parsed", () => {
        expect(transformTags("summer, sports")).toEqual(["summer", "sports"]);
    });

    test("case is preserved (no normalization)", () => {
        // transformTags does NOT lowercase - it only trims
        expect(transformTags(["SUMMER", "Sports"])).toEqual(["SUMMER", "Sports"]);
    });

    test("empty array returns empty array", () => {
        expect(transformTags([])).toEqual([]);
    });

    test("empty string returns empty array", () => {
        expect(transformTags("")).toEqual([]);
    });

    test("whitespace handling in string", () => {
        expect(transformTags(" summer , sports ")).toEqual(["summer", "sports"]);
    });

    test("single tag from string", () => {
        expect(transformTags("single")).toEqual(["single"]);
    });

    test("null input returns empty array", () => {
        expect(transformTags(null)).toEqual([]);
    });

    test("undefined input returns empty array", () => {
        expect(transformTags(undefined)).toEqual([]);
    });

    test("non-string array items converted to strings", () => {
        const result = transformTags([1, 2, 3] as unknown as string[]);
        expect(result).toEqual(["1", "2", "3"]);
    });

    test("empty strings filtered from array", () => {
        expect(transformTags(["summer", "", "sports", "  "])).toEqual(["summer", "sports"]);
    });

    test("complex comma-separated handling", () => {
        expect(transformTags("a,b,c")).toEqual(["a", "b", "c"]);
        expect(transformTags("a, b, c")).toEqual(["a", "b", "c"]);
        expect(transformTags("a , b , c")).toEqual(["a", "b", "c"]);
    });
});
