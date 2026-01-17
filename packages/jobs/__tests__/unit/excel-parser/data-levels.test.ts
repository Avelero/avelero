/**
 * Unit Tests: Excel Parser - Product-Level vs Variant-Level Data
 *
 * Tests the separation of product-level and variant-level data.
 * Parent rows contain product-level data, child rows contain variant-level data.
 *
 * @group unit
 * @group excel-parser
 */

import { describe, expect, it } from "bun:test";
import { ExcelBuilder } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel";

describe("Excel Parser - Data Levels", () => {
  it("extracts product-level fields from parent row", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "test-handle",
          title: "Test Product Title",
          manufacturer: "Test Manufacturer",
          description: "Test Description",
          category: "Clothing > T-shirts",
          season: "SS26",
          tags: ["tag1", "tag2"],
          image: "https://example.com/image.jpg",
          variants: [{ sku: "SKU-001", barcode: "1234567890123" }],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(1);
    const product = result.products[0]!;

    expect(product.productHandle).toBe("test-handle");
    expect(product.name).toBe("Test Product Title");
    expect(product.manufacturerName).toBe("Test Manufacturer");
    expect(product.description).toBe("Test Description");
    expect(product.categoryPath).toBe("Clothing > T-shirts");
    expect(product.seasonName).toBe("SS26");
    expect(product.tags).toEqual(["tag1", "tag2"]);
    expect(product.imagePath).toBe("https://example.com/image.jpg");
  });

  it("extracts variant-level fields from all rows", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "multi-variant",
          title: "Multi Variant Product",
          variants: [
            {
              sku: "SKU-001",
              barcode: "1111111111111",
              attributes: [
                { name: "Size", value: "S" },
                { name: "Color", value: "Red" },
              ],
              gramsWeight: 200,
            },
            {
              sku: "SKU-002",
              barcode: "1111111111112",
              attributes: [
                { name: "Size", value: "M" },
                { name: "Color", value: "Blue" },
              ],
              gramsWeight: 220,
            },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products[0]!.variants).toHaveLength(2);

    // First variant (parent row)
    const v1 = result.products[0]!.variants[0]!;
    expect(v1.sku).toBe("SKU-001");
    expect(v1.barcode).toBe("1111111111111");
    expect(v1.attributes).toHaveLength(2);
    expect(v1.attributes[0]).toEqual({
      name: "Size",
      value: "S",
      sortOrder: 0,
    });
    expect(v1.attributes[1]).toEqual({
      name: "Color",
      value: "Red",
      sortOrder: 1,
    });

    // Second variant (child row)
    const v2 = result.products[0]!.variants[1]!;
    expect(v2.sku).toBe("SKU-002");
    expect(v2.barcode).toBe("1111111111112");
    expect(v2.attributes).toHaveLength(2);
    expect(v2.attributes[0]).toEqual({
      name: "Size",
      value: "M",
      sortOrder: 0,
    });
    expect(v2.attributes[1]).toEqual({
      name: "Color",
      value: "Blue",
      sortOrder: 1,
    });
  });

  it("extracts environmental data from parent row only", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "eco-product",
          title: "Eco Product",
          environmental: {
            kilogramsCO2: 2.5,
            litersWaterUsed: 100,
            carbonFootprint: "Low carbon footprint",
          },
          variants: [
            { sku: "SKU-001", barcode: "2222222222221" },
            { sku: "SKU-002", barcode: "2222222222222" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    // Product-level environmental data
    const product = result.products[0]!;
    expect(product.carbonKg).toBe(2.5);
    expect(product.waterLiters).toBe(100);
    expect(product.carbonStatus).toBe("Low carbon footprint");

    // Parent variant should NOT have environmental overrides
    expect(result.products[0]!.variants[0]!.carbonKgOverride).toBeUndefined();
    expect(
      result.products[0]!.variants[0]!.waterLitersOverride,
    ).toBeUndefined();
  });

  it("extracts materials from parent row only", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "material-product",
          title: "Material Product",
          materials: [
            { name: "Cotton", percentage: 80 },
            { name: "Polyester", percentage: 20 },
          ],
          variants: [
            { sku: "SKU-001", barcode: "3333333333331" },
            { sku: "SKU-002", barcode: "3333333333332" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    // Product-level materials
    const product = result.products[0]!;
    expect(product.materials).toHaveLength(2);
    expect(product.materials[0]!.name).toBe("Cotton");
    expect(product.materials[0]!.percentage).toBe(80);
    expect(product.materials[1]!.name).toBe("Polyester");
    expect(product.materials[1]!.percentage).toBe(20);

    // Parent variant should NOT have materials override
    expect(result.products[0]!.variants[0]!.materialsOverride).toEqual([]);
  });

  it("extracts journey steps from parent row only", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "journey-product",
          title: "Journey Product",
          journey: {
            rawMaterial: "Italy Supplier",
            weaving: "Portugal Mill",
            dyeingPrinting: "Spain Dye House",
            stitching: "Portugal Factory",
            assembly: "Portugal Assembly",
            finishing: "Portugal Finish",
          },
          variants: [
            { sku: "SKU-001", barcode: "4444444444441" },
            { sku: "SKU-002", barcode: "4444444444442" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    // Product-level journey steps
    const product = result.products[0]!;
    expect(product.journeySteps["Raw Material"]).toBe("Italy Supplier");
    expect(product.journeySteps.Weaving).toBe("Portugal Mill");
    expect(product.journeySteps["Dyeing / Printing"]).toBe("Spain Dye House");
    expect(product.journeySteps.Stitching).toBe("Portugal Factory");
    expect(product.journeySteps.Assembly).toBe("Portugal Assembly");
    expect(product.journeySteps.Finishing).toBe("Portugal Finish");

    // Parent variant should NOT have journey override
    expect(result.products[0]!.variants[0]!.journeyStepsOverride).toEqual({});
  });

  it("handles variant-level overrides in child rows", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "override-product",
          title: "Main Product Title",
          description: "Main Description",
          image: "https://example.com/main.jpg",
          variants: [
            { sku: "SKU-001", barcode: "5555555555551" },
            {
              sku: "SKU-002",
              barcode: "5555555555552",
              titleOverride: "Override Title for Variant",
              descriptionOverride: "Override Description",
              imageOverride: "https://example.com/variant.jpg",
            },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    // Parent variant should NOT have overrides (isFirstVariant = true)
    const v1 = result.products[0]!.variants[0]!;
    expect(v1.nameOverride).toBeUndefined();
    expect(v1.descriptionOverride).toBeUndefined();
    expect(v1.imagePathOverride).toBeUndefined();

    // Child variant SHOULD have overrides
    const v2 = result.products[0]!.variants[1]!;
    expect(v2.nameOverride).toBe("Override Title for Variant");
    expect(v2.descriptionOverride).toBe("Override Description");
    expect(v2.imagePathOverride).toBe("https://example.com/variant.jpg");
  });

  it("ignores product-level fields in child rows (except overrides)", async () => {
    // Use createFromRows for explicit control over what's in each row
    const buffer = await ExcelBuilder.createFromRows([
      // Parent row
      {
        "Product Handle": "test-product",
        "Product Title": "Parent Title",
        Manufacturer: "Parent Manufacturer",
        Category: "Parent Category",
        Season: "SS26",
        SKU: "SKU-001",
        Barcode: "6666666666661",
      },
      // Child row with product-level fields that should be ignored
      {
        "Product Title": "Child Title Override", // This IS an override
        Manufacturer: "Child Manufacturer", // Should be ignored
        Category: "Child Category", // Should be ignored
        Season: "FW26", // Should be ignored
        SKU: "SKU-002",
        Barcode: "6666666666662",
      },
    ]);

    const result = await parseExcelFile(buffer);

    // Product should have parent row values
    const product = result.products[0]!;
    expect(product.name).toBe("Parent Title");
    expect(product.manufacturerName).toBe("Parent Manufacturer");
    expect(product.categoryPath).toBe("Parent Category");
    expect(product.seasonName).toBe("SS26");

    // Child variant should have title override but not other product fields
    const v2 = result.products[0]!.variants[1]!;
    expect(v2.nameOverride).toBe("Child Title Override");
    // Manufacturer, Category, Season are not extractable from child rows
    // They don't have corresponding override fields on ParsedVariant
  });
});
