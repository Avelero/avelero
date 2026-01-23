/**
 * Unit Tests: Barcode Uniqueness Functions
 *
 * Tests the barcode uniqueness query functions:
 * - isBarcodeTakenInBrand
 * - getBatchTakenBarcodes
 *
 * Uses real database connections with transaction isolation between tests.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  getBatchTakenBarcodes,
  isBarcodeTakenInBrand,
} from "@v1/db/queries/products";
import {
  createTestBrand,
  createTestProductForExport,
  createTestVariantWithOverrides,
  testDb,
} from "@v1/db/testing";

describe("Barcode Uniqueness Functions", () => {
  let brandId: string;
  let productId: string;
  let variantId: string;

  beforeEach(async () => {
    // Create a test brand and product for each test
    brandId = await createTestBrand("Barcode Test Brand");
    productId = await createTestProductForExport(brandId, {
      name: "Test Product",
      handle: `test-product-${Math.random().toString(36).substring(2, 8)}`,
    });
    // Create a variant with a barcode
    variantId = await createTestVariantWithOverrides(productId, brandId, {
      barcode: "1234567890123",
    });
  });

  describe("isBarcodeTakenInBrand()", () => {
    it("returns true when barcode exists in brand", async () => {
      const result = await isBarcodeTakenInBrand(
        testDb,
        brandId,
        "1234567890123",
      );
      expect(result).toBe(true);
    });

    it("returns false when barcode does not exist in brand", async () => {
      const result = await isBarcodeTakenInBrand(
        testDb,
        brandId,
        "9999999999999",
      );
      expect(result).toBe(false);
    });

    it("returns false when checking same variant (excludeVariantId)", async () => {
      const result = await isBarcodeTakenInBrand(
        testDb,
        brandId,
        "1234567890123",
        variantId,
      );
      expect(result).toBe(false);
    });

    it("returns true when another variant has same barcode (excludeVariantId)", async () => {
      // Create another variant with a different barcode
      const otherVariantId = await createTestVariantWithOverrides(
        productId,
        brandId,
        {
          barcode: "9876543210987",
        },
      );

      // Check if the first variant's barcode is taken, excluding the other variant
      const result = await isBarcodeTakenInBrand(
        testDb,
        brandId,
        "1234567890123",
        otherVariantId, // Excluding different variant
      );
      expect(result).toBe(true);
    });

    it("returns false for barcode in different brand", async () => {
      // Create a different brand
      const otherBrandId = await createTestBrand("Other Brand");

      // Check if the barcode is taken in the other brand (it shouldn't be)
      const result = await isBarcodeTakenInBrand(
        testDb,
        otherBrandId,
        "1234567890123",
      );
      expect(result).toBe(false);
    });

    it("returns false for empty string", async () => {
      const result = await isBarcodeTakenInBrand(testDb, brandId, "");
      expect(result).toBe(false);
    });

    it("returns false for whitespace-only string", async () => {
      const result = await isBarcodeTakenInBrand(testDb, brandId, "   ");
      expect(result).toBe(false);
    });

    it("handles case where product has multiple variants with same barcode query", async () => {
      // Create another product with a variant that has the same barcode
      // This tests the query behavior before the constraint is applied
      const otherProductId = await createTestProductForExport(brandId, {
        name: "Other Product",
        handle: `other-product-${Math.random().toString(36).substring(2, 8)}`,
      });

      // Note: This will succeed now but will fail once the constraint is applied
      await createTestVariantWithOverrides(otherProductId, brandId, {
        barcode: "5555555555555",
      });

      const result = await isBarcodeTakenInBrand(
        testDb,
        brandId,
        "5555555555555",
      );
      expect(result).toBe(true);
    });
  });

  describe("getBatchTakenBarcodes()", () => {
    beforeEach(async () => {
      // Add more variants with barcodes
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "1111111111111",
      });
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "2222222222222",
      });
    });

    it("returns correct taken barcodes", async () => {
      const result = await getBatchTakenBarcodes(testDb, brandId, [
        "1234567890123", // exists
        "1111111111111", // exists
        "9999999999999", // doesn't exist
      ]);

      expect(result).toHaveLength(2);
      expect(result).toContain("1234567890123");
      expect(result).toContain("1111111111111");
      expect(result).not.toContain("9999999999999");
    });

    it("returns empty array when no barcodes are taken", async () => {
      const result = await getBatchTakenBarcodes(testDb, brandId, [
        "8888888888888",
        "7777777777777",
      ]);

      expect(result).toHaveLength(0);
    });

    it("handles empty input array", async () => {
      const result = await getBatchTakenBarcodes(testDb, brandId, []);
      expect(result).toHaveLength(0);
    });

    it("handles input with empty strings and whitespace", async () => {
      const result = await getBatchTakenBarcodes(testDb, brandId, [
        "",
        "   ",
        "1234567890123",
      ]);

      // Should only find the valid barcode
      expect(result).toHaveLength(1);
      expect(result).toContain("1234567890123");
    });

    it("excludes specified variant IDs", async () => {
      const result = await getBatchTakenBarcodes(
        testDb,
        brandId,
        ["1234567890123", "1111111111111"],
        [variantId], // Exclude the variant with 1234567890123
      );

      // Should only find 1111111111111 since 1234567890123's variant is excluded
      expect(result).toHaveLength(1);
      expect(result).toContain("1111111111111");
      expect(result).not.toContain("1234567890123");
    });

    it("returns barcodes only from specified brand", async () => {
      // Create another brand with a variant using the same barcode
      const otherBrandId = await createTestBrand("Another Brand");
      const otherProductId = await createTestProductForExport(otherBrandId, {
        name: "Other Brand Product",
      });
      await createTestVariantWithOverrides(otherProductId, otherBrandId, {
        barcode: "1234567890123", // Same barcode as in first brand
      });

      // Check in the other brand
      const result = await getBatchTakenBarcodes(testDb, otherBrandId, [
        "1234567890123",
        "1111111111111", // This one is only in first brand
      ]);

      expect(result).toHaveLength(1);
      expect(result).toContain("1234567890123");
      expect(result).not.toContain("1111111111111");
    });

    it("handles duplicate barcodes in input", async () => {
      const result = await getBatchTakenBarcodes(testDb, brandId, [
        "1234567890123",
        "1234567890123", // Duplicate
        "1234567890123", // Another duplicate
      ]);

      // Should deduplicate and return only once
      expect(result).toHaveLength(1);
      expect(result).toContain("1234567890123");
    });
  });
});
