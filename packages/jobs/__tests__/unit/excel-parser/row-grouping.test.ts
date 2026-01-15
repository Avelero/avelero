/**
 * Unit Tests: Excel Parser - Row Grouping
 *
 * Tests the Shopify-style row grouping logic where Product Handle
 * determines parent/child relationships.
 *
 * @group unit
 * @group excel-parser
 */

import { describe, expect, it } from "bun:test";
import { ExcelBuilder } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../src/lib/excel";

describe("Excel Parser - Row Grouping", () => {
  it("groups rows by Product Handle", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "product-1",
          title: "Product 1",
          variants: [
            { sku: "SKU-001", barcode: "1234567890123" },
            { sku: "SKU-002", barcode: "1234567890124" },
          ],
        },
        {
          handle: "product-2",
          title: "Product 2",
          variants: [{ sku: "SKU-003", barcode: "1234567890125" }],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(2);
    expect(result.products[0]!.productHandle).toBe("product-1");
    expect(result.products[0]!.variants).toHaveLength(2);
    expect(result.products[1]!.productHandle).toBe("product-2");
    expect(result.products[1]!.variants).toHaveLength(1);
  });

  it("first row with handle becomes parent", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "test-handle",
          title: "Test Product",
          description: "Product description",
          category: "Clothing",
          variants: [
            { sku: "SKU-001", barcode: "1234567890123" },
            { sku: "SKU-002", barcode: "1234567890124" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(1);
    const product = result.products[0]!;
    expect(product.productHandle).toBe("test-handle");
    expect(product.name).toBe("Test Product");
    expect(product.description).toBe("Product description");
    expect(product.categoryPath).toBe("Clothing");
  });

  it("rows without handle are children of previous product", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "parent-product",
          title: "Parent Product",
          variants: [
            { sku: "PARENT-001", barcode: "1111111111111" },
            { sku: "CHILD-001", barcode: "1111111111112" },
            { sku: "CHILD-002", barcode: "1111111111113" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]!.variants).toHaveLength(3);
    expect(result.products[0]!.variants[0]!.sku).toBe("PARENT-001");
    expect(result.products[0]!.variants[1]!.sku).toBe("CHILD-001");
    expect(result.products[0]!.variants[2]!.sku).toBe("CHILD-002");
  });

  it("single row becomes single-variant product", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "single-variant",
          title: "Single Variant Product",
          variants: [{ sku: "SINGLE-001", barcode: "2222222222222" }],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]!.variants).toHaveLength(1);
    expect(result.products[0]!.variants[0]!.sku).toBe("SINGLE-001");
  });

  it("empty file returns empty array", async () => {
    const buffer = await ExcelBuilder.createEmpty();

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  it("header-only file returns empty array", async () => {
    const buffer = await ExcelBuilder.createHeaderOnly();

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  it("preserves row order within groups", async () => {
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "ordered-product",
          title: "Ordered Product",
          variants: [
            { sku: "ORDER-A", barcode: "3333333333331" },
            { sku: "ORDER-B", barcode: "3333333333332" },
            { sku: "ORDER-C", barcode: "3333333333333" },
            { sku: "ORDER-D", barcode: "3333333333334" },
          ],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    const skus = result.products[0]!.variants.map((v) => v.sku);
    expect(skus).toEqual(["ORDER-A", "ORDER-B", "ORDER-C", "ORDER-D"]);
  });

  it("handles whitespace in Product Handle", async () => {
    // Test that whitespace is trimmed from handles
    const buffer = await ExcelBuilder.createFromRows([
      {
        "Product Handle": "  spaced-handle  ",
        "Product Title": "Spaced Handle Product",
        SKU: "SKU-SPACE-001",
        Barcode: "4444444444444",
      },
    ]);

    const result = await parseExcelFile(buffer);

    expect(result.products).toHaveLength(1);
    // The parser should trim whitespace from handles
    expect(result.products[0]!.productHandle).toBe("spaced-handle");
  });

  it("handles case sensitivity in handles", async () => {
    // Test that handles are case-sensitive (Handle vs handle)
    const buffer = await ExcelBuilder.create({
      products: [
        {
          handle: "CamelCase-Handle",
          title: "CamelCase Product",
          variants: [{ sku: "SKU-CASE-001", barcode: "5555555555551" }],
        },
        {
          handle: "camelcase-handle",
          title: "Lowercase Product",
          variants: [{ sku: "SKU-CASE-002", barcode: "5555555555552" }],
        },
      ],
    });

    const result = await parseExcelFile(buffer);

    // Handles should be treated as case-sensitive
    expect(result.products).toHaveLength(2);
    expect(result.products[0]!.productHandle).toBe("CamelCase-Handle");
    expect(result.products[1]!.productHandle).toBe("camelcase-handle");
  });
});
