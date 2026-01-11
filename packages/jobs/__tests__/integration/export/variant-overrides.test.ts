/**
 * Integration Tests: Variant Overrides
 *
 * Tests variant override resolution for export.
 * Verifies that variant-level overrides are correctly loaded and
 * structured for export.
 *
 * @module tests/integration/export/variant-overrides
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { getProductsForExport } from "@v1/db/queries/products";
import { cleanupTables, createTestBrand, testDb } from "@v1/db/testing";
import {
  createTestProductForExport,
  createTestVariantWithOverrides,
} from "@v1/db/testing";

describe("Variant Override Resolution", () => {
  let brandId: string;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
  });

  it("variant without overrides uses product-level values", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Base Product",
      description: "Base description",
      carbonKg: 10,
      waterLiters: 3000,
      weightGrams: 500,
      materials: [{ name: "Cotton", percentage: 100 }],
      ecoClaims: ["Organic"],
      journeySteps: { "Raw Material": "Farm A" },
    });

    // Create variant without any overrides
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-NO-OVERRIDE",
      sku: "SKU-001",
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    expect(products.length).toBe(1);

    const variant = products[0]!.variants[0]!;

    // All override fields should be null
    expect(variant.nameOverride).toBeNull();
    expect(variant.descriptionOverride).toBeNull();
    expect(variant.carbonKgOverride).toBeNull();
    expect(variant.waterLitersOverride).toBeNull();
    expect(variant.weightGramsOverride).toBeNull();
    expect(variant.ecoClaimsOverride).toBeNull();
    expect(variant.materialsOverride).toBeNull();
    expect(variant.journeyStepsOverride).toBeNull();
  });

  it("variant with environment override includes carbonKg/waterLiters", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Env Test Product",
      carbonKg: 10,
      waterLiters: 2000,
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-ENV-OVERRIDE",
      carbonKgOverride: 15,
      waterLitersOverride: 2500,
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    const variant = products[0]!.variants[0]!;

    expect(variant.carbonKgOverride).toBe(15);
    expect(variant.waterLitersOverride).toBe(2500);
  });

  it("variant with materials override includes materialsOverride array", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Materials Test Product",
      materials: [{ name: "Cotton", percentage: 100 }],
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-MATERIALS-OVERRIDE",
      materialsOverride: [
        { name: "Recycled Polyester", percentage: 70 },
        { name: "Organic Cotton", percentage: 30 },
      ],
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    const variant = products[0]!.variants[0]!;

    expect(variant.materialsOverride).not.toBeNull();
    expect(variant.materialsOverride!.length).toBe(2);
    expect(
      variant.materialsOverride!.some(
        (m) => m.name === "Recycled Polyester" && m.percentage === 70,
      ),
    ).toBe(true);
    expect(
      variant.materialsOverride!.some(
        (m) => m.name === "Organic Cotton" && m.percentage === 30,
      ),
    ).toBe(true);
  });

  it("variant with eco-claims override includes ecoClaimsOverride", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Eco Claims Test Product",
      ecoClaims: ["GOTS Certified"],
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-ECOCLAIMS-OVERRIDE",
      ecoClaimsOverride: ["Recycled Content", "Fair Trade"],
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    const variant = products[0]!.variants[0]!;

    expect(variant.ecoClaimsOverride).not.toBeNull();
    expect(variant.ecoClaimsOverride!.length).toBe(2);
    expect(variant.ecoClaimsOverride).toContain("Recycled Content");
    expect(variant.ecoClaimsOverride).toContain("Fair Trade");
  });

  it("variant with journey override includes journeyStepsOverride", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Journey Test Product",
      journeySteps: {
        "Raw Material": "Original Farm",
        Weaving: "Original Mill",
      },
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-JOURNEY-OVERRIDE",
      journeyStepsOverride: {
        "Raw Material": "Alternative Farm",
        Finishing: "Special Finish Center",
      },
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    const variant = products[0]!.variants[0]!;

    expect(variant.journeyStepsOverride).not.toBeNull();
    expect(variant.journeyStepsOverride!["Raw Material"]).toBe(
      "Alternative Farm",
    );
    expect(variant.journeyStepsOverride!.Finishing).toBe(
      "Special Finish Center",
    );
  });

  it("multiple variants have independent override resolution", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Multi Variant Product",
      carbonKg: 10,
      waterLiters: 2000,
      materials: [{ name: "Cotton", percentage: 100 }],
    });

    // First variant - no overrides
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-VARIANT-1",
      sku: "SKU-V1",
    });

    // Second variant - environment overrides
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-VARIANT-2",
      sku: "SKU-V2",
      carbonKgOverride: 12,
    });

    // Third variant - materials override
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-VARIANT-3",
      sku: "SKU-V3",
      materialsOverride: [{ name: "Recycled Cotton", percentage: 100 }],
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    expect(products[0]!.variants.length).toBe(3);

    // Find variants by UPID
    const v1 = products[0]!.variants.find((v) => v.upid === "UPID-VARIANT-1")!;
    const v2 = products[0]!.variants.find((v) => v.upid === "UPID-VARIANT-2")!;
    const v3 = products[0]!.variants.find((v) => v.upid === "UPID-VARIANT-3")!;

    // V1 - no overrides
    expect(v1.carbonKgOverride).toBeNull();
    expect(v1.materialsOverride).toBeNull();

    // V2 - carbon override only
    expect(v2.carbonKgOverride).toBe(12);
    expect(v2.materialsOverride).toBeNull();

    // V3 - materials override only
    expect(v3.carbonKgOverride).toBeNull();
    expect(v3.materialsOverride).not.toBeNull();
    expect(v3.materialsOverride!.length).toBe(1);
    expect(v3.materialsOverride![0]!.name).toBe("Recycled Cotton");
  });

  it("weight override is correctly loaded", async () => {
    const productId = await createTestProductForExport(brandId, {
      name: "Weight Test Product",
      weightGrams: 250,
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-WEIGHT-OVERRIDE",
      weightGramsOverride: 300,
    });

    const products = await getProductsForExport(testDb, brandId, [productId]);
    const variant = products[0]!.variants[0]!;

    expect(variant.weightGramsOverride).toBe(300);
  });
});
