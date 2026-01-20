/**
 * Unit Tests: Error Report Excel Highlighting
 *
 * Tests the `generateErrorReportExcel` function's cell highlighting logic.
 * Verifies that only cells with BOTH data AND errors are colored red.
 *
 * @module tests/unit/excel-error-report/error-highlighting
 */

import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import {
  type ErrorReportRow,
  generateErrorReportExcel,
} from "../../../src/lib/excel";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read a generated Excel buffer back into a workbook
 */
async function readGeneratedExcel(
  buffer: Uint8Array,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // Use ArrayBuffer for compatibility with ExcelJS type expectations
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
  return workbook;
}

/**
 * Get the Products worksheet from a workbook.
 * The template has two tabs: "Description" and "Products".
 * Data is written to "Products".
 */
function getProductsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet("Products");
  if (!worksheet) {
    throw new Error("Products worksheet not found in generated Excel");
  }
  return worksheet;
}

/**
 * Check if a cell has the error fill (red background)
 * ERROR_FILL uses argb: "FFFFE0E0"
 */
function hasErrorFill(cell: ExcelJS.Cell): boolean {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  return fill?.type === "pattern" && fill?.fgColor?.argb === "FFFFE0E0";
}

/**
 * Get a cell value as string, handling various ExcelJS value types
 */
function getCellValue(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return String(value);
}

/**
 * Find the column index for a given column name.
 * Searches multiple possible header rows (templates use row 2, fallback uses row 1).
 */
function findColumnIndex(
  worksheet: ExcelJS.Worksheet,
  columnName: string,
): number | null {
  // Try row 2 first (template), then row 1 (fallback)
  for (const headerRow of [2, 1]) {
    const row = worksheet.getRow(headerRow);
    let foundIndex: number | null = null;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (cell.value?.toString().trim() === columnName) {
        foundIndex = colNumber;
      }
    });

    if (foundIndex !== null) {
      return foundIndex;
    }
  }

  return null;
}

/**
 * Find the first data row (where actual data starts).
 * Templates have data at row 4, fallback has data at row 2.
 */
function getDataStartRow(worksheet: ExcelJS.Worksheet): number {
  // Check if row 2 has header-like content (template) or row 1 does (fallback)
  const row2 = worksheet.getRow(2);
  let isRow2Header = false;
  row2.eachCell({ includeEmpty: false }, (cell) => {
    const val = cell.value?.toString() || "";
    if (val === "Product Title" || val === "Product Handle") {
      isRow2Header = true;
    }
  });

  // If row 2 is headers (template), data starts at row 4
  // Otherwise (fallback), data starts at row 2
  return isRow2Header ? 4 : 2;
}

// ============================================================================
// Tests: Cells with data and errors
// ============================================================================

describe("generateErrorReportExcel - error highlighting", () => {
  describe("cells with data and errors", () => {
    it("A1: should color cells red when they have data AND an error", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4, // Original row number (metadata, not used for output position)
          raw: {
            "Product Title": "Test Product",
            "Product Handle": "invalid-handle",
          },
          errors: [{ field: "Product Handle", message: "Invalid handle" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      // Find column indices
      const handleColIdx = findColumnIndex(worksheet, "Product Handle");
      expect(handleColIdx).not.toBeNull();

      // Data is written starting at startRow (depends on template vs fallback)
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const handleCell = dataRow.getCell(handleColIdx!);

      // Cell should have the value
      expect(getCellValue(handleCell)).toBe("invalid-handle");
      // Cell should be colored red
      expect(hasErrorFill(handleCell)).toBe(true);
    });

    it("A2: should NOT color cells when they have data but NO error", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            "Product Handle": "valid-handle",
          },
          errors: [{ field: "Product Title", message: "Title is invalid" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const handleColIdx = findColumnIndex(worksheet, "Product Handle");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const handleCell = dataRow.getCell(handleColIdx!);

      // Cell has data but no error for this field
      expect(getCellValue(handleCell)).toBe("valid-handle");
      expect(hasErrorFill(handleCell)).toBe(false);
    });
  });

  // ============================================================================
  // Tests: Empty cells with errors
  // Empty cells WITH errors SHOULD be colored to indicate where the error is.
  // This helps users see which fields need attention (e.g., incomplete attribute pairs).
  // ============================================================================

  describe("empty cells with errors", () => {
    it("A3: should color empty cells when error references that field", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            // "Materials" is NOT in raw (empty cell)
          },
          errors: [{ field: "Materials", message: "Materials required" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      expect(materialsColIdx).not.toBeNull();

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const materialsCell = dataRow.getCell(materialsColIdx!);

      // Cell should be empty but colored to indicate error location
      expect(getCellValue(materialsCell)).toBeNull();
      expect(hasErrorFill(materialsCell)).toBe(true);
    });

    it("A4: should NOT color empty cells that have no errors", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            // "Materials" is NOT in raw (empty cell)
          },
          errors: [],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const materialsCell = dataRow.getCell(materialsColIdx!);

      expect(getCellValue(materialsCell)).toBeNull();
      expect(hasErrorFill(materialsCell)).toBe(false);
    });

    it("A-EC4: should color empty Image cell when Image has error", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            // "Image" is NOT in raw (empty cell)
          },
          errors: [
            {
              field: "Image",
              message: "Invalid image URL. Must be full URL.",
            },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const imageColIdx = findColumnIndex(worksheet, "Image");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const imageCell = dataRow.getCell(imageColIdx!);

      // Empty cell with error should be colored
      expect(getCellValue(imageCell)).toBeNull();
      expect(hasErrorFill(imageCell)).toBe(true);
    });

    it("A-EC5: should color empty Materials cell when Materials has error", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            // "Materials" is NOT in raw
          },
          errors: [{ field: "Materials", message: "Invalid materials format" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const materialsCell = dataRow.getCell(materialsColIdx!);

      // Empty cell with error should be colored
      expect(getCellValue(materialsCell)).toBeNull();
      expect(hasErrorFill(materialsCell)).toBe(true);
    });

    it("A-EC8: should color whitespace-only cells when they have errors", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            Materials: "   ", // whitespace-only
          },
          errors: [{ field: "Materials", message: "Materials required" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const materialsCell = dataRow.getCell(materialsColIdx!);

      // Whitespace-only cell with error should be colored
      expect(hasErrorFill(materialsCell)).toBe(true);
    });

    it("A-EC9: should color BOTH cells for incomplete attribute pairs", async () => {
      // Simulates: User filled "Attribute 1" with "Color" but left "Attribute Value 1" empty
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            "Attribute 1": "Color",
            // "Attribute Value 1" is NOT in raw (empty)
          },
          errors: [
            {
              field: "Attribute 1",
              message:
                "Incomplete attribute pair: both Attribute 1 and Attribute Value 1 must be provided.",
            },
            {
              field: "Attribute Value 1",
              message:
                "Incomplete attribute pair: both Attribute 1 and Attribute Value 1 must be provided.",
            },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const attr1ColIdx = findColumnIndex(worksheet, "Attribute 1");
      const attrVal1ColIdx = findColumnIndex(worksheet, "Attribute Value 1");
      expect(attr1ColIdx).not.toBeNull();
      expect(attrVal1ColIdx).not.toBeNull();

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const attr1Cell = dataRow.getCell(attr1ColIdx!);
      const attrVal1Cell = dataRow.getCell(attrVal1ColIdx!);

      // Filled cell should have data and be colored
      expect(getCellValue(attr1Cell)).toBe("Color");
      expect(hasErrorFill(attr1Cell)).toBe(true);

      // Empty cell should also be colored (the key fix!)
      expect(getCellValue(attrVal1Cell)).toBeNull();
      expect(hasErrorFill(attrVal1Cell)).toBe(true);
    });
  });

  // ============================================================================
  // Tests: Rows without errors
  // ============================================================================

  describe("rows without errors", () => {
    it("A5: should not color any cells in error-free rows", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            "Product Handle": "test-handle",
            Materials: "Cotton",
            Image: "https://example.com/img.jpg",
          },
          errors: [], // No errors
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);

      // Check multiple columns - none should have error fill
      const titleColIdx = findColumnIndex(worksheet, "Product Title");
      const handleColIdx = findColumnIndex(worksheet, "Product Handle");
      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      const imageColIdx = findColumnIndex(worksheet, "Image");

      expect(hasErrorFill(dataRow.getCell(titleColIdx!))).toBe(false);
      expect(hasErrorFill(dataRow.getCell(handleColIdx!))).toBe(false);
      expect(hasErrorFill(dataRow.getCell(materialsColIdx!))).toBe(false);
      expect(hasErrorFill(dataRow.getCell(imageColIdx!))).toBe(false);
    });
  });

  // ============================================================================
  // Tests: Error field matching
  // ============================================================================

  describe("error field matching", () => {
    it("A6: should ignore errors for non-existent columns", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
          },
          errors: [
            {
              field: "NonExistentColumn",
              message: "Some error",
            },
          ],
        },
      ];

      // Should not throw
      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      // Just verify it generated something
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const titleColIdx = findColumnIndex(worksheet, "Product Title");
      expect(getCellValue(dataRow.getCell(titleColIdx!))).toBe("Test Product");
    });

    it("A-EC2: should match field names via template column mapping", async () => {
      // "Kilograms CO2" maps to "kgCO2e Carbon Footprint" in the template
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            "Kilograms CO2": "invalid", // Internal name
          },
          errors: [
            {
              field: "Kilograms CO2", // Internal error field name
              message: "Invalid number",
            },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      // The template uses "kgCO2e Carbon Footprint"
      const carbonColIdx = findColumnIndex(
        worksheet,
        "kgCO2e Carbon Footprint",
      );
      expect(carbonColIdx).not.toBeNull();

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const carbonCell = dataRow.getCell(carbonColIdx!);

      // Cell should have data and be colored
      expect(getCellValue(carbonCell)).toBe("invalid");
      expect(hasErrorFill(carbonCell)).toBe(true);
    });

    it("A-EC3: should only color cell once even with multiple errors for same field", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Test Product",
            Materials: "Invalid Material",
          },
          errors: [
            { field: "Materials", message: "Error 1" },
            { field: "Materials", message: "Error 2" },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const materialsColIdx = findColumnIndex(worksheet, "Materials");
      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const materialsCell = dataRow.getCell(materialsColIdx!);

      // Should still be colored (no double-fill issue, but should work)
      expect(hasErrorFill(materialsCell)).toBe(true);
    });
  });

  // ============================================================================
  // Tests: Error scope (product vs variant fields)
  // ============================================================================

  describe("error scope", () => {
    it("A-EC6: should only color product-level fields for product errors", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4,
          raw: {
            "Product Title": "Bad Title",
            "Product Handle": "valid-handle",
            Barcode: "1234567890",
          },
          errors: [
            {
              field: "Product Title",
              message: "Title is invalid",
            },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow);
      const titleColIdx = findColumnIndex(worksheet, "Product Title");
      const handleColIdx = findColumnIndex(worksheet, "Product Handle");
      const barcodeColIdx = findColumnIndex(worksheet, "Barcode");

      // Only title should be colored
      expect(hasErrorFill(dataRow.getCell(titleColIdx!))).toBe(true);
      expect(hasErrorFill(dataRow.getCell(handleColIdx!))).toBe(false);
      expect(hasErrorFill(dataRow.getCell(barcodeColIdx!))).toBe(false);
    });

    it("A-EC7: should only color variant-level fields for variant errors", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 5, // Child row (metadata, not used for position)
          raw: {
            Barcode: "invalid-barcode",
            SKU: "valid-sku",
          },
          errors: [
            {
              field: "Barcode",
              message: "Invalid barcode format",
            },
          ],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const dataStartRow = getDataStartRow(worksheet);
      const dataRow = worksheet.getRow(dataStartRow); // First data row
      const barcodeColIdx = findColumnIndex(worksheet, "Barcode");
      const skuColIdx = findColumnIndex(worksheet, "SKU");

      // Only barcode should be colored
      expect(hasErrorFill(dataRow.getCell(barcodeColIdx!))).toBe(true);
      expect(hasErrorFill(dataRow.getCell(skuColIdx!))).toBe(false);
    });
  });

  // ============================================================================
  // Tests: Multiple rows
  // ============================================================================

  describe("multiple rows", () => {
    it("should correctly highlight errors across multiple rows", async () => {
      const rows: ErrorReportRow[] = [
        {
          rowNumber: 4, // Metadata only
          raw: {
            "Product Title": "Product 1",
            "Product Handle": "handle-1",
          },
          errors: [{ field: "Product Title", message: "Error in title" }],
        },
        {
          rowNumber: 5,
          raw: {
            Barcode: "barcode-1",
          },
          errors: [], // No errors on this row
        },
        {
          rowNumber: 6,
          raw: {
            Barcode: "bad-barcode",
          },
          errors: [{ field: "Barcode", message: "Invalid barcode" }],
        },
      ];

      const buffer = await generateErrorReportExcel(rows);
      const workbook = await readGeneratedExcel(buffer);
      const worksheet = getProductsWorksheet(workbook);

      const titleColIdx = findColumnIndex(worksheet, "Product Title");
      const barcodeColIdx = findColumnIndex(worksheet, "Barcode");
      const dataStartRow = getDataStartRow(worksheet);

      // First data row: Title should be red
      const row1 = worksheet.getRow(dataStartRow);
      expect(hasErrorFill(row1.getCell(titleColIdx!))).toBe(true);

      // Second data row: No errors
      const row2 = worksheet.getRow(dataStartRow + 1);
      expect(hasErrorFill(row2.getCell(barcodeColIdx!))).toBe(false);

      // Third data row: Barcode should be red
      const row3 = worksheet.getRow(dataStartRow + 2);
      expect(hasErrorFill(row3.getCell(barcodeColIdx!))).toBe(true);
    });
  });
});
