/**
 * Excel Parser for Bulk Import
 *
 * Parses XLSX files with Shopify-style row grouping.
 * Uses ExcelJS for parsing Excel files.
 *
 * Key concepts:
 * - Parent row: Has a value in "Product Handle" column (starts a new product)
 * - Child row: No "Product Handle" value (belongs to previous parent)
 * - Variant-level overrides: Child rows can override product-level fields
 *
 * @module excel-parser
 */

import ExcelJS from "exceljs";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Parsed material from the "Materials" and "Percentages" columns
 * Format: Two separate columns - Materials (semicolon-separated names) and Percentages (semicolon-separated values)
 */
export interface ParsedMaterial {
  name: string;
  percentage?: number;
}

/**
 * Parsed attribute name/value pair from Attribute columns
 */
export interface ParsedAttribute {
  name: string;
  value: string;
  sortOrder: number;
}

/**
 * Parsed variant from an Excel row
 */
export interface ParsedVariant {
  /** Row number in the original Excel file (1-indexed, excluding header) */
  rowNumber: number;
  /** Unique Product/Variant ID - required for enriching existing variants, empty for new variants */
  upid?: string;
  /** Product barcode (EAN/UPC) */
  barcode?: string;
  /** Stock Keeping Unit */
  sku?: string;
  /** Attributes extracted from Attribute 1-3 / Attribute Value 1-3 columns */
  attributes: ParsedAttribute[];

  // Variant-level overrides (only set if child row has values)
  /** Override for product name (only on child rows) */
  nameOverride?: string;
  /** Override for product description (only on child rows) */
  descriptionOverride?: string;
  /** Override for product image (only on child rows) */
  imagePathOverride?: string;

  // Environmental data OVERRIDES (only populated on child rows with values)
  // Parent row environmental data goes to ParsedProduct instead
  /** Carbon footprint override in kg CO2e (only on child rows) */
  carbonKgOverride?: number;
  /** Carbon footprint status override (only on child rows) */
  carbonStatusOverride?: string;
  /** Water usage override in liters (only on child rows) */
  waterLitersOverride?: number;
  /** Weight override in grams (only on child rows) */
  weightGramsOverride?: number;
  /** Eco claims override (only on child rows) */
  ecoClaimsOverride: string[];
  /** Materials override (only on child rows) */
  materialsOverride: ParsedMaterial[];

  // Journey steps OVERRIDE (only populated on child rows with values)
  /** Map of step slug -> operator/facility name (only on child rows) */
  journeyStepsOverride: Record<string, string>;

  // Raw data for error reporting
  rawData: Record<string, string>;
}

/**
 * Parsed product group from Excel rows
 */
export interface ParsedProduct {
  /** First row number of this product group */
  rowNumber: number;
  /** URL-friendly product identifier (KEY DIFFERENTIATOR) */
  productHandle: string;
  /** Product display name */
  name: string;
  /** Product description */
  description?: string;
  /** Manufacturer/brand name */
  manufacturerName?: string;
  /** Product image URL/path */
  imagePath?: string;
  /** Product status (unpublished, published, archived, scheduled) */
  status?: string;
  /** Category path (e.g., "Clothing > T-shirts") */
  categoryPath?: string;
  /** Season name (e.g., "NOS", "SS26") */
  seasonName?: string;
  /** Tags (semicolon-separated in Excel) */
  tags: string[];

  // Product-level environmental/supply chain data (from parent row)
  /** Carbon footprint in kg CO2e */
  carbonKg?: number;
  /** Carbon footprint description/status */
  carbonStatus?: string;
  /** Water usage in liters */
  waterLiters?: number;
  /** Weight in grams */
  weightGrams?: number;
  /** Eco claims (semicolon-separated in Excel) */
  ecoClaims: string[];
  /** Parsed materials (from Materials + Percentages columns) */
  materials: ParsedMaterial[];
  /** Map of journey step slug -> operator/facility name */
  journeySteps: Record<string, string>;

  /** All variants belonging to this product */
  variants: ParsedVariant[];
  /** Raw product-level data for error reporting */
  rawData: Record<string, string>;
}

/**
 * Result of parsing an Excel file
 */
export interface ExcelParseResult {
  /** Parsed product groups */
  products: ParsedProduct[];
  /** Original column headers from the file */
  headers: string[];
  /** Total rows processed (excluding header) */
  totalRows: number;
  /** Any parsing errors encountered */
  errors: ExcelParseError[];
}

/**
 * Parse error from Excel parsing
 */
export interface ExcelParseError {
  row: number;
  column?: string;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Expected columns in the Avelero import template.
 * All columns must be present with exact names (case-sensitive).
 * UPID is the only optional column (present in export template, absent in import template).
 */
export const EXPECTED_COLUMNS = [
  "Product Title",
  "Product Handle",
  "Manufacturer",
  "Description",
  "Image",
  "Status",
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
  "kgCO2e Carbon Footprint",
  "Liters Water Used",
  "Eco-claims",
  "Grams Weight",
  "Materials",
  "Percentages",
  "Raw Material",
  "Weaving",
  "Dyeing / Printing",
  "Stitching",
  "Assembly",
  "Finishing",
] as const;

/**
 * Column that is optional (only present in export template, not required in import template)
 */
const OPTIONAL_COLUMN = "UPID";

/**
 * Mapping from template column names to internal canonical names
 * Used for accessing data after parsing
 */
const COLUMN_TO_INTERNAL: Record<string, string> = {
  "Product Title": "Product Title",
  "Product Handle": "Product Handle",
  "Manufacturer": "Manufacturer",
  "Description": "Description",
  "Image": "Image",
  "Status": "Status",
  "Category": "Category",
  "Season": "Season",
  "Tags": "Tags",
  "UPID": "UPID",
  "Barcode": "Barcode",
  "SKU": "SKU",
  "Attribute 1": "Attribute 1",
  "Attribute Value 1": "Attribute Value 1",
  "Attribute 2": "Attribute 2",
  "Attribute Value 2": "Attribute Value 2",
  "Attribute 3": "Attribute 3",
  "Attribute Value 3": "Attribute Value 3",
  "kgCO2e Carbon Footprint": "Kilograms CO2",
  "Liters Water Used": "Liters Water Used",
  "Eco-claims": "Eco Claims",
  "Grams Weight": "Grams Weight",
  "Materials": "Materials",
  "Percentages": "Percentages",
  "Raw Material": "Raw Material",
  "Weaving": "Weaving",
  "Dyeing / Printing": "Dyeing / Printing",
  "Stitching": "Stitching",
  "Assembly": "Assembly",
  "Finishing": "Finishing",
};

/**
 * Journey step column names mapped to their step types (display format)
 * These must match the exact format used in the UI/database
 */
const JOURNEY_STEP_COLUMNS: Record<string, string> = {
  "Raw Material": "Raw Material",
  Weaving: "Weaving",
  "Dyeing / Printing": "Dyeing / Printing",
  Stitching: "Stitching",
  Assembly: "Assembly",
  Finishing: "Finishing",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get internal column name from template column name
 * Uses exact matching - no normalization or aliases
 */
function getInternalColumnName(name: string): string {
  return COLUMN_TO_INTERNAL[name] || name;
}

/**
 * Extract cell value as string
 */
function getCellValue(
  row: ExcelJS.Row,
  columnIndex: number,
): string | undefined {
  const cell = row.getCell(columnIndex);
  if (!cell || cell.value === null || cell.value === undefined) {
    return undefined;
  }

  // Handle different cell value types
  const value = cell.value;

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return value.toISOString().split("T")[0]; // YYYY-MM-DD format
  }

  // Handle rich text
  if (
    typeof value === "object" &&
    "richText" in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText
      .map((rt) => (typeof rt === "object" && "text" in rt ? rt.text : ""))
      .join("")
      .trim();
  }

  // Handle formula results
  if (typeof value === "object" && "result" in value) {
    const result = value.result;
    if (typeof result === "string") return result.trim();
    if (typeof result === "number") return String(result);
    if (result === null || result === undefined) return undefined;
    return String(result);
  }

  // Handle hyperlinks
  if (typeof value === "object" && "text" in value) {
    return typeof value.text === "string" ? value.text.trim() : undefined;
  }

  return String(value).trim();
}

/**
 * Parse semicolon-separated values
 * Example: "Red; Blue; Green" => ["Red", "Blue", "Green"]
 */
export function parseSemicolonSeparated(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * @deprecated Use parseSemicolonSeparated instead
 */
export function parsePipeSeparated(value: string | undefined): string[] {
  return parseSemicolonSeparated(value);
}

/**
 * Parse materials from simple semicolon-separated format with optional percentages
 *
 * Materials column: "Cotton; Polyester; Elastane"
 * Percentages column (optional): "80; 15; 5"
 *
 * @param materialsValue - Semicolon-separated material names
 * @param percentagesValue - Optional semicolon-separated percentages
 * @returns Array of ParsedMaterial objects
 */
export function parseMaterials(
  materialsValue: string | undefined,
  percentagesValue?: string | undefined,
): ParsedMaterial[] {
  if (!materialsValue || materialsValue.trim() === "") {
    return [];
  }

  const materialNames = parseSemicolonSeparated(materialsValue);
  const percentages = percentagesValue
    ? parseSemicolonSeparated(percentagesValue)
    : [];

  return materialNames.map((name, index) => {
    const material: ParsedMaterial = { name };

    // Get corresponding percentage if available
    if (percentages[index]) {
      const percentage = Number.parseFloat(percentages[index]);
      if (!Number.isNaN(percentage)) {
        material.percentage = percentage;
      }
    }

    return material;
  });
}

/**
 * Parse a number from a string, returning undefined if invalid
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isNaN(num) ? undefined : num;
}

// ============================================================================
// Main Parser Functions
// ============================================================================

/**
 * Extract attributes from row data (Attribute 1-3 / Attribute Value 1-3)
 */
function extractAttributes(rowData: Record<string, string>): ParsedAttribute[] {
  const attrs: ParsedAttribute[] = [];

  for (let i = 1; i <= 3; i++) {
    const name = rowData[`Attribute ${i}`]?.trim();
    const value = rowData[`Attribute Value ${i}`]?.trim();

    if (name && value) {
      attrs.push({ name, value, sortOrder: i - 1 });
    }
  }

  return attrs;
}

/**
 * Extract journey steps from row data
 * Returns a map of step slug -> operator/facility name
 */
function extractJourneySteps(
  rowData: Record<string, string>,
): Record<string, string> {
  const steps: Record<string, string> = {};

  for (const [columnName, stepSlug] of Object.entries(JOURNEY_STEP_COLUMNS)) {
    const value = rowData[columnName]?.trim();
    if (value) {
      steps[stepSlug] = value;
    }
  }

  return steps;
}

/**
 * Extract variant data from a row
 *
 * For parent rows (isFirstVariant=true): Only extracts variant-level data (barcode, sku, attributes)
 * Environmental/material/journey data goes to the product level instead.
 *
 * For child rows (isFirstVariant=false): Extracts variant-level overrides if cells have values.
 *
 * @param rowData - Row data as key-value pairs
 * @param rowNumber - Row number in the Excel file
 * @param isFirstVariant - Whether this is the first variant of a product (parent row)
 */
function extractVariant(
  rowData: Record<string, string>,
  rowNumber: number,
  isFirstVariant: boolean,
): ParsedVariant {
  // For child rows, extract environmental/material/journey data as overrides
  // For parent rows, these fields stay empty (data goes to product level)
  const shouldExtractOverrides = !isFirstVariant;

  return {
    rowNumber,
    upid: rowData.UPID?.trim() || undefined,
    barcode: rowData.Barcode,
    sku: rowData.SKU,
    attributes: extractAttributes(rowData),

    // Only set overrides for child rows (not first variant)
    nameOverride: shouldExtractOverrides
      ? rowData["Product Title"]?.trim() || undefined
      : undefined,
    descriptionOverride: shouldExtractOverrides
      ? rowData.Description?.trim() || undefined
      : undefined,
    imagePathOverride: shouldExtractOverrides
      ? rowData.Image?.trim() || undefined
      : undefined,

    // Environmental data OVERRIDES - only for child rows
    carbonKgOverride: shouldExtractOverrides
      ? parseNumber(rowData["Kilograms CO2"])
      : undefined,
    carbonStatusOverride: shouldExtractOverrides
      ? rowData["Carbon Footprint"]
      : undefined,
    waterLitersOverride: shouldExtractOverrides
      ? parseNumber(rowData["Liters Water Used"])
      : undefined,
    weightGramsOverride: shouldExtractOverrides
      ? parseNumber(rowData["Grams Weight"])
      : undefined,
    ecoClaimsOverride: shouldExtractOverrides
      ? parseSemicolonSeparated(rowData["Eco Claims"])
      : [],
    materialsOverride: shouldExtractOverrides
      ? parseMaterials(rowData.Materials, rowData.Percentages)
      : [],

    // Journey steps OVERRIDE - only for child rows
    journeyStepsOverride: shouldExtractOverrides
      ? extractJourneySteps(rowData)
      : {},

    // Raw data for error reporting
    rawData: { ...rowData },
  };
}

/**
 * Build a header map from row 2 (Avelero template structure)
 *
 * Template structure:
 * - Row 1: Category header with merged cells (skip)
 * - Row 2: Actual column headers
 * - Row 3: Example data row (skip)
 * - Row 4+: Actual product data
 *
 * Maps column index to canonical column name
 */
function buildHeaderMap(worksheet: ExcelJS.Worksheet): {
  headers: string[];
  headerMap: Map<number, string>;
  headerRowNumber: number;
} {
  const headers: string[] = [];
  const headerMap = new Map<number, string>();

  // Use row 2 as the header row (row 1 is category headers with merged cells)
  const headerRow = worksheet.getRow(2);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = getCellValue(headerRow, colNumber);
    if (rawHeader) {
      const internalHeader = getInternalColumnName(rawHeader);
      headers.push(rawHeader);
      headerMap.set(colNumber, internalHeader);
    }
  });

  return { headers, headerMap, headerRowNumber: 2 };
}

/**
 * Extract row data as key-value pairs using canonical column names
 */
function extractRowData(
  row: ExcelJS.Row,
  headerMap: Map<number, string>,
): Record<string, string> {
  const data: Record<string, string> = {};

  for (const [colIndex, columnName] of headerMap.entries()) {
    const value = getCellValue(row, colIndex);
    if (value !== undefined && value !== "") {
      data[columnName] = value;
    }
  }

  return data;
}

/**
 * Parse an Excel file (XLSX) with Shopify-style row grouping
 *
 * The key rule: "Product Handle" is the differentiator
 * - Row with Product Handle = Parent row (start of new product)
 * - Row without Product Handle = Child row (variant of previous product)
 *
 * @param buffer - File buffer to parse
 * @returns Parsed products with variants
 */
export async function parseExcelFile(
  buffer: ArrayBuffer | Uint8Array,
): Promise<ExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  const errors: ExcelParseError[] = [];

  try {
    // ExcelJS accepts ArrayBuffer, Uint8Array, and Buffer at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    return {
      products: [],
      headers: [],
      totalRows: 0,
      errors: [
        {
          row: 0,
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }

  // Get the "Products" worksheet by name (the template has two tabs: Description and Products)
  // Fall back to first worksheet if "Products" tab doesn't exist (for simpler files)
  let worksheet = workbook.getWorksheet("Products");
  if (!worksheet) {
    worksheet = workbook.getWorksheet(1);
  }

  if (!worksheet) {
    return {
      products: [],
      headers: [],
      totalRows: 0,
      errors: [
        {
          row: 0,
          message: "No worksheet found in Excel file. Expected 'Products' tab.",
        },
      ],
    };
  }

  // Build header map from row 2 (row 1 is category header with merged cells)
  const { headers, headerMap, headerRowNumber } = buildHeaderMap(worksheet);

  if (headers.length === 0) {
    return {
      products: [],
      headers: [],
      totalRows: 0,
      errors: [{ row: 0, message: "No headers found in Excel file" }],
    };
  }

  const products: ParsedProduct[] = [];
  let currentProduct: ParsedProduct | null = null;
  let rowCount = 0;

  // Process each row (skip first 3 rows: category header, column headers, example row)
  // Row 1: Category headers (merged cells)
  // Row 2: Column headers
  // Row 3: Example data row
  // Row 4+: Actual product data
  const DATA_START_ROW = 4;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < DATA_START_ROW) {
      return; // Skip rows 1-3
    }

    rowCount++;
    const rowData = extractRowData(row, headerMap);

    // Check if this is a parent row (has Product Handle)
    const productHandle = rowData["Product Handle"]?.trim();

    if (productHandle) {
      // Parent row - start new product group
      // Extract product-level environmental/material/journey data from parent row
      currentProduct = {
        rowNumber,
        productHandle,
        name: rowData["Product Title"] || "",
        description: rowData.Description,
        manufacturerName: rowData.Manufacturer,
        imagePath: rowData.Image,
        status: rowData.Status?.toLowerCase(),
        categoryPath: rowData.Category,
        seasonName: rowData.Season,
        tags: parseSemicolonSeparated(rowData.Tags),

        // Product-level environmental/supply chain data (from parent row)
        carbonKg: parseNumber(rowData["Kilograms CO2"]),
        carbonStatus: rowData["Carbon Footprint"],
        waterLiters: parseNumber(rowData["Liters Water Used"]),
        weightGrams: parseNumber(rowData["Grams Weight"]),
        ecoClaims: parseSemicolonSeparated(rowData["Eco Claims"]),
        materials: parseMaterials(rowData.Materials, rowData.Percentages),
        journeySteps: extractJourneySteps(rowData),

        variants: [extractVariant(rowData, rowNumber, true)],
        rawData: { ...rowData },
      };
      products.push(currentProduct);
    } else {
      // Child row - belongs to current product
      if (!currentProduct) {
        errors.push({
          row: rowNumber,
          message: "Child row found before any parent row (no Product Handle)",
        });
        return;
      }

      currentProduct.variants.push(extractVariant(rowData, rowNumber, false));
    }
  });

  return {
    products,
    headers,
    totalRows: rowCount,
    errors,
  };
}

/**
 * Validate that the Excel file matches the Avelero template exactly.
 * All expected columns must be present with exact names (case-sensitive).
 * UPID is optional (present in export template, absent in import template).
 * Extra columns are not allowed.
 */
export function validateTemplateMatch(headers: string[]): {
  valid: boolean;
  error?: string;
  missingColumns: string[];
  extraColumns: string[];
  hasUpid: boolean;
} {
  const headerSet = new Set(headers);
  const expectedSet = new Set<string>(EXPECTED_COLUMNS);

  // Check for missing columns (excluding optional UPID)
  const missingColumns: string[] = [];
  for (const expected of EXPECTED_COLUMNS) {
    if (!headerSet.has(expected)) {
      missingColumns.push(expected);
    }
  }

  // Check for extra columns (excluding optional UPID)
  const extraColumns: string[] = [];
  for (const header of headers) {
    if (!expectedSet.has(header) && header !== OPTIONAL_COLUMN) {
      extraColumns.push(header);
    }
  }

  // Check if UPID column is present
  const hasUpid = headerSet.has(OPTIONAL_COLUMN);

  // Build error message if invalid
  let error: string | undefined;
  if (missingColumns.length > 0 || extraColumns.length > 0) {
    const parts: string[] = [];
    if (missingColumns.length > 0) {
      parts.push(`Missing columns: ${missingColumns.join(", ")}`);
    }
    if (extraColumns.length > 0) {
      parts.push(`Unexpected columns: ${extraColumns.join(", ")}`);
    }
    error = `Template mismatch. ${parts.join(". ")}. Please use the Avelero template.`;
  }

  return {
    valid: missingColumns.length === 0 && extraColumns.length === 0,
    error,
    missingColumns,
    extraColumns,
    hasUpid,
  };
}

/**
 * @deprecated Use validateTemplateMatch instead
 */
export function validateRequiredColumns(headers: string[]): {
  valid: boolean;
  missingColumns: string[];
} {
  const result = validateTemplateMatch(headers);
  return {
    valid: result.valid,
    missingColumns: [...result.missingColumns, ...result.extraColumns],
  };
}

/**
 * Find duplicate identifiers within parsed products.
 * Only checks for duplicate Product Handles and UPIDs.
 * SKU and Barcode duplicates are NOT checked (user's responsibility).
 */
export function findDuplicateIdentifiers(
  products: ParsedProduct[],
): { field: "Product Handle" | "UPID"; value: string; rows: number[] }[] {
  const handleMap = new Map<string, number[]>();
  const upidMap = new Map<string, number[]>();

  for (const product of products) {
    // Track product handle duplicates
    if (product.productHandle) {
      const existing = handleMap.get(product.productHandle) || [];
      existing.push(product.rowNumber);
      handleMap.set(product.productHandle, existing);
    }

    // Track UPID duplicates across all variants
    for (const variant of product.variants) {
      if (variant.upid) {
        const existing = upidMap.get(variant.upid) || [];
        existing.push(variant.rowNumber);
        upidMap.set(variant.upid, existing);
      }
    }
  }

  const duplicates: {
    field: "Product Handle" | "UPID";
    value: string;
    rows: number[];
  }[] = [];

  for (const [handle, rows] of handleMap.entries()) {
    if (rows.length > 1) {
      duplicates.push({ field: "Product Handle", value: handle, rows });
    }
  }

  for (const [upid, rows] of upidMap.entries()) {
    if (rows.length > 1) {
      duplicates.push({ field: "UPID", value: upid, rows });
    }
  }

  return duplicates;
}
