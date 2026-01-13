/**
 * Excel Utilities for Bulk Import/Export
 *
 * Consolidated module for all Excel operations:
 * - Parsing: Read Excel files with Shopify-style row grouping
 * - Product Export: Generate product data Excel files
 * - Error Report: Generate correction files with error highlighting
 *
 * Uses ExcelJS for all operations.
 *
 * @module excel
 */

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

// ============================================================================
// Types & Interfaces
// ============================================================================

// --- Parsing Types ---

export interface ParsedMaterial {
  name: string;
  percentage?: number;
}

export interface ParsedAttribute {
  name: string;
  value: string;
  sortOrder: number;
}

export interface ParsedVariant {
  rowNumber: number;
  upid?: string;
  barcode?: string;
  sku?: string;
  attributes: ParsedAttribute[];
  nameOverride?: string;
  descriptionOverride?: string;
  imagePathOverride?: string;
  carbonKgOverride?: number;
  carbonStatusOverride?: string;
  waterLitersOverride?: number;
  weightGramsOverride?: number;
  ecoClaimsOverride: string[];
  materialsOverride: ParsedMaterial[];
  journeyStepsOverride: Record<string, string>;
  rawData: Record<string, string>;
}

export interface ParsedProduct {
  rowNumber: number;
  productHandle: string;
  name: string;
  description?: string;
  manufacturerName?: string;
  imagePath?: string;
  status?: string;
  categoryPath?: string;
  seasonName?: string;
  tags: string[];
  carbonKg?: number;
  carbonStatus?: string;
  waterLiters?: number;
  weightGrams?: number;
  ecoClaims: string[];
  materials: ParsedMaterial[];
  journeySteps: Record<string, string>;
  variants: ParsedVariant[];
  rawData: Record<string, string>;
}

export interface ExcelParseResult {
  products: ParsedProduct[];
  headers: string[];
  totalRows: number;
  errors: ExcelParseError[];
}

export interface ExcelParseError {
  row: number;
  column?: string;
  message: string;
}

// --- Export Types ---

export interface ExportProductData {
  id: string;
  name: string;
  productHandle: string;
  description: string | null;
  manufacturerName: string | null;
  imagePath: string | null;
  status: string;
  categoryPath: string | null;
  seasonName: string | null;
  tags: string[];
  carbonKg: number | null;
  waterLiters: number | null;
  ecoClaims: string[];
  weightGrams: number | null;
  materials: Array<{ name: string; percentage: number | null }>;
  journeySteps: Record<string, string>;
  variants: ExportVariantData[];
}

export interface ExportVariantData {
  upid: string;
  barcode: string | null;
  sku: string | null;
  attributes: Array<{ name: string; value: string; sortOrder: number }>;
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

export interface ErrorReportRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: Array<{ field: string; message: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const ERROR_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFE0E0" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0E0E0" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
};

const DEFAULT_COLUMN_WIDTH = 20;
const TEMPLATE_HEADER_ROW = 2;
const TEMPLATE_DATA_START_ROW = 4;

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
  "UPID",
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

const JOURNEY_STEP_COLUMNS: Record<string, string> = {
  "Raw Material": "Raw Material",
  Weaving: "Weaving",
  "Dyeing / Printing": "Dyeing / Printing",
  Stitching: "Stitching",
  Assembly: "Assembly",
  Finishing: "Finishing",
};

const COLUMN_TO_INTERNAL: Record<string, string> = {
  "Product Title": "Product Title",
  "Product Handle": "Product Handle",
  Manufacturer: "Manufacturer",
  Description: "Description",
  Image: "Image",
  Status: "Status",
  Category: "Category",
  Season: "Season",
  Tags: "Tags",
  UPID: "UPID",
  Barcode: "Barcode",
  SKU: "SKU",
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
  Materials: "Materials",
  Percentages: "Percentages",
  "Raw Material": "Raw Material",
  Weaving: "Weaving",
  "Dyeing / Printing": "Dyeing / Printing",
  Stitching: "Stitching",
  Assembly: "Assembly",
  Finishing: "Finishing",
};

const INTERNAL_TO_TEMPLATE: Record<string, string> = {
  "Kilograms CO2": "kgCO2e Carbon Footprint",
  "Carbon Footprint": "kgCO2e Carbon Footprint",
  "Eco Claims": "Eco-claims",
};

// ============================================================================
// Shared Utilities
// ============================================================================

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

function getCellValue(
  row: ExcelJS.Row,
  columnIndex: number,
): string | undefined {
  const cell = row.getCell(columnIndex);
  if (!cell || cell.value === null || cell.value === undefined) {
    return undefined;
  }

  const value = cell.value;

  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString().split("T")[0];

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

  if (typeof value === "object" && "result" in value) {
    const result = value.result;
    if (typeof result === "string") return result.trim();
    if (typeof result === "number") return String(result);
    if (result === null || result === undefined) return undefined;
    return String(result);
  }

  if (typeof value === "object" && "text" in value) {
    return typeof value.text === "string" ? value.text.trim() : undefined;
  }

  return String(value).trim();
}

export function parseSemicolonSeparated(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function parseMaterials(
  materialsValue: string | undefined,
  percentagesValue?: string | undefined,
): ParsedMaterial[] {
  if (!materialsValue || materialsValue.trim() === "") return [];

  const materialNames = parseSemicolonSeparated(materialsValue);
  const percentages = percentagesValue
    ? parseSemicolonSeparated(percentagesValue)
    : [];

  return materialNames.map((name, index) => {
    const material: ParsedMaterial = { name };
    if (percentages[index]) {
      const percentage = Number.parseFloat(percentages[index]);
      if (!Number.isNaN(percentage)) material.percentage = percentage;
    }
    return material;
  });
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isNaN(num) ? undefined : num;
}

export function joinSemicolon(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join("; ");
}

export function formatMaterials(
  materials:
    | Array<{ name: string; percentage: number | null }>
    | null
    | undefined,
): { names: string; percentages: string } {
  if (!materials || materials.length === 0)
    return { names: "", percentages: "" };
  const names = materials.map((m) => m.name).join("; ");
  const percentages = materials
    .map((m) => (m.percentage != null ? String(m.percentage) : ""))
    .join("; ");
  return { names, percentages };
}

export function buildImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return imagePath;
  const baseUrl = supabaseUrl.endsWith("/")
    ? supabaseUrl.slice(0, -1)
    : supabaseUrl;
  return `${baseUrl}/storage/v1/object/public/products/${imagePath}`;
}

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

function getTemplateColumnName(internalName: string): string {
  return INTERNAL_TO_TEMPLATE[internalName] || internalName;
}

async function loadExportTemplate(): Promise<{
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
  columnMap: Map<string, number>;
  startRow: number;
  fromTemplate: boolean;
}> {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(
    process.cwd(),
    "../../apps/api/public/templates/avelero-bulk-export-template.xlsx",
  );

  if (fs.existsSync(templatePath)) {
    await workbook.xlsx.readFile(templatePath);
    const worksheet =
      workbook.getWorksheet("Products") ?? workbook.getWorksheet(1)!;
    if (!worksheet) throw new Error("No worksheet found in template");
    const columnMap = buildColumnMapFromRow(worksheet, TEMPLATE_HEADER_ROW);
    return {
      workbook,
      worksheet,
      columnMap,
      startRow: TEMPLATE_DATA_START_ROW,
      fromTemplate: true,
    };
  }

  const worksheet = workbook.addWorksheet("Products");
  worksheet.addRow(EXPORT_COLUMNS);
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  for (let i = 0; i < EXPORT_COLUMNS.length; i++) {
    worksheet.getColumn(i + 1).width = DEFAULT_COLUMN_WIDTH;
  }
  const columnMap = new Map<string, number>();
  EXPORT_COLUMNS.forEach((col, idx) => columnMap.set(col, idx + 1));
  return { workbook, worksheet, columnMap, startRow: 2, fromTemplate: false };
}

// ============================================================================
// Parsing Functions
// ============================================================================

function extractAttributes(rowData: Record<string, string>): ParsedAttribute[] {
  const attrs: ParsedAttribute[] = [];
  for (let i = 1; i <= 3; i++) {
    const name = rowData[`Attribute ${i}`]?.trim();
    const value = rowData[`Attribute Value ${i}`]?.trim();
    if (name && value) attrs.push({ name, value, sortOrder: i - 1 });
  }
  return attrs;
}

function extractJourneySteps(
  rowData: Record<string, string>,
): Record<string, string> {
  const steps: Record<string, string> = {};
  for (const [columnName, stepSlug] of Object.entries(JOURNEY_STEP_COLUMNS)) {
    const value = rowData[columnName]?.trim();
    if (value) steps[stepSlug] = value;
  }
  return steps;
}

function extractVariant(
  rowData: Record<string, string>,
  rowNumber: number,
  isFirstVariant: boolean,
): ParsedVariant {
  const shouldExtractOverrides = !isFirstVariant;
  return {
    rowNumber,
    upid: rowData.UPID?.trim() || undefined,
    barcode: rowData.Barcode,
    sku: rowData.SKU,
    attributes: extractAttributes(rowData),
    nameOverride: shouldExtractOverrides
      ? rowData["Product Title"]?.trim() || undefined
      : undefined,
    descriptionOverride: shouldExtractOverrides
      ? rowData.Description?.trim() || undefined
      : undefined,
    imagePathOverride: shouldExtractOverrides
      ? rowData.Image?.trim() || undefined
      : undefined,
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
    journeyStepsOverride: shouldExtractOverrides
      ? extractJourneySteps(rowData)
      : {},
    rawData: { ...rowData },
  };
}

function buildHeaderMap(worksheet: ExcelJS.Worksheet): {
  headers: string[];
  headerMap: Map<number, string>;
} {
  const headers: string[] = [];
  const headerMap = new Map<number, string>();
  const headerRow = worksheet.getRow(2);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = getCellValue(headerRow, colNumber);
    if (rawHeader) {
      const internalHeader = COLUMN_TO_INTERNAL[rawHeader] || rawHeader;
      headers.push(rawHeader);
      headerMap.set(colNumber, internalHeader);
    }
  });

  return { headers, headerMap };
}

function extractRowData(
  row: ExcelJS.Row,
  headerMap: Map<number, string>,
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [colIndex, columnName] of headerMap.entries()) {
    const value = getCellValue(row, colIndex);
    if (value !== undefined && value !== "") data[columnName] = value;
  }
  return data;
}

export async function parseExcelFile(
  buffer: ArrayBuffer | Uint8Array,
): Promise<ExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  const errors: ExcelParseError[] = [];

  try {
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

  let worksheet = workbook.getWorksheet("Products");
  if (!worksheet) worksheet = workbook.getWorksheet(1);
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

  const { headers, headerMap } = buildHeaderMap(worksheet);
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

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 4) return;
    rowCount++;
    const rowData = extractRowData(row, headerMap);
    const productHandle = rowData["Product Handle"]?.trim();

    if (productHandle) {
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

  return { products, headers, totalRows: rowCount, errors };
}

export function validateTemplateMatch(headers: string[]): {
  valid: boolean;
  error?: string;
  missingColumns: string[];
  extraColumns: string[];
  hasUpid: boolean;
} {
  const headerSet = new Set(headers);
  const expectedSet = new Set<string>(EXPECTED_COLUMNS);
  const missingColumns: string[] = [];
  const extraColumns: string[] = [];

  for (const expected of EXPECTED_COLUMNS) {
    if (!headerSet.has(expected)) missingColumns.push(expected);
  }
  for (const header of headers) {
    if (!expectedSet.has(header) && header !== "UPID")
      extraColumns.push(header);
  }

  const hasUpid = headerSet.has("UPID");
  let error: string | undefined;
  if (missingColumns.length > 0 || extraColumns.length > 0) {
    const parts: string[] = [];
    if (missingColumns.length > 0)
      parts.push(`Missing columns: ${missingColumns.join(", ")}`);
    if (extraColumns.length > 0)
      parts.push(`Unexpected columns: ${extraColumns.join(", ")}`);
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

export function findDuplicateIdentifiers(
  products: ParsedProduct[],
): { field: "Product Handle" | "UPID"; value: string; rows: number[] }[] {
  const handleMap = new Map<string, number[]>();
  const upidMap = new Map<string, number[]>();

  for (const product of products) {
    if (product.productHandle) {
      const existing = handleMap.get(product.productHandle) || [];
      existing.push(product.rowNumber);
      handleMap.set(product.productHandle, existing);
    }
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
    if (rows.length > 1)
      duplicates.push({ field: "Product Handle", value: handle, rows });
  }
  for (const [upid, rows] of upidMap.entries()) {
    if (rows.length > 1) duplicates.push({ field: "UPID", value: upid, rows });
  }

  return duplicates;
}

// ============================================================================
// Export Functions
// ============================================================================

export async function generateProductExportExcel(
  products: ExportProductData[],
): Promise<Uint8Array> {
  const { workbook, worksheet, columnMap, startRow } =
    await loadExportTemplate();
  let currentRow = startRow;

  for (const product of products) {
    for (
      let variantIdx = 0;
      variantIdx < product.variants.length;
      variantIdx++
    ) {
      const variant = product.variants[variantIdx]!;
      const isParentRow = variantIdx === 0;
      const row = worksheet.getRow(currentRow);

      const setCell = (
        columnName: string,
        value: string | number | null | undefined,
      ) => {
        const colIdx = columnMap.get(columnName);
        if (colIdx && value != null && value !== "")
          row.getCell(colIdx).value = value;
      };

      if (isParentRow) {
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
        setCell(
          "kgCO2e Carbon Footprint",
          variant.carbonKgOverride ?? product.carbonKg,
        );
        setCell(
          "Liters Water Used",
          variant.waterLitersOverride ?? product.waterLiters,
        );
        const ecoClaims = variant.ecoClaimsOverride?.length
          ? variant.ecoClaimsOverride
          : product.ecoClaims;
        setCell("Eco-claims", joinSemicolon(ecoClaims));
        setCell(
          "Grams Weight",
          variant.weightGramsOverride ?? product.weightGrams,
        );
        const materials = variant.materialsOverride?.length
          ? variant.materialsOverride
          : product.materials;
        const { names, percentages } = formatMaterials(materials);
        setCell("Materials", names);
        setCell("Percentages", percentages);
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
        if (variant.ecoClaimsOverride?.length)
          setCell("Eco-claims", joinSemicolon(variant.ecoClaimsOverride));
        if (variant.materialsOverride?.length) {
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

      setCell("UPID", variant.upid);
      setCell("Barcode", variant.barcode);
      setCell("SKU", variant.sku);

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

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function generateErrorReportExcel(
  rows: ErrorReportRow[],
): Promise<Uint8Array> {
  const { workbook, worksheet, columnMap, startRow } =
    await loadExportTemplate();
  let currentRow = startRow;

  for (const rowData of rows) {
    const errorFields = new Set(rowData.errors.map((e) => e.field));
    const row = worksheet.getRow(currentRow);

    for (const [columnName, value] of Object.entries(rowData.raw)) {
      const templateColumn = getTemplateColumnName(columnName);
      const colIdx = columnMap.get(templateColumn) ?? columnMap.get(columnName);
      if (colIdx && value != null && value !== "") {
        const cell = row.getCell(colIdx);
        cell.value = value;
        if (errorFields.has(columnName) || errorFields.has(templateColumn)) {
          cell.fill = ERROR_FILL;
        }
      }
    }

    for (const error of rowData.errors) {
      const templateColumn = getTemplateColumnName(error.field);
      const colIdx =
        columnMap.get(templateColumn) ?? columnMap.get(error.field);
      if (colIdx) row.getCell(colIdx).fill = ERROR_FILL;
    }

    row.commit();
    currentRow++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
