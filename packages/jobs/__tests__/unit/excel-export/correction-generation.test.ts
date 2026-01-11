/**
 * Unit Tests: Excel Export - Correction Generation
 *
 * Tests the correction Excel generation with error highlighting.
 * Verifies that exported Excel files properly highlight error cells with red fill.
 *
 * @module __tests__/unit/excel-export/correction-generation
 */

import { describe, it, expect } from "bun:test";
import ExcelJS from "exceljs";
import {
    generateCorrectionExcel,
    generateFullCorrectionExcel,
    generateErrorOnlyCorrectionExcel,
    type ExportRow,
    DEFAULT_IMPORT_COLUMN_ORDER,
} from "../../../src/lib/excel-export";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a basic export row for testing
 */
function createExportRow(
    rowNumber: number,
    data: Record<string, string>,
    errors: Array<{ field: string; message: string }> = []
): ExportRow {
    return { rowNumber, data, errors };
}

/**
 * Parse an XLSX buffer and return the workbook
 */
async function parseExcelBuffer(buffer: Uint8Array): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    return workbook;
}

/**
 * Get cell fill color as ARGB string
 */
function getCellFillColor(cell: ExcelJS.Cell): string | undefined {
    const fill = cell.fill as ExcelJS.FillPattern;
    if (fill?.type === "pattern" && fill.fgColor?.argb) {
        return fill.fgColor.argb;
    }
    return undefined;
}

// ============================================================================
// Constants for testing
// ============================================================================

const ERROR_FILL_COLOR = "FFFFE0E0"; // Light red
const HEADER_FILL_COLOR = "FFE0E0E0"; // Light gray

// ============================================================================
// Tests: Basic Excel Generation
// ============================================================================

describe("Excel Export - Correction Generation", () => {
    describe("Basic Generation", () => {
        it("generates valid XLSX buffer", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test Product", "SKU": "SKU-001" }),
            ];

            const buffer = await generateCorrectionExcel(rows);

            // Verify it's a non-empty buffer
            expect(buffer).toBeInstanceOf(Uint8Array);
            expect(buffer.length).toBeGreaterThan(0);

            // Verify it's a valid Excel file
            const workbook = await parseExcelBuffer(buffer);
            expect(workbook.worksheets.length).toBe(1);
        });

        it("creates worksheet with default name 'Products'", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test" }),
            ];

            const buffer = await generateCorrectionExcel(rows);
            const workbook = await parseExcelBuffer(buffer);

            expect(workbook.worksheets[0]!.name).toBe("Products");
        });

        it("creates worksheet with custom name when specified", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test" }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                worksheetName: "Import Corrections",
            });
            const workbook = await parseExcelBuffer(buffer);

            expect(workbook.worksheets[0]!.name).toBe("Import Corrections");
        });

        it("handles empty rows array", async () => {
            const buffer = await generateCorrectionExcel([]);
            const workbook = await parseExcelBuffer(buffer);

            expect(workbook.worksheets.length).toBe(1);
            expect(workbook.worksheets[0]!.rowCount).toBe(0);
        });
    });

    // ============================================================================
    // Tests: Error Highlighting
    // ============================================================================

    describe("Error Highlighting", () => {
        it("applies red fill to error cells", async () => {
            const rows: ExportRow[] = [
                createExportRow(
                    2,
                    { "Product Title": "Test", "SKU": "", "Category": "Invalid" },
                    [{ field: "SKU", message: "Required" }]
                ),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Row 2 is the data row (row 1 is headers)
            const skuCell = worksheet.getCell(2, 2); // Column 2 = SKU
            const fillColor = getCellFillColor(skuCell);

            expect(fillColor).toBe(ERROR_FILL_COLOR);
        });

        it("does not highlight non-error cells", async () => {
            const rows: ExportRow[] = [
                createExportRow(
                    2,
                    { "Product Title": "Test", "SKU": "", "Category": "Invalid" },
                    [{ field: "SKU", message: "Required" }]
                ),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Product Title should not be highlighted
            const titleCell = worksheet.getCell(2, 1);
            const fillColor = getCellFillColor(titleCell);

            expect(fillColor).not.toBe(ERROR_FILL_COLOR);
        });

        it("handles rows with multiple errors", async () => {
            const rows: ExportRow[] = [
                createExportRow(
                    2,
                    { "Product Title": "", "SKU": "", "Category": "" },
                    [
                        { field: "Product Title", message: "Required" },
                        { field: "SKU", message: "Required" },
                        { field: "Category", message: "Not found" },
                    ]
                ),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // All three cells should be highlighted
            expect(getCellFillColor(worksheet.getCell(2, 1))).toBe(ERROR_FILL_COLOR);
            expect(getCellFillColor(worksheet.getCell(2, 2))).toBe(ERROR_FILL_COLOR);
            expect(getCellFillColor(worksheet.getCell(2, 3))).toBe(ERROR_FILL_COLOR);
        });

        it("handles rows with no errors", async () => {
            const rows: ExportRow[] = [
                createExportRow(
                    2,
                    { "Product Title": "Valid", "SKU": "SKU-001", "Category": "Clothing" },
                    [] // No errors
                ),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // No cells should be highlighted
            expect(getCellFillColor(worksheet.getCell(2, 1))).not.toBe(ERROR_FILL_COLOR);
            expect(getCellFillColor(worksheet.getCell(2, 2))).not.toBe(ERROR_FILL_COLOR);
            expect(getCellFillColor(worksheet.getCell(2, 3))).not.toBe(ERROR_FILL_COLOR);
        });
    });

    // ============================================================================
    // Tests: Data Preservation
    // ============================================================================

    describe("Data Preservation", () => {
        it("preserves original data in cells", async () => {
            const originalData = {
                "Product Title": "Organic Cotton T-Shirt",
                "SKU": "SKU-OCT-001",
                "Category": "Clothing",
                "Description": "A comfortable t-shirt",
            };

            const rows: ExportRow[] = [createExportRow(2, originalData)];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category", "Description"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Verify each value is preserved
            expect(worksheet.getCell(2, 1).value).toBe("Organic Cotton T-Shirt");
            expect(worksheet.getCell(2, 2).value).toBe("SKU-OCT-001");
            expect(worksheet.getCell(2, 3).value).toBe("Clothing");
            expect(worksheet.getCell(2, 4).value).toBe("A comfortable t-shirt");
        });

        it("handles empty cell values", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, {
                    "Product Title": "Test",
                    "SKU": "",
                    "Category": "Clothing",
                }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "SKU", "Category"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Empty value should be preserved as empty string
            expect(worksheet.getCell(2, 2).value).toBe("");
        });

        it("handles special characters in data", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, {
                    "Product Title": 'Test "Product" & Co.',
                    "Description": "Line 1\nLine 2",
                    "Tags": "tag1; tag2; tag3",
                }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title", "Description", "Tags"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            expect(worksheet.getCell(2, 1).value).toBe('Test "Product" & Co.');
            expect(worksheet.getCell(2, 2).value).toBe("Line 1\nLine 2");
            expect(worksheet.getCell(2, 3).value).toBe("tag1; tag2; tag3");
        });
    });

    // ============================================================================
    // Tests: Column Order
    // ============================================================================

    describe("Column Order", () => {
        it("includes all columns in specified order", async () => {
            const columnOrder = ["Category", "Product Title", "SKU"];

            const rows: ExportRow[] = [
                createExportRow(2, {
                    "Product Title": "Test",
                    "SKU": "SKU-001",
                    "Category": "Clothing",
                }),
            ];

            const buffer = await generateCorrectionExcel(rows, { columnOrder });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Check headers match specified order
            expect(worksheet.getCell(1, 1).value).toBe("Category");
            expect(worksheet.getCell(1, 2).value).toBe("Product Title");
            expect(worksheet.getCell(1, 3).value).toBe("SKU");

            // Check data values follow same order
            expect(worksheet.getCell(2, 1).value).toBe("Clothing");
            expect(worksheet.getCell(2, 2).value).toBe("Test");
            expect(worksheet.getCell(2, 3).value).toBe("SKU-001");
        });

        it("derives column order from data when not specified", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, {
                    "Product Title": "Test",
                    "SKU": "SKU-001",
                }),
            ];

            const buffer = await generateCorrectionExcel(rows);
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Columns should be derived from the data
            const headerRow = worksheet.getRow(1);
            const headers: string[] = [];
            headerRow.eachCell((cell) => {
                if (cell.value) headers.push(String(cell.value));
            });

            expect(headers).toContain("Product Title");
            expect(headers).toContain("SKU");
        });
    });

    // ============================================================================
    // Tests: Header Row Styling
    // ============================================================================

    describe("Header Row Styling", () => {
        it("styles header row with gray fill", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test" }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            const headerCell = worksheet.getCell(1, 1);
            const fillColor = getCellFillColor(headerCell);

            expect(fillColor).toBe(HEADER_FILL_COLOR);
        });

        it("styles header row with bold font", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test" }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            const headerCell = worksheet.getCell(1, 1);
            expect(headerCell.font?.bold).toBe(true);
        });

        it("freezes header row", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, { "Product Title": "Test" }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Product Title"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Check that the worksheet view has frozen panes at row 1
            const view = worksheet.views[0] as { state?: string; ySplit?: number };
            expect(view?.state).toBe("frozen");
            expect(view?.ySplit).toBe(1);
        });
    });

    // ============================================================================
    // Tests: Column Auto-Sizing
    // ============================================================================

    describe("Column Auto-Sizing", () => {
        it("auto-sizes columns based on content", async () => {
            const rows: ExportRow[] = [
                createExportRow(2, {
                    "Short": "A",
                    "Very Long Column Name With Lots of Text": "Short value",
                }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Short", "Very Long Column Name With Lots of Text"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            const shortColumn = worksheet.getColumn(1);
            const longColumn = worksheet.getColumn(2);

            // The long column should be wider than the short one
            expect(longColumn.width).toBeGreaterThan(shortColumn.width || 0);
        });

        it("respects maximum column width", async () => {
            const veryLongValue = "A".repeat(200);
            const rows: ExportRow[] = [
                createExportRow(2, { "Column": veryLongValue }),
            ];

            const buffer = await generateCorrectionExcel(rows, {
                columnOrder: ["Column"],
            });
            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            const column = worksheet.getColumn(1);
            // Max column width is 50 (from excel-export.ts)
            expect(column.width).toBeLessThanOrEqual(50);
        });
    });

    // ============================================================================
    // Tests: Full Correction Export
    // ============================================================================

    describe("Full Correction Export", () => {
        it("generates correction export with all rows", async () => {
            const allRows = [
                { rowNumber: 2, data: { "Title": "Product 1", "SKU": "SKU-001" } },
                { rowNumber: 3, data: { "Title": "Product 2", "SKU": "" } },
                { rowNumber: 4, data: { "Title": "Product 3", "SKU": "SKU-003" } },
            ];

            const failedRowNumbers = new Set([3]);
            const errorsByRow = new Map([
                [3, [{ field: "SKU", message: "Required" }]],
            ]);

            const buffer = await generateFullCorrectionExcel(
                allRows,
                failedRowNumbers,
                errorsByRow,
                ["Title", "SKU"]
            );

            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // All 3 data rows should be present (+ 1 header row)
            expect(worksheet.rowCount).toBe(4);

            // Only row 3 (Excel row 3 = data row 2) should have error highlighting
            // Row 2 = first data row, Row 3 = second data row, Row 4 = third data row
            expect(getCellFillColor(worksheet.getCell(2, 2))).not.toBe(ERROR_FILL_COLOR); // SKU-001
            expect(getCellFillColor(worksheet.getCell(3, 2))).toBe(ERROR_FILL_COLOR); // Empty SKU
            expect(getCellFillColor(worksheet.getCell(4, 2))).not.toBe(ERROR_FILL_COLOR); // SKU-003
        });
    });

    // ============================================================================
    // Tests: Error-Only Correction Export
    // ============================================================================

    describe("Error-Only Correction Export", () => {
        it("only includes products with errors", async () => {
            const allRows = [
                { rowNumber: 2, data: { "Title": "Product 1", "SKU": "SKU-001" } },
                { rowNumber: 3, data: { "Title": "Product 2", "SKU": "" } },
                { rowNumber: 4, data: { "Title": "Product 3", "SKU": "SKU-003" } },
                { rowNumber: 5, data: { "Title": "Product 4", "SKU": "" } },
            ];

            const failedRowNumbers = new Set([3, 5]);
            const errorsByRow = new Map([
                [3, [{ field: "SKU", message: "Required" }]],
                [5, [{ field: "SKU", message: "Required" }]],
            ]);

            const buffer = await generateErrorOnlyCorrectionExcel(
                allRows,
                failedRowNumbers,
                errorsByRow,
                ["Title", "SKU"]
            );

            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Only 2 error rows should be present (+ 1 header row)
            expect(worksheet.rowCount).toBe(3);

            // Both error rows should have error highlighting
            expect(getCellFillColor(worksheet.getCell(2, 2))).toBe(ERROR_FILL_COLOR);
            expect(getCellFillColor(worksheet.getCell(3, 2))).toBe(ERROR_FILL_COLOR);

            // Verify the correct data is included
            expect(worksheet.getCell(2, 1).value).toBe("Product 2");
            expect(worksheet.getCell(3, 1).value).toBe("Product 4");
        });

        it("returns empty worksheet when no errors", async () => {
            const allRows = [
                { rowNumber: 2, data: { "Title": "Product 1", "SKU": "SKU-001" } },
                { rowNumber: 3, data: { "Title": "Product 2", "SKU": "SKU-002" } },
            ];

            const failedRowNumbers = new Set<number>();
            const errorsByRow = new Map<number, Array<{ field: string; message: string }>>();

            const buffer = await generateErrorOnlyCorrectionExcel(
                allRows,
                failedRowNumbers,
                errorsByRow,
                ["Title", "SKU"]
            );

            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Only header row, no data rows
            expect(worksheet.rowCount).toBe(1);
        });

        it("preserves original data in error rows", async () => {
            const allRows = [
                { rowNumber: 2, data: { "Title": "Valid Product", "SKU": "SKU-001", "Category": "Clothing" } },
                { rowNumber: 3, data: { "Title": "Invalid Product", "SKU": "", "Category": "Electronics" } },
            ];

            const failedRowNumbers = new Set([3]);
            const errorsByRow = new Map([
                [3, [{ field: "SKU", message: "Required" }]],
            ]);

            const buffer = await generateErrorOnlyCorrectionExcel(
                allRows,
                failedRowNumbers,
                errorsByRow,
                ["Title", "SKU", "Category"]
            );

            const workbook = await parseExcelBuffer(buffer);
            const worksheet = workbook.worksheets[0]!;

            // Verify data is preserved
            expect(worksheet.getCell(2, 1).value).toBe("Invalid Product");
            expect(worksheet.getCell(2, 2).value).toBe("");
            expect(worksheet.getCell(2, 3).value).toBe("Electronics");
        });
    });

    // ============================================================================
    // Tests: Default Column Order
    // ============================================================================

    describe("Default Column Order", () => {
        it("exports DEFAULT_IMPORT_COLUMN_ORDER constant", () => {
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toBeDefined();
            expect(Array.isArray(DEFAULT_IMPORT_COLUMN_ORDER)).toBe(true);
            expect(DEFAULT_IMPORT_COLUMN_ORDER.length).toBeGreaterThan(0);
        });

        it("includes essential columns in default order", () => {
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toContain("Product Title");
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toContain("Product Handle");
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toContain("SKU");
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toContain("Barcode");
            expect(DEFAULT_IMPORT_COLUMN_ORDER).toContain("Category");
        });
    });
});
