/**
 * Excel Export for Products
 *
 * Generates XLSX files using the Avelero template format.
 * Populates products in Shopify-style parent/child row structure.
 *
 * Template structure:
 * - Row 1: Category headers (merged cells) - preserved from template
 * - Row 2: Column headers - preserved from template
 * - Row 3: Example data row - preserved from template
 * - Row 4+: Exported product data
 *
 * @module excel-export-products
 */

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

// ============================================================================
// Types
// ============================================================================

/**
 * Product data for export (from getProductsForExport query)
 */
export interface ExportProductData {
  // Basic product info
  id: string;
  name: string;
  productHandle: string;
  description: string | null;
  manufacturerName: string | null;
  imagePath: string | null;
  status: string;
  categoryPath: string | null;
  seasonName: string | null;
  tags: string[]; // semicolon-joined in output

  // Environmental
  carbonKg: number | null;
  waterLiters: number | null;

  // Eco-claims
  ecoClaims: string[]; // semicolon-joined in output

  // Weight
  weightGrams: number | null;

  // Materials
  materials: Array<{ name: string; percentage: number | null }>;

  // Journey steps (operator names by step type)
  journeySteps: Record<string, string>; // stepType -> operatorName

  // Variants
  variants: ExportVariantData[];
}

export interface ExportVariantData {
  upid: string;
  barcode: string | null;
  sku: string | null;
  attributes: Array<{ name: string; value: string; sortOrder: number }>;

  // Overrides (if any)
  nameOverride: string | null;
  descriptionOverride: string | null;
  imagePathOverride: string | null;
  carbonKgOverride: number | null;
  waterLitersOverride: number | null;
  weightGramsOverride: number | null;
  ecoClaimsOverride: string[] | null;
  materialsOverride: Array<{ name: string; percentage: number | null }> | null;
  journeyStepsOverride: Record<string, string> | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Column mapping for export (matches template structure with UPID added)
 */
const EXPORT_COLUMNS = [
  "Product Title",
  "Product Handle",
  "Manufacturer",
  "Description",
  "Image",
  "Status",
  "Category",
  "Season",
  "Tags",
  "UPID", // Added for export
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
];

/**
 * Journey step column mappings (stepType -> column name)
 *
 * NOTE: The keys here must match the stepType values stored in the database.
 * The Excel parser stores journey steps using display names (e.g., "Raw Material")
 * not slug format (e.g., "raw-material" or "raw_material").
 */
const JOURNEY_STEP_COLUMNS: Record<string, string> = {
  "Raw Material": "Raw Material",
  Weaving: "Weaving",
  "Dyeing / Printing": "Dyeing / Printing",
  Stitching: "Stitching",
  Assembly: "Assembly",
  Finishing: "Finishing",
};

/**
 * Row where data starts (after category header, column headers, and example row)
 */
const DATA_START_ROW = 4;

/**
 * Header row (column names)
 */
const HEADER_ROW = 2;

/**
 * Default column width
 */
const DEFAULT_COLUMN_WIDTH = 20;

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

/**
 * Join array with semicolons
 */
export function joinSemicolon(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join("; ");
}

/**
 * Format materials for export
 */
export function formatMaterials(
  materials:
    | Array<{ name: string; percentage: number | null }>
    | null
    | undefined,
): { names: string; percentages: string } {
  if (!materials || materials.length === 0) {
    return { names: "", percentages: "" };
  }

  const names = materials.map((m) => m.name).join("; ");
  const percentages = materials
    .map((m) => (m.percentage != null ? String(m.percentage) : ""))
    .join("; ");

  return { names, percentages };
}

/**
 * Build full image URL from path
 */
export function buildImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";

  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Build full Supabase storage URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return imagePath;

  const baseUrl = supabaseUrl.endsWith("/")
    ? supabaseUrl.slice(0, -1)
    : supabaseUrl;
  return `${baseUrl}/storage/v1/object/public/products/${imagePath}`;
}

/**
 * Get attribute value by index (1-3)
 */
export function getAttributeByIndex(
  attributes: Array<{ name: string; value: string; sortOrder: number }>,
  index: number,
): { name: string; value: string } {
  const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
  const attr = sorted[index - 1];
  return attr
    ? { name: attr.name, value: attr.value }
    : { name: "", value: "" };
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate product export Excel file
 *
 * Creates a new workbook with headers and populates with product data.
 * Products are formatted in Shopify-style parent/child row structure.
 *
 * @param products - Array of products with all related data
 * @returns Buffer containing the XLSX file
 */
export async function generateProductExportExcel(
  products: ExportProductData[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();

  // Try to load template, fall back to creating from scratch
  const templatePath = path.join(
    process.cwd(),
    "../../apps/api/public/templates/avelero-bulk-export-template.xlsx",
  );

  let worksheet: ExcelJS.Worksheet;
  let columnMap: Map<string, number>;

  if (fs.existsSync(templatePath)) {
    // Load template
    await workbook.xlsx.readFile(templatePath);
    worksheet = workbook.getWorksheet("Products") ?? workbook.getWorksheet(1)!;

    if (!worksheet) {
      throw new Error("No worksheet found in template");
    }

    // Build column index map from header row
    columnMap = buildColumnMapFromRow(worksheet, HEADER_ROW);
  } else {
    // Fallback: create worksheet with headers
    worksheet = workbook.addWorksheet("Products");

    // Add header row
    worksheet.addRow(EXPORT_COLUMNS);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    // Set column widths
    for (let i = 0; i < EXPORT_COLUMNS.length; i++) {
      worksheet.getColumn(i + 1).width = DEFAULT_COLUMN_WIDTH;
    }

    // Build column map from our headers (1-indexed)
    columnMap = new Map();
    EXPORT_COLUMNS.forEach((col, idx) => {
      columnMap.set(col, idx + 1);
    });
  }

  // Get starting row for data
  const startRow = fs.existsSync(templatePath) ? DATA_START_ROW : 2;

  // Add product data
  let currentRow = startRow;

  for (const product of products) {
    // Process each variant
    for (
      let variantIdx = 0;
      variantIdx < product.variants.length;
      variantIdx++
    ) {
      const variant = product.variants[variantIdx]!;
      const isParentRow = variantIdx === 0;

      const row = worksheet.getRow(currentRow);

      // Helper to set cell value
      const setCell = (
        columnName: string,
        value: string | number | null | undefined,
      ) => {
        const colIdx = columnMap.get(columnName);
        if (colIdx && value != null && value !== "") {
          row.getCell(colIdx).value = value;
        }
      };

      if (isParentRow) {
        // Parent row - include all product-level data
        setCell("Product Title", variant.nameOverride ?? product.name);
        setCell("Product Handle", product.productHandle);
        setCell("Manufacturer", product.manufacturerName);
        setCell(
          "Description",
          variant.descriptionOverride ?? product.description,
        );
        setCell(
          "Image",
          buildImageUrl(variant.imagePathOverride ?? product.imagePath),
        );
        setCell("Status", product.status);
        setCell("Category", product.categoryPath);
        setCell("Season", product.seasonName);
        setCell("Tags", joinSemicolon(product.tags));

        // Environmental
        setCell(
          "kgCO2e Carbon Footprint",
          variant.carbonKgOverride ?? product.carbonKg,
        );
        setCell(
          "Liters Water Used",
          variant.waterLitersOverride ?? product.waterLiters,
        );

        // Eco-claims
        const ecoClaims =
          variant.ecoClaimsOverride && variant.ecoClaimsOverride.length > 0
            ? variant.ecoClaimsOverride
            : product.ecoClaims;
        setCell("Eco-claims", joinSemicolon(ecoClaims));

        // Weight
        setCell(
          "Grams Weight",
          variant.weightGramsOverride ?? product.weightGrams,
        );

        // Materials
        const materials =
          variant.materialsOverride && variant.materialsOverride.length > 0
            ? variant.materialsOverride
            : product.materials;
        const { names, percentages } = formatMaterials(materials);
        setCell("Materials", names);
        setCell("Percentages", percentages);

        // Journey steps
        const journeySteps =
          variant.journeyStepsOverride &&
            Object.keys(variant.journeyStepsOverride).length > 0
            ? variant.journeyStepsOverride
            : product.journeySteps;
        for (const [stepType, columnName] of Object.entries(
          JOURNEY_STEP_COLUMNS,
        )) {
          setCell(columnName, journeySteps[stepType]);
        }
      } else {
        // Child row - only variant-specific data and overrides
        if (variant.nameOverride)
          setCell("Product Title", variant.nameOverride);
        if (variant.descriptionOverride)
          setCell("Description", variant.descriptionOverride);
        if (variant.imagePathOverride)
          setCell("Image", buildImageUrl(variant.imagePathOverride));
        if (variant.carbonKgOverride != null)
          setCell("kgCO2e Carbon Footprint", variant.carbonKgOverride);
        if (variant.waterLitersOverride != null)
          setCell("Liters Water Used", variant.waterLitersOverride);
        if (variant.weightGramsOverride != null)
          setCell("Grams Weight", variant.weightGramsOverride);
        if (variant.ecoClaimsOverride && variant.ecoClaimsOverride.length > 0)
          setCell("Eco-claims", joinSemicolon(variant.ecoClaimsOverride));

        if (variant.materialsOverride && variant.materialsOverride.length > 0) {
          const { names, percentages } = formatMaterials(
            variant.materialsOverride,
          );
          setCell("Materials", names);
          setCell("Percentages", percentages);
        }

        if (
          variant.journeyStepsOverride &&
          Object.keys(variant.journeyStepsOverride).length > 0
        ) {
          for (const [stepType, columnName] of Object.entries(
            JOURNEY_STEP_COLUMNS,
          )) {
            setCell(columnName, variant.journeyStepsOverride[stepType]);
          }
        }
      }

      // Always set variant-level data
      setCell("UPID", variant.upid);
      setCell("Barcode", variant.barcode);
      setCell("SKU", variant.sku);

      // Attributes (up to 3)
      const attr1 = getAttributeByIndex(variant.attributes, 1);
      const attr2 = getAttributeByIndex(variant.attributes, 2);
      const attr3 = getAttributeByIndex(variant.attributes, 3);

      setCell("Attribute 1", attr1.name);
      setCell("Attribute Value 1", attr1.value);
      setCell("Attribute 2", attr2.name);
      setCell("Attribute Value 2", attr2.value);
      setCell("Attribute 3", attr3.name);
      setCell("Attribute Value 3", attr3.value);

      row.commit();
      currentRow++;
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Build column index map from a worksheet row
 */
export function buildColumnMapFromRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
): Map<string, number> {
  const columnMap = new Map<string, number>();
  const headerRow = worksheet.getRow(rowNumber);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const value = cell.value?.toString().trim();
    if (value) {
      columnMap.set(value, colNumber);
    }
  });

  return columnMap;
}
