/**
 * Excel Builder Utility for Bulk Import Tests
 *
 * Creates test Excel files programmatically using ExcelJS.
 * Follows the Avelero bulk import template structure:
 * - Row 1: Category headers (merged cells)
 * - Row 2: Column headers
 * - Row 3: Example data row
 * - Row 4+: Product data
 *
 * @module @v1/testing/bulk-import/excel-builder
 */

import ExcelJS from "exceljs";

// ============================================================================
// Types
// ============================================================================

/**
 * Material definition for test products
 */
export interface TestMaterial {
    name: string;
    percentage?: number;
    country?: string;
    recyclable?: boolean;
    certTitle?: string;
    certNumber?: string;
    certExpiry?: string;
}

/**
 * Attribute definition for test variants
 */
export interface TestAttribute {
    name: string;
    value: string;
}

/**
 * Journey step definition for test products
 */
export interface TestJourneySteps {
    rawMaterial?: string;
    weaving?: string;
    dyeingPrinting?: string;
    stitching?: string;
    assembly?: string;
    finishing?: string;
}

/**
 * Environmental data for test products
 */
export interface TestEnvironmentalData {
    kilogramsCO2?: number;
    litersWaterUsed?: number;
    carbonFootprint?: string;
    gramsWeight?: number;
}

/**
 * Test variant definition
 */
export interface TestVariant {
    /** Stock Keeping Unit (required for import) */
    sku?: string;
    /** Product barcode - EAN/UPC (required for import) */
    barcode?: string;
    /** UPID for variant matching in enrich mode */
    upid?: string;
    /** Variant attributes (up to 3) */
    attributes?: TestAttribute[];
    /** Weight in grams */
    gramsWeight?: number;

    // Variant-level overrides (for child rows)
    /** Override product title for this variant */
    titleOverride?: string;
    /** Override product description for this variant */
    descriptionOverride?: string;
    /** Override product image for this variant */
    imageOverride?: string;
    /** Override environmental data for this variant */
    environmentalOverride?: TestEnvironmentalData;
    /** Override materials for this variant */
    materialsOverride?: TestMaterial[];
    /** Override journey steps for this variant */
    journeyOverride?: TestJourneySteps;
}

/**
 * Test product definition
 */
export interface TestProduct {
    /** URL-friendly product identifier (required) */
    handle: string;
    /** Product display name (required) */
    title: string;
    /** Manufacturer/brand name */
    manufacturer?: string;
    /** Product description */
    description?: string;
    /** Product image URL */
    image?: string;
    /** Product status (unpublished, published, archived, scheduled) */
    status?: string;
    /** Category path (e.g., "Clothing > T-shirts") */
    category?: string;
    /** Season name (e.g., "NOS", "SS26") */
    season?: string;
    /** Tags (array, will be semicolon-separated) */
    tags?: string[];
    /** Eco claims (array, will be semicolon-separated) */
    ecoClaims?: string[];
    /** Materials with percentages */
    materials?: TestMaterial[];
    /** Environmental data */
    environmental?: TestEnvironmentalData;
    /** Journey steps (supply chain) */
    journey?: TestJourneySteps;
    /** Product variants (at least one required) */
    variants: TestVariant[];
}

/**
 * Options for Excel file generation
 */
export interface ExcelBuilderOptions {
    /** Products to include in the Excel file */
    products: TestProduct[];
    /** Whether to include example row (row 3). Defaults to false for tests */
    includeExampleRow?: boolean;
    /** Worksheet name. Defaults to "Products" */
    sheetName?: string;
    /** Include category header row (row 1). Defaults to true */
    includeCategoryHeaders?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All column headers in the correct order
 */
const COLUMN_HEADERS = [
    // Product identification
    "Product Handle",
    "Product Title",
    "Manufacturer",
    "Description",
    "Image",
    "Status",
    "Category",
    "Season",
    "Tags",
    // Variant identification
    "UPID",
    "Barcode",
    "SKU",
    // Attributes
    "Attribute 1",
    "Attribute Value 1",
    "Attribute 2",
    "Attribute Value 2",
    "Attribute 3",
    "Attribute Value 3",
    // Environmental
    "Kilograms CO2",
    "Liters Water Used",
    "Carbon Footprint",
    "Grams Weight",
    "Eco Claims",
    // Materials
    "Materials",
    "Percentages",
    // Journey steps
    "Raw Material",
    "Weaving",
    "Dyeing / Printing",
    "Stitching",
    "Assembly",
    "Finishing",
];

/**
 * Category header groups for row 1
 */
const CATEGORY_HEADERS = [
    { name: "Product Information", columns: 9 },
    { name: "Variant Information", columns: 9 },
    { name: "Environmental Data", columns: 5 },
    { name: "Materials", columns: 2 },
    { name: "Supply Chain Journey", columns: 6 },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format materials as semicolon-separated strings
 */
function formatMaterials(materials: TestMaterial[]): {
    names: string;
    percentages: string;
} {
    const names = materials.map((m) => m.name).join("; ");
    const percentages = materials
        .map((m) => (m.percentage !== undefined ? String(m.percentage) : ""))
        .join("; ");
    return { names, percentages };
}

/**
 * Format tags/eco claims as semicolon-separated string
 */
function formatSemicolonList(items: string[] | undefined): string {
    if (!items || items.length === 0) return "";
    return items.join("; ");
}

/**
 * Build a row of data for a product/variant
 */
function buildRowData(
    product: TestProduct,
    variant: TestVariant,
    isParentRow: boolean
): Record<string, string | number | undefined> {
    const row: Record<string, string | number | undefined> = {};

    // Parent row gets all product-level data
    if (isParentRow) {
        row["Product Handle"] = product.handle;
        row["Product Title"] = product.title;
        row["Manufacturer"] = product.manufacturer;
        row["Description"] = product.description;
        row["Image"] = product.image;
        row["Status"] = product.status;
        row["Category"] = product.category;
        row["Season"] = product.season;
        row["Tags"] = formatSemicolonList(product.tags);
        row["Eco Claims"] = formatSemicolonList(product.ecoClaims);

        // Environmental data
        if (product.environmental) {
            row["Kilograms CO2"] = product.environmental.kilogramsCO2;
            row["Liters Water Used"] = product.environmental.litersWaterUsed;
            row["Carbon Footprint"] = product.environmental.carbonFootprint;
            row["Grams Weight"] = product.environmental.gramsWeight;
        }

        // Materials
        if (product.materials && product.materials.length > 0) {
            const { names, percentages } = formatMaterials(product.materials);
            row["Materials"] = names;
            row["Percentages"] = percentages;
        }

        // Journey steps
        if (product.journey) {
            row["Raw Material"] = product.journey.rawMaterial;
            row["Weaving"] = product.journey.weaving;
            row["Dyeing / Printing"] = product.journey.dyeingPrinting;
            row["Stitching"] = product.journey.stitching;
            row["Assembly"] = product.journey.assembly;
            row["Finishing"] = product.journey.finishing;
        }
    } else {
        // Child row - only include overrides if present
        row["Product Handle"] = undefined; // Empty for child rows

        if (variant.titleOverride) row["Product Title"] = variant.titleOverride;
        if (variant.descriptionOverride)
            row["Description"] = variant.descriptionOverride;
        if (variant.imageOverride) row["Image"] = variant.imageOverride;

        // Environmental overrides
        if (variant.environmentalOverride) {
            row["Kilograms CO2"] = variant.environmentalOverride.kilogramsCO2;
            row["Liters Water Used"] =
                variant.environmentalOverride.litersWaterUsed;
            row["Carbon Footprint"] =
                variant.environmentalOverride.carbonFootprint;
            row["Grams Weight"] = variant.environmentalOverride.gramsWeight;
        }

        // Materials override
        if (variant.materialsOverride && variant.materialsOverride.length > 0) {
            const { names, percentages } = formatMaterials(
                variant.materialsOverride
            );
            row["Materials"] = names;
            row["Percentages"] = percentages;
        }

        // Journey override
        if (variant.journeyOverride) {
            row["Raw Material"] = variant.journeyOverride.rawMaterial;
            row["Weaving"] = variant.journeyOverride.weaving;
            row["Dyeing / Printing"] = variant.journeyOverride.dyeingPrinting;
            row["Stitching"] = variant.journeyOverride.stitching;
            row["Assembly"] = variant.journeyOverride.assembly;
            row["Finishing"] = variant.journeyOverride.finishing;
        }
    }

    // Variant-level data (always included)
    row["UPID"] = variant.upid;
    row["Barcode"] = variant.barcode;
    row["SKU"] = variant.sku;

    // Variant weight (if not already set by product or override)
    if (variant.gramsWeight !== undefined && row["Grams Weight"] === undefined) {
        row["Grams Weight"] = variant.gramsWeight;
    }

    // Attributes (up to 3)
    if (variant.attributes) {
        variant.attributes.slice(0, 3).forEach((attr, index) => {
            row[`Attribute ${index + 1}`] = attr.name;
            row[`Attribute Value ${index + 1}`] = attr.value;
        });
    }

    return row;
}

// ============================================================================
// Excel Builder Class
// ============================================================================

/**
 * Utility class for creating test Excel files
 *
 * @example
 * ```typescript
 * const buffer = await ExcelBuilder.create({
 *   products: [
 *     {
 *       handle: "test-product",
 *       title: "Test Product",
 *       variants: [
 *         { sku: "SKU-001", barcode: "1234567890123" }
 *       ]
 *     }
 *   ]
 * });
 * ```
 */
export class ExcelBuilder {
    /**
     * Create an Excel file from product definitions
     */
    static async create(options: ExcelBuilderOptions): Promise<Uint8Array> {
        const {
            products,
            includeExampleRow = false,
            sheetName = "Products",
            includeCategoryHeaders = true,
        } = options;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        let currentRow = 1;

        // Row 1: Category headers (optional)
        if (includeCategoryHeaders) {
            let colIndex = 1;
            for (const category of CATEGORY_HEADERS) {
                const endCol = colIndex + category.columns - 1;
                worksheet.mergeCells(currentRow, colIndex, currentRow, endCol);
                const cell = worksheet.getCell(currentRow, colIndex);
                cell.value = category.name;
                cell.font = { bold: true };
                cell.alignment = { horizontal: "center" };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFE0E0E0" },
                };
                colIndex = endCol + 1;
            }
            currentRow++;
        }

        // Row 2: Column headers
        const headerRow = worksheet.getRow(currentRow);
        COLUMN_HEADERS.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { bold: true };
        });
        currentRow++;

        // Row 3: Example row (always reserve this row, but only populate if requested)
        // The parser always skips row 3, so we must start data at row 4
        if (includeExampleRow) {
            const exampleRow = worksheet.getRow(currentRow);
            exampleRow.getCell(1).value = "example-handle";
            exampleRow.getCell(2).value = "Example Product";
            exampleRow.font = { italic: true, color: { argb: "FF888888" } };
        }
        currentRow++; // Always skip row 3, even if empty

        // Row 4+: Product data
        for (const product of products) {
            for (let i = 0; i < product.variants.length; i++) {
                const variant = product.variants[i];
                if (!variant) continue;
                const isParentRow = i === 0;
                const rowData = buildRowData(product, variant, isParentRow);

                const dataRow = worksheet.getRow(currentRow);
                COLUMN_HEADERS.forEach((header, colIndex) => {
                    const value = rowData[header];
                    if (value !== undefined && value !== "") {
                        dataRow.getCell(colIndex + 1).value = value;
                    }
                });

                currentRow++;
            }
        }

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
            column.width = 15;
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Create a simple single-product Excel file
     *
     * @example
     * ```typescript
     * const buffer = await ExcelBuilder.createSingleProduct({
     *   handle: "test-product",
     *   title: "Test Product",
     *   variants: [{ sku: "SKU-001", barcode: "1234567890123" }]
     * });
     * ```
     */
    static async createSingleProduct(product: TestProduct): Promise<Uint8Array> {
        return ExcelBuilder.create({ products: [product] });
    }

    /**
     * Create an Excel file from raw row data
     * Useful for testing edge cases with malformed data
     *
     * @example
     * ```typescript
     * const buffer = await ExcelBuilder.createFromRows([
     *   { "Product Handle": "handle-1", "Product Title": "Title", "SKU": "SKU-001" },
     *   { "SKU": "SKU-002" } // Child row without handle
     * ]);
     * ```
     */
    static async createFromRows(
        rows: Record<string, string | number | undefined>[],
        options?: {
            sheetName?: string;
            includeCategoryHeaders?: boolean;
        }
    ): Promise<Uint8Array> {
        const { sheetName = "Products", includeCategoryHeaders = true } =
            options ?? {};

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        let currentRow = 1;

        // Row 1: Category headers (optional)
        if (includeCategoryHeaders) {
            let colIndex = 1;
            for (const category of CATEGORY_HEADERS) {
                const endCol = colIndex + category.columns - 1;
                worksheet.mergeCells(currentRow, colIndex, currentRow, endCol);
                const cell = worksheet.getCell(currentRow, colIndex);
                cell.value = category.name;
                cell.font = { bold: true };
                colIndex = endCol + 1;
            }
            currentRow++;
        }

        // Row 2: Column headers
        const headerRow = worksheet.getRow(currentRow);
        COLUMN_HEADERS.forEach((header, index) => {
            headerRow.getCell(index + 1).value = header;
            headerRow.getCell(index + 1).font = { bold: true };
        });
        currentRow++;

        // Skip row 3 (example row) - jump to row 4 for data
        currentRow++;

        // Row 4+: Data rows
        for (const row of rows) {
            const dataRow = worksheet.getRow(currentRow);
            COLUMN_HEADERS.forEach((header, colIndex) => {
                const value = row[header];
                if (value !== undefined && value !== "") {
                    dataRow.getCell(colIndex + 1).value = value;
                }
            });
            currentRow++;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Create an empty Excel file (headers only)
     */
    static async createEmpty(): Promise<Uint8Array> {
        return ExcelBuilder.create({ products: [] });
    }

    /**
     * Create an Excel file with only headers (no data rows)
     * This simulates a "header-only" file
     */
    static async createHeaderOnly(): Promise<Uint8Array> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Products");

        // Row 1: Category headers
        let colIndex = 1;
        for (const category of CATEGORY_HEADERS) {
            const endCol = colIndex + category.columns - 1;
            worksheet.mergeCells(1, colIndex, 1, endCol);
            worksheet.getCell(1, colIndex).value = category.name;
            colIndex = endCol + 1;
        }

        // Row 2: Column headers
        COLUMN_HEADERS.forEach((header, index) => {
            worksheet.getCell(2, index + 1).value = header;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Get the list of column headers used by the builder
     */
    static getColumnHeaders(): string[] {
        return [...COLUMN_HEADERS];
    }
}
