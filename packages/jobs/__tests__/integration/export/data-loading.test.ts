/**
 * Integration Tests: Data Loading
 *
 * Tests the getProductsForExport() database query for loading
 * complete product data with all related entities.
 *
 * @module tests/integration/export/data-loading
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { getProductsForExport } from "@v1/db/queries/products";
import { cleanupTables, createTestBrand, testDb } from "@v1/db/testing";
import {
  createTestProductForExport,
  createTestVariantWithOverrides,
} from "@v1/db/testing";

describe("getProductsForExport()", () => {
  let brandId: string;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
  });

  it("loads products with all related entities", async () => {
    // Create a product with all related data
    const productId = await createTestProductForExport(brandId, {
      name: "Complete Product",
      handle: "complete-product",
      description: "A fully loaded product",
      status: "published",
      tags: ["organic", "sustainable"],
      materials: [
        { name: "Cotton", percentage: 60 },
        { name: "Polyester", percentage: 40 },
      ],
      carbonKg: 5.5,
      waterLiters: 2500,
      weightGrams: 250,
      journeySteps: {
        "Raw Material": "Farm A",
        Weaving: "Mill B",
      },
      manufacturerName: "EcoFactory",
      seasonName: "Spring 2026",
    });

    // Create a variant
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "TEST-UPID-001",
      sku: "SKU-001",
      barcode: "1234567890123",
      attributes: [
        { name: "Color", value: "Blue" },
        { name: "Size", value: "Medium" },
      ],
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);

    expect(products.length).toBe(1);
    const product = products[0]!;

    // Basic info
    expect(product.name).toBe("Complete Product");
    expect(product.productHandle).toBe("complete-product");
    expect(product.description).toBe("A fully loaded product");
    expect(product.status).toBe("published");

    // Related entities
    expect(product.manufacturerName).toBe("EcoFactory");
    expect(product.seasonName).toBe("Spring 2026");
    expect(product.tags).toContain("organic");
    expect(product.tags).toContain("sustainable");

    // Materials
    expect(product.materials.length).toBe(2);
    expect(
      product.materials.some((m) => m.name === "Cotton" && m.percentage === 60),
    ).toBe(true);
    expect(
      product.materials.some(
        (m) => m.name === "Polyester" && m.percentage === 40,
      ),
    ).toBe(true);

    // Environment
    expect(product.carbonKg).toBe(5.5);
    expect(product.waterLiters).toBe(2500);

    // Weight
    expect(product.weightGrams).toBe(250);

    // Journey steps
    expect(product.journeySteps["Raw Material"]).toBe("Farm A");
    expect(product.journeySteps.Weaving).toBe("Mill B");

    // Variants
    expect(product.variants.length).toBe(1);
    const variant = product.variants[0]!;
    expect(variant.upid).toBe("TEST-UPID-001");
    expect(variant.sku).toBe("SKU-001");
    // Barcodes are normalized to GTIN-14 format (padded with leading zeros)
    expect(variant.barcode).toBe("01234567890123");
    expect(variant.attributes.length).toBe(2);
  });

  it("returns empty array for empty product IDs", async () => {
    const products = await getProductsForExport(testDb, brandId, []);
    expect(products).toEqual([]);
  });

  it("filters by brandId (cannot load other brand products)", async () => {
    // Create a product in our brand
    const productId = await createTestProductForExport(brandId, {
      name: "My Brand Product",
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-001",
    });

    // Create another brand and product
    const otherBrandId = await createTestBrand("Other Brand");
    const otherProductId = await createTestProductForExport(otherBrandId, {
      name: "Other Brand Product",
    });
    await createTestVariantWithOverrides(otherProductId, otherBrandId, {
      upid: "UPID-002",
    });

    // Try to load both products with first brand's ID
    const products = await getProductsForExport(testDb, brandId, [
      productId,
      otherProductId,
    ]);

    // Should only return first brand's product
    expect(products.length).toBe(1);
    expect(products[0]!.name).toBe("My Brand Product");
  });

  it("loads manufacturer and season names via joins", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Product with Metadata",
      manufacturerName: "Quality Manufacturer Inc.",
      seasonName: "Fall/Winter 2026",
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-MFR-001",
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);

    expect(products.length).toBe(1);
    expect(products[0]!.manufacturerName).toBe("Quality Manufacturer Inc.");
    expect(products[0]!.seasonName).toBe("Fall/Winter 2026");
  });

  it("loads journey steps with facility names", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Product with Journey",
      journeySteps: {
        "Raw Material": "Organic Farm Co",
        Weaving: "Textile Mill Ltd",
        "Dyeing / Printing": "Color Works Factory",
        Stitching: "Garment Assembly Plant",
        Finishing: "Quality Finish Center",
      },
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-JOURNEY-001",
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);

    expect(products.length).toBe(1);
    const journey = products[0]!.journeySteps;

    expect(journey["Raw Material"]).toBe("Organic Farm Co");
    expect(journey.Weaving).toBe("Textile Mill Ltd");
    expect(journey["Dyeing / Printing"]).toBe("Color Works Factory");
    expect(journey.Stitching).toBe("Garment Assembly Plant");
    expect(journey.Finishing).toBe("Quality Finish Center");
  });

  it("handles products with no related data", async () => {
    // Create a minimal product with no related data
    const productId = await createTestProductForExport(brandId, {
      name: "Minimal Product",
      handle: "minimal-product",
      // No tags, materials, eco-claims, etc.
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-MINIMAL-001",
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);

    expect(products.length).toBe(1);
    const product = products[0]!;

    // Should have empty arrays and null values
    expect(product.tags).toEqual([]);
    expect(product.materials).toEqual([]);
    expect(product.carbonKg).toBeNull();
    expect(product.waterLiters).toBeNull();
    expect(product.weightGrams).toBeNull();
    expect(product.manufacturerName).toBeNull();
    expect(product.seasonName).toBeNull();
    expect(product.journeySteps).toEqual({});
  });

  it("loads multiple products efficiently", async () => {
    // Create multiple products
    const productIds: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const productId = await createTestProductForExport(brandId, {
        name: `Product ${i}`,
        handle: `product-${i}`,
        tags: [`tag-${i}`],
      });
      await createTestVariantWithOverrides(productId, brandId, {
        upid: `UPID-BATCH-${i.toString().padStart(3, "0")}`,
      });
      productIds.push(productId);
    }

    const products = await getProductsForExport(testDb, brandId, productIds);

    expect(products.length).toBe(5);

    // Verify all products loaded
    for (let i = 1; i <= 5; i++) {
      const product = products.find((p) => p.name === `Product ${i}`);
      expect(product).toBeDefined();
      expect(product!.tags).toContain(`tag-${i}`);
    }
  });
});
