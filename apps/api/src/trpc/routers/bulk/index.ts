/**
 * Bulk operations router implementation.
 *
 * Centralizes batch mutations that were previously scattered across domains.
 * Supports:
 * - Legacy product imports (synchronous)
 * - Passport bulk updates
 * - NEW: Async bulk product import with staging (Phase 1)
 */
import {
  type BulkChanges as PassportBulkChanges,
  type BulkSelection as PassportBulkSelection,
  bulkUpdatePassports,
  createProduct,
  createImportJob,
  getImportJobStatus,
  getImportErrors,
  getFailedRowsForExport,
  getUnmappedValuesForJob,
  getStagingPreview,
  countStagingProductsByAction,
  validateAndCreateEntity,
  createValueMapping,
  updateImportJobProgress,
  updateImportJobStatus,
  deleteStagingDataForJob,
} from "@v1/db/queries";
import {
  type BulkSelectionInput,
  bulkImportSchema,
  bulkUpdateSchema,
  validateImportSchema,
  startImportSchema,
  getImportStatusSchema,
  getImportErrorsSchema,
  getStagingPreviewSchema,
  getUnmappedValuesSchema,
  defineValueSchema,
  batchDefineValuesSchema,
  exportFailedRowsSchema,
  approveImportSchema,
  cancelImportSchema,
  type EntityType,
} from "../../../schemas/bulk.js";
import {
  parseFile,
  validateHeaders,
  normalizeHeaders,
  generateCSV,
} from "../../../lib/csv-parser.js";
import { downloadImportFile } from "@v1/supabase/storage/product-imports";
import { tasks } from "@trigger.dev/sdk";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createBatchResponse,
  createSuccessWithMeta,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrand(
  ctx: AuthenticatedTRPCContext,
): asserts ctx is BrandContext {
  if (!ctx.brandId) {
    throw badRequest("Active brand context required");
  }
}

function assertBrandScope(
  ctx: AuthenticatedTRPCContext,
  requestedBrandId?: string | null,
): string {
  ensureBrand(ctx);
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

interface ResolvedImportFilePath {
  path: string;
  jobId: string;
  filename: string;
}

function resolveImportFilePath(params: {
  fileId: string;
  brandId: string;
  filename: string;
}): ResolvedImportFilePath {
  const sanitizedPath = params.fileId.replace(/^\/+|\/+$/g, "");
  const segments = sanitizedPath.split("/");

  console.log("[resolveImportFilePath] Debug info:", {
    fileId: params.fileId,
    brandId: params.brandId,
    filename: params.filename,
    sanitizedPath,
    segments,
    segmentsLength: segments.length,
  });

  if (segments.length < 3) {
    console.error("[resolveImportFilePath] Error: segments.length < 3");
    throw badRequest(`Invalid file reference provided. Expected format: brandId/jobId/filename, got: ${sanitizedPath}`);
  }

  const [pathBrandId, jobId, ...fileSegments] = segments;

  console.log("[resolveImportFilePath] Parsed segments:", {
    pathBrandId,
    jobId,
    fileSegments,
  });

  if (pathBrandId !== params.brandId) {
    console.error("[resolveImportFilePath] Error: brandId mismatch", {
      pathBrandId,
      expectedBrandId: params.brandId,
    });
    throw badRequest(`File does not belong to the active brand context. Expected: ${params.brandId}, got: ${pathBrandId}`);
  }

  if (!jobId || fileSegments.length === 0) {
    console.error("[resolveImportFilePath] Error: missing jobId or filename");
    throw badRequest("Incomplete file reference provided");
  }

  const resolvedFilename = fileSegments.join("/");

  console.log("[resolveImportFilePath] Filename comparison:", {
    resolvedFilename,
    expectedFilename: params.filename,
    match: resolvedFilename === params.filename,
  });

  if (resolvedFilename !== params.filename) {
    console.error("[resolveImportFilePath] Error: filename mismatch");
    throw badRequest(`Filename does not match the provided file reference. Expected: ${params.filename}, got: ${resolvedFilename}`);
  }

  return {
    path: sanitizedPath,
    jobId,
    filename: resolvedFilename,
  };
}

function toPassportSelection(
  selection: BulkSelectionInput,
): PassportBulkSelection {
  if (selection.mode === "all") {
    return {
      mode: "all",
      excludeIds: selection.excludeIds ?? [],
    };
  }

  return {
    mode: "explicit",
    includeIds: [...selection.includeIds],
  };
}

export const bulkRouter = createTRPCRouter({
  import: brandRequiredProcedure
    .input(bulkImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = assertBrandScope(brandCtx, input.brand_id);

      if (input.domain !== "products") {
        throw badRequest(`Unsupported bulk import domain: ${input.domain}`);
      }

      try {
        const created: Array<{ id: string }> = [];
        for (const item of input.items) {
          const product = await createProduct(brandCtx.db, brandId, {
            name: item.name,
            description: item.description ?? undefined,
            categoryId: item.category_id ?? undefined,
            season: item.season ?? undefined,
            brandCertificationId: item.brand_certification_id ?? undefined,
            showcaseBrandId: item.showcase_brand_id ?? undefined,
            primaryImageUrl: item.primary_image_url ?? undefined,
          });
          if (product?.id) {
            created.push({ id: product.id });
          }
        }

        return createSuccessWithMeta({
          domain: input.domain,
          created: created.length,
          products: created,
        });
      } catch (error) {
        throw wrapError(error, "Failed to import products");
      }
    }),

  update: brandRequiredProcedure
    .input(bulkUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;

      switch (input.domain) {
        case "passports": {
          const selection = toPassportSelection(input.selection);
          const changes: PassportBulkChanges = {};
          if (input.changes.status) {
            changes.status = input.changes.status;
          }

          try {
            const affected = await bulkUpdatePassports(
              brandCtx.db,
              brandCtx.brandId,
              selection,
              changes,
            );
            return createBatchResponse(affected);
          } catch (error) {
            throw wrapError(error, "Failed to bulk update passports");
          }
        }

        case "products":
        case "brand": {
          throw badRequest(
            `Bulk update for domain '${input.domain}' is not implemented yet`,
          );
        }
      }
    }),

  /**
   * NEW: Validate import file before processing
   *
   * Phase 1 - Server-side quick validation:
   * - Parse file headers
   * - Check for duplicate UPID/SKU within file
   * - Verify file integrity
   * - Return validation report
   *
   * This is a synchronous operation that provides fast feedback
   * before queuing the background validation job.
   */
  validateImport: brandRequiredProcedure
    .input(validateImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;
      
      console.log("[validateImport] Input received:", {
        fileId: input.fileId,
        filename: input.filename,
        brandId,
      });

      const resolvedFile = resolveImportFilePath({
        fileId: input.fileId,
        brandId,
        filename: input.filename,
      });
      
      console.log("[validateImport] Resolved file:", resolvedFile);
      
      // Always use admin client for storage operations to bypass RLS
      const supabaseClient = brandCtx.supabaseAdmin;
      if (!supabaseClient) {
        throw badRequest("Supabase admin client is not configured. Check SUPABASE_SERVICE_ROLE_KEY environment variable.");
      }

      try {
        // Download file from Supabase Storage
        console.log("[validateImport] Downloading file from storage:", {
          path: resolvedFile.path,
        });
        
        const downloadResult = await downloadImportFile(supabaseClient, {
          path: resolvedFile.path,
        });

        console.log("[validateImport] Download result:", {
          hasData: !!downloadResult.data,
          dataType: downloadResult.data ? typeof downloadResult.data : 'null',
        });

        if (!downloadResult.data) {
          console.error("[validateImport] Download failed: no data returned");
          throw badRequest("File download failed - file not found in storage");
        }

        // Parse file to validate headers and content
        console.log("[validateImport] Parsing file...");
        const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
        console.log("[validateImport] File buffer size:", fileBuffer.length);
        
        const file = new File([fileBuffer], resolvedFile.filename);
        console.log("[validateImport] File object created:", {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        const parseResult = await parseFile(file, { trimValues: true });
        console.log("[validateImport] Parse result:", {
          rowCount: parseResult.rowCount,
          headerCount: parseResult.headers.length,
          headers: parseResult.headers,
          errorCount: parseResult.errors.length,
        });

        if (parseResult.errors.length > 0) {
          console.log("[validateImport] Parse errors found:", parseResult.errors);
          return {
            valid: false,
            fileId: input.fileId,
            warnings: [],
            errors: parseResult.errors.map((err) => ({
              type: "INVALID_FORMAT",
              message: err.message,
              row: err.row,
            })),
            summary: {
              totalRows: 0,
              hasUpid: false,
              hasSku: false,
              recognizedColumns: [],
              unrecognizedColumns: [],
            },
          };
        }

        // Validate headers
        const { normalized: normalizedHeaders, mapping: headerMapping } =
          normalizeHeaders(parseResult.headers);

        const requiredHeaders = ["product_name"];
        const missingRequired = requiredHeaders.filter(
          (h) => !normalizedHeaders.includes(h),
        );

        if (missingRequired.length > 0) {
          return {
            valid: false,
            fileId: input.fileId,
            warnings: [],
            errors: [
              {
                type: "MISSING_COLUMNS",
                message: `Missing required columns: ${missingRequired.join(", ")}`,
              },
            ],
            summary: {
              totalRows: parseResult.rowCount,
              hasUpid: normalizedHeaders.includes("upid"),
              hasSku: normalizedHeaders.includes("sku"),
              recognizedColumns: normalizedHeaders,
              unrecognizedColumns: [],
            },
          };
        }

        // Check for UPID or SKU
        const hasUpid = normalizedHeaders.includes("upid");
        const hasSku = normalizedHeaders.includes("sku");

        if (!hasUpid && !hasSku) {
          return {
            valid: false,
            fileId: input.fileId,
            warnings: [],
            errors: [
              {
                type: "MISSING_COLUMNS",
                message: "Either 'upid' or 'sku' column is required",
              },
            ],
            summary: {
              totalRows: parseResult.rowCount,
              hasUpid: false,
              hasSku: false,
              recognizedColumns: normalizedHeaders,
              unrecognizedColumns: [],
            },
          };
        }

        // File structure is valid - duplicates will be checked in background job
        return {
          valid: true,
          fileId: input.fileId,
          warnings: [],
          errors: [],
          summary: {
            totalRows: parseResult.rowCount,
            hasUpid,
            hasSku,
            recognizedColumns: normalizedHeaders,
            unrecognizedColumns: parseResult.headers.filter(
              (h) => !normalizedHeaders.includes(h.toLowerCase()),
            ),
          },
        };
      } catch (error) {
        console.error("[validateImport] Error caught:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw wrapError(error, "Failed to validate import file");
      }
    }),

  /**
   * NEW: Start async import job (Phase 1 - Validation & Staging)
   *
   * Creates import job record and triggers background validation task.
   * Returns immediately with job_id for progress tracking.
   *
   * Flow:
   * 1. Create import_jobs record (status: PENDING)
   * 2. Validate the uploaded file path belongs to the active brand
   * 3. Trigger validate-and-stage background job
   * 4. Return job_id immediately
   */
  startImport: brandRequiredProcedure
    .input(startImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      console.log("[startImport] Input received:", {
        fileId: input.fileId,
        filename: input.filename,
        brandId,
      });

      const resolvedFile = resolveImportFilePath({
        fileId: input.fileId,
        brandId,
        filename: input.filename,
      });

      console.log("[startImport] Resolved file path:", resolvedFile.path);

      try {
        // Create import job record
        console.log("[startImport] Creating import job...");
        const job = await createImportJob(brandCtx.db, {
          brandId,
          filename: input.filename,
          status: "PENDING",
        });

        console.log("[startImport] Import job created:", {
          jobId: job.id,
          status: job.status,
        });

        // Trigger validate-and-stage background job via Trigger.dev using the uploaded file path
        const triggerApiUrl = process.env.TRIGGER_API_URL ?? "https://api.trigger.dev";
        console.log("[startImport] Triggering background job...", {
          triggerApiUrl,
          hasCustomTriggerUrl: Boolean(process.env.TRIGGER_API_URL),
          hasTriggerSecret: Boolean(process.env.TRIGGER_SECRET_KEY),
        });

        try {
          console.log("[startImport] About to trigger background job with payload:", {
            jobId: job.id,
            brandId,
            filePath: resolvedFile.path,
          });

          const runHandle = await tasks.trigger("validate-and-stage", {
            jobId: job.id,
            brandId,
            filePath: resolvedFile.path,
          });

          console.log("[startImport] Background job triggered successfully", {
            triggerRunId: runHandle.id,
            triggerTaskId: "validate-and-stage",
            publicAccessToken: runHandle.publicAccessToken || "N/A",
          });

          // Log the run handle for debugging
          console.log("[startImport] Full run handle:", JSON.stringify(runHandle, null, 2));
        } catch (triggerError) {
          console.error("[startImport] Failed to trigger background job:", {
            error: triggerError,
            errorMessage: triggerError instanceof Error ? triggerError.message : String(triggerError),
            errorStack: triggerError instanceof Error ? triggerError.stack : undefined,
          });

          // Update job status to FAILED immediately
          await updateImportJobStatus(brandCtx.db, {
            jobId: job.id,
            status: "FAILED",
            summary: {
              error: `Failed to start background job: ${triggerError instanceof Error ? triggerError.message : String(triggerError)}`,
            },
          });

          // If Trigger.dev is not available, throw a more specific error
          throw new Error(
            `Failed to start background import job. Please ensure Trigger.dev dev server is running. Error: ${
              triggerError instanceof Error ? triggerError.message : String(triggerError)
            }`
          );
        }

        return {
          jobId: job.id,
          status: job.status,
          createdAt: job.startedAt,
        };
      } catch (error) {
        console.error("[startImport] Error occurred:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw wrapError(error, "Failed to start import job");
      }
    }),

  /**
   * NEW: Get import job status
   *
   * Query current status and progress of an import job.
   * Used for polling or to display status on import dashboard.
   */
  getImportStatus: brandRequiredProcedure
    .input(getImportStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        // Verify brand ownership
        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Extract progress from summary
        const summary = job.summary as Record<string, unknown> | null;
        const progress = {
          phase:
            job.status === "VALIDATING" || job.status === "VALIDATED"
              ? "validation"
              : "commit",
          total: (summary?.total as number) ?? 0,
          processed: (summary?.processed as number) ?? 0,
          created: (summary?.created as number) ?? 0,
          updated: (summary?.updated as number) ?? 0,
          failed: (summary?.failed as number) ?? 0,
          percentage: calculatePercentage(
            (summary?.processed as number) ?? 0,
            (summary?.total as number) ?? 0,
          ),
        };

        return {
          jobId: job.id,
          filename: job.filename,
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          progress,
          summary: job.summary,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get import status");
      }
    }),

  /**
   * NEW: Get import errors with pagination
   *
   * Retrieve detailed error information for failed rows in an import job.
   * Supports pagination for large error lists.
   */
  getImportErrors: brandRequiredProcedure
    .input(getImportErrorsSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Fetch paginated errors
        const result = await getImportErrors(
          brandCtx.db,
          input.jobId,
          input.limit,
          input.offset,
        );

        return {
          errors: result.errors.map((err) => ({
            rowNumber: err.rowNumber,
            rawData: err.raw,
            error: err.error ?? "Unknown error",
            field: null, // TODO: Extract field from error message
          })),
          totalErrors: result.total,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get import errors");
      }
    }),

  /**
   * NEW: Get staging preview with pagination
   *
   * Retrieves validated staging data for user review before approval.
   * Shows exactly what will be created/updated when approved.
   */
  getStagingPreview: brandRequiredProcedure
    .input(getStagingPreviewSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Get staging preview
        const preview = await getStagingPreview(
          brandCtx.db,
          input.jobId,
          input.limit,
          input.offset,
        );

        // Get action counts
        const counts = await countStagingProductsByAction(
          brandCtx.db,
          input.jobId,
        );

        return {
          stagingData: preview.products.map((p) => ({
            rowNumber: p.rowNumber,
            action: p.action,
            existingProductId: p.existingProductId,
            product: {
              name: p.name,
              description: p.description,
              categoryId: p.categoryId,
              season: p.season,
              primaryImageUrl: p.primaryImageUrl,
            },
            variant: p.variant
              ? {
                  upid: p.variant.upid,
                  sku: p.variant.sku,
                  colorId: p.variant.colorId,
                  sizeId: p.variant.sizeId,
                  productImageUrl: p.variant.productImageUrl,
                }
              : null,
          })),
          totalValid: preview.total,
          willCreate: counts.create,
          willUpdate: counts.update,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get staging preview");
      }
    }),

  /**
   * NEW: Get unmapped values needing definition
   *
   * Returns list of CSV values that don't have corresponding database entities.
   * User must define these before approval.
   */
  getUnmappedValues: brandRequiredProcedure
    .input(getUnmappedValuesSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Get unmapped values
        const result = await getUnmappedValuesForJob(brandCtx.db, input.jobId);

        return result;
      } catch (error) {
        throw wrapError(error, "Failed to get unmapped values");
      }
    }),

  /**
   * NEW: Define single value inline
   *
   * Creates a new catalog entity (material, color, size, etc.) during import review.
   * Updates value mapping and job summary.
   */
  defineValue: brandRequiredProcedure
    .input(defineValueSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Validate job status
        if (job.status !== "VALIDATED") {
          throw badRequest(
            `Cannot define values for job with status ${job.status}. Job must be VALIDATED.`,
          );
        }

        // Create the entity based on type
        const entity = await validateAndCreateEntity(
          brandCtx.db,
          brandId,
          input.entityType as "COLOR" | "SIZE" | "MATERIAL" | "ECO_CLAIM" | "FACILITY" | "SHOWCASE_BRAND" | "CERTIFICATION",
          input.entityData,
        );

        // Create value mapping
        await createValueMapping(brandCtx.db, {
          brandId,
          sourceColumn: input.sourceColumn,
          rawValue: input.rawValue,
          target: input.entityType as "COLOR" | "SIZE" | "MATERIAL" | "ECO_CLAIM" | "FACILITY" | "SHOWCASE_BRAND" | "CERTIFICATION",
          targetId: entity.id,
        });

        // Update job summary to remove from pending_approval
        const summary = (job.summary as Record<string, unknown>) ?? {};
        const pendingApproval = (summary.pending_approval as unknown[]) ?? [];
        const approvedValues = (summary.approved_values as unknown[]) ?? [];

        // Filter out the value we just defined
        const updatedPending = pendingApproval.filter((item) => {
          const val = item as { name: string; type: string };
          return !(
            val.name === input.rawValue && val.type === input.entityType
          );
        });

        // Add to approved values
        approvedValues.push({
          type: input.entityType,
          name: input.rawValue,
          entityId: entity.id,
        });

        await updateImportJobProgress(brandCtx.db, {
          jobId: input.jobId,
          summary: {
            ...summary,
            pending_approval: updatedPending,
            approved_values: approvedValues,
          },
        });

        const remainingUnmapped = updatedPending.length;

        return {
          success: true,
          entityId: entity.id,
          entityType: input.entityType,
          name: input.rawValue,
          valueMappingId: entity.id, // Placeholder - we'd need to return the actual mapping ID
          remainingUnmapped,
        };
      } catch (error) {
        throw wrapError(error, "Failed to define value");
      }
    }),

  /**
   * NEW: Batch define multiple values
   *
   * Creates multiple catalog entities at once.
   * Useful for bulk approval of simple entities.
   */
  batchDefineValues: brandRequiredProcedure
    .input(batchDefineValuesSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Validate job status
        if (job.status !== "VALIDATED") {
          throw badRequest(
            `Cannot define values for job with status ${job.status}. Job must be VALIDATED.`,
          );
        }

        const created: Array<{
          entityId: string;
          entityType: string;
          name: string;
        }> = [];
        const failed: Array<{ rawValue: string; error: string }> = [];

        // Process each value
        for (const value of input.values) {
          try {
            // Create the entity
            const entity = await validateAndCreateEntity(
              brandCtx.db,
              brandId,
              value.entityType as "COLOR" | "SIZE" | "MATERIAL" | "ECO_CLAIM" | "FACILITY" | "SHOWCASE_BRAND" | "CERTIFICATION",
              value.entityData,
            );

            // Create value mapping
            await createValueMapping(brandCtx.db, {
              brandId,
              sourceColumn: value.sourceColumn,
              rawValue: value.rawValue,
              target: value.entityType as "COLOR" | "SIZE" | "MATERIAL" | "ECO_CLAIM" | "FACILITY" | "SHOWCASE_BRAND" | "CERTIFICATION",
              targetId: entity.id,
            });

            created.push({
              entityId: entity.id,
              entityType: value.entityType,
              name: value.rawValue,
            });
          } catch (err) {
            failed.push({
              rawValue: value.rawValue,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        // Update job summary
        const summary = (job.summary as Record<string, unknown>) ?? {};
        const pendingApproval = (summary.pending_approval as unknown[]) ?? [];
        const approvedValues = (summary.approved_values as unknown[]) ?? [];

        // Filter out successfully created values from pending
        const createdNames = new Set(created.map((c) => c.name));
        const updatedPending = pendingApproval.filter((item) => {
          const val = item as { name: string };
          return !createdNames.has(val.name);
        });

        // Add all created values to approved
        approvedValues.push(...created);

        await updateImportJobProgress(brandCtx.db, {
          jobId: input.jobId,
          summary: {
            ...summary,
            pending_approval: updatedPending,
            approved_values: approvedValues,
          },
        });

        return {
          success: true,
          created,
          failed,
          remainingUnmapped: updatedPending.length,
        };
      } catch (error) {
        throw wrapError(error, "Failed to batch define values");
      }
    }),

  /**
   * NEW: Export failed rows as CSV
   *
   * Generates a downloadable CSV file containing all failed rows
   * with their original data and error messages.
   */
  exportFailedRows: brandRequiredProcedure
    .input(exportFailedRowsSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Get failed rows
        const failedRows = await getFailedRowsForExport(
          brandCtx.db,
          input.jobId,
        );

        if (failedRows.length === 0) {
          return {
            csv: "",
            filename: `failed-rows-${input.jobId}.csv`,
            totalRows: 0,
          };
        }

        // Prepare data for CSV generation
        const rows = failedRows.map((row) => ({
          ...row.raw,
          error_message: row.error ?? "Unknown error",
        }));

        // Generate CSV
        const csv = generateCSV(rows);

        return {
          csv,
          filename: `failed-rows-${input.jobId}.csv`,
          totalRows: failedRows.length,
        };
      } catch (error) {
        throw wrapError(error, "Failed to export failed rows");
      }
    }),

  /**
   * NEW: Approve import job (trigger Phase 2)
   *
   * Validates that:
   * 1. Job is in VALIDATED status
   * 2. All unmapped values have been defined
   * 3. Staging data exists
   *
   * Then triggers Phase 2 background job to commit staging data to production.
   * Returns immediately while background job processes the commit.
   */
  approveImport: brandRequiredProcedure
    .input(approveImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership and get current status
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Validate job status - only VALIDATED jobs can be approved
        if (job.status !== "VALIDATED") {
          throw badRequest(
            `Cannot approve job with status ${job.status}. Job must be in VALIDATED status.`,
          );
        }

        // Check that all unmapped values have been defined
        const summary = (job.summary as Record<string, unknown>) ?? {};
        const pendingApproval = (summary.pending_approval as unknown[]) ?? [];

        if (pendingApproval.length > 0) {
          throw badRequest(
            `Cannot approve import: ${pendingApproval.length} unmapped values still need to be defined. Please define all values before approval.`,
          );
        }

        // Verify staging data exists
        const counts = await countStagingProductsByAction(
          brandCtx.db,
          input.jobId,
        );

        if (counts.create === 0 && counts.update === 0) {
          throw badRequest(
            "Cannot approve import: no staging data found. The import may have been cancelled or corrupted.",
          );
        }

        // Update job status to COMMITTING
        await updateImportJobStatus(brandCtx.db, {
          jobId: input.jobId,
          status: "COMMITTING",
        });

        // Trigger Phase 2 background job (commit-to-production)
        console.log("[approveImport] Triggering commit-to-production job", {
          jobId: input.jobId,
          brandId,
        });

        try {
          const runHandle = await tasks.trigger("commit-to-production", {
            jobId: input.jobId,
            brandId,
          });

          console.log("[approveImport] Commit job triggered successfully", {
            triggerRunId: runHandle.id,
          });
        } catch (triggerError) {
          console.error("[approveImport] Failed to trigger commit job:", {
            error: triggerError,
            errorMessage: triggerError instanceof Error ? triggerError.message : String(triggerError),
          });
          
          // Rollback status if trigger fails
          await updateImportJobStatus(brandCtx.db, {
            jobId: input.jobId,
            status: "VALIDATED",
          });
          
          throw wrapError(triggerError, "Failed to start commit process");
        }

        return {
          jobId: input.jobId,
          status: "COMMITTING" as const,
          message: "Import approved - committing to production",
        };
      } catch (error) {
        throw wrapError(error, "Failed to approve import");
      }
    }),

  /**
   * NEW: Cancel import job
   *
   * Discards staging data and marks job as CANCELLED.
   * Can only cancel jobs in VALIDATED status (before commit starts).
   */
  cancelImport: brandRequiredProcedure
    .input(cancelImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership and get current status
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Validate job status - only VALIDATED jobs can be cancelled
        if (job.status !== "VALIDATED") {
          throw badRequest(
            `Cannot cancel job with status ${job.status}. Only jobs in VALIDATED status can be cancelled.`,
          );
        }

        // Delete staging data for this job (cascades to all related tables)
        await deleteStagingDataForJob(brandCtx.db, input.jobId);

        // Update job status to CANCELLED
        await updateImportJobStatus(brandCtx.db, {
          jobId: input.jobId,
          status: "CANCELLED",
        });

        return {
          jobId: input.jobId,
          status: "CANCELLED" as const,
          message: "Import cancelled - staging data discarded",
        };
      } catch (error) {
        throw wrapError(error, "Failed to cancel import");
      }
    }),
});

/**
 * Calculate percentage with safe division
 */
function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

export type BulkRouter = typeof bulkRouter;
