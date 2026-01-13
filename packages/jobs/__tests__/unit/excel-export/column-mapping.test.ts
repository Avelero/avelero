/**
 * Unit Tests: Column Mapping
 *
 * Tests column mapping logic for Excel export.
 * These tests verify column index mapping and attribute retrieval.
 *
 * @module tests/unit/excel-export/column-mapping
 */

import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import {
  buildColumnMapFromRow,
  getAttributeByIndex,
} from "../../../src/lib/excel";

describe("buildColumnMapFromRow()", () => {
  it("creates correct index mapping from header row", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test");

    // Add a header row
    worksheet.addRow([
      "Product Title",
      "Product Handle",
      "Manufacturer",
      "Description",
    ]);

    const columnMap = buildColumnMapFromRow(worksheet, 1);

    expect(columnMap.get("Product Title")).toBe(1);
    expect(columnMap.get("Product Handle")).toBe(2);
    expect(columnMap.get("Manufacturer")).toBe(3);
    expect(columnMap.get("Description")).toBe(4);
  });

  it("handles whitespace in headers (trims)", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test");

    // Add header row with whitespace
    worksheet.addRow([
      "  Product Title  ",
      "Product Handle\t",
      "\nManufacturer",
    ]);

    const columnMap = buildColumnMapFromRow(worksheet, 1);

    // Should trim whitespace
    expect(columnMap.get("Product Title")).toBe(1);
    expect(columnMap.get("Product Handle")).toBe(2);
    expect(columnMap.get("Manufacturer")).toBe(3);
  });

  it("skips empty cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test");

    // Add row with empty cells
    const row = worksheet.getRow(1);
    row.getCell(1).value = "Product Title";
    row.getCell(2).value = ""; // Empty
    row.getCell(3).value = null; // Null
    row.getCell(4).value = "Description";
    row.commit();

    const columnMap = buildColumnMapFromRow(worksheet, 1);

    expect(columnMap.get("Product Title")).toBe(1);
    expect(columnMap.has("")).toBe(false);
    expect(columnMap.get("Description")).toBe(4);
    expect(columnMap.size).toBe(2);
  });

  it("handles numeric cell values by converting to string", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test");

    // Add row with numeric header (edge case)
    worksheet.addRow([123, "Product Handle"]);

    const columnMap = buildColumnMapFromRow(worksheet, 1);

    expect(columnMap.get("123")).toBe(1);
    expect(columnMap.get("Product Handle")).toBe(2);
  });
});

describe("getAttributeByIndex()", () => {
  it("returns correct attribute by sort order (1-indexed)", () => {
    const attributes = [
      { name: "Color", value: "Red", sortOrder: 1 },
      { name: "Size", value: "Medium", sortOrder: 2 },
      { name: "Material", value: "Cotton", sortOrder: 3 },
    ];

    expect(getAttributeByIndex(attributes, 1)).toEqual({
      name: "Color",
      value: "Red",
    });
    expect(getAttributeByIndex(attributes, 2)).toEqual({
      name: "Size",
      value: "Medium",
    });
    expect(getAttributeByIndex(attributes, 3)).toEqual({
      name: "Material",
      value: "Cotton",
    });
  });

  it("returns empty for out-of-bounds index", () => {
    const attributes = [{ name: "Color", value: "Blue", sortOrder: 1 }];

    expect(getAttributeByIndex(attributes, 0)).toEqual({ name: "", value: "" });
    expect(getAttributeByIndex(attributes, 2)).toEqual({ name: "", value: "" });
    expect(getAttributeByIndex(attributes, 5)).toEqual({ name: "", value: "" });
  });

  it("handles unsorted input array", () => {
    // Attributes in random order, should still sort by sortOrder
    const attributes = [
      { name: "Size", value: "Large", sortOrder: 3 },
      { name: "Color", value: "Green", sortOrder: 1 },
      { name: "Season", value: "Winter", sortOrder: 2 },
    ];

    expect(getAttributeByIndex(attributes, 1)).toEqual({
      name: "Color",
      value: "Green",
    });
    expect(getAttributeByIndex(attributes, 2)).toEqual({
      name: "Season",
      value: "Winter",
    });
    expect(getAttributeByIndex(attributes, 3)).toEqual({
      name: "Size",
      value: "Large",
    });
  });

  it("handles empty array", () => {
    expect(getAttributeByIndex([], 1)).toEqual({ name: "", value: "" });
  });

  it("handles duplicate sortOrder (takes first in stable sort)", () => {
    const attributes = [
      { name: "Color", value: "Red", sortOrder: 1 },
      { name: "Shade", value: "Dark", sortOrder: 1 }, // Same sortOrder
    ];

    // First one should be at index 1
    const result = getAttributeByIndex(attributes, 1);
    expect(result.name).toBe("Color");
  });
});
