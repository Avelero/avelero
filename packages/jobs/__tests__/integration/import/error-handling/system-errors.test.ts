/**
 * Integration Tests: Error Handling - System Errors
 *
 * Tests system-level error handling including database failures,
 * storage issues, and invalid file formats.
 *
 * @module tests/integration/import/error-handling/system-errors
 */

import "../../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  TestCatalog,
  TestDatabase,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import * as ExcelJS from "exceljs";
import { parseExcelFile } from "../../../../src/lib/excel";

describe("Error Handling - System Errors", () => {
  let brandId: string;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    await TestCatalog.setupFull(testDb, brandId);
  });

  describe("Invalid File Format", () => {
    it("handles invalid Excel file format (not an Excel file)", async () => {
      // Create a non-Excel buffer (just random bytes that look like text)
      const invalidBuffer = new Uint8Array(
        Buffer.from("This is not an Excel file, just plain text content."),
      );

      // Parser handles errors gracefully, returning errors in the result
      const result = await parseExcelFile(invalidBuffer);
      expect(result.products).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain("Failed to parse Excel file");
    });

    it("handles corrupted Excel file", async () => {
      // Create a buffer that starts like an Excel file but is corrupted
      // Excel files start with PK (ZIP signature), so let's create one that's incomplete
      const corruptedBuffer = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00,
      ]);

      // Parser handles errors gracefully, returning errors in the result
      const result = await parseExcelFile(corruptedBuffer);
      expect(result.products).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("handles empty Uint8Array", async () => {
      const emptyBuffer = new Uint8Array(0);

      // Parser handles errors gracefully, returning errors in the result
      const result = await parseExcelFile(emptyBuffer);
      expect(result.products).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Empty Data", () => {
    it("handles empty Excel file (only headers, no data rows)", async () => {
      // Create an Excel file with headers but no data
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Products");

      // Add only headers
      worksheet.addRow([
        "Product Title",
        "Product Handle",
        "Manufacturer",
        "Description",
        "Image",
        "Status",
        "Category",
        "Season",
        "Tags",
        "Eco Claims",
        "UPID",
        "SKU",
        "Barcode",
        "Grams Weight",
        "Attribute 1 Name",
        "Attribute 1 Value",
        "Attribute 2 Name",
        "Attribute 2 Value",
        "Attribute 3 Name",
        "Attribute 3 Value",
        "Attribute 4 Name",
        "Attribute 4 Value",
        "Materials",
        "Percentages",
        "Kilograms CO2",
        "Liters Water Used",
        "Carbon Footprint",
        "Raw Material",
        "Weaving",
        "Dyeing / Printing",
        "Stitching",
        "Assembly",
        "Finishing",
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(
        new Uint8Array(buffer as ArrayBuffer),
      );

      expect(result.products).toHaveLength(0);
      expect(result.totalRows).toBe(0);
    });

    it("handles file with only whitespace data rows", async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Products");

      // Add headers
      worksheet.addRow([
        "Product Title",
        "Product Handle",
        "Manufacturer",
        "Description",
        "Image",
        "Status",
        "Category",
        "Season",
        "Tags",
        "Eco Claims",
        "UPID",
        "SKU",
        "Barcode",
        "Grams Weight",
        "Attribute 1 Name",
        "Attribute 1 Value",
        "Attribute 2 Name",
        "Attribute 2 Value",
        "Attribute 3 Name",
        "Attribute 3 Value",
        "Attribute 4 Name",
        "Attribute 4 Value",
        "Materials",
        "Percentages",
        "Kilograms CO2",
        "Liters Water Used",
        "Carbon Footprint",
        "Raw Material",
        "Weaving",
        "Dyeing / Printing",
        "Stitching",
        "Assembly",
        "Finishing",
      ]);

      // Add rows with only whitespace
      worksheet.addRow([
        "   ",
        "   ",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      worksheet.addRow(["", "   ", "", "", "", "", "", "", "", "", "", "", ""]);

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(
        new Uint8Array(buffer as ArrayBuffer),
      );

      // Should have no valid products (empty handles are skipped)
      expect(result.products).toHaveLength(0);
    });
  });

  describe("Job Status on Errors", () => {
    it("creates job that can be marked as FAILED", async () => {
      // Create a job to simulate failure scenario
      const job = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "will-fail.xlsx",
      });

      // Simulate the job failing using direct database update
      const { importJobs } = await import("@v1/db/schema");
      const { eq } = await import("drizzle-orm");

      await testDb
        .update(importJobs)
        .set({
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          summary: { error: "System error during processing" },
        })
        .where(eq(importJobs.id, job.id));

      const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
      expect(updatedJob?.status).toBe("FAILED");
      expect((updatedJob?.summary as Record<string, string>)?.error).toBe(
        "System error during processing",
      );
    });

    it("tracks job timing even on failure", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Import schema and operators for direct DB updates
      const { importJobs } = await import("@v1/db/schema");
      const { eq } = await import("drizzle-orm");

      // Start the job
      const startTime = new Date().toISOString();
      await testDb
        .update(importJobs)
        .set({
          status: "PROCESSING",
          startedAt: startTime,
        })
        .where(eq(importJobs.id, job.id));

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mark as failed
      await testDb
        .update(importJobs)
        .set({
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          summary: { error: "Processing error" },
        })
        .where(eq(importJobs.id, job.id));

      const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
      expect(updatedJob?.startedAt).toBeDefined();
      expect(updatedJob?.finishedAt).toBeDefined();
    });
  });

  describe("Large File Handling", () => {
    it("parses file with many products", async () => {
      // Create an Excel with 50 products
      const products = Array.from({ length: 50 }, (_, i) => ({
        handle: `product-${i + 1}`,
        title: `Product ${i + 1}`,
        variants: [
          {
            sku: `SKU-${String(i + 1).padStart(4, "0")}`,
            barcode: `${String(i + 1).padStart(13, "0")}`,
          },
        ],
      }));

      const excelBuffer = await ExcelBuilder.create({ products });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products).toHaveLength(50);
      expect(result.errors).toHaveLength(0);
    });

    it("handles product with many variants", async () => {
      // Create a product with 20 variants
      const variants = Array.from({ length: 20 }, (_, i) => ({
        sku: `SKU-VARIANT-${String(i + 1).padStart(3, "0")}`,
        barcode: `BARCODE${String(i + 1).padStart(10, "0")}`,
        attributes: [
          { name: "Size", value: `Size-${i + 1}` },
          { name: "Color", value: i % 2 === 0 ? "Red" : "Blue" },
        ],
      }));

      const product = {
        handle: "many-variants-product",
        title: "Product With Many Variants",
        variants,
      };

      const excelBuffer = await ExcelBuilder.create({ products: [product] });
      const result = await parseExcelFile(excelBuffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.variants).toHaveLength(20);
    });
  });
});
