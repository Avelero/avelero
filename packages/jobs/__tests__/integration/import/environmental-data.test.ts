/**
 * Integration Tests: Environmental Data Processing
 *
 * Tests environmental impact data handling during import.
 * Validates CO2, water usage, carbon footprint, and weight data.
 *
 * @module tests/integration/import/environmental-data
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  type InsertedCatalog,
  TestCatalog,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import {
  ExcelBuilder,
  basicProduct,
  completeProduct,
} from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel-parser";

describe("Environmental Data Processing", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  describe("CO2 Data", () => {
    it("stores Kilograms CO2 at product level", async () => {
      const productWithCO2 = {
        ...basicProduct,
        environmental: {
          kilogramsCO2: 5.2,
        },
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithCO2],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.carbonKg).toBe(5.2);
    });

    it("handles decimal CO2 values", async () => {
      const productWithDecimalCO2 = {
        handle: "decimal-co2-product",
        title: "Decimal CO2 Product",
        environmental: {
          kilogramsCO2: 2.567,
        },
        variants: [{ sku: "DEC-CO2-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithDecimalCO2],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.carbonKg).toBe(2.567);
    });
  });

  describe("Water Usage Data", () => {
    it("stores Liters Water Used at product level", async () => {
      const productWithWater = {
        ...basicProduct,
        environmental: {
          litersWaterUsed: 2700,
        },
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithWater],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.waterLiters).toBe(2700);
    });
  });

  describe("Carbon Footprint", () => {
    it("stores Carbon Footprint at product level", async () => {
      const productWithFootprint = {
        ...basicProduct,
        environmental: {
          carbonFootprint: "Low impact",
        },
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithFootprint],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.carbonStatus).toBe("Low impact");
    });
  });

  describe("Combined Environmental Data", () => {
    it("parses all environmental fields from complete product", async () => {
      const excelBuffer = await ExcelBuilder.create({
        products: [completeProduct],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const product = parseResult.products[0];

      expect(product?.carbonKg).toBe(5.2);
      expect(product?.waterLiters).toBe(2700);
      expect(product?.carbonStatus).toBe("Low impact");
    });

    it("handles empty environmental fields", async () => {
      // Product with no environmental data
      const productNoEnv = {
        handle: "no-env-product",
        title: "No Environmental Data Product",
        variants: [{ sku: "NO-ENV-001", barcode: "2234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productNoEnv],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.carbonKg).toBeUndefined();
      expect(parseResult.products[0]?.waterLiters).toBeUndefined();
      expect(parseResult.products[0]?.carbonStatus).toBeUndefined();
    });
  });

  describe("Product vs Variant Level Data", () => {
    it("environmental data is product-level (ignores child rows)", async () => {
      // Product with environmental data and multiple variants
      // Child rows should NOT have environmental data override (unless explicitly set)
      const productWithEnvAndVariants = {
        handle: "env-multi-variant",
        title: "Environmental Multi-Variant",
        environmental: {
          kilogramsCO2: 10.0,
          litersWaterUsed: 5000,
        },
        variants: [
          {
            sku: "ENV-VAR-001",
            barcode: "3234567890123",
            attributes: [{ name: "Size", value: "S" }],
          },
          {
            sku: "ENV-VAR-002",
            barcode: "3234567890124",
            attributes: [{ name: "Size", value: "M" }],
          },
          {
            sku: "ENV-VAR-003",
            barcode: "3234567890125",
            attributes: [{ name: "Size", value: "L" }],
          },
        ],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithEnvAndVariants],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      // Product has environmental data
      expect(parseResult.products[0]?.carbonKg).toBe(10.0);
      expect(parseResult.products[0]?.waterLiters).toBe(5000);

      // All variants belong to the product
      expect(parseResult.products[0]?.variants).toHaveLength(3);
    });
  });
});
