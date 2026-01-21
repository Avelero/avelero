/**
 * Unit Tests: Error Report Row Inclusion
 *
 * Tests the logic for determining which rows are included in the error report.
 *
 * Key behavior: When a product has errors (BLOCKED or PENDING_WITH_WARNINGS),
 * ALL variants should be included in the error report, not just variants
 * with their own errors. This gives users complete product context for corrections.
 *
 * @module tests/unit/error-report/row-inclusion
 */

import { describe, expect, it } from "bun:test";
import {
  type ProductData,
  getErrorReportRows,
} from "../../../src/lib/error-report-utils";

describe("getErrorReportRows", () => {
  // ============================================================================
  // Basic inclusion rules
  // ============================================================================

  describe("basic inclusion rules", () => {
    it("B1: should include parent row when product has errors", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Product Title", message: "Title required" }],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "", "Product Handle": "handle-1" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.rowNumber).toBe(4);
      expect(rows[0]!.errors).toHaveLength(1);
      expect(rows[0]!.errors[0]!.field).toBe("Product Title");
    });

    it("B2: should include variant rows that have errors", () => {
      const product: ProductData = {
        rowStatus: "PENDING_WITH_WARNINGS",
        productErrors: [],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Product 1", Barcode: "123" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "invalid" },
            errors: [{ field: "Barcode", message: "Invalid barcode format" }],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      // Both rows should be included
      expect(rows).toHaveLength(2);
      expect(rows[1]!.errors).toHaveLength(1);
    });

    it("B3: should include variant rows WITHOUT errors when product has errors", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Product Title", message: "Title invalid" }],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Bad Title", Barcode: "123" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "456" },
            errors: [], // This variant has NO errors but should still be included
          },
        ],
      };

      const rows = getErrorReportRows(product);

      // BOTH rows should be included even though variant 2 has no errors
      expect(rows).toHaveLength(2);
      expect(rows[0]!.rowNumber).toBe(4);
      expect(rows[1]!.rowNumber).toBe(5);
      expect(rows[1]!.errors).toHaveLength(0); // Variant 2 has no errors
    });

    it("B4: should NOT include any rows when product has no errors", () => {
      const product: ProductData = {
        rowStatus: "PENDING", // PENDING means no errors
        productErrors: [],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Good Product", Barcode: "123" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "456" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(0);
    });
  });

  // ============================================================================
  // All variants included
  // ============================================================================

  describe("all variants included", () => {
    it("B-EC1: product with 1 variant with error - include 1 row", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Category", message: "Category not found" }],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Product", Category: "NonExistent" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(1);
    });

    it("B-EC2: product with 20 variants, 1 has error - include all 20 rows", () => {
      const variants = Array.from({ length: 20 }, (_, i) => ({
        rowNumber: 4 + i,
        rawData: { Barcode: `barcode-${i}` },
        errors: i === 10 ? [{ field: "Barcode", message: "Invalid" }] : [],
      }));

      const product: ProductData = {
        rowStatus: "PENDING_WITH_WARNINGS",
        productErrors: [],
        variants,
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(20);
      // Only variant 10 should have errors
      expect(rows[10]!.errors).toHaveLength(1);
      // Other variants should have no errors but still be included
      expect(rows[0]!.errors).toHaveLength(0);
      expect(rows[19]!.errors).toHaveLength(0);
    });

    it("B-EC3: product with 3 variants, parent/first-variant has error - include all 3 rows", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [
          { field: "Product Title", message: "Title is invalid" },
        ],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Bad", Barcode: "123" },
            errors: [], // Parent's own errors empty, but gets product errors
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "456" },
            errors: [],
          },
          {
            rowNumber: 6,
            rawData: { Barcode: "789" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(3);
      // Parent row gets product-level errors
      expect(rows[0]!.errors).toHaveLength(1);
      expect(rows[0]!.errors[0]!.field).toBe("Product Title");
      // Child rows have no errors but are still included
      expect(rows[1]!.errors).toHaveLength(0);
      expect(rows[2]!.errors).toHaveLength(0);
    });

    it("B-EC4: product with 3 variants, only child variant 2 has error - include all 3 rows", () => {
      const product: ProductData = {
        rowStatus: "PENDING_WITH_WARNINGS",
        productErrors: [],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Good Product", Barcode: "123" },
            errors: [],
          },
          {
            rowNumber: 5, // This is the variant with the error
            rawData: { Barcode: "invalid" },
            errors: [{ field: "Barcode", message: "Invalid barcode" }],
          },
          {
            rowNumber: 6,
            rawData: { Barcode: "789" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(3);
      // Only variant 2 (index 1) has errors
      expect(rows[0]!.errors).toHaveLength(0);
      expect(rows[1]!.errors).toHaveLength(1);
      expect(rows[2]!.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Product status handling
  // ============================================================================

  describe("product status handling", () => {
    it("B-EC5: BLOCKED status - include all variants", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Image", message: "Invalid image URL" }],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Product", Image: "bad-url" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "123" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(2);
    });

    it("B-EC6: PENDING_WITH_WARNINGS status - include all variants", () => {
      const product: ProductData = {
        rowStatus: "PENDING_WITH_WARNINGS",
        productErrors: [
          {
            field: "Status",
            message: 'Invalid status. Defaulting to "unpublished".',
          },
        ],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Product", Status: "xyz" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "123" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows).toHaveLength(2);
    });
  });

  // ============================================================================
  // Multiple products (isolation)
  // ============================================================================

  describe("product isolation", () => {
    it("B-EC7: only include products with errors, but all their variants", () => {
      // Test that when processing multiple products, only products with errors
      // are included, but ALL variants of those products are included
      const productWithErrors: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Product Title", message: "Title invalid" }],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Bad" },
            errors: [],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "123" },
            errors: [],
          },
        ],
      };

      const productWithoutErrors: ProductData = {
        rowStatus: "PENDING",
        productErrors: [],
        variants: [
          {
            rowNumber: 10,
            rawData: { "Product Title": "Good" },
            errors: [],
          },
          {
            rowNumber: 11,
            rawData: { Barcode: "456" },
            errors: [],
          },
        ],
      };

      const rowsWithErrors = getErrorReportRows(productWithErrors);
      const rowsWithoutErrors = getErrorReportRows(productWithoutErrors);

      // Product with errors: all variants included
      expect(rowsWithErrors).toHaveLength(2);
      // Product without errors: no variants included
      expect(rowsWithoutErrors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error assignment
  // ============================================================================

  describe("error assignment", () => {
    it("assigns product-level errors only to parent row", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [
          { field: "Product Title", message: "Title error" },
          { field: "Category", message: "Category error" },
        ],
        variants: [
          {
            rowNumber: 4,
            rawData: { "Product Title": "Bad", Category: "Invalid" },
            errors: [{ field: "Barcode", message: "Barcode error" }],
          },
          {
            rowNumber: 5,
            rawData: { Barcode: "good" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      // Parent row should have product errors + its own variant errors
      expect(rows[0]!.errors).toHaveLength(3);
      expect(rows[0]!.errors.map((e) => e.field)).toContain("Product Title");
      expect(rows[0]!.errors.map((e) => e.field)).toContain("Category");
      expect(rows[0]!.errors.map((e) => e.field)).toContain("Barcode");

      // Child row should NOT have product errors
      expect(rows[1]!.errors).toHaveLength(0);
    });

    it("preserves row numbers from original data", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Product Title", message: "Error" }],
        variants: [
          {
            rowNumber: 100, // Non-sequential row number
            rawData: { "Product Title": "Bad" },
            errors: [],
          },
          {
            rowNumber: 150, // Another non-sequential
            rawData: { Barcode: "123" },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows[0]!.rowNumber).toBe(100);
      expect(rows[1]!.rowNumber).toBe(150);
    });

    it("preserves raw data from original rows", () => {
      const product: ProductData = {
        rowStatus: "BLOCKED",
        productErrors: [{ field: "Product Title", message: "Error" }],
        variants: [
          {
            rowNumber: 4,
            rawData: {
              "Product Title": "Test Product",
              "Product Handle": "test-handle",
              Category: "Test Category",
            },
            errors: [],
          },
        ],
      };

      const rows = getErrorReportRows(product);

      expect(rows[0]!.raw["Product Title"]).toBe("Test Product");
      expect(rows[0]!.raw["Product Handle"]).toBe("test-handle");
      expect(rows[0]!.raw.Category).toBe("Test Category");
    });
  });
});
