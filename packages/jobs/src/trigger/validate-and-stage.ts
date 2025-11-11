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
  lookupOperatorId,
  lookupSeasonId,
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
 *
 * NEW FORMAT (minimal):
 * - category: hierarchical path (e.g., "Men's > Tops > T-Shirts")
 * - colors: pipe-separated (e.g., "Blue|Green|Custom:Navy")
 * - tags: pipe-separated with optional color (e.g., "Tag1|New:Tag2:#10B981")
 * - eco_claims: pipe-separated (e.g., "Claim1|Claim2|Claim3")
 * - materials: complex format (e.g., "Cotton:75:TR:yes:GOTS:123:2025-12-31|Polyester:25")
 * - journey_steps: step@operators format (e.g., "Spinning@SupplierA,SupplierB|Weaving@SupplierC")
 *
 * LEGACY FORMAT (backward compatible):
 * - Old material columns (material_1_name, material_1_percentage, etc.)
 * - Old journey columns (journey_step_1, journey_operator_1, etc.)
 * - Old color_name (single value)
 */
interface CSVRow {
  // ============================================================================
  // REQUIRED FIELDS
  // ============================================================================
  product_name: string; // Max 100 characters
  sku?: string; // Required if no EAN

  // ============================================================================
  // BASIC INFORMATION (NEW FORMAT)
  // ============================================================================
  description?: string; // Max 2000 characters
  ean?: string; // EAN-8 or EAN-13 with valid checksum
  status?: string; // draft|published|archived (default: draft)
  brand?: string; // Showcase brand name

  // ============================================================================
  // ORGANIZATION (NEW FORMAT)
  // ============================================================================
  category?: string; // Hierarchical path: "Men's > Tops > T-Shirts"
  season?: string; // Season name: "SS 2025" or "FW 2024"
  colors?: string; // Pipe-separated: "Blue|Green"
  size?: string; // Size name: "S", "M", "L", "XL", etc.
  tags?: string; // Pipe-separated: "Tag1|Tag2|Tag3"

  // ============================================================================
  // ENVIRONMENT (NEW FORMAT)
  // ============================================================================
  carbon_footprint?: string; // Single decimal value (kg CO2e)
  water_usage?: string; // Single decimal value (liters)
  eco_claims?: string; // Pipe-separated claims (max 5, each max 50 chars)

  // ============================================================================
  // MATERIALS (NEW FORMAT)
  // ============================================================================
  // Format: "Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|..."
  // Example: "Cotton:75:TR:yes:GOTS:123:2025-12-31|Polyester:25"
  materials?: string;

  // ============================================================================
  // JOURNEY STEPS (NEW FORMAT)
  // ============================================================================
  // Format: "StepName@Operator1,Operator2|Step2@Operator3"
  // Example: "Spinning@SupplierA,SupplierB|Weaving@SupplierC"
  journey_steps?: string;

  // ============================================================================
  // IMAGES (NEW FORMAT)
  // ============================================================================
  primary_image_url?: string; // Single URL
  additional_image_urls?: string; // Pipe-separated URLs

  // ============================================================================
  // LEGACY FIELDS (BACKWARD COMPATIBILITY)
  // ============================================================================
  // Legacy organization
  category_id?: string;
  category_name?: string; // Legacy: single category name
  color_name?: string; // Legacy: single color (replaced by colors)
  color_id?: string;
  size_id?: string;
  size_name?: string;

  // Legacy variant identifiers
  upid?: string;
  product_image_url?: string;

  // Legacy materials (separate columns)
  material_1_name?: string;
  material_1_percentage?: string;
  material_2_name?: string;
  material_2_percentage?: string;
  material_3_name?: string;
  material_3_percentage?: string;

  // Legacy journey (separate columns)
  journey_step_1?: string;
  journey_operator_1?: string;
  journey_step_2?: string;
  journey_operator_2?: string;
  journey_step_3?: string;
  journey_operator_3?: string;
  journey_step_4?: string;
  journey_operator_4?: string;
  journey_step_5?: string;
  journey_operator_5?: string;

  // Legacy care & certifications
  care_codes?: string;
  certifications?: string;

  // Legacy brand fields
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
    | "SEASON"
    | "TAG"
    | "ECO_CLAIM"
    | "FACILITY"
    | "OPERATOR" // Journey operators
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
   * Send update to API endpoint
   * When called via flush(), this will be awaited to ensure delivery
   * When called directly, it returns a promise but caller doesn't await (fire-and-forget)
   */
  private async sendUpdate(params: any): Promise<void> {
    const inputData = {
      apiKey: this.apiKey,
      ...params,
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/trpc/internal.emitProgress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            json: inputData,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[ProgressEmitter] Failed to emit:", {
          status: response.status,
          jobId: params.jobId,
          error: errorText.substring(0, 200),
        });
      }
      // Success - no logging to reduce noise
    } catch (error) {
      // Log errors in development mode
      if (process.env.NODE_ENV === "development") {
        console.warn("[ProgressEmitter] Network error:", {
          jobId: params.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
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
                unmappedValueDetails,
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
      ? operatorsStr.split(",").map((o) => o.trim()).filter((o) => o.length > 0)
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
 * @param status - Status string from CSV
 * @returns Normalized status or null if invalid
 */
function validateStatus(
  status: string | undefined,
): "DRAFT" | "PUBLISHED" | "ARCHIVED" | null {
  if (!status) return null;

  const normalized = status.trim().toUpperCase();

  switch (normalized) {
    case "DRAFT":
      return "DRAFT";
    case "PUBLISHED":
    case "PUBLISH":
      return "PUBLISHED";
    case "ARCHIVED":
    case "ARCHIVE":
      return "ARCHIVED";
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
function validateMaterialPercentages(
  materials: Array<string | undefined>,
): { isValid: boolean; total: number; error?: string } {
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
 * Validate URL format
 * @param url - URL string from CSV
 * @returns true if valid URL format
 */
function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

  // ========================================================================
  // NEW FIELD VALIDATIONS (Task 26)
  // ========================================================================

  // HARD ERROR: EAN validation
  if (row.ean && row.ean.trim()) {
    if (!validateEAN(row.ean)) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_EAN",
        field: "ean",
        message: `Invalid EAN barcode: "${row.ean}". Must be EAN-8 or EAN-13 with valid checksum`,
        severity: "error",
      });
    }
  }

  // Validate status (defaults to DRAFT if invalid/empty)
  const validatedStatus = row.status ? validateStatus(row.status) : "DRAFT";
  const productStatus = validatedStatus || "DRAFT"; // Default to DRAFT

  // HARD ERROR: Carbon footprint validation
  if (row.carbon_footprint && row.carbon_footprint.trim()) {
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
  if (row.water_usage && row.water_usage.trim()) {
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
  // MATERIALS VALIDATION - Support both NEW and LEGACY formats
  // ========================================================================
  // NEW format: materials field with complex format
  // LEGACY format: material_1_name, material_1_percentage, etc.

  let materialsToValidate: ParsedMaterial[] = [];

  // Try NEW format first
  if (row.materials && row.materials.trim()) {
    materialsToValidate = parseMaterials(row.materials);
  }
  // Fall back to LEGACY format
  else if (row.material_1_name || row.material_2_name || row.material_3_name) {
    // Convert legacy format to ParsedMaterial format
    const legacyMaterials = [
      { name: row.material_1_name, percentageStr: row.material_1_percentage },
      { name: row.material_2_name, percentageStr: row.material_2_percentage },
      { name: row.material_3_name, percentageStr: row.material_3_percentage },
    ];

    for (const mat of legacyMaterials) {
      if (mat.name && mat.name.trim()) {
        const percentage = mat.percentageStr ? Number.parseFloat(mat.percentageStr) : 0;
        if (!Number.isNaN(percentage)) {
          materialsToValidate.push({
            name: mat.name.trim(),
            percentage,
          });
        }
      }
    }
  }

  // HARD ERROR: Validate material percentages total 100%
  if (materialsToValidate.length > 0) {
    let totalPercentage = 0;

    for (const material of materialsToValidate) {
      totalPercentage += material.percentage;

      // Validate each percentage is between 0-100
      if (material.percentage < 0 || material.percentage > 100) {
        errors.push({
          type: "HARD_ERROR",
          subtype: "INVALID_MATERIAL_PERCENTAGE",
          field: "materials",
          message: `Material "${material.name}" has invalid percentage: ${material.percentage}. Must be between 0-100.`,
          severity: "error",
        });
      }

      // Check if material exists in catalog
      const materialId = lookupMaterialId(catalog, material.name, "materials");
      if (!materialId) {
        // Track as unmapped for user definition
        trackUnmappedValue(
          unmappedValues,
          unmappedValueDetails,
          "MATERIAL",
          material.name,
          "materials",
        );
        warnings.push({
          type: "NEEDS_DEFINITION",
          subtype: "MISSING_MATERIAL",
          field: "materials",
          message: `Material "${material.name}" needs to be created`,
          severity: "warning",
          entityType: "MATERIAL",
        });
      }
    }

    // HARD ERROR: Percentages must total 100% (with 0.01% tolerance for rounding)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_MATERIAL_PERCENTAGE",
        field: "materials",
        message: `Material percentages must total 100%. Current total: ${totalPercentage.toFixed(2)}%`,
        severity: "error",
      });
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

  // HARD ERROR: Each claim max 50 characters
  for (const claim of ecoClaims) {
    if (claim.length > 50) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "ECO_CLAIM_TOO_LONG",
        field: "eco_claims",
        message: `Eco-claim exceeds 50 characters: "${claim.substring(0, 40)}..."`,
        severity: "error",
      });
    }
  }

  // ========================================================================
  // JOURNEY STEPS VALIDATION
  // ========================================================================
  // Parse journey steps with operators
  const journeySteps = parseJourneySteps(row.journey_steps);

  // Validate operators exist in catalog
  for (const [index, step] of journeySteps.entries()) {
    // Step type can be custom, so no validation needed for step names

    // Validate each operator
    for (const operatorName of step.operators) {
      const operatorId = lookupOperatorId(catalog, operatorName, "journey_steps");

      if (!operatorId) {
        // Track as unmapped for user definition
        trackUnmappedValue(
          unmappedValues,
          unmappedValueDetails,
          "OPERATOR",
          operatorName,
          "journey_steps",
        );
        warnings.push({
          type: "NEEDS_DEFINITION",
          subtype: "MISSING_OPERATOR",
          field: "journey_steps",
          message: `Operator "${operatorName}" needs to be created or mapped`,
          severity: "warning",
          entityType: "OPERATOR",
        });
      }
    }
  }

  // Validate image URLs
  if (row.primary_image_url && row.primary_image_url.trim()) {
    if (!validateURL(row.primary_image_url)) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_URL",
        field: "primary_image_url",
        message: `Invalid URL: "${row.primary_image_url}"`,
        severity: "error",
      });
    }
  }

  if (row.additional_image_urls && row.additional_image_urls.trim()) {
    const additionalUrls = parsePipeSeparated(row.additional_image_urls);
    for (const url of additionalUrls) {
      if (!validateURL(url)) {
        errors.push({
          type: "HARD_ERROR",
          subtype: "INVALID_URL",
          field: "additional_image_urls",
          message: `Invalid URL in additional images: "${url}"`,
          severity: "error",
        });
      }
    }
  }

  if (row.product_image_url && row.product_image_url.trim()) {
    if (!validateURL(row.product_image_url)) {
      errors.push({
        type: "HARD_ERROR",
        subtype: "INVALID_URL",
        field: "product_image_url",
        message: `Invalid URL: "${row.product_image_url}"`,
        severity: "error",
      });
    }
  }

  // ========================================================================
  // BACKWARD COMPATIBILITY: Support both old and new CSV formats
  // ========================================================================
  // Old format (19 columns): uses color_name (single value)
  // New format (44 columns): uses colors (pipe-separated multi-value)
  // This ensures existing CSVs continue to work while supporting new features
  // ========================================================================

  // Parse multi-value fields (pipe-separated)
  const colors = parsePipeSeparated(row.colors || row.color_name); // Backward compatibility: colors OR color_name
  const tags = parsePipeSeparated(row.tags);
  // ecoClaims already parsed above in ECO-CLAIMS VALIDATION section
  const certifications = parsePipeSeparated(row.certifications);

  // ========================================================================
  // END NEW FIELD VALIDATIONS
  // ========================================================================

  // ========================================================================
  // BRAND VALIDATION (showcase_brand)
  // ========================================================================
  let showcaseBrandId: string | null = null;
  if (row.brand && row.brand.trim()) {
    // Check if brand exists in catalog - brands are global, not brand-specific
    // TODO: Implement lookupShowcaseBrandId function
    // For now, track as unmapped if provided
    trackUnmappedValue(
      unmappedValues,
      unmappedValueDetails,
      "SHOWCASE_BRAND",
      row.brand.trim(),
      "brand",
    );
    warnings.push({
      type: "NEEDS_DEFINITION",
      subtype: "MISSING_BRAND",
      field: "brand",
      message: `Brand "${row.brand}" needs to be mapped or created`,
      severity: "warning",
      entityType: "SHOWCASE_BRAND",
    });
  }

  // ========================================================================
  // COLOR VALIDATION - Support both single (legacy) and multiple (new) format
  // ========================================================================
  let colorId: string | null = null;
  const colorIds: string[] = [];
  
  // Process multiple colors if provided
  if (colors.length > 0) {
    for (const colorName of colors) {
      const foundColorId = lookupColorId(catalog, colorName, "colors");
      if (!foundColorId) {
        trackUnmappedValue(
          unmappedValues,
          unmappedValueDetails,
          "COLOR",
          colorName,
          "colors",
        );
        warnings.push({
          type: "NEEDS_DEFINITION",
          subtype: "MISSING_COLOR",
          field: "colors",
          message: `Color "${colorName}" needs to be mapped to an existing color`,
          severity: "warning",
          entityType: "COLOR",
        });
      } else {
        colorIds.push(foundColorId);
      }
    }
    // For variant, use first color as primary
    colorId = colorIds.length > 0 ? (colorIds[0] ?? null) : null;
  } else if (row.color_name) {
    // Legacy single color support
    colorId = lookupColorId(catalog, row.color_name, "color_name");
    if (!colorId) {
      trackUnmappedValue(
        unmappedValues,
        unmappedValueDetails,
        "COLOR",
        row.color_name,
        "color_name",
      );
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_COLOR",
        field: "color_name",
        message: `Color "${row.color_name}" needs to be mapped to an existing color`,
        severity: "warning",
        entityType: "COLOR",
      });
    }
  }

  // ========================================================================
  // SIZE VALIDATION - Support both new 'size' and legacy 'size_name' columns
  // ========================================================================
  let sizeId: string | null = null;
  const sizeName = row.size || row.size_name;
  
  if (sizeName && sizeName.trim()) {
    sizeId = lookupSizeId(catalog, sizeName, "size");
    if (!sizeId) {
      trackUnmappedValue(
        unmappedValues,
        unmappedValueDetails,
        "SIZE",
        sizeName,
        "size",
      );
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_SIZE",
        field: "size",
        message: `Size "${sizeName}" needs to be mapped or created`,
        severity: "warning",
        entityType: "SIZE",
      });
    }
  }

  // ========================================================================
  // TAGS VALIDATION
  // ========================================================================
  // Tags are stored as text in products table, no FK validation needed
  // Just validate format and store as pipe-separated string
  const tagsString = tags.length > 0 ? tags.join("|") : null;

  // ========================================================================
  // SEASON VALIDATION - Lookup from brand_seasons table
  // ========================================================================
  let seasonId: string | null = null;
  if (row.season && row.season.trim()) {
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
  // Support both NEW format (hierarchical path) and LEGACY format (flat name)
  let categoryId: string | null = null;
  const categoryValue = row.category || row.category_name;

  if (categoryValue && categoryValue.trim()) {
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
  } else if (row.category_id) {
    // Direct category ID provided (legacy support)
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
  const additionalImagesString = row.additional_image_urls?.trim() || null;
  
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
    season: row.season?.trim() || null, // Legacy: kept for backward compatibility
    seasonId,
    primaryImageUrl: row.primary_image_url?.trim() || null,
    additionalImageUrls: additionalImagesString,
    tags: tagsString,
    showcaseBrandId: showcaseBrandId || row.showcase_brand_id?.trim() || null,
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
    ean: row.ean?.trim() || null,
    colorId,
    sizeId,
    productImageUrl: row.product_image_url?.trim() || null,
    status: productStatus,
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
