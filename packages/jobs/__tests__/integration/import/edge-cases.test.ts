/**
 * Integration Tests: Edge Cases
 *
 * Tests unusual but valid scenarios including:
 * - Products with many variants
 * - Very long text fields
 * - Special characters and unicode
 * - Re-import scenarios
 *
 * @module tests/integration/import/edge-cases
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  type InsertedCatalog,
  TestCatalog,
  TestDatabase,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import { loadBrandCatalog } from "../../../src/lib/catalog-loader";
import { parseExcelFile } from "../../../src/lib/excel";

describe("Edge Cases", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  describe("High Variant Count", () => {
    it("handles product with 50 variants", async () => {
      // Create a product with 50 variants
      const variants = Array.from({ length: 50 }, (_, i) => ({
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        barcode: `${String(i + 1000000000000 + i)}`,
        attributes: [{ name: "Size", value: `Size-${i + 1}` }],
      }));

      const product = {
        handle: "fifty-variant-product",
        title: "Product With 50 Variants",
        variants,
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.variants).toHaveLength(50);

      // Verify each variant has correct data
      result.products[0]?.variants.forEach((variant, index) => {
        expect(variant.sku).toBe(`SKU-${String(index + 1).padStart(4, "0")}`);
      });
    });
  });

  describe("Long String Fields", () => {
    it("handles very long product title (500+ chars)", async () => {
      const longTitle = "A".repeat(500);

      const product = {
        handle: "long-title-product",
        title: longTitle,
        variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.name).toHaveLength(500);
      expect(result.products[0]?.name).toBe(longTitle);
    });

    it("handles very long description (10000+ chars)", async () => {
      const longDescription = "B".repeat(10000);

      const product = {
        handle: "long-description-product",
        title: "Long Description Product",
        description: longDescription,
        variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.description).toHaveLength(10000);
      expect(result.products[0]?.description).toBe(longDescription);
    });
  });

  describe("Special Characters", () => {
    it("handles unicode characters in text fields", async () => {
      const product = {
        handle: "unicode-product",
        title: "Café Élégant 咖啡 日本語",
        description: "🌿 Organic cotton with émojis ñ ü ö 中文",
        variants: [{ sku: "SKU-UNICODE", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.name).toBe("Café Élégant 咖啡 日本語");
      expect(result.products[0]?.description).toContain("🌿");
      expect(result.products[0]?.description).toContain("中文");
    });

    it("handles emoji in product title", async () => {
      const product = {
        handle: "emoji-product",
        title: "🌱 Eco-Friendly T-Shirt 🌍",
        variants: [{ sku: "SKU-EMOJI", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.name).toContain("🌱");
      expect(result.products[0]?.name).toContain("🌍");
    });

    it("handles special characters in product handle", async () => {
      const product = {
        handle: "product-with-dashes-123",
        title: "Product With Dashes",
        variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.productHandle).toBe("product-with-dashes-123");
    });

    it("handles numbers in product handle", async () => {
      const product = {
        handle: "2024-spring-collection-001",
        title: "Spring Collection",
        variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.productHandle).toBe(
        "2024-spring-collection-001",
      );
    });
  });

  describe("Minimal Data", () => {
    it("handles variant with all optional fields empty", async () => {
      const product = {
        handle: "minimal-product",
        title: "Minimal Product",
        variants: [
          {
            sku: "SKU-001",
            barcode: "1234567890123",
            // No attributes, no weight, no UPID
          },
        ],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.variants).toHaveLength(1);
      expect(result.products[0]?.variants[0]?.attributes).toHaveLength(0);
    });

    it("handles product with no optional fields", async () => {
      const product = {
        handle: "bare-minimum-product",
        title: "Bare Minimum",
        variants: [{ sku: "SKU-BARE", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.name).toBe("Bare Minimum");
      expect(result.products[0]?.manufacturerName).toBeFalsy();
      expect(result.products[0]?.seasonName).toBeFalsy();
      expect(result.products[0]?.description).toBeFalsy();
      expect(result.products[0]?.categoryPath).toBeFalsy();
    });
  });

  describe("Re-import Scenarios", () => {
    it("handles re-import of same file content", async () => {
      const product = {
        handle: "reimport-product",
        title: "Product for Re-import",
        variants: [{ sku: "SKU-REIMPORT", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });

      // Parse the file twice (simulating re-import)
      const result1 = await parseExcelFile(excelBuffer);
      const result2 = await parseExcelFile(excelBuffer);

      // Both parse results should be identical
      expect(result1.products).toHaveLength(1);
      expect(result2.products).toHaveLength(1);
      expect(result1.products[0]?.name).toBe(result2.products[0]?.name);
      expect(result1.products[0]?.productHandle).toBe(
        result2.products[0]?.productHandle,
      );
    });
  });

  describe("Multiple Jobs", () => {
    it("handles multiple import jobs for same brand", async () => {
      // Create two import jobs for the same brand
      const job1 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-1.xlsx",
      });
      const job2 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-2.xlsx",
      });

      expect(job1.id).not.toBe(job2.id);
      expect(job1.brandId).toBe(job2.brandId);

      // Both jobs should be independent
      const retrievedJob1 = await TestDatabase.getImportJob(testDb, job1.id);
      const retrievedJob2 = await TestDatabase.getImportJob(testDb, job2.id);

      expect(retrievedJob1?.filename).toBe("import-1.xlsx");
      expect(retrievedJob2?.filename).toBe("import-2.xlsx");
    });
  });

  describe("Whitespace Handling", () => {
    it("handles leading/trailing whitespace in fields", async () => {
      const product = {
        handle: "  whitespace-handle  ",
        title: "  Whitespace Title  ",
        description: "  Description with whitespace  ",
        variants: [{ sku: "  SKU-001  ", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      // Parser trims handle
      expect(result.products[0]?.productHandle).toBe("whitespace-handle");
      // Other fields may or may not be trimmed depending on parser behavior
      expect(result.products).toHaveLength(1);
    });

    it("handles tabs and newlines in description", async () => {
      const product = {
        handle: "multiline-product",
        title: "Multiline Product",
        description: "Line 1\nLine 2\tTabbed\r\nLine 3",
        variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products[0]?.description).toContain("Line 1");
      expect(result.products[0]?.description).toContain("Line 2");
    });
  });
});
