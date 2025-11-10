import "./configure-trigger";
import { randomUUID } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { serviceDb as db } from "@v1/db/client";
import {
  type CreateImportRowParams,
  type UpdateImportRowStatusParams,
  batchUpdateImportRowStatus,
  createImportRows,
  getImportJobStatus,
  updateImportJobProgress,
  updateImportJobStatus,
} from "@v1/db/queries";
import {
  type InsertStagingProductParams,
  type InsertStagingVariantParams,
  countStagingProductsByAction,
  deleteStagingDataForJob,
  insertStagingProduct,
  insertStagingVariant,
} from "@v1/db/queries";
import { and, eq } from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import type { Database as SupabaseDatabase } from "@v1/supabase/types";
import {
  findDuplicates,
  normalizeHeaders,
  parseFile,
} from "../lib/csv-parser";
import {
  EntityType,
  ValueMapper,
} from "../lib/value-mapper";

/**
 * Task payload for Phase 1 validation and staging
 */
interface ValidateAndStagePayload {
  jobId: string;
  brandId: string;
  filePath: string;
}

/**
 * CSV row structure with all possible columns
 */
interface CSVRow {
  product_name: string;
  upid?: string;
  sku?: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  season?: string;
  primary_image_url?: string;
  color_id?: string;
  color_name?: string;
  size_id?: string;
  size_name?: string;
  product_image_url?: string;
  material_1_name?: string;
  material_1_percentage?: string;
  material_2_name?: string;
  material_2_percentage?: string;
  material_3_name?: string;
  material_3_percentage?: string;
  showcase_brand_id?: string;
  brand_certification_id?: string;
  [key: string]: unknown;
}

/**
 * Validation error type
 */
interface ValidationError {
  type: string;
  field?: string;
  message: string;
}

/**
 * Validated row data ready for staging
 */
interface ValidatedRowData {
  productId: string; // Generated UUID for new product or existing product ID
  variantId: string; // Generated UUID for new variant or existing variant ID
  action: "CREATE" | "UPDATE";
  existingProductId?: string;
  existingVariantId?: string;
  product: InsertStagingProductParams;
  variant: InsertStagingVariantParams;
  errors: ValidationError[];
}

const BATCH_SIZE = 100;
const TIMEOUT_MS = 1800000; // 30 minutes

/**
 * Emit progress update to WebSocket clients via API endpoint
 */
async function emitProgress(params: {
  jobId: string;
  status: "PENDING" | "VALIDATING" | "VALIDATED" | "COMMITTING" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase: "validation" | "commit";
  processed: number;
  total: number;
  created?: number;
  updated?: number;
  failed?: number;
  percentage: number;
  message?: string;
}): Promise<void> {
  try {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const apiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";

    // Prepare input data with apiKey
    const inputData = {
      apiKey,
      ...params,
    };

    // tRPC HTTP format for POST mutations: wrap input in "json" key
    // The procedure name is in the URL path
    const response = await fetch(`${apiUrl}/trpc/internal.emitProgress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: inputData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[emitProgress] Failed to emit progress:", {
        status: response.status,
        statusText: response.statusText,
        url: `${apiUrl}/trpc/internal.emitProgress`,
        error: errorText,
        payload: inputData,
      });
    } else {
      const result = await response.json();
      // tRPC response format: { "result": { "data": ... } }
      const data = result.result?.data;
      console.log("[emitProgress] Progress emitted successfully:", {
        jobId: params.jobId,
        emittedTo: data?.emittedTo || 0,
        status: params.status,
        percentage: params.percentage,
      });
    }
  } catch (error) {
    // Don't fail the job if WebSocket emission fails
    console.error("[emitProgress] Error emitting progress:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Phase 1: Validate CSV data and populate staging tables
 *
 * This background job:
 * 1. Downloads and parses the uploaded CSV/XLSX file
 * 2. Validates each row comprehensively
 * 3. Determines CREATE vs UPDATE action based on UPID/SKU matching
 * 4. Auto-creates simple entities (colors, eco-claims) when needed
 * 5. Populates staging tables with validated data
 * 6. Tracks unmapped values that need user approval
 * 7. Sends WebSocket progress updates (TODO: implement WebSocket)
 *
 * Processes data in batches of 100 rows for optimal performance.
 */
export const validateAndStage = task({
  id: "validate-and-stage",
  run: async (payload: ValidateAndStagePayload): Promise<void> => {
    const { jobId, brandId, filePath } = payload;
    const jobStartTime = Date.now();

    console.log("=".repeat(80));
    console.log("[validate-and-stage] TASK EXECUTION STARTED");
    console.log("[validate-and-stage] Timestamp:", new Date().toISOString());
    console.log("[validate-and-stage] Payload:", JSON.stringify(payload, null, 2));
    console.log("[validate-and-stage] Environment Check:", {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30),
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE')),
    });
    console.log("=".repeat(80));
    logger.info("Starting validate-and-stage job", {
      jobId,
      brandId,
      filePath,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate environment variables first
      console.log("[validate-and-stage] Checking environment variables...");
      const requiredEnvVars = {
        DATABASE_URL: process.env.DATABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      };

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
      }

      console.log("[validate-and-stage] Environment variables validated:", {
        hasDatabaseUrl: !!requiredEnvVars.DATABASE_URL,
        hasSupabaseUrl: !!requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!requiredEnvVars.SUPABASE_SERVICE_KEY,
      });

      // Update job status to VALIDATING
      console.log("[validate-and-stage] Updating job status to VALIDATING...");
      try {
        await updateImportJobStatus(db, {
          jobId,
          status: "VALIDATING",
        });
        console.log("[validate-and-stage] Job status updated to VALIDATING");
        logger.info("Import job status set to VALIDATING", { jobId });
      } catch (statusError) {
        console.error("[validate-and-stage] Failed to update job status:", {
          error: statusError instanceof Error ? statusError.message : String(statusError),
          stack: statusError instanceof Error ? statusError.stack : undefined,
        });
        throw statusError;
      }

      // Initialize Supabase client for file download
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase configuration missing");
      }

      const supabase = createSupabaseClient<SupabaseDatabase>(
        supabaseUrl,
        supabaseServiceKey,
      );

      // Download file from storage
      console.log(
        "[validate-and-stage] Downloading file from storage:",
        filePath,
      );
      logger.info("Downloading file from storage", { filePath });
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("product-imports")
        .download(filePath);

      if (downloadError || !fileData) {
        console.error(
          "[validate-and-stage] File download failed:",
          downloadError,
        );
        throw new Error(
          `Failed to download file: ${downloadError?.message || "Unknown error"}`,
        );
      }
      console.log("[validate-and-stage] File downloaded successfully");

      // Parse CSV/XLSX file
      console.log("[validate-and-stage] Parsing file...");
      logger.info("Parsing file");
      const fileBuffer = Buffer.from(await fileData.arrayBuffer());
      console.log("[validate-and-stage] File buffer size:", fileBuffer.length);

      const parseResult = await parseFile(
        new File([fileBuffer], "import.csv"),
        { trimValues: true },
      );

      if (parseResult.errors.length > 0) {
        console.error(
          "[validate-and-stage] File parsing errors:",
          parseResult.errors,
        );
        logger.error("File parsing errors", {
          errors: parseResult.errors,
        });
        throw new Error(
          `File parsing failed: ${parseResult.errors[0]?.message}`,
        );
      }

      console.log("[validate-and-stage] File parsed successfully:", {
        rowCount: parseResult.rowCount,
        headerCount: parseResult.headers.length,
      });
      logger.info("File parsed successfully", {
        rowCount: parseResult.rowCount,
        headers: parseResult.headers,
      });

      // Normalize headers
      const { normalized: normalizedHeaders, mapping: headerMapping } =
        normalizeHeaders(parseResult.headers);

      // Check for duplicate UPID/SKU values in the file
      console.log("[validate-and-stage] Checking for duplicates...");
      const hasUpid = normalizedHeaders.includes("upid");
      const hasSku = normalizedHeaders.includes("sku");
      const duplicateCheckColumn = hasUpid ? "upid" : "sku";
      console.log(
        "[validate-and-stage] Duplicate check column:",
        duplicateCheckColumn,
      );

      const duplicates = findDuplicates(parseResult.data, [
        duplicateCheckColumn,
      ]);
      const duplicateRowNumbers = new Set<number>();

      // Build a map of row numbers that have duplicates
      for (const dup of duplicates) {
        for (const rowNum of dup.rows) {
          duplicateRowNumbers.add(rowNum);
        }
      }

      if (duplicates.length > 0) {
        console.log("[validate-and-stage] Found duplicates:", {
          duplicateCount: duplicates.length,
          affectedRows: duplicateRowNumbers.size,
        });
        logger.warn("Duplicate values found in file", {
          duplicateCount: duplicates.length,
          affectedRows: duplicateRowNumbers.size,
          column: duplicateCheckColumn,
        });
      } else {
        console.log("[validate-and-stage] No duplicates found");
      }

      // Clean up any existing staging data for this job (handles retry scenarios)
      console.log("[validate-and-stage] Cleaning up any existing staging data for retry...");
      try {
        const deletedCount = await deleteStagingDataForJob(db, jobId);
        if (deletedCount > 0) {
          console.log(`[validate-and-stage] Cleaned up ${deletedCount} existing staging records from previous attempt`);
          logger.info("Cleaned up existing staging data", { jobId, deletedCount });
        }
      } catch (cleanupError) {
        // Non-fatal - log and continue
        console.warn("[validate-and-stage] Failed to cleanup existing staging data:", cleanupError);
      }

      // Create import_rows records for tracking
      console.log("[validate-and-stage] Creating import_rows records...");
      const importRows: CreateImportRowParams[] = parseResult.data.map(
        (row, index) => ({
          jobId,
          rowNumber: index + 1,
          raw: row as Record<string, unknown>,
          status: "PENDING",
        }),
      );

      const createdRows = await createImportRows(db, importRows);
      console.log(
        "[validate-and-stage] Created import_rows:",
        createdRows.length,
      );
      logger.info("Created import_rows records", {
        count: createdRows.length,
      });

      // Initialize value mapper for catalog lookups
      const valueMapper = new ValueMapper(db);

      // Process data in batches
      const totalRows = parseResult.data.length;
      let processedCount = 0;
      let validCount = 0;
      let invalidCount = 0;
      let willCreateCount = 0;
      let willUpdateCount = 0;
      const unmappedValues = new Map<string, Set<string>>();

      console.log("[validate-and-stage] Starting batch processing...");
      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = parseResult.data.slice(i, i + BATCH_SIZE);
        const batchRows = createdRows.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

        console.log(
          `[validate-and-stage] Processing batch ${batchNumber}/${totalBatches}`,
        );
        logger.info(`Processing batch ${batchNumber}`, {
          start: i + 1,
          end: Math.min(i + BATCH_SIZE, totalRows),
          total: totalRows,
        });

        // Validate and process each row in the batch
        const validatedBatch: Array<{
          importRowId: string;
          rowNumber: number;
          validated: ValidatedRowData | null;
          error: string | null;
        }> = [];

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j] as CSVRow;
          const importRow = batchRows[j];
          if (!importRow) continue;

          const rowNumber = i + j + 1;

          try {
            // Validate and transform row
            const validated = await validateRow(
              row,
              brandId,
              rowNumber,
              jobId,
              valueMapper,
              unmappedValues,
              duplicateRowNumbers,
              duplicateCheckColumn,
            );

            validatedBatch.push({
              importRowId: importRow.id,
              rowNumber,
              validated,
              error:
                validated.errors.length > 0
                  ? validated.errors.map((e) => e.message).join("; ")
                  : null,
            });

            if (validated.errors.length === 0) {
              validCount++;
              if (validated.action === "CREATE") willCreateCount++;
              else willUpdateCount++;
            } else {
              invalidCount++;
            }
          } catch (error) {
            logger.error("Row validation error", {
              rowNumber,
              error: error instanceof Error ? error.message : String(error),
            });

            validatedBatch.push({
              importRowId: importRow.id,
              rowNumber,
              validated: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown validation error",
            });

            invalidCount++;
          }
        }

        // Insert valid rows into staging tables
        for (const item of validatedBatch) {
          if (item.validated && item.error === null) {
            try {
              // Insert staging product
              const stagingProductId = await insertStagingProduct(
                db,
                item.validated.product,
              );

              // Insert staging variant with product reference
              const variantParams: InsertStagingVariantParams = {
                ...item.validated.variant,
                stagingProductId,
              };

              await insertStagingVariant(db, variantParams);

              // Update import_row status to VALIDATED
              await batchUpdateImportRowStatus(db, [
                {
                  id: item.importRowId,
                  status: "VALIDATED",
                  normalized: {
                    action: item.validated.action,
                    product_id: item.validated.productId,
                    variant_id: item.validated.variantId,
                  },
                },
              ]);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : undefined;
              const errorDetails = error instanceof Error && 'code' in error ? (error as any).code : undefined;
              const errorConstraint = error instanceof Error && 'constraint' in error ? (error as any).constraint : undefined;

              // Log detailed error information for debugging
              logger.error("Failed to insert into staging", {
                rowNumber: item.rowNumber,
                error: errorMessage,
                errorCode: errorDetails,
                errorConstraint,
                stack: errorStack,
                productData: {
                  productId: item.validated?.productId,
                  variantId: item.validated?.variantId,
                  upid: item.validated?.variant.upid,
                  sku: item.validated?.variant.sku,
                  action: item.validated?.action,
                },
              });

              console.error("[validate-and-stage] Staging insert failed:", {
                rowNumber: item.rowNumber,
                jobId,
                errorMessage,
                errorCode: errorDetails,
                errorConstraint,
                productId: item.validated?.productId,
                variantId: item.validated?.variantId,
                action: item.validated?.action,
                fullError: error,
              });

              // Mark row as FAILED
              await batchUpdateImportRowStatus(db, [
                {
                  id: item.importRowId,
                  status: "FAILED",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to insert into staging",
                },
              ]);

              invalidCount++;
              validCount--;
            }
          } else if (item.error) {
            // Update import_row status to FAILED
            await batchUpdateImportRowStatus(db, [
              {
                id: item.importRowId,
                status: "FAILED",
                error: item.error,
              },
            ]);
          }
        }

        processedCount += batch.length;

        // Update job progress
        await updateImportJobProgress(db, {
          jobId,
          summary: {
            total: totalRows,
            processed: processedCount,
            valid: validCount,
            invalid: invalidCount,
            will_create: willCreateCount,
            will_update: willUpdateCount,
            percentage: Math.round((processedCount / totalRows) * 100),
          },
        });
        console.log("[validate-and-stage] Job progress updated", {
          jobId,
          processed: processedCount,
          total: totalRows,
          valid: validCount,
          invalid: invalidCount,
        });

        // Send WebSocket progress update
        await emitProgress({
          jobId,
          status: "VALIDATING",
          phase: "validation",
          processed: processedCount,
          total: totalRows,
          failed: invalidCount,
          percentage: Math.round((processedCount / totalRows) * 100),
        });

        logger.info("Batch processed", {
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          processedCount,
          validCount,
          invalidCount,
        });
      }

      // Get final staging counts
      const stagingCounts = await countStagingProductsByAction(db, jobId);

      // Prepare final summary with unmapped values
      const unmappedValuesSummary = Array.from(unmappedValues.entries()).map(
        ([entityType, values]) => ({
          entityType,
          values: Array.from(values),
          count: values.size,
        }),
      );

      // Update job status to VALIDATED
      await updateImportJobStatus(db, {
        jobId,
        status: "VALIDATED",
        summary: {
          total: totalRows,
          valid: validCount,
          invalid: invalidCount,
          will_create: stagingCounts.create,
          will_update: stagingCounts.update,
          unmapped_values: unmappedValuesSummary,
          requires_value_approval: unmappedValuesSummary.length > 0,
        },
      });
      console.log("[validate-and-stage] Job status updated to VALIDATED", {
        jobId,
        totalRows,
        validCount,
        invalidCount,
        willCreate: stagingCounts.create,
        willUpdate: stagingCounts.update,
      });

      // Send WebSocket completion notification
      await emitProgress({
        jobId,
        status: "VALIDATED",
        phase: "validation",
        processed: totalRows,
        total: totalRows,
        failed: invalidCount,
        percentage: 100,
        message: "Validation complete - ready for review",
      });

      logger.info("Validation and staging completed successfully", {
        jobId,
        total: totalRows,
        valid: validCount,
        invalid: invalidCount,
        will_create: stagingCounts.create,
        will_update: stagingCounts.update,
        durationMs: Date.now() - jobStartTime,
      });
    } catch (error) {
      logger.error("Validation and staging job failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Update job status to FAILED
      await updateImportJobStatus(db, {
        jobId,
        status: "FAILED",
        finishedAt: new Date().toISOString(),
        summary: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      console.log("[validate-and-stage] Job status updated to FAILED", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Send WebSocket failure notification (temporarily disabled)
      // websocketManager.emit(jobId, {
      //   jobId,
      //   status: "FAILED",
      //   phase: "validation",
      //   processed: 0,
      //   total: 0,
      //   percentage: 0,
      //   message: error instanceof Error ? error.message : "Validation failed",
      // });

      throw error;
    }
  },
});

/**
 * Validate a single CSV row and prepare staging data
 *
 * @param row - CSV row data
 * @param brandId - Brand ID for scoping
 * @param rowNumber - Row number in CSV (1-indexed)
 * @param jobId - Import job ID
 * @param valueMapper - Value mapper instance
 * @param unmappedValues - Map to track unmapped values
 * @param duplicateRowNumbers - Set of row numbers that have duplicate UPID/SKU
 * @param duplicateCheckColumn - Column name being checked for duplicates (upid or sku)
 * @returns Validated row data or null if invalid
 */
async function validateRow(
  row: CSVRow,
  brandId: string,
  rowNumber: number,
  jobId: string,
  valueMapper: ValueMapper,
  unmappedValues: Map<string, Set<string>>,
  duplicateRowNumbers: Set<number>,
  duplicateCheckColumn: string,
): Promise<ValidatedRowData> {
  const errors: ValidationError[] = [];

  // Check for duplicate UPID/SKU
  if (duplicateRowNumbers.has(rowNumber)) {
    const duplicateValue = String(row[duplicateCheckColumn] || "").trim();
    errors.push({
      type: "DUPLICATE_VALUE",
      field: duplicateCheckColumn,
      message: `Duplicate ${duplicateCheckColumn.toUpperCase()}: "${duplicateValue}" appears multiple times in the file`,
    });
  }

  // Required field validation
  if (!row.product_name || row.product_name.trim() === "") {
    errors.push({
      type: "REQUIRED_FIELD_EMPTY",
      field: "product_name",
      message: "Product name is required",
    });
  }

  // UPID or SKU required
  const upid = row.upid?.trim() || "";
  const sku = row.sku?.trim() || "";

  if (!upid && !sku) {
    errors.push({
      type: "REQUIRED_FIELD_EMPTY",
      field: "upid/sku",
      message: "Either UPID or SKU must be provided",
    });
  }

  // Check string length limits
  if (row.product_name && row.product_name.length > 100) {
    errors.push({
      type: "FIELD_TOO_LONG",
      field: "product_name",
      message: "Product name cannot exceed 100 characters",
    });
  }

  if (row.description && row.description.length > 2000) {
    errors.push({
      type: "FIELD_TOO_LONG",
      field: "description",
      message: "Description cannot exceed 2000 characters",
    });
  }

  // Map values to IDs
  let colorId: string | null = null;
  if (row.color_name) {
    const colorResult = await valueMapper.mapColorName(
      brandId,
      row.color_name,
      "color_name",
    );

    if (!colorResult.found) {
      // Auto-create color (simple entity)
      const createdColorId = await valueMapper.autoCreateColor(
        brandId,
        row.color_name,
      );

      if (createdColorId) {
        colorId = createdColorId;
        logger.info("Auto-created color", {
          colorName: row.color_name,
          colorId: createdColorId,
        });
      } else {
        trackUnmappedValue(unmappedValues, "COLOR", row.color_name);
      }
    } else {
      colorId = colorResult.targetId;
    }
  }

  let sizeId: string | null = null;
  if (row.size_name) {
    const sizeResult = await valueMapper.mapSizeName(
      brandId,
      row.size_name,
      "size_name",
    );

    if (!sizeResult.found) {
      // Sizes require additional fields - track as unmapped
      trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
      errors.push({
        type: "UNMAPPED_VALUE",
        field: "size_name",
        message: `Size "${row.size_name}" not found in brand catalog`,
      });
    } else {
      sizeId = sizeResult.targetId;
    }
  }

  let categoryId: string | null = null;
  if (row.category_name) {
    const categoryResult = await valueMapper.mapCategoryName(
      row.category_name,
      "category_name",
    );

    if (!categoryResult.found) {
      errors.push({
        type: "FOREIGN_KEY_NOT_FOUND",
        field: "category_name",
        message: `Category "${row.category_name}" not found`,
      });
    } else {
      categoryId = categoryResult.targetId;
    }
  } else if (row.category_id) {
    categoryId = row.category_id;
  }

  // Check if product variant exists (CREATE vs UPDATE detection)
  let existingProduct: { id: string; variant_id: string } | null = null;

  try {
    // Query variant with join to products to check brand ownership
    const variantQuery = await db
      .select({
        variantId: productVariants.id,
        productId: productVariants.productId,
        brandId: products.brandId,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(products.brandId, brandId),
          upid
            ? eq(productVariants.upid, upid)
            : sku
              ? eq(productVariants.sku, sku)
              : undefined,
        ),
      )
      .limit(1);

    const result = variantQuery[0];
    if (result) {
      existingProduct = {
        id: result.productId,
        variant_id: result.variantId,
      };
    }
  } catch (error) {
    logger.warn("Failed to check for existing variant", {
      upid,
      sku,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const action: "CREATE" | "UPDATE" = existingProduct ? "UPDATE" : "CREATE";

  // Generate UUIDs for new records
  const productId = existingProduct?.id || randomUUID();
  const variantId = existingProduct?.variant_id || randomUUID();

  // Prepare staging data
  const product: InsertStagingProductParams = {
    jobId,
    rowNumber,
    action,
    existingProductId: existingProduct?.id || null,
    id: productId,
    brandId,
    name: row.product_name?.trim() || "",
    description: row.description?.trim() || null,
    categoryId,
    season: row.season?.trim() || null,
    primaryImageUrl: row.primary_image_url?.trim() || null,
    showcaseBrandId: row.showcase_brand_id?.trim() || null,
    brandCertificationId: row.brand_certification_id?.trim() || null,
  };

  const variant: InsertStagingVariantParams = {
    stagingProductId: "", // Will be set after product insertion
    jobId,
    rowNumber,
    action,
    existingVariantId: existingProduct?.variant_id || null,
    id: variantId,
    productId,
    upid: upid || "",
    sku: sku || null,
    colorId,
    sizeId,
    productImageUrl: row.product_image_url?.trim() || null,
  };

  return {
    productId,
    variantId,
    action,
    existingProductId: existingProduct?.id,
    existingVariantId: existingProduct?.variant_id,
    product,
    variant,
    errors,
  };
}

/**
 * Track unmapped value for user review
 *
 * @param unmappedValues - Map to store unmapped values
 * @param entityType - Type of entity (COLOR, SIZE, etc.)
 * @param value - Raw value from CSV
 */
function trackUnmappedValue(
  unmappedValues: Map<string, Set<string>>,
  entityType: string,
  value: string,
): void {
  if (!unmappedValues.has(entityType)) {
    unmappedValues.set(entityType, new Set());
  }
  unmappedValues.get(entityType)?.add(value);
}
