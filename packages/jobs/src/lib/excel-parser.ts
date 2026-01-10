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
 * Parsed material from the "Materials Percentages" column
 * Format: "Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|..."
 */
export interface ParsedMaterial {
  name: string;
  percentage?: number;
  country?: string;
  recyclable?: boolean;
  certificationTitle?: string;
  certificationNumber?: string;
  certificationExpiry?: string;
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
 * Column name mappings for case-insensitive matching
 * Maps normalized column names to their canonical form
 */
const COLUMN_ALIASES: Record<string, string> = {
  // Product-level columns
  product_title: "Product Title",
  producttitle: "Product Title",
  title: "Product Title",
  name: "Product Title",
  product_name: "Product Title",
  productname: "Product Title",

  product_handle: "Product Handle",
  producthandle: "Product Handle",
  handle: "Product Handle",

  manufacturer: "Manufacturer",
  brand: "Manufacturer",

  description: "Description",
  desc: "Description",
  product_description: "Description",

  image: "Image",
  image_url: "Image",
  imageurl: "Image",

  // Product status (unpublished, published, archived, scheduled)
  status: "Status",
  product_status: "Status",
  productstatus: "Status",

  category: "Category",
  product_category: "Category",

  season: "Season",

  tags: "Tags",
  tag: "Tags",

  // Variant-level columns
  barcode: "Barcode",
  ean: "Barcode",
  upc: "Barcode",

  sku: "SKU",
  stock_keeping_unit: "SKU",

  // UPID column for variant matching in enrich mode
  upid: "UPID",
  variant_upid: "UPID",
  variantupid: "UPID",
  variant_id: "UPID",

  // Attribute columns
  attribute_1: "Attribute 1",
  attribute1: "Attribute 1",
  "attribute value 1": "Attribute Value 1",
  attribute_value_1: "Attribute Value 1",
  attributevalue1: "Attribute Value 1",
  "attribute 1 value": "Attribute Value 1",

  attribute_2: "Attribute 2",
  attribute2: "Attribute 2",
  "attribute value 2": "Attribute Value 2",
  attribute_value_2: "Attribute Value 2",
  attributevalue2: "Attribute Value 2",
  "attribute 2 value": "Attribute Value 2",

  attribute_3: "Attribute 3",
  attribute3: "Attribute 3",
  "attribute value 3": "Attribute Value 3",
  attribute_value_3: "Attribute Value 3",
  attributevalue3: "Attribute Value 3",
  "attribute 3 value": "Attribute Value 3",

  // Environmental columns
  // "kgCO2e Carbon Footprint" -> "kgco2e_carbon_footprint"
  kgco2e_carbon_footprint: "Kilograms CO2",
  kilograms_co2: "Kilograms CO2",
  kilogramsco2: "Kilograms CO2",
  kg_co2: "Kilograms CO2",
  carbon_kg: "Kilograms CO2",

  carbon_footprint: "Carbon Footprint",
  carbonfootprint: "Carbon Footprint",

  // "Liters Water Used" -> "liters_water_used"
  liters_water_used: "Liters Water Used",
  literswaterused: "Liters Water Used",
  water_liters: "Liters Water Used",
  water_usage: "Liters Water Used",
  liters_water: "Liters Water Used",

  // "Eco-claims" -> "eco_claims"
  eco_claims: "Eco Claims",
  ecoclaims: "Eco Claims",

  grams_weight: "Grams Weight",
  gramsweight: "Grams Weight",
  weight: "Grams Weight",
  weight_grams: "Grams Weight",

  // Materials column (semicolon-separated material names)
  materials: "Materials",
  material: "Materials",
  material_list: "Materials",

  // Percentages column (semicolon-separated percentages, matches Materials order)
  percentages: "Percentages",
  percentage: "Percentages",
  material_percentages: "Percentages",
  materials_percentages: "Percentages",

  // Journey step columns
  raw_material: "Raw Material",
  rawmaterial: "Raw Material",

  weaving: "Weaving",

  "dyeing / printing": "Dyeing / Printing",
  dyeing_printing: "Dyeing / Printing",
  dyeingprinting: "Dyeing / Printing",
  dyeing: "Dyeing / Printing",
  printing: "Dyeing / Printing",

  stitching: "Stitching",

  assembly: "Assembly",

  finishing: "Finishing",
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
 * Normalize a column name for comparison
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_\-/]+/g, "_");
}

/**
 * Get canonical column name from any variation
 */
function getCanonicalColumnName(name: string): string {
  const normalized = normalizeColumnName(name);
  return COLUMN_ALIASES[normalized] || name;
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
      const canonicalHeader = getCanonicalColumnName(rawHeader);
      headers.push(rawHeader);
      headerMap.set(colNumber, canonicalHeader);
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
 * Validate that required columns are present
 */
export function validateRequiredColumns(headers: string[]): {
  valid: boolean;
  missingColumns: string[];
} {
  const canonicalHeaders = headers.map((h) => getCanonicalColumnName(h));

  // Required columns per the refactor plan
  const requiredColumns = ["Product Title", "Product Handle"];

  // At least one identifier column is required
  const identifierColumns = ["Barcode", "SKU"];
  const hasIdentifier = identifierColumns.some((col) =>
    canonicalHeaders.includes(col),
  );

  const missingColumns: string[] = [];

  for (const required of requiredColumns) {
    if (!canonicalHeaders.includes(required)) {
      missingColumns.push(required);
    }
  }

  if (!hasIdentifier) {
    missingColumns.push("Barcode or SKU (at least one required)");
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
  };
}

/**
 * Find duplicate identifiers within parsed products
 * Returns rows with duplicate barcodes, SKUs, or UPIDs
 */
export function findDuplicateIdentifiers(
  products: ParsedProduct[],
): { field: "Barcode" | "SKU" | "UPID"; value: string; rows: number[] }[] {
  const barcodeMap = new Map<string, number[]>();
  const skuMap = new Map<string, number[]>();
  const upidMap = new Map<string, number[]>();

  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.barcode) {
        const existing = barcodeMap.get(variant.barcode) || [];
        existing.push(variant.rowNumber);
        barcodeMap.set(variant.barcode, existing);
      }

      if (variant.sku) {
        const existing = skuMap.get(variant.sku) || [];
        existing.push(variant.rowNumber);
        skuMap.set(variant.sku, existing);
      }

      if (variant.upid) {
        const existing = upidMap.get(variant.upid) || [];
        existing.push(variant.rowNumber);
        upidMap.set(variant.upid, existing);
      }
    }
  }

  const duplicates: {
    field: "Barcode" | "SKU" | "UPID";
    value: string;
    rows: number[];
  }[] = [];

  for (const [barcode, rows] of barcodeMap.entries()) {
    if (rows.length > 1) {
      duplicates.push({ field: "Barcode", value: barcode, rows });
    }
  }

  for (const [sku, rows] of skuMap.entries()) {
    if (rows.length > 1) {
      duplicates.push({ field: "SKU", value: sku, rows });
    }
  }

  for (const [upid, rows] of upidMap.entries()) {
    if (rows.length > 1) {
      duplicates.push({ field: "UPID", value: upid, rows });
    }
  }

  return duplicates;
}
