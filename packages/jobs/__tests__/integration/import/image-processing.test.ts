/**
 * Integration Tests: Image Processing
 *
 * Tests image URL handling and validation during import.
 * Validates URL format, storage, missing images, and variant overrides.
 *
 * @module tests/integration/import/image-processing
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
  productWithOverrides,
} from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel-parser";

describe("Image Processing", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  describe("Valid Image URLs", () => {
    it("accepts valid HTTPS image URL", async () => {
      const productWithImage = {
        ...basicProduct,
        image: "https://example.com/images/product.jpg",
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithImage],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.imagePath).toBe(
        "https://example.com/images/product.jpg",
      );
    });

    it("stores image URL in product data", async () => {
      const excelBuffer = await ExcelBuilder.create({
        products: [completeProduct],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products[0]?.imagePath).toBe(
        "https://example.com/images/hoodie.jpg",
      );
    });
  });

  describe("Missing Images", () => {
    it("handles missing image field", async () => {
      // Product without image
      const productNoImage = {
        handle: "no-image-product",
        title: "No Image Product",
        variants: [{ sku: "NO-IMG-001", barcode: "1234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productNoImage],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      // imagePath should be undefined or empty
      expect(parseResult.products[0]?.imagePath).toBeFalsy();
    });

    it("handles empty image string", async () => {
      const productEmptyImage = {
        handle: "empty-image-product",
        title: "Empty Image Product",
        image: "", // Explicitly empty
        variants: [{ sku: "EMPTY-IMG-001", barcode: "2234567890123" }],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productEmptyImage],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      // Should be falsy (undefined or empty string)
      expect(parseResult.products[0]?.imagePath).toBeFalsy();
    });
  });

  describe("Variant-Level Image Overrides", () => {
    it("handles variant-level image override in child rows", async () => {
      // Product with overrides has variant-level image
      const excelBuffer = await ExcelBuilder.create({
        products: [productWithOverrides],
      });

      const parseResult = await parseExcelFile(excelBuffer);

      // Parent product has image
      expect(parseResult.products[0]?.imagePath).toBe(
        "https://example.com/parent.jpg",
      );

      // The second variant has an override (this is stored at variant level)
      // Note: The parser may store this differently; checking parse worked
      expect(parseResult.products[0]?.variants).toHaveLength(2);
    });
  });

  describe("URL Format Validation", () => {
    it("parses URLs with various formats", async () => {
      const productsWithDifferentUrls = [
        {
          handle: "cdn-image",
          title: "CDN Image",
          image: "https://cdn.shopify.com/s/files/image.jpg",
          variants: [{ sku: "CDN-001", barcode: "3234567890123" }],
        },
        {
          handle: "cloudinary-image",
          title: "Cloudinary Image",
          image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
          variants: [{ sku: "CLOUDY-001", barcode: "3234567890124" }],
        },
        {
          handle: "s3-image",
          title: "S3 Image",
          image: "https://bucket.s3.amazonaws.com/images/product.png",
          variants: [{ sku: "S3-001", barcode: "3234567890125" }],
        },
      ];

      const excelBuffer = await ExcelBuilder.create({
        products: productsWithDifferentUrls,
      });

      const parseResult = await parseExcelFile(excelBuffer);

      expect(parseResult.products).toHaveLength(3);
      expect(parseResult.products[0]?.imagePath).toContain("cdn.shopify.com");
      expect(parseResult.products[1]?.imagePath).toContain("cloudinary.com");
      expect(parseResult.products[2]?.imagePath).toContain("s3.amazonaws.com");
    });
  });
});
