import "../configure-trigger";
import { randomUUID } from "node:crypto";
import { logger, task } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray } from "@v1/db/queries";
import {
  type CreateImportRowParams,
  type InsertStagingProductParams,
  type InsertStagingVariantParams,
  type UpdateImportRowStatusParams,
  batchInsertStagingProducts,
  batchInsertStagingVariants,
  batchInsertStagingWithStatus,
  batchUpdateImportRowStatus,
  countStagingProductsByAction,
  createImportRows,
  deleteStagingDataForJob,
  getImportJobStatus,
  insertStagingProduct,
  insertStagingVariant,
  updateImportJobProgress,
  updateImportJobStatus,
} from "@v1/db/queries/bulk";
import { productVariants, products } from "@v1/db/schema";
import * as schema from "@v1/db/schema";
import { generateUniqueUpid } from "@v1/db/utils";
import pMap from "p-map";
import type { BrandCatalog } from "../../lib/catalog-loader";
import {
  loadBrandCatalog,
  lookupCategoryId,
  lookupMaterialId,
  lookupSeasonId,
} from "../../lib/catalog-loader";
import {
  findCompositeDuplicates,
  findDuplicates,
  normalizeHeaders,
  parseFile,
} from "../../lib/csv-parser";
import { ProgressEmitter } from "./progress-emitter";

/**
 * Task payload for Phase 1 validation and staging
 */
interface ValidateAndStagePayload {
  jobId: string;
  brandId: string;
  filePath: string;
}

interface StorageDownloadParams {
  supabaseUrl: string;
  serviceKey: string;
  bucket: string;
  path: string;
}

async function downloadFileFromSupabase({
  supabaseUrl,
  serviceKey,
  bucket,
  path,
}: StorageDownloadParams): Promise<Buffer> {
  const normalizedBaseUrl = supabaseUrl.endsWith("/")
    ? supabaseUrl.slice(0, -1)
    : supabaseUrl;

  const encodedPath = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const downloadUrl = `${normalizedBaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

  let response: Response;
  try {
    response = await fetch(downloadUrl, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
  } catch (networkError) {
    throw new Error(
      `Failed to reach Supabase Storage: ${
        networkError instanceof Error
          ? networkError.message
          : String(networkError)
      }`,
    );
  }

  if (!response.ok) {
    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch {
      responseBody = undefined;
    }

    throw new Error(
      `Supabase storage download failed (${response.status} ${response.statusText})${
        responseBody ? `: ${responseBody}` : ""
      }`,
    );
  }

  const fileArrayBuffer = await response.arrayBuffer();
  return Buffer.from(fileArrayBuffer);
}

/**
 * CSV row structure with all possible columns
 *
 * NEW FORMAT (minimal):
 * - category: hierarchical path (e.g., "Men's > Tops > T-Shirts")
 * - colors: pipe-separated (e.g., "Blue|Green|Custom:Navy")
 * - eco_claims: pipe-separated (e.g., "Claim1|Claim2|Claim3")
 * - materials: complex format (e.g., "Cotton:75:TR:yes:GOTS:123:2025-12-31|Polyester:25")
 * - journey_steps: step@operators format (e.g., "Spinning@SupplierA,SupplierB|Weaving@SupplierC")
 * Legacy columns are not supported in the new pipeline.
 */
interface CSVRow {
  // ============================================================================
  // REQUIRED FIELDS
  // ============================================================================
  product_name: string; // Max 100 characters
  product_handle: string; // Required - Unique product identifier (brand-scoped, shared across variants)
  upid?: string; // Optional - Unique variant identifier (auto-generated if not provided)

  // ============================================================================
  // BASIC INFORMATION
  // ============================================================================
  description?: string; // Max 2000 characters
  status?: string; // draft|published|archived (default: draft)
  manufacturer?: string; // Manufacturer name

  // ============================================================================
  // ORGANIZATION
  // ============================================================================
  category?: string; // Hierarchical path: "Men's > Tops > T-Shirts"
  season?: string; // Season name: "SS 2025" or "FW 2024"
  colors?: string; // Pipe-separated: "Blue|Green"
  size?: string; // Size name: "S", "M", "L", "XL", etc.

  // ============================================================================
  // ENVIRONMENT
  // ============================================================================
  carbon_footprint?: string; // Single decimal value (kg CO2e)
  water_usage?: string; // Single decimal value (liters)
  eco_claims?: string; // Pipe-separated claims (max 5, each max 50 chars)

  // ============================================================================
  // MATERIALS
  // ============================================================================
  // Format: "Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|..."
  // Example: "Cotton:75:TR:yes:GOTS:123:2025-12-31|Polyester:25"
  materials?: string;

  // ============================================================================
  // JOURNEY STEPS
  // ============================================================================
  // Format: "StepName@Operator1,Operator2|Step2@Operator3"
  // Example: "Spinning@SupplierA,SupplierB|Weaving@SupplierC"
  journey_steps?: string;

  // ============================================================================
  // IMAGES
  // ============================================================================
  image_url?: string; // Single URL

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
  type: "NEEDS_DEFINITION" | "WARNING";
  subtype: string;
  field?: string;
  message: string;
  severity: "warning";
  entityType?:
    | "COLOR"
    | "SIZE"
    | "MATERIAL"
    | "CATEGORY"
    | "SEASON"
    | "TAG"
    | "ECO_CLAIM"
    | "FACILITY"
    | "OPERATOR" // Journey operators
    | "MANUFACTURER"
    | "CERTIFICATION"
    | "PRODUCT_VARIANT"; // For ambiguous match warnings
}

/**
 * Existing variant data from database (used for change detection)
 */
interface ExistingVariant {
  // Product fields
  id: string;
  productHandle: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  seasonId: string | null;
  imagePath: string | null;
  manufacturerId: string | null;
  status: string | null;
  // Variant fields
  variant_id: string;
  upid: string | null;
}

/**
 * Validated row data ready for staging
 */
interface ValidatedRowData {
  productId: string; // Generated UUID for new product or existing product ID
  variantId: string; // Generated UUID for new variant or existing variant ID
  action: "CREATE" | "UPDATE" | "SKIP";
  existingProductId?: string;
  existingVariantId?: string;
  product: InsertStagingProductParams;
  variant: InsertStagingVariantParams;
  errors: ValidationError[]; // Hard errors that block import
  warnings: ValidationWarning[]; // Missing catalog values that need user definition
  changedFields?: string[]; // Fields that changed (for UPDATE action only)
}

const BATCH_SIZE = 250; // Optimal batch size for memory and performance
const MAX_PARALLEL_BATCHES = 1; // Sequential processing to avoid overwhelming system
const TIMEOUT_MS = 1800000; // 30 minutes

/**
 * Resolve parallel batch count from environment
 * @returns number of batches to process in parallel (1-10)
 */
function resolveParallelBatches(): number {
  const envValue = process.env.VALIDATION_PARALLEL_BATCHES;
  const parsed = envValue ? Number.parseInt(envValue, 10) : Number.NaN;
  const base = Number.isNaN(parsed) ? 5 : parsed;
  return Math.min(Math.max(base, 1), 10);
}

/**
 * Phase 1: Validate CSV data and populate staging tables
 *
 * This background job:
 * 1. Downloads and parses the uploaded CSV/XLSX file
 * 2. Validates each row comprehensively
 * 3. Determines CREATE vs UPDATE action based on UPID matching (product_handle for product grouping)
 * 4. Auto-creates simple entities (colors, eco-claims) when needed
 * 5. Populates staging tables with validated data
 * 6. Tracks unmapped values that need user approval
 * 7. Sends WebSocket progress updates (TODO: implement WebSocket)
 *
 * Processes data in batches of 100 rows for optimal performance.
 */
export const validateAndStage = task({
  id: "validate-and-stage",
  maxDuration: 1800, // 30 minutes max - handles large files with 10k+ rows
  queue: {
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },
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

      // Download file from storage
      console.log(
        "[validate-and-stage] Downloading file from storage:",
        filePath,
      );
      logger.info("Downloading file from storage", { filePath });
      const fileBuffer = await downloadFileFromSupabase({
        supabaseUrl,
        serviceKey: supabaseServiceKey,
        bucket: "product-imports",
        path: filePath,
      });

      console.log("[validate-and-stage] File downloaded successfully");

      // Parse CSV/XLSX file
      console.log("[validate-and-stage] Parsing file...");
      logger.info("Parsing file");
      console.log("[validate-and-stage] File buffer size:", fileBuffer.length);

      const parseResult = await parseFile(
        new File([fileBuffer.buffer as ArrayBuffer], "import.csv"),
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

      // ========================================================================
      // DUPLICATE DETECTION - Two-level approach for data integrity:
      // 1. Check for duplicate UPIDs (when provided)
      // 2. Check for duplicate composite keys (product_handle + colors + size)
      // ========================================================================
      console.log("[validate-and-stage] Checking for duplicates...");

      // Check for duplicate UPIDs (when provided in CSV)
      const upidDuplicates = findDuplicates(parseResult.data, ["upid"]);

      // Check for duplicate composite keys (true variant duplicates)
      // This catches duplicates even when UPID is not provided
      const compositeDuplicates = findCompositeDuplicates(parseResult.data, [
        "product_handle",
        "colors",
        "size",
      ]);

      // Build a map of row numbers that have any type of duplicate
      const duplicateRowNumbers = new Set<number>();
      const duplicateDetails = new Map<
        number,
        { type: "upid" | "composite"; value: string }
      >();

      // Mark rows with duplicate UPIDs (highest priority)
      for (const dup of upidDuplicates) {
        for (const rowNum of dup.rows) {
          duplicateRowNumbers.add(rowNum);
          duplicateDetails.set(rowNum, { type: "upid", value: dup.value });
        }
      }

      // Mark rows with duplicate composite keys (if not already marked)
      for (const dup of compositeDuplicates) {
        for (const rowNum of dup.rows) {
          duplicateRowNumbers.add(rowNum);
          // Only set if not already marked as UPID duplicate
          if (!duplicateDetails.has(rowNum)) {
            duplicateDetails.set(rowNum, {
              type: "composite",
              value: dup.compositeKey,
            });
          }
        }
      }

      const totalDuplicates =
        upidDuplicates.length + compositeDuplicates.length;

      if (totalDuplicates > 0) {
        console.log("[validate-and-stage] Found duplicates:", {
          upidDuplicateCount: upidDuplicates.length,
          compositeDuplicateCount: compositeDuplicates.length,
          affectedRows: duplicateRowNumbers.size,
        });
        logger.warn("Duplicate values found in file", {
          upidDuplicateCount: upidDuplicates.length,
          compositeDuplicateCount: compositeDuplicates.length,
          affectedRows: duplicateRowNumbers.size,
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
          materials: catalog.materials.size,
          categories: catalog.categories.size,
          valueMappings: catalog.valueMappings.size,
        },
      );
      logger.info("Catalog loaded into memory", {
        duration: catalogLoadDuration,
        materialCount: catalog.materials.size,
        categoryCount: catalog.categories.size,
      });

      // Performance optimization: Load variants per-batch instead of pre-loading all
      // This reduces memory usage and query complexity

      // Process data in batches
      const totalRows = parseResult.data.length;
      let processedCount = 0;
      let validCount = 0;
      let invalidCount = 0;
      let willCreateCount = 0;
      let willUpdateCount = 0;
      let willSkipCount = 0; // Track rows that will be skipped (no changes)
      const unmappedValues = new Map<string, Set<string>>();
      // Track unmapped values with full details for pending_approval
      const unmappedValueDetails = new Map<
        string,
        {
          type: string;
          name: string;
          affected_rows: number;
          source_column: string;
        }
      >();

      console.log("[validate-and-stage] Starting parallel batch processing...");
      console.log(
        `[validate-and-stage] Configuration: MAX_PARALLEL_BATCHES=${MAX_PARALLEL_BATCHES}`,
      );

      // Split data into batch chunks
      const batches: Array<{
        data: unknown[];
        rows: typeof createdRows;
        startIndex: number;
      }> = [];

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        batches.push({
          data: parseResult.data.slice(i, i + BATCH_SIZE),
          rows: createdRows.slice(i, i + BATCH_SIZE),
          startIndex: i,
        });
      }

      const totalBatches = batches.length;
      logger.info("Starting parallel batch processing", {
        totalRows,
        batchSize: BATCH_SIZE,
        totalBatches,
        maxParallelBatches: MAX_PARALLEL_BATCHES,
      });

      // Process batches in parallel with concurrency limit
      await pMap(
        batches,
        async (batchData, batchIndex) => {
          const { data: batch, rows: batchRows, startIndex: i } = batchData;
          const batchNumber = batchIndex + 1;

          console.log(
            `[validate-and-stage] Processing batch ${batchNumber}/${totalBatches}`,
          );
          logger.info(`Processing batch ${batchNumber}`, {
            start: i + 1,
            end: Math.min(i + BATCH_SIZE, totalRows),
            total: totalRows,
          });

          // Load existing variants for this batch only (per-batch queries)
          const batchUpids = batch
            .map((r) => (r as CSVRow).upid)
            .filter((v): v is string => !!v && v.trim() !== "");

          const existingVariantsByUpid = new Map<string, ExistingVariant>();

          if (batchUpids.length > 0) {
            const existingVariants = await db
              .select({
                variantId: productVariants.id,
                productId: productVariants.productId,
                productHandle: products.productHandle,
                name: products.name,
                description: products.description,
                categoryId: products.categoryId,
                seasonId: products.seasonId,
                imagePath: products.imagePath,
                manufacturerId: products.manufacturerId,
                status: products.status,
                upid: productVariants.upid,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(
                and(
                  eq(products.brandId, brandId),
                  inArray(productVariants.upid, batchUpids),
                ),
              );

            for (const v of existingVariants) {
              const variant: ExistingVariant = {
                id: v.productId,
                productHandle: v.productHandle,
                name: v.name,
                description: v.description,
                categoryId: v.categoryId,
                seasonId: v.seasonId,
                imagePath: v.imagePath,
                manufacturerId: v.manufacturerId,
                status: v.status,
                variant_id: v.variantId,
                upid: v.upid,
              };

              if (v.upid && v.upid.trim() !== "") {
                existingVariantsByUpid.set(v.upid, variant);
              }
            }
          }

          // Parallel validation within batch
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
                  unmappedValueDetails,
                  duplicateRowNumbers,
                  duplicateDetails,
                  existingVariantsByUpid,
                  db,
                );

                // Only hard errors block validation (warnings are OK)
                const hasHardErrors = validated.errors.length > 0;

                // Row is valid if it has no hard errors (warnings are acceptable)
                if (!hasHardErrors) {
                  validCount++;
                  if (validated.action === "CREATE") willCreateCount++;
                  else if (validated.action === "UPDATE") willUpdateCount++;
                  else if (validated.action === "SKIP") willSkipCount++;
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
              // PHASE 3D: OPTIMIZED - Single round trip for all operations
              // Use PostgreSQL function to insert products, variants, and update statuses
              // in a SINGLE database call to eliminate network latency overhead
              // Performance: 3 round trips → 1 round trip = ~40% faster in production

              // Prepare data for single round trip
              const products = validRows.map((item) => item.validated!.product);
              const variants = validRows.map((item) => item.validated!.variant);
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

              // Single database call for all three operations!
              const result = await batchInsertStagingWithStatus(
                db,
                products,
                variants,
                validStatusUpdates,
              );

              const stagingInsertDuration = Date.now() - stagingInsertStart;
              console.log(
                `[validate-and-stage] Batch ${batchNumber} staged ${validRows.length} rows in ${stagingInsertDuration}ms (single round trip: ${result.productsInserted} products, ${result.variantsInserted} variants, ${result.rowsUpdated} status updates)`,
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
            // Batch insert failed - fall back to individual row inserts
            // This ensures we don't lose good rows due to one bad row
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error(
              "Batch staging insert failed, falling back to individual row inserts",
              {
                batchNumber,
                validRowCount: validRows.length,
                error: errorMessage,
              },
            );

            // Fallback: Process each row individually to isolate failures
            let successCount = 0;
            let fallbackFailCount = 0;

            for (const validRow of validRows) {
              try {
                // Insert product and variant individually
                const productStagingId = await insertStagingProduct(
                  db,
                  validRow.validated!.product,
                );
                await insertStagingVariant(db, {
                  ...validRow.validated!.variant,
                  stagingProductId: productStagingId,
                });

                // Update status for this row
                await batchUpdateImportRowStatus(db, [
                  {
                    id: validRow.importRowId,
                    status: "VALIDATED" as const,
                    normalized: {
                      action: validRow.validated!.action,
                      product_id: validRow.validated!.productId,
                      variant_id: validRow.validated!.variantId,
                      warnings:
                        validRow.validated!.warnings.length > 0
                          ? validRow.validated!.warnings.map((w) => ({
                              type: w.subtype,
                              field: w.field,
                              message: w.message,
                              entity_type: w.entityType,
                            }))
                          : undefined,
                    },
                  },
                ]);

                successCount++;
              } catch (rowError) {
                // This specific row failed - mark only this row as failed
                logger.error("Individual row insert failed", {
                  batchNumber,
                  rowNumber: validRow.rowNumber,
                  error:
                    rowError instanceof Error
                      ? rowError.message
                      : String(rowError),
                });

                await batchUpdateImportRowStatus(db, [
                  {
                    id: validRow.importRowId,
                    status: "FAILED" as const,
                    error:
                      rowError instanceof Error
                        ? rowError.message
                        : "Failed to insert into staging",
                  },
                ]);

                fallbackFailCount++;
                invalidCount++;
                validCount--;
              }
            }

            logger.info("Individual row fallback completed", {
              batchNumber,
              totalRows: validRows.length,
              successCount,
              fallbackFailCount,
            });
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
              will_skip: willSkipCount,
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
            batchNumber,
            processedCount,
            validCount,
            invalidCount,
          });
        },
        { concurrency: MAX_PARALLEL_BATCHES },
      );

      // Get final staging counts
      const stagingCounts = await countStagingProductsByAction(db, jobId);

      // Prepare pending_approval array from unmappedValueDetails
      const pendingApproval = Array.from(unmappedValueDetails.values());

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
          pending_approval: pendingApproval,
          approved_values: [],
          requires_value_approval: pendingApproval.length > 0,
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

      // OPTIMIZATION: Flush any pending updates before final notification
      await progressEmitter.flush();

      // Send final VALIDATED notification
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

      // CRITICAL: Flush final notification before task completion
      // This ensures the VALIDATED status reaches the frontend before the job exits
      await progressEmitter.flush();

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

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Parse pipe-separated values from CSV field
 * Example: "Red|Blue|Green" => ["Red", "Blue", "Green"]
 */
function parsePipeSeparated(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split("|")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Parse materials from CSV format
 * Format: "Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|..."
 * Example: "Cotton:75:TR:yes:GOTS:123:2025-12-31|Polyester:25"
 */
interface ParsedMaterial {
  name: string;
  percentage: number;
}

function parseMaterials(value: string | undefined): ParsedMaterial[] {
  if (!value || value.trim() === "") return [];

  const materials = parsePipeSeparated(value);
  const parsed: ParsedMaterial[] = [];

  for (const mat of materials) {
    const parts = mat.split(":").map((p) => p.trim());

    if (parts.length < 2) continue; // Must have at least name:percentage

    const name = parts[0];
    const percentageStr = parts[1];

    if (!name || !percentageStr) continue;

    const percentage = Number.parseFloat(percentageStr);
    if (Number.isNaN(percentage)) continue;

    parsed.push({ name, percentage });
  }

  return parsed;
}

/**
 * Parse journey steps from CSV format
 * Format: "StepName@Operator1,Operator2|Step2@Operator3"
 * Example: "Spinning@SupplierA,SupplierB|Weaving@SupplierC"
 */
interface ParsedJourneyStep {
  step: string;
  operators: string[];
}

function parseJourneySteps(value: string | undefined): ParsedJourneyStep[] {
  if (!value || value.trim() === "") return [];

  const steps = parsePipeSeparated(value);
  const parsed: ParsedJourneyStep[] = [];

  for (const stepStr of steps) {
    const [step, operatorsStr] = stepStr.split("@").map((s) => s.trim());

    if (!step) continue;

    const operators = operatorsStr
      ? operatorsStr
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      : [];

    parsed.push({ step, operators });
  }

  return parsed;
}

/**
 * Parse tag with optional color from CSV format
 * Format: "TagName" or "New:TagName:ColorHex"
 * Example: "Sustainable" or "New:EcoFriendly:#10B981"
 */
interface ParsedTag {
  name: string;
  isNew: boolean;
  hex?: string;
}

function parseTag(tagStr: string): ParsedTag {
  const parts = tagStr.split(":");

  if (parts[0] === "New" && parts.length >= 2) {
    // New tag with optional color
    return {
      name: parts[1]!.trim(),
      isNew: true,
      hex: parts.length > 2 ? parts[2]?.trim() : undefined,
    };
  }

  // Existing tag
  return {
    name: tagStr.trim(),
    isNew: false,
  };
}

/**
 * Parse color with optional custom indicator from CSV format
 * Format: "ColorName" or "Custom:ColorName"
 * Example: "Blue" or "Custom:Navy Blue"
 */
interface ParsedColor {
  name: string;
  isCustom: boolean;
}

function parseColor(colorStr: string): ParsedColor {
  if (colorStr.startsWith("Custom:")) {
    return {
      name: colorStr.substring(7).trim(),
      isCustom: true,
    };
  }

  return {
    name: colorStr.trim(),
    isCustom: false,
  };
}

/**
 * Validate EAN-8 or EAN-13 barcode format and checksum
 * @param ean - EAN barcode string
 * @returns true if valid, false otherwise
 */
function validateEAN(ean: string): boolean {
  // Remove whitespace
  const cleaned = ean.trim().replace(/\s/g, "");

  // Must be 8 or 13 digits
  if (!/^\d{8}$|^\d{13}$/.test(cleaned)) {
    return false;
  }

  // Calculate checksum
  const digits = cleaned.split("").map(Number);
  const checkDigit = digits.pop()!;

  // EAN checksum algorithm
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // Alternate weights: 1, 3, 1, 3, ...
    const weight = i % 2 === 0 ? 1 : 3;
    sum += digits[i]! * weight;
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

/**
 * Validate status field against allowed values
 * Valid statuses: published, unpublished, archived, scheduled
 * @param status - Status string from CSV
 * @returns Normalized status or null if invalid
 */
function validateStatus(
  status: string | undefined,
): "published" | "unpublished" | "archived" | "scheduled" | null {
  if (!status) return null;

  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "published":
    case "publish":
      return "published";
    case "unpublished":
    case "draft":
      return "unpublished";
    case "archived":
    case "archive":
      return "archived";
    case "scheduled":
    case "schedule":
      return "scheduled";
    default:
      return null; // Invalid status
  }
}

/**
 * Validate decimal number (for carbon/water metrics)
 * @param value - String value from CSV
 * @returns number if valid, null otherwise
 */
function validateDecimal(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;

  const num = Number.parseFloat(value.trim());

  // Must be a valid number and non-negative
  if (Number.isNaN(num) || num < 0) {
    return null;
  }

  return num;
}

/**
 * Validate and sum material percentages
 * @param materials - Array of material percentage values
 * @returns object with isValid flag and total sum
 */
function validateMaterialPercentages(materials: Array<string | undefined>): {
  isValid: boolean;
  total: number;
  error?: string;
} {
  const percentages: number[] = [];

  for (const mat of materials) {
    if (!mat || mat.trim() === "") continue;

    const num = Number.parseFloat(mat.trim());

    if (Number.isNaN(num) || num < 0 || num > 100) {
      return {
        isValid: false,
        total: 0,
        error: `Invalid material percentage: "${mat}"`,
      };
    }

    percentages.push(num);
  }

  // If no materials, validation passes
  if (percentages.length === 0) {
    return { isValid: true, total: 0 };
  }

  const total = percentages.reduce((sum, p) => sum + p, 0);

  // Total must be 100% (allow 0.1% tolerance for rounding)
  if (Math.abs(total - 100) > 0.1) {
    return {
      isValid: false,
      total,
      error: `Material percentages sum to ${total}%, but must total 100%`,
    };
  }

  return { isValid: true, total };
}

/**
 * Validate boolean field (for material_N_recyclable)
 * @param value - String value from CSV
 * @returns boolean or null
 */
function validateBoolean(value: string | undefined): boolean | null {
  if (!value || value.trim() === "") return null;

  const normalized = value.trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(normalized)) return true;
  if (["false", "no", "0", "n"].includes(normalized)) return false;

  return null; // Invalid boolean
}

/**
 * Detect changes between new staging data and existing product/variant
 * @param newProduct - New product data from CSV
 * @param newVariant - New variant data from CSV
 * @param existing - Existing product/variant data from database
 * @returns Object with hasChanges flag and array of changed field names
 */
function detectChanges(
  newProduct: InsertStagingProductParams,
  newVariant: InsertStagingVariantParams,
  existing: {
    // Product fields
    name: string;
    description: string | null;
    categoryId: string | null;
    seasonId: string | null;
    imagePath: string | null;
    manufacturerId: string | null;
    status: string | null;
    // Variant fields
    upid: string | null;
  },
): { hasChanges: boolean; changedFields: string[] } {
  const changedFields: string[] = [];

  // Helper function to compare values (handles null/undefined/empty string equivalence)
  const isDifferent = (newVal: unknown, oldVal: unknown): boolean => {
    // Normalize null, undefined, and empty string to null
    const normalizeEmpty = (val: unknown): unknown => {
      if (val === "" || val === undefined) return null;
      return val;
    };

    const normalizedNew = normalizeEmpty(newVal);
    const normalizedOld = normalizeEmpty(oldVal);

    return normalizedNew !== normalizedOld;
  };

  // Compare product fields
  if (isDifferent(newProduct.name, existing.name)) changedFields.push("name");
  if (isDifferent(newProduct.description, existing.description))
    changedFields.push("description");
  if (isDifferent(newProduct.categoryId, existing.categoryId))
    changedFields.push("categoryId");
  if (isDifferent(newProduct.seasonId, existing.seasonId))
    changedFields.push("seasonId");
  if (isDifferent(newProduct.imagePath, existing.imagePath))
    changedFields.push("imagePath");
  if (isDifferent(newProduct.manufacturerId, existing.manufacturerId))
    changedFields.push("manufacturerId");
  if (isDifferent(newProduct.status, existing.status))
    changedFields.push("status");

  // Compare variant fields
  if (isDifferent(newVariant.upid, existing.upid)) changedFields.push("upid");
  // NOTE: colorId and sizeId comparison removed as part of variant attribute migration.
  // These fields no longer exist on product_variants table.

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
  };
}

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
 * @param unmappedValueDetails - Map to track detailed unmapped value information for pending_approval
 * @param duplicateRowNumbers - Set of row numbers that have duplicate UPID
 * @param duplicateCheckColumn - Column name being checked for duplicates (upid)
 * @param existingVariantsMap - Pre-loaded map of existing variants (UPID -> product/variant IDs)
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
  unmappedValueDetails: Map<
    string,
    {
      type: string;
      name: string;
      affected_rows: number;
      source_column: string;
    }
  >,
  duplicateRowNumbers: Set<number>,
  duplicateDetails: Map<number, { type: "upid" | "composite"; value: string }>,
  existingVariantsByUpid: Map<string, ExistingVariant>,
  db: Database,
): Promise<ValidatedRowData> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // HARD ERROR: Duplicate detection (UPID or composite key)
  if (duplicateRowNumbers.has(rowNumber)) {
    const dupInfo = duplicateDetails.get(rowNumber);
    if (dupInfo) {
      if (dupInfo.type === "upid") {
        errors.push({
          type: "HARD_ERROR",
          subtype: "DUPLICATE_VALUE",
          field: "upid",
          message: `Duplicate UPID: "${dupInfo.value}" appears multiple times in the file`,
          severity: "error",
        });
      } else {
        // Composite key duplicate
        errors.push({
          type: "HARD_ERROR",
          subtype: "DUPLICATE_VALUE",
          field: "product_handle+colors+size",
          message:
            "Duplicate variant: This combination of product, color, and size appears multiple times in the file",
          severity: "error",
        });
      }
    }
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

  // HARD ERROR: product_handle is required (product-level identification)
  if (!row.product_handle || row.product_handle.trim() === "") {
    errors.push({
      type: "HARD_ERROR",
      subtype: "REQUIRED_FIELD_EMPTY",
      field: "product_handle",
      message: "Product handle is required",
      severity: "error",
    });
  }

  // Auto-generate UPID if not provided (variant-level identification)
  const upid =
    row.upid?.trim() ||
    (await generateUniqueUpid({
      isTaken: async (candidate: string) => {
        const [existing] = await db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.upid, candidate))
          .limit(1);
        return Boolean(existing);
      },
    }));

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

  // Validate status (defaults to unpublished if invalid/empty)
  const validatedStatus = row.status
    ? validateStatus(row.status)
    : "unpublished";
  const productStatus = validatedStatus || "unpublished"; // Default to unpublished

  // HARD ERROR: Carbon footprint validation
  if (row.carbon_footprint?.trim()) {
    const carbonValue = validateDecimal(row.carbon_footprint);
    if (carbonValue === null) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_NUMBER",
        field: "carbon_footprint",
        message: `Invalid carbon footprint: "${row.carbon_footprint}". Must be a non-negative decimal number`,
        severity: "error",
      });
    }
  }

  // HARD ERROR: Water usage validation
  if (row.water_usage?.trim()) {
    const waterValue = validateDecimal(row.water_usage);
    if (waterValue === null) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_NUMBER",
        field: "water_usage",
        message: `Invalid water usage: "${row.water_usage}". Must be a non-negative decimal number`,
        severity: "error",
      });
    }
  }

  // ========================================================================
  // MATERIALS VALIDATION
  // ========================================================================
  // Format: materials field with complex format

  let materialsToValidate: ParsedMaterial[] = [];

  if (row.materials?.trim()) {
    materialsToValidate = parseMaterials(row.materials);
  }

  // Simplified material validation - only check for critical errors
  if (materialsToValidate.length > 0) {
    const totalPercentage = materialsToValidate.reduce(
      (sum, m) => sum + m.percentage,
      0,
    );

    // HARD ERROR: Percentages must total 100% (with 1% tolerance for simplicity)
    if (Math.abs(totalPercentage - 100) > 1) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_MATERIAL_PERCENTAGE",
        field: "materials",
        message: `Material percentages must total 100%. Current total: ${totalPercentage.toFixed(2)}%`,
        severity: "error",
      });
    }

    // Only track first material if unmapped (for performance)
    const firstMaterial = materialsToValidate[0];
    if (firstMaterial) {
      const materialId = lookupMaterialId(
        catalog,
        firstMaterial.name,
        "materials",
      );
      if (!materialId) {
        trackUnmappedValue(
          unmappedValues,
          unmappedValueDetails,
          "MATERIAL",
          firstMaterial.name,
          "materials",
        );
      }
    }
  }

  // ========================================================================
  // ECO-CLAIMS VALIDATION
  // ========================================================================
  // Parse multi-value eco-claims field
  const ecoClaims = parsePipeSeparated(row.eco_claims);

  // HARD ERROR: Maximum 5 eco-claims allowed
  if (ecoClaims.length > 5) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "TOO_MANY_ECO_CLAIMS",
      field: "eco_claims",
      message: `Maximum 5 eco-claims allowed per product. Found ${ecoClaims.length}.`,
      severity: "error",
    });
  }

  // Note: Individual eco-claim length validation removed for performance
  // Claims will be truncated at database level if needed

  // ========================================================================
  // JOURNEY STEPS VALIDATION
  // ========================================================================
  // Note: Journey step operator validation simplified for performance
  // Operators will be validated during the commit phase
  const journeySteps = parseJourneySteps(row.journey_steps);

  // Note: URL validation removed for performance
  // URLs will be validated when actually used/accessed

  // Parse multi-value fields (pipe-separated)
  const colors = parsePipeSeparated(row.colors);
  // ecoClaims already parsed above in ECO-CLAIMS VALIDATION section

  // ========================================================================
  // END NEW FIELD VALIDATIONS
  // ========================================================================

  // ========================================================================
  // MANUFACTURER VALIDATION
  // ========================================================================
  const manufacturerId: string | null = null;
  if (row.manufacturer?.trim()) {
    // Check if manufacturer exists in catalog
    // TODO: Implement lookupManufacturerId function
    // For now, track as unmapped if provided
    trackUnmappedValue(
      unmappedValues,
      unmappedValueDetails,
      "MANUFACTURER",
      row.manufacturer.trim(),
      "manufacturer",
    );
    warnings.push({
      type: "NEEDS_DEFINITION",
      subtype: "MISSING_MANUFACTURER",
      field: "manufacturer",
      message: `Manufacturer "${row.manufacturer}" needs to be mapped or created`,
      severity: "warning",
      entityType: "MANUFACTURER",
    });
  }

  // ========================================================================
  // COLOR/SIZE VALIDATION - REMOVED
  // ========================================================================
  // Note: Color and size validation removed in Phase 5 of variant attribute migration.
  // Colors and sizes are now managed via generic brand attributes.
  // The colors and size fields in the CSV are still parsed but no longer validated
  // or stored on variants. In the future, these could be mapped to brand attributes.

  // ========================================================================
  // SEASON VALIDATION - Lookup from brand_seasons table
  // ========================================================================
  let seasonId: string | null = null;
  if (row.season?.trim()) {
    seasonId = lookupSeasonId(catalog, row.season, "season");
    if (!seasonId) {
      trackUnmappedValue(
        unmappedValues,
        unmappedValueDetails,
        "SEASON",
        row.season,
        "season",
      );
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_SEASON",
        field: "season",
        message: `Season "${row.season}" needs to be mapped or created`,
        severity: "warning",
        entityType: "SEASON",
      });
    }
  }

  // WARNING: Missing category (needs user definition)
  let categoryId: string | null = null;
  const categoryValue = row.category;

  if (categoryValue?.trim()) {
    // NEW format: hierarchical path like "Men's > Tops > T-Shirts"
    // The path will be normalized to just the leaf category name for lookup
    // Example: "Men's > Tops > T-Shirts" becomes "t-shirts" for lookup
    const categoryParts = categoryValue.split(">").map((p) => p.trim());
    const leafCategory = categoryParts[categoryParts.length - 1] || "";

    // In-memory lookup from catalog (0 database queries)
    categoryId = lookupCategoryId(catalog, leafCategory, "category");

    if (!categoryId) {
      // Track as unmapped for user definition
      trackUnmappedValue(
        unmappedValues,
        unmappedValueDetails,
        "CATEGORY",
        categoryValue,
        "category",
      );
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_CATEGORY",
        field: "category",
        message: `Category "${categoryValue}" needs to be mapped to an existing category`,
        severity: "warning",
        entityType: "CATEGORY",
      });
      // Leave categoryId as null - will be populated after user maps category
    }
  }

  // ========================================================================
  // CREATE vs UPDATE DETECTION - UPID matching
  // ========================================================================

  const matchedByUpid = (upid ? existingVariantsByUpid.get(upid) : null) as
    | ExistingVariant
    | null
    | undefined;

  const existingVariant: ExistingVariant | null = matchedByUpid || null;

  // Generate UUIDs for new records or use existing
  const productId = existingVariant?.id || randomUUID();
  const variantId = existingVariant?.variant_id || randomUUID();

  // Build temporary product and variant objects for change detection
  const productHandle = row.product_handle.trim();
  const tempProduct: InsertStagingProductParams = {
    jobId,
    rowNumber,
    action: "UPDATE", // Temporary, will be overwritten
    existingProductId: existingVariant?.id || null,
    id: productId,
    brandId,
    productHandle,
    name: row.product_name?.trim() || "",
    description: row.description?.trim() || null,
    categoryId,
    seasonId,
    // CSV column is image_url, but we store as imagePath
    imagePath: row.image_url?.trim() || null,
    status: productStatus,
    manufacturerId,
  };

  // Note: colorId and sizeId removed in Phase 5 of variant attribute migration.
  const tempVariant: InsertStagingVariantParams = {
    stagingProductId: "", // Will be set after product insertion
    jobId,
    rowNumber,
    action: "UPDATE", // Temporary, will be overwritten
    existingVariantId: existingVariant?.variant_id || null,
    id: variantId,
    productId,
    upid: upid || "",
  };

  // ========================================================================
  // PHASE 2: CHANGE DETECTION - Skip UPDATE if no changes detected
  // ========================================================================

  let action: "CREATE" | "UPDATE" | "SKIP" = "CREATE";
  let changedFields: string[] | undefined;

  if (existingVariant) {
    // Product exists - check if any fields have changed
    const changeDetection = detectChanges(
      tempProduct,
      tempVariant,
      existingVariant,
    );

    if (changeDetection.hasChanges) {
      action = "UPDATE";
      changedFields = changeDetection.changedFields;
    } else {
      action = "SKIP";
      changedFields = []; // No changes
    }
  } else {
    // New product
    action = "CREATE";
  }

  // Update action in product and variant objects
  const product: InsertStagingProductParams = {
    ...tempProduct,
    action,
  };

  const variant: InsertStagingVariantParams = {
    ...tempVariant,
    action,
  };

  return {
    productId,
    variantId,
    action,
    existingProductId: existingVariant?.id,
    existingVariantId: existingVariant?.variant_id,
    product,
    variant,
    errors, // Hard errors that block import
    warnings, // Missing catalog values that need user definition
    changedFields, // Fields that changed (for UPDATE action only)
  };
}

/**
 * Track unmapped value for user review
 *
 * @param unmappedValues - Map to store unmapped values
 * @param unmappedValueDetails - Map to store detailed unmapped value information
 * @param entityType - Type of entity (COLOR, SIZE, etc.)
 * @param value - Raw value from CSV
 * @param sourceColumn - CSV column where this value came from
 */
function trackUnmappedValue(
  unmappedValues: Map<string, Set<string>>,
  unmappedValueDetails: Map<
    string,
    {
      type: string;
      name: string;
      affected_rows: number;
      source_column: string;
    }
  >,
  entityType: string,
  value: string,
  sourceColumn: string,
): void {
  if (!unmappedValues.has(entityType)) {
    unmappedValues.set(entityType, new Set());
  }
  unmappedValues.get(entityType)?.add(value);

  // Track detailed information for pending_approval
  const key = `${entityType}:${value}`;
  if (unmappedValueDetails.has(key)) {
    // Increment affected rows count
    const existing = unmappedValueDetails.get(key)!;
    existing.affected_rows += 1;
  } else {
    unmappedValueDetails.set(key, {
      type: entityType,
      name: value,
      affected_rows: 1,
      source_column: sourceColumn,
    });
  }
}
