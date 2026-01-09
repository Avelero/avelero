/**
 * Excel Export for Bulk Import Corrections
 *
 * Generates XLSX files with correction highlighting for failed import rows.
 * Uses ExcelJS for Excel generation.
 *
 * Key features:
 * - Red background highlighting for cells with errors
 * - Preserves original data structure
 * - Header row styling
 * - Auto-fit column widths
 *
 * @module excel-export
 */

import ExcelJS from "exceljs";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Row data for export with associated errors
 */
export interface ExportRow {
  /** Original row number from the import */
  rowNumber: number;
  /** Row data as key-value pairs */
  data: Record<string, string>;
  /** Errors associated with this row */
  errors: Array<{ field: string; message: string }>;
}

/**
 * Options for generating correction Excel
 */
export interface CorrectionExportOptions {
  /** Column order for the output file (uses data keys if not provided) */
  columnOrder?: string[];
  /** Filename for the worksheet */
  worksheetName?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Error cell fill color (light red)
 */
const ERROR_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFE0E0" }, // Light red: #FFE0E0
};

/**
 * Header row fill color (light gray)
 */
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0E0E0" }, // Light gray: #E0E0E0
};

/**
 * Header font style
 */
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
};

/**
 * Default column width
 */
const DEFAULT_COLUMN_WIDTH = 20;

/**
 * Maximum column width (for auto-sizing)
 */
const MAX_COLUMN_WIDTH = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate optimal column width based on content
 */
function calculateColumnWidth(
  header: string,
  values: (string | undefined)[],
): number {
  let maxLength = header.length;

  for (const value of values) {
    if (value && value.length > maxLength) {
      maxLength = value.length;
    }
  }

  // Add some padding and cap at maximum
  return Math.min(maxLength + 2, MAX_COLUMN_WIDTH);
}

/**
 * Derive column order from rows data if not provided
 */
function deriveColumnOrder(rows: ExportRow[]): string[] {
  const columnsSet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row.data)) {
      columnsSet.add(key);
    }
  }

  return Array.from(columnsSet);
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Generate a correction Excel file with red cell highlighting for errors
 *
 * Creates an XLSX file where:
 * - Failed cells are highlighted with a light red background
 * - Header row has a gray background and bold text
 * - Columns are auto-sized based on content
 *
 * @param rows - Array of row data with associated errors
 * @param options - Export options
 * @returns Buffer containing the XLSX file
 *
 * @example
 * ```typescript
 * const rows: ExportRow[] = [
 *   {
 *     rowNumber: 2,
 *     data: { "Product Title": "Test", "SKU": "", "Category": "Invalid" },
 *     errors: [
 *       { field: "SKU", message: "Required" },
 *       { field: "Category", message: "Not found" }
 *     ]
 *   }
 * ];
 *
 * const buffer = await generateCorrectionExcel(rows);
 * ```
 */
export async function generateCorrectionExcel(
  rows: ExportRow[],
  options: CorrectionExportOptions = {},
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheetName = options.worksheetName || "Products";
  const worksheet = workbook.addWorksheet(worksheetName);

  // Determine column order
  const columnOrder = options.columnOrder || deriveColumnOrder(rows);

  if (columnOrder.length === 0) {
    // Return empty workbook
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }

  // Set up columns
  worksheet.columns = columnOrder.map((header) => ({
    header,
    key: header,
    width: DEFAULT_COLUMN_WIDTH,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  // Track column values for auto-sizing
  const columnValues: Map<string, (string | undefined)[]> = new Map();
  for (const col of columnOrder) {
    columnValues.set(col, []);
  }

  // Add data rows
  for (const row of rows) {
    // Prepare row data in column order
    const rowData: Record<string, string> = {};
    for (const col of columnOrder) {
      const value = row.data[col] || "";
      rowData[col] = value;
      columnValues.get(col)?.push(value);
    }

    const excelRow = worksheet.addRow(rowData);

    // Get set of error fields for this row
    const errorFields = new Set(row.errors.map((e) => e.field));

    // Apply error highlighting to cells with errors
    for (let colIndex = 0; colIndex < columnOrder.length; colIndex++) {
      const columnName = columnOrder[colIndex];
      if (columnName && errorFields.has(columnName)) {
        const cell = excelRow.getCell(colIndex + 1);
        cell.fill = ERROR_FILL;
      }
    }
  }

  // Auto-size columns based on content
  for (let i = 0; i < columnOrder.length; i++) {
    const header = columnOrder[i];
    if (header) {
      const values = columnValues.get(header) || [];
      const width = calculateColumnWidth(header, values);
      const column = worksheet.getColumn(i + 1);
      column.width = width;
    }
  }

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Generate a complete correction export including all original rows
 * with error highlighting only on failed rows
 *
 * @param allRows - All rows from the original import (success and failed)
 * @param failedRowNumbers - Set of row numbers that failed
 * @param errorsByRow - Map of row number to errors
 * @param columnOrder - Column order for the output
 * @returns Buffer containing the XLSX file
 */
export async function generateFullCorrectionExcel(
  allRows: Array<{ rowNumber: number; data: Record<string, string> }>,
  failedRowNumbers: Set<number>,
  errorsByRow: Map<number, Array<{ field: string; message: string }>>,
  columnOrder: string[],
): Promise<Uint8Array> {
  const exportRows: ExportRow[] = allRows.map((row) => ({
    rowNumber: row.rowNumber,
    data: row.data,
    errors: failedRowNumbers.has(row.rowNumber)
      ? errorsByRow.get(row.rowNumber) || []
      : [],
  }));

  return generateCorrectionExcel(exportRows, { columnOrder });
}

/**
 * Default column order for import correction exports
 * Matches the expected template structure
 */
export const DEFAULT_IMPORT_COLUMN_ORDER = [
  "Product Title",
  "Product Handle",
  "Manufacturer",
  "Description",
  "Image",
  "Image Status",
  "Category",
  "Season",
  "Tags",
  "Barcode",
  "SKU",
  "Attribute 1",
  "Attribute Value 1",
  "Attribute 2",
  "Attribute Value 2",
  "Attribute 3",
  "Attribute Value 3",
  "Kilograms CO2",
  "Carbon Footprint",
  "Liters Water Used",
  "Eco Claims",
  "Grams Weight",
  "Materials Percentages",
  "Raw Material",
  "Weaving",
  "Dyeing/Printing",
  "Stitching",
  "Assembly",
  "Finishing",
];

/**
 * Generate a blank import template with headers and example rows
 *
 * @param includeExamples - Whether to include example data rows
 * @returns Buffer containing the XLSX template file
 */
export async function generateImportTemplate(
  includeExamples = true,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Products");

  // Set up columns
  worksheet.columns = DEFAULT_IMPORT_COLUMN_ORDER.map((header) => ({
    header,
    key: header,
    width: DEFAULT_COLUMN_WIDTH,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  if (includeExamples) {
    // Add example parent row (product with first variant)
    worksheet.addRow({
      "Product Title": "Organic Cotton T-Shirt",
      "Product Handle": "organic-cotton-tshirt",
      Manufacturer: "Avelero Apparel",
      Description: "A comfortable, sustainable organic cotton t-shirt",
      Image: "https://example.com/images/tshirt-white.jpg",
      "Image Status": "published",
      Category: "Clothing > T-shirts",
      Season: "NOS",
      Tags: "organic|sustainable|cotton",
      Barcode: "1152437460001",
      SKU: "SKU-OCT-001",
      "Attribute 1": "Color",
      "Attribute Value 1": "White",
      "Attribute 2": "Size",
      "Attribute Value 2": "M",
      "Kilograms CO2": "2.5",
      "Liters Water Used": "1500",
      "Eco Claims": "Organic|Fair Trade",
      "Grams Weight": "180",
      "Materials Percentages": "Organic Cotton:100:TR:yes:GOTS:123:2026-12-31",
      "Raw Material": "Turkish Cotton Co",
      Weaving: "Eco Textiles",
      "Dyeing/Printing": "Natural Dye Works",
      Assembly: "Fair Wear Factory",
      Finishing: "Quality Finish Ltd",
    });

    // Add example child row (same product, different variant)
    worksheet.addRow({
      // No Product Handle = child row
      Barcode: "1152437460002",
      SKU: "SKU-OCT-002",
      "Attribute 1": "Color",
      "Attribute Value 1": "White",
      "Attribute 2": "Size",
      "Attribute Value 2": "L",
    });

    // Add another child row with variant-level override
    worksheet.addRow({
      "Product Title": "Organic Cotton T-Shirt - Black Edition", // Override
      Description: "Limited edition black colorway", // Override
      Image: "https://example.com/images/tshirt-black.jpg", // Override
      Barcode: "1152437460003",
      SKU: "SKU-OCT-003",
      "Attribute 1": "Color",
      "Attribute Value 1": "Black",
      "Attribute 2": "Size",
      "Attribute Value 2": "M",
    });

    // Add second product example
    worksheet.addRow({
      "Product Title": "Recycled Denim Jeans",
      "Product Handle": "recycled-denim-jeans",
      Manufacturer: "Avelero Apparel",
      Description: "Comfortable jeans made from recycled denim",
      Category: "Clothing > Jeans",
      Season: "AW24",
      Barcode: "2243635420001",
      SKU: "SKU-RDJ-001",
      "Attribute 1": "Size",
      "Attribute Value 1": "32",
      "Kilograms CO2": "8.5",
      "Materials Percentages": "Recycled Cotton:80|Elastane:20",
    });
  }

  // Auto-size columns
  for (const column of worksheet.columns) {
    column.width = 22;
  }

  // Make some columns wider
  const wideColumns = ["Product Title", "Description", "Materials Percentages"];
  for (const colName of wideColumns) {
    const col = worksheet.getColumn(colName);
    if (col) col.width = 35;
  }

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
