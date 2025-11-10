import "./configure-trigger";
import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk";
import { type Database, serviceDb as db } from "@v1/db/client";
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
  batchInsertStagingProducts,
  batchInsertStagingVariants,
  countStagingProductsByAction,
  deleteStagingDataForJob,
  insertStagingProduct,
  insertStagingVariant,
} from "@v1/db/queries";
import { and, eq, inArray } from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import * as schema from "@v1/db/schema";
import type { Database as SupabaseDatabase } from "@v1/supabase/types";
import { or, sql } from "drizzle-orm";
import type { BrandCatalog } from "../lib/catalog-loader";
import {
  addColorToCatalog,
  loadBrandCatalog,
  lookupCategoryId,
  lookupColorId,
  lookupMaterialId,
  lookupSizeId,
} from "../lib/catalog-loader";
import { findDuplicates, normalizeHeaders, parseFile } from "../lib/csv-parser";
import { EntityType, ValueMapper } from "../lib/value-mapper";

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
 * Validation error type (blocks import)
 */
interface ValidationError {
  type: "HARD_ERROR";
  subtype: string;
  field?: string;
  message: string;
  severity: "error";
}

/**
 * Validation warning type (needs user definition)
 */
interface ValidationWarning {
  type: "NEEDS_DEFINITION";
  subtype: string;
  field?: string;
  message: string;
  severity: "warning";
  entityType?:
    | "COLOR"
    | "SIZE"
    | "MATERIAL"
    | "CATEGORY"
    | "FACILITY"
    | "SHOWCASE_BRAND"
    | "CERTIFICATION";
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
  errors: ValidationError[]; // Hard errors that block import
  warnings: ValidationWarning[]; // Missing catalog values that need user definition
}

const BATCH_SIZE = 100;
const TIMEOUT_MS = 1800000; // 30 minutes

/**
 * Emit progress update to WebSocket clients via API endpoint
 */
/**
 * Debounced progress emitter that batches WebSocket updates
 * Updates at most once per second to provide real-time feedback
 * without blocking batch processing
 */
class ProgressEmitter {
  private lastEmitTime = 0;
  private pendingUpdate: any = null;
  private emitPromise: Promise<void> | null = null;
  private readonly EMIT_INTERVAL_MS = 1000; // Update every second
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000";
    this.apiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
  }

  /**
   * Queue a progress update (non-blocking, debounced)
   * Will emit immediately if 1 second has passed, otherwise queues for next interval
   */
  emit(params: {
    jobId: string;
    status:
      | "PENDING"
      | "VALIDATING"
      | "VALIDATED"
      | "COMMITTING"
      | "COMPLETED"
      | "FAILED"
      | "CANCELLED";
    phase: "validation" | "commit";
    processed: number;
    total: number;
    created?: number;
    updated?: number;
    failed?: number;
    percentage: number;
    message?: string;
  }): void {
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;

    // Always store the latest update
    this.pendingUpdate = params;

    // If enough time has passed, emit immediately (non-blocking)
    if (timeSinceLastEmit >= this.EMIT_INTERVAL_MS) {
      this.lastEmitTime = now;
      this.sendUpdate(params);
    }
    // Otherwise, it will be picked up by the next update or flush
  }

  /**
   * Force emit any pending update (for final updates)
   */
  async flush(): Promise<void> {
    if (this.pendingUpdate) {
      await this.sendUpdate(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }

  /**
   * Send update in background (fire-and-forget, never blocks)
   */
  private sendUpdate(params: any): void {
    // Fire-and-forget: don't await, let it run in background
    const inputData = {
      apiKey: this.apiKey,
      ...params,
    };

    // Execute fetch without blocking
    fetch(`${this.apiUrl}/trpc/internal.emitProgress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: inputData,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.warn("[ProgressEmitter] Failed to emit (non-blocking):", {
            status: response.status,
            jobId: params.jobId,
            error: errorText.substring(0, 200),
          });
        }
        // Success - no logging to reduce noise
      })
      .catch((error) => {
        // Silently catch errors - don't spam logs
        if (process.env.NODE_ENV === "development") {
          console.warn("[ProgressEmitter] Background error:", {
            jobId: params.jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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

    // OPTIMIZATION: Create debounced progress emitter for real-time updates
    // Updates at most once per second, never blocks processing
    const progressEmitter = new ProgressEmitter();

    console.log("=".repeat(80));
    console.log("[validate-and-stage] TASK EXECUTION STARTED");
    console.log("[validate-and-stage] Timestamp:", new Date().toISOString());
    console.log(
      "[validate-and-stage] Payload:",
      JSON.stringify(payload, null, 2),
    );
    console.log("[validate-and-stage] Environment Check:", {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30),
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      allEnvKeys: Object.keys(process.env).filter(
        (k) => k.includes("DATABASE") || k.includes("SUPABASE"),
      ),
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
        throw new Error(
          `Missing required environment variables: ${missingVars.join(", ")}`,
        );
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
          error:
            statusError instanceof Error
              ? statusError.message
              : String(statusError),
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
      console.log(
        "[validate-and-stage] Cleaning up any existing staging data for retry...",
      );
      try {
        const deletedCount = await deleteStagingDataForJob(db, jobId);
        if (deletedCount > 0) {
          console.log(
            `[validate-and-stage] Cleaned up ${deletedCount} existing staging records from previous attempt`,
          );
          logger.info("Cleaned up existing staging data", {
            jobId,
            deletedCount,
          });
        }
      } catch (cleanupError) {
        // Non-fatal - log and continue
        console.warn(
          "[validate-and-stage] Failed to cleanup existing staging data:",
          cleanupError,
        );
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

      // Load brand catalog into memory (PERFORMANCE OPTIMIZATION)
      // This eliminates the N+1 query problem by loading all catalog data once
      console.log("[validate-and-stage] Loading brand catalog into memory...");
      const catalogLoadStart = Date.now();
      const catalog = await loadBrandCatalog(db, brandId);
      const catalogLoadDuration = Date.now() - catalogLoadStart;
      console.log(
        `[validate-and-stage] Catalog loaded in ${catalogLoadDuration}ms`,
        {
          colors: catalog.colors.size,
          sizes: catalog.sizes.size,
          materials: catalog.materials.size,
          categories: catalog.categories.size,
          valueMappings: catalog.valueMappings.size,
        },
      );
      logger.info("Catalog loaded into memory", {
        duration: catalogLoadDuration,
        colorCount: catalog.colors.size,
        sizeCount: catalog.sizes.size,
        materialCount: catalog.materials.size,
        categoryCount: catalog.categories.size,
      });

      // PHASE 3A OPTIMIZATION: Pre-load ALL existing variants at job start
      // Single query instead of 10-20 queries per 1,000 rows (one per batch)
      console.log("[validate-and-stage] Pre-loading all existing variants...");
      const variantLoadStart = Date.now();
      const allUpids = parseResult.data
        .map((r) => (r as CSVRow).upid)
        .filter((v): v is string => !!v && v.trim() !== "");
      const allSkus = parseResult.data
        .map((r) => (r as CSVRow).sku)
        .filter((v): v is string => !!v && v.trim() !== "");

      let existingVariantsMap = new Map<
        string,
        { id: string; variant_id: string }
      >();

      if (allUpids.length > 0 || allSkus.length > 0) {
        const existingVariants = await db
          .select({
            variantId: productVariants.id,
            productId: productVariants.productId,
            brandId: products.brandId,
            upid: productVariants.upid,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(
            and(
              eq(products.brandId, brandId),
              or(
                allUpids.length > 0
                  ? inArray(productVariants.upid, allUpids)
                  : undefined,
                allSkus.length > 0
                  ? inArray(productVariants.sku, allSkus)
                  : undefined,
              ),
            ),
          );

        // Build lookup map
        existingVariantsMap = new Map(
          existingVariants.map((v) => [
            (v.upid || v.sku || "") as string,
            { id: v.productId, variant_id: v.variantId },
          ]),
        );

        const variantLoadDuration = Date.now() - variantLoadStart;
        console.log(
          `[validate-and-stage] Pre-loaded ${existingVariants.length} existing variants in ${variantLoadDuration}ms`,
        );
        logger.info("Pre-loaded all existing variants", {
          duration: variantLoadDuration,
          variantCount: existingVariants.length,
        });
      } else {
        console.log("[validate-and-stage] No UPIDs or SKUs to pre-load");
      }

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

        // PHASE 2 OPTIMIZATION: Parallel validation using Promise.all()
        // Validates all rows in batch simultaneously, utilizing multiple CPU cores
        const validationStart = Date.now();
        const validatedBatch = await Promise.all(
          batch.map(async (row, j) => {
            const importRow = batchRows[j];
            if (!importRow) return null;

            const rowNumber = i + j + 1;

            try {
              // Validate and transform row with in-memory catalog
              const validated = await validateRow(
                row as CSVRow,
                brandId,
                rowNumber,
                jobId,
                catalog,
                unmappedValues,
                duplicateRowNumbers,
                duplicateCheckColumn,
                existingVariantsMap,
                db,
              );

              // Only hard errors block validation (warnings are OK)
              const hasHardErrors = validated.errors.length > 0;

              // Row is valid if it has no hard errors (warnings are acceptable)
              if (!hasHardErrors) {
                validCount++;
                if (validated.action === "CREATE") willCreateCount++;
                else willUpdateCount++;
              } else {
                invalidCount++;
              }

              return {
                importRowId: importRow.id,
                rowNumber,
                validated,
                error: hasHardErrors
                  ? validated.errors.map((e) => e.message).join("; ")
                  : null,
                hasHardErrors,
              };
            } catch (error) {
              logger.error("Row validation error", {
                rowNumber,
                error: error instanceof Error ? error.message : String(error),
              });

              invalidCount++;

              return {
                importRowId: importRow.id,
                rowNumber,
                validated: null,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown validation error",
                hasHardErrors: true,
              };
            }
          }),
        ).then((results) =>
          results.filter((r): r is NonNullable<typeof r> => r !== null),
        );

        const validationDuration = Date.now() - validationStart;
        console.log(
          `[validate-and-stage] Batch ${batchNumber} validated in ${validationDuration}ms (parallel)`,
        );

        // PHASE 2 OPTIMIZATION: Batch staging inserts
        // PHASE 3A OPTIMIZATION: Wrap in transaction for connection pooling efficiency
        // Single batch insert instead of individual inserts per row
        const stagingInsertStart = Date.now();

        // Separate valid and invalid rows
        const validRows = validatedBatch.filter(
          (item) => item.validated && !item.hasHardErrors,
        );
        const invalidRows = validatedBatch.filter(
          (item) => !item.validated || item.hasHardErrors,
        );

        try {
          if (validRows.length > 0) {
            // PHASE 3D: Fast batch inserts without transaction overhead
            // Run operations directly on the connection which has RLS disabled
            // No transaction = no COMMIT overhead between batches

            // Batch insert all products
            const products = validRows.map((item) => item.validated!.product);
            const stagingProductIds = await batchInsertStagingProducts(
              db,
              products,
            );

            // Batch insert all variants with staging product references
            const variants = validRows.map((item, idx) => ({
              ...item.validated!.variant,
              stagingProductId: stagingProductIds[idx] as string,
            }));
            await batchInsertStagingVariants(db, variants);

            // Status updates
            const validStatusUpdates = validRows.map((item) => ({
              id: item.importRowId,
              status: "VALIDATED" as const,
              normalized: {
                action: item.validated!.action,
                product_id: item.validated!.productId,
                variant_id: item.validated!.variantId,
                warnings:
                  item.validated!.warnings.length > 0
                    ? item.validated!.warnings.map((w) => ({
                        type: w.subtype,
                        field: w.field,
                        message: w.message,
                        entity_type: w.entityType,
                      }))
                    : undefined,
              },
            }));
            await batchUpdateImportRowStatus(db, validStatusUpdates);

            const stagingInsertDuration = Date.now() - stagingInsertStart;
            console.log(
              `[validate-and-stage] Batch ${batchNumber} staged ${validRows.length} rows in ${stagingInsertDuration}ms (batch insert)`,
            );
          }

          // PHASE 2 OPTIMIZATION: Single batch status update for all invalid rows
          if (invalidRows.length > 0) {
            const invalidStatusUpdates = invalidRows.map((item) => ({
              id: item.importRowId,
              status: "FAILED" as const,
              error: item.error || "Validation failed",
            }));
            await batchUpdateImportRowStatus(db, invalidStatusUpdates);
          }
        } catch (error) {
          // Batch insert failed - fall back to individual inserts with error handling
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            "Batch staging insert failed, falling back to individual inserts",
            {
              batchNumber,
              validRowCount: validRows.length,
              error: errorMessage,
            },
          );

          // Fall back to individual inserts for this batch
          for (const item of validRows) {
            try {
              const stagingProductId = await insertStagingProduct(
                db,
                item.validated!.product,
              );
              const variantParams: InsertStagingVariantParams = {
                ...item.validated!.variant,
                stagingProductId,
              };
              await insertStagingVariant(db, variantParams);

              await batchUpdateImportRowStatus(db, [
                {
                  id: item.importRowId,
                  status: "VALIDATED",
                  normalized: {
                    action: item.validated!.action,
                    product_id: item.validated!.productId,
                    variant_id: item.validated!.variantId,
                    warnings:
                      item.validated!.warnings.length > 0
                        ? item.validated!.warnings.map((w) => ({
                            type: w.subtype,
                            field: w.field,
                            message: w.message,
                            entity_type: w.entityType,
                          }))
                        : undefined,
                  },
                },
              ]);
            } catch (individualError) {
              logger.error("Individual staging insert failed", {
                rowNumber: item.rowNumber,
                error:
                  individualError instanceof Error
                    ? individualError.message
                    : String(individualError),
              });

              await batchUpdateImportRowStatus(db, [
                {
                  id: item.importRowId,
                  status: "FAILED",
                  error:
                    individualError instanceof Error
                      ? individualError.message
                      : "Failed to insert into staging",
                },
              ]);

              invalidCount++;
              validCount--;
            }
          }
        }

        processedCount += batch.length;

        // OPTIMIZATION: Update DB progress every batch (cheap operation)
        // WebSocket updates are automatically debounced to once per second
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

        // OPTIMIZATION: Debounced WebSocket update (max once per second)
        // Fire-and-forget, never blocks batch processing
        progressEmitter.emit({
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

      // OPTIMIZATION: Flush final WebSocket notification immediately
      // Ensures final 100% update is sent
      await progressEmitter.flush();
      progressEmitter.emit({
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
 * Performs two-tier validation:
 * - Hard errors (block import): missing required fields, duplicates, invalid formats
 * - Warnings (need user definition): missing catalog entities that can be created
 *
 * @param row - CSV row data
 * @param brandId - Brand ID for scoping
 * @param rowNumber - Row number in CSV (1-indexed)
 * @param jobId - Import job ID
 * @param catalog - In-memory brand catalog for fast lookups
 * @param unmappedValues - Map to track unmapped values
 * @param duplicateRowNumbers - Set of row numbers that have duplicate UPID/SKU
 * @param duplicateCheckColumn - Column name being checked for duplicates (upid or sku)
 * @param existingVariantsMap - Pre-loaded map of existing variants (UPID/SKU -> product/variant IDs)
 * @param db - Database instance for auto-creating entities
 * @returns Validated row data with errors and warnings
 */
async function validateRow(
  row: CSVRow,
  brandId: string,
  rowNumber: number,
  jobId: string,
  catalog: BrandCatalog,
  unmappedValues: Map<string, Set<string>>,
  duplicateRowNumbers: Set<number>,
  duplicateCheckColumn: string,
  existingVariantsMap: Map<string, { id: string; variant_id: string }>,
  db: Database,
): Promise<ValidatedRowData> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // HARD ERROR: Duplicate UPID/SKU
  if (duplicateRowNumbers.has(rowNumber)) {
    const duplicateValue = String(row[duplicateCheckColumn] || "").trim();
    errors.push({
      type: "HARD_ERROR",
      subtype: "DUPLICATE_VALUE",
      field: duplicateCheckColumn,
      message: `Duplicate ${duplicateCheckColumn.toUpperCase()}: "${duplicateValue}" appears multiple times in the file`,
      severity: "error",
    });
  }

  // HARD ERROR: Required field validation
  if (!row.product_name || row.product_name.trim() === "") {
    errors.push({
      type: "HARD_ERROR",
      subtype: "REQUIRED_FIELD_EMPTY",
      field: "product_name",
      message: "Product name is required",
      severity: "error",
    });
  }

  // HARD ERROR: UPID or SKU required
  const upid = row.upid?.trim() || "";
  const sku = row.sku?.trim() || "";

  if (!upid && !sku) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "REQUIRED_FIELD_EMPTY",
      field: "upid/sku",
      message: "Either UPID or SKU must be provided",
      severity: "error",
    });
  }

  // HARD ERROR: Check string length limits
  if (row.product_name && row.product_name.length > 100) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "FIELD_TOO_LONG",
      field: "product_name",
      message: "Product name cannot exceed 100 characters",
      severity: "error",
    });
  }

  if (row.description && row.description.length > 2000) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "FIELD_TOO_LONG",
      field: "description",
      message: "Description cannot exceed 2000 characters",
      severity: "error",
    });
  }

  // PHASE 2 OPTIMIZATION: Removed auto-create to eliminate race conditions
  // All catalog entities (colors, sizes, categories) now require user definition
  // This enables safe parallel validation and provides consistent UX
  let colorId: string | null = null;
  if (row.color_name) {
    // In-memory lookup from catalog (0 database queries)
    colorId = lookupColorId(catalog, row.color_name, "color_name");

    if (!colorId) {
      // Track as unmapped for user definition (same as sizes/categories)
      trackUnmappedValue(unmappedValues, "COLOR", row.color_name);
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_COLOR",
        field: "color_name",
        message: `Color "${row.color_name}" needs to be created`,
        severity: "warning",
        entityType: "COLOR",
      });
      // Leave colorId as null - will be populated after user creates color
    }
  }

  // WARNING: Missing size (needs user definition)
  let sizeId: string | null = null;
  if (row.size_name) {
    // In-memory lookup from catalog (0 database queries)
    sizeId = lookupSizeId(catalog, row.size_name, "size_name");

    if (!sizeId) {
      // Track as unmapped for user definition
      trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_SIZE",
        field: "size_name",
        message: `Size "${row.size_name}" needs to be created`,
        severity: "warning",
        entityType: "SIZE",
      });
      // Leave sizeId as null - will be populated after user creates size
    }
  }

  // WARNING: Missing category (needs user definition)
  let categoryId: string | null = null;
  if (row.category_name) {
    // In-memory lookup from catalog (0 database queries)
    categoryId = lookupCategoryId(catalog, row.category_name, "category_name");

    if (!categoryId) {
      // Track as unmapped for user definition
      trackUnmappedValue(unmappedValues, "CATEGORY", row.category_name);
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_CATEGORY",
        field: "category_name",
        message: `Category "${row.category_name}" needs to be created`,
        severity: "warning",
        entityType: "CATEGORY",
      });
      // Leave categoryId as null - will be populated after user creates category
    }
  } else if (row.category_id) {
    categoryId = row.category_id;
  }

  // Check if product variant exists (CREATE vs UPDATE detection)
  // Use pre-loaded variants map (0 database queries per row)
  const lookupKey = upid || sku || "";
  const existingProduct = existingVariantsMap.get(lookupKey) || null;

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
    errors, // Hard errors that block import
    warnings, // Missing catalog values that need user definition
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
