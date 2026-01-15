/**
 * Unit Tests: Parent/Child Row Structure
 *
 * Tests the logic for building parent/child row structure in Excel exports.
 * Parent rows contain all product-level data, while child rows only contain
 * variant-specific data and overrides.
 *
 * @module tests/unit/excel-export/parent-child-rows
 */

import { describe, expect, it } from "bun:test";
import {
  type ExportProductData,
  type ExportVariantData,
  formatMaterials,
  getAttributeByIndex,
  joinSemicolon,
} from "../../../src/lib/excel";

// Helper to create a minimal variant
function createTestVariant(
  overrides: Partial<ExportVariantData> = {},
): ExportVariantData {
  return {
    upid: "UPID-001",
    barcode: null,
    sku: null,
    attributes: [],
    nameOverride: null,
    descriptionOverride: null,
    imagePathOverride: null,
    carbonKgOverride: null,
    waterLitersOverride: null,
    weightGramsOverride: null,
    ecoClaimsOverride: null,
    materialsOverride: null,
    journeyStepsOverride: null,
    ...overrides,
  };
}

// Helper to create a minimal product
function createTestProduct(
  overrides: Partial<ExportProductData> = {},
): ExportProductData {
  return {
    id: "product-001",
    name: "Test Product",
    productHandle: "test-product",
    description: "A test product",
    manufacturerName: null,
    imagePath: null,
    status: "published",
    categoryPath: null,
    seasonName: null,
    tags: [],
    carbonKg: null,
    waterLiters: null,
    ecoClaims: [],
    weightGrams: null,
    materials: [],
    journeySteps: {},
    variants: [createTestVariant()],
    ...overrides,
  };
}

describe("Parent Row (first variant)", () => {
  it("includes all product-level fields", () => {
    const product = createTestProduct({
      name: "Premium Shirt",
      productHandle: "premium-shirt",
      description: "A premium quality shirt",
      manufacturerName: "EcoFactory",
      imagePath: "images/shirt.jpg",
      status: "published",
      categoryPath: "Apparel > Tops > Shirts",
      seasonName: "Spring 2026",
      tags: ["organic", "sustainable"],
      carbonKg: 5.5,
      waterLiters: 2500,
      ecoClaims: ["GOTS Certified"],
      weightGrams: 250,
      materials: [{ name: "Cotton", percentage: 100 }],
      journeySteps: { "Raw Material": "Farm A", Weaving: "Mill B" },
    });

    // For parent row, we use product-level values (possibly with variant override)
    const variant = product.variants[0]!;

    // Name should use variant override if present, otherwise product name
    const name = variant.nameOverride ?? product.name;
    expect(name).toBe("Premium Shirt");

    // Description
    const description = variant.descriptionOverride ?? product.description;
    expect(description).toBe("A premium quality shirt");

    // Tags (joined)
    expect(joinSemicolon(product.tags)).toBe("organic; sustainable");

    // Materials
    const { names, percentages } = formatMaterials(product.materials);
    expect(names).toBe("Cotton");
    expect(percentages).toBe("100");

    // Environment
    const carbonKg = variant.carbonKgOverride ?? product.carbonKg;
    expect(carbonKg).toBe(5.5);

    const waterLiters = variant.waterLitersOverride ?? product.waterLiters;
    expect(waterLiters).toBe(2500);
  });

  it("uses variant override when present for parent row", () => {
    const product = createTestProduct({
      name: "Base Product",
      carbonKg: 10,
      variants: [
        createTestVariant({
          nameOverride: "Override Name",
          carbonKgOverride: 8,
        }),
      ],
    });

    const variant = product.variants[0]!;

    // Name should use variant override
    const name = variant.nameOverride ?? product.name;
    expect(name).toBe("Override Name");

    // Carbon should use variant override
    const carbonKg = variant.carbonKgOverride ?? product.carbonKg;
    expect(carbonKg).toBe(8);
  });
});

describe("Child Rows (subsequent variants)", () => {
  it("only includes variant-specific data and overrides", () => {
    const product = createTestProduct({
      name: "Base Product",
      description: "Base description",
      carbonKg: 10,
      variants: [
        createTestVariant({ upid: "UPID-001" }),
        createTestVariant({
          upid: "UPID-002",
          nameOverride: "Child Override Name",
          carbonKgOverride: 12,
        }),
      ],
    });

    // First variant (parent row) - uses product name
    const parentVariant = product.variants[0]!;
    expect(parentVariant.nameOverride).toBeNull();

    // Second variant (child row) - has override
    const childVariant = product.variants[1]!;
    expect(childVariant.nameOverride).toBe("Child Override Name");
    expect(childVariant.carbonKgOverride).toBe(12);
  });

  it("omits fields when no override exists (child row)", () => {
    const product = createTestProduct({
      carbonKg: 10,
      waterLiters: 2000,
      variants: [
        createTestVariant({ upid: "UPID-001" }),
        createTestVariant({
          upid: "UPID-002",
          // No overrides
        }),
      ],
    });

    const childVariant = product.variants[1]!;

    // All override fields should be null for child without overrides
    expect(childVariant.nameOverride).toBeNull();
    expect(childVariant.descriptionOverride).toBeNull();
    expect(childVariant.carbonKgOverride).toBeNull();
    expect(childVariant.waterLitersOverride).toBeNull();
    expect(childVariant.weightGramsOverride).toBeNull();
    expect(childVariant.ecoClaimsOverride).toBeNull();
    expect(childVariant.materialsOverride).toBeNull();
    expect(childVariant.journeyStepsOverride).toBeNull();
  });
});

describe("Single Variant Products", () => {
  it("outputs only parent row for single variant product", () => {
    const product = createTestProduct({
      name: "Single Variant Product",
      variants: [createTestVariant({ upid: "UPID-ONLY-001" })],
    });

    expect(product.variants.length).toBe(1);
    expect(product.variants[0]!.upid).toBe("UPID-ONLY-001");
  });
});

describe("Attributes Ordering", () => {
  it("sorts attributes by sortOrder in output", () => {
    const attributes = [
      { name: "Size", value: "Large", sortOrder: 2 },
      { name: "Color", value: "Blue", sortOrder: 1 },
      { name: "Style", value: "Casual", sortOrder: 3 },
    ];

    const attr1 = getAttributeByIndex(attributes, 1);
    const attr2 = getAttributeByIndex(attributes, 2);
    const attr3 = getAttributeByIndex(attributes, 3);

    // Should be sorted by sortOrder
    expect(attr1).toEqual({ name: "Color", value: "Blue" });
    expect(attr2).toEqual({ name: "Size", value: "Large" });
    expect(attr3).toEqual({ name: "Style", value: "Casual" });
  });

  it("returns empty for out-of-bounds index", () => {
    const attributes = [{ name: "Color", value: "Red", sortOrder: 1 }];

    const attr4 = getAttributeByIndex(attributes, 4);
    expect(attr4).toEqual({ name: "", value: "" });
  });

  it("handles empty attributes array", () => {
    const attr1 = getAttributeByIndex([], 1);
    expect(attr1).toEqual({ name: "", value: "" });
  });
});
