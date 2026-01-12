/**
 * Generate Error Report Background Job
 *
 * Trigger.dev task for generating error report Excel files for failed imports.
 *
 * Workflow:
 * 1. Load raw data from import_rows (stored during validate-and-stage for error products)
 * 2. Load errors from staging_products to know which fields to highlight
 * 3. Generate Excel file with error highlighting (using bulk export template)
 * 4. Upload to Supabase storage
 * 5. Generate signed download URL (7 days expiry)
 * 6. Update import job with correction file info
 * 7. Send email notification if user email is available
 *
 * @module generate-error-report
 */

import "../configure-trigger";
import fs from "node:fs";
import path from "node:path";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  getImportJobStatus,
  updateImportJobCorrectionFile,
} from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import ImportFailuresEmail from "@v1/email/emails/import-failures";
import { and, asc, eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getResend } from "../../utils/resend";

// ============================================================================
// Types
// ============================================================================

interface GenerateErrorReportPayload {
  jobId: string;
  brandId: string;
  userEmail: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Download URL expiry in days */
const DOWNLOAD_EXPIRY_DAYS = 7;

/** Email from address */
const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

/** Storage bucket for correction files */
const STORAGE_BUCKET = "product-imports";

/** Row where headers are in the template */
const TEMPLATE_HEADER_ROW = 2;

/** Row where data starts in the template (after headers and example) */
const TEMPLATE_DATA_START_ROW = 4;

/**
 * Error cell fill color (light red)
 */
const ERROR_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFE0E0" }, // Light red: #FFE0E0
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build column index map from a worksheet row
 */
function buildColumnMapFromRow(
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

/**
 * Map internal column names to template column names
 * The raw data uses internal names (from parsing), but the template uses display names
 */
function getTemplateColumnName(internalName: string): string {
  const columnMappings: Record<string, string> = {
    // Internal name -> Template name
    "Kilograms CO2": "kgCO2e Carbon Footprint",
    "Carbon Footprint": "kgCO2e Carbon Footprint",
    "Eco Claims": "Eco-claims",
    "Eco-claims": "Eco-claims",
    "Liters Water Used": "Liters Water Used",
    "Grams Weight": "Grams Weight",
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
    Materials: "Materials",
    Percentages: "Percentages",
    "Raw Material": "Raw Material",
    Weaving: "Weaving",
    "Dyeing / Printing": "Dyeing / Printing",
    Stitching: "Stitching",
    Assembly: "Assembly",
    Finishing: "Finishing",
    "Attribute 1": "Attribute 1",
    "Attribute Value 1": "Attribute Value 1",
    "Attribute 2": "Attribute 2",
    "Attribute Value 2": "Attribute Value 2",
    "Attribute 3": "Attribute 3",
    "Attribute Value 3": "Attribute Value 3",
  };

  return columnMappings[internalName] || internalName;
}

// ============================================================================
// Main Task
// ============================================================================

export const generateErrorReport = task({
  id: "generate-error-report",
  maxDuration: 300, // 5 minutes
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 2 },

  run: async (payload: GenerateErrorReportPayload) => {
    const { jobId, brandId, userEmail } = payload;

    logger.info("Starting error report generation", { jobId, brandId });

    try {
      // 1. Get job info to verify it has exportable failures
      const job = await getImportJobStatus(db, jobId);

      if (!job) {
        throw new Error(`Import job not found: ${jobId}`);
      }

      if (!job.hasExportableFailures) {
        logger.warn("Job has no exportable failures", { jobId });
        return;
      }

      // 2. Load products with errors to get error info
      const productsWithErrors = await db
        .select({
          rowNumber: schema.stagingProducts.rowNumber,
          rowStatus: schema.stagingProducts.rowStatus,
          errors: schema.stagingProducts.errors,
        })
        .from(schema.stagingProducts)
        .where(
          and(
            eq(schema.stagingProducts.jobId, jobId),
            inArray(schema.stagingProducts.rowStatus, [
              "BLOCKED",
              "PENDING_WITH_WARNINGS",
            ]),
          ),
        )
        .orderBy(asc(schema.stagingProducts.rowNumber));

      // 3. Load variants with errors to get variant-level error info
      const variantsWithErrors = await db
        .select({
          rowNumber: schema.stagingProductVariants.rowNumber,
          rowStatus: schema.stagingProductVariants.rowStatus,
          errors: schema.stagingProductVariants.errors,
        })
        .from(schema.stagingProductVariants)
        .where(
          and(
            eq(schema.stagingProductVariants.jobId, jobId),
            eq(
              schema.stagingProductVariants.rowStatus,
              "PENDING_WITH_WARNINGS",
            ),
          ),
        )
        .orderBy(asc(schema.stagingProductVariants.rowNumber));

      const blockedCount = productsWithErrors.filter(
        (p) => p.rowStatus === "BLOCKED",
      ).length;
      const warningsCount = productsWithErrors.filter(
        (p) => p.rowStatus === "PENDING_WITH_WARNINGS",
      ).length;

      logger.info("Loaded products and variants with errors", {
        products: productsWithErrors.length,
        variants: variantsWithErrors.length,
        blocked: blockedCount,
        warnings: warningsCount,
      });

      if (productsWithErrors.length === 0) {
        logger.warn("No products with errors found in staging", { jobId });
        return;
      }

      // Build a map of rowNumber -> errors (combine product and variant errors)
      const errorsByRow = new Map<
        number,
        Array<{ field: string; message: string }>
      >();

      // Add product-level errors (these are for parent rows only)
      // Note: Product errors include aggregated variant errors, but we want per-row
      // For now, we'll only add non-variant-specific errors here
      // The key insight: staging_products.errors contains ALL errors (product + variant)
      // But staging_product_variants.errors contains ONLY that variant's errors
      // So we should prefer variant-level errors when available

      // First, add all product rows with their errors
      for (const product of productsWithErrors) {
        // Get only product-level errors (exclude variant errors that were aggregated)
        // For parent rows, we'll use the product errors
        errorsByRow.set(product.rowNumber, product.errors ?? []);
      }

      // Then, override/add variant rows with their specific errors
      for (const variant of variantsWithErrors) {
        const variantErrors = variant.errors ?? [];
        if (variantErrors.length > 0) {
          errorsByRow.set(variant.rowNumber, variantErrors);
        }
      }

      // 4. Load raw data from import_rows (stored during validate-and-stage)
      const rawRows = await db
        .select({
          rowNumber: schema.importRows.rowNumber,
          raw: schema.importRows.raw,
          status: schema.importRows.status,
        })
        .from(schema.importRows)
        .where(eq(schema.importRows.jobId, jobId))
        .orderBy(asc(schema.importRows.rowNumber));

      logger.info("Loaded raw rows from import_rows", {
        count: rawRows.length,
      });

      if (rawRows.length === 0) {
        logger.warn("No raw rows found in import_rows", { jobId });
        return;
      }

      // 5. Generate Excel file using the bulk export template
      const excelBuffer = await generateErrorReportExcel(
        rawRows.map((r) => ({
          rowNumber: r.rowNumber,
          raw: r.raw as Record<string, string>,
          errors: errorsByRow.get(r.rowNumber) ?? [],
        })),
      );

      logger.info("Generated Excel file", {
        size: excelBuffer.length,
      });

      // 5. Upload to Supabase storage
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const timestamp = Date.now();
      const filename = `error-report-${timestamp}.xlsx`;
      const storagePath = `${brandId}/${jobId}/corrections/${filename}`;

      logger.info("Uploading to storage", { path: storagePath });

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, excelBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true, // Allow overwriting if regenerated
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload error report file: ${uploadError.message}`,
        );
      }

      // 6. Generate signed download URL (7 days expiry)
      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60; // seconds
      const { data: signedData, error: signedError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          `Failed to generate download URL: ${signedError?.message}`,
        );
      }

      const downloadUrl = signedData.signedUrl;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // 7. Update import job with correction file info
      await updateImportJobCorrectionFile(db, {
        jobId,
        correctionFilePath: storagePath,
        correctionDownloadUrl: downloadUrl,
        correctionExpiresAt: expiresAt,
      });

      logger.info("Updated job with correction file info", {
        jobId,
        downloadUrl: `${downloadUrl.substring(0, 50)}...`,
      });

      // 8. Send email notification if user email is available
      if (userEmail) {
        try {
          // Get success count from job summary
          const summary = job.summary as Record<string, number> | null;
          const totalProducts = summary?.totalProducts ?? 0;
          const successfulProductCount =
            totalProducts - blockedCount - warningsCount;

          const html = await render(
            ImportFailuresEmail({
              blockedProductCount: blockedCount,
              warningProductCount: warningsCount,
              successfulProductCount: Math.max(0, successfulProductCount),
              downloadUrl,
              expiresAt,
              filename: job.filename,
            }),
          );

          const resend = getResend();
          const subject =
            blockedCount > 0
              ? `${blockedCount} products failed during your import`
              : `${warningsCount} products had warnings during your import`;

          await resend.emails.send({
            from: EMAIL_FROM,
            to: [userEmail],
            subject,
            html,
          });

          logger.info("Error report notification email sent", {
            to: userEmail,
          });
        } catch (emailError) {
          // Don't fail the job if email fails - file is still available
          logger.error("Failed to send error report notification email", {
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      } else {
        logger.info("No user email provided, skipping notification", { jobId });
      }

      logger.info("Error report generation completed", {
        jobId,
        blockedProducts: blockedCount,
        warningProducts: warningsCount,
        storagePath,
      });
    } catch (error) {
      logger.error("Error report generation failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});

// ============================================================================
// Excel Generation
// ============================================================================

/**
 * Generate error report Excel file using the bulk export template
 *
 * Uses the same template as the product export to ensure consistent column structure.
 * Failed cells are highlighted with a red background.
 */
async function generateErrorReportExcel(
  rows: Array<{
    rowNumber: number;
    raw: Record<string, string>;
    errors: Array<{ field: string; message: string }>;
  }>,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();

  // Try to load the bulk export template
  const templatePath = path.join(
    process.cwd(),
    "../../apps/api/public/templates/avelero-bulk-export-template.xlsx",
  );

  let worksheet: ExcelJS.Worksheet;
  let columnMap: Map<string, number>;
  let startRow: number;

  if (fs.existsSync(templatePath)) {
    // Load template
    await workbook.xlsx.readFile(templatePath);
    worksheet = workbook.getWorksheet("Products") ?? workbook.getWorksheet(1)!;

    if (!worksheet) {
      throw new Error("No worksheet found in template");
    }

    // Build column index map from header row
    columnMap = buildColumnMapFromRow(worksheet, TEMPLATE_HEADER_ROW);
    startRow = TEMPLATE_DATA_START_ROW;

    logger.info("Loaded template", {
      path: templatePath,
      columns: columnMap.size,
    });
  } else {
    // Fallback: create worksheet with basic headers
    logger.warn("Template not found, creating basic worksheet", {
      path: templatePath,
    });

    worksheet = workbook.addWorksheet("Products");

    // Get all unique column names from the raw data
    const allColumns = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.raw)) {
        allColumns.add(key);
      }
    }

    // Add header row
    const columns = Array.from(allColumns);
    worksheet.addRow(columns);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    // Build column map
    columnMap = new Map();
    columns.forEach((col, idx) => {
      columnMap.set(col, idx + 1);
    });

    startRow = 2;
  }

  // Add data rows
  let currentRow = startRow;

  for (const rowData of rows) {
    const errors = rowData.errors;
    const errorFields = new Set(errors.map((e) => e.field));

    const row = worksheet.getRow(currentRow);

    // Populate cells from raw data
    for (const [columnName, value] of Object.entries(rowData.raw)) {
      // Map column name to template column name
      const templateColumn = getTemplateColumnName(columnName);
      const colIdx = columnMap.get(templateColumn) ?? columnMap.get(columnName);

      if (colIdx && value != null && value !== "") {
        const cell = row.getCell(colIdx);
        cell.value = value;

        // Apply error highlighting if this field has an error
        if (errorFields.has(columnName) || errorFields.has(templateColumn)) {
          cell.fill = ERROR_FILL;
        }
      }
    }

    // Also highlight error fields that might not have values in raw data
    // (e.g., missing required fields)
    for (const error of errors) {
      const templateColumn = getTemplateColumnName(error.field);
      const colIdx =
        columnMap.get(templateColumn) ?? columnMap.get(error.field);

      if (colIdx) {
        const cell = row.getCell(colIdx);
        cell.fill = ERROR_FILL;
      }
    }

    row.commit();
    currentRow++;
  }

  logger.info("Populated Excel with row data", {
    rowsAdded: rows.length,
    startRow,
    endRow: currentRow - 1,
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
