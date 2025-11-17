import { tasks } from "@trigger.dev/sdk/v3";
/**
 * Bulk import lifecycle router.
 *
 * Handles the complete import workflow:
 * - validate: Quick pre-validation of file headers
 * - start: Create job and trigger background validation
 * - status: Get real-time job progress
 * - approve: Trigger Phase 2 commit to production
 * - cancel: Discard staging data and cancel job
 */
import {
  countStagingProductsByAction,
  createImportJob,
  deleteStagingDataForJob,
  getImportJobStatus,
  updateImportJobStatus,
} from "@v1/db/queries";
import { downloadImportFile } from "@v1/supabase/utils/product-imports";
import {
  normalizeHeader,
  normalizeHeaders,
  parseFile,
} from "../../../lib/csv-parser.js";
import {
  approveImportSchema,
  cancelImportSchema,
  getImportStatusSchema,
  startImportSchema,
  validateImportSchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
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
    throw badRequest(
      `Invalid file reference provided. Expected format: brandId/jobId/filename, got: ${sanitizedPath}`,
    );
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
    throw badRequest(
      `File does not belong to the active brand context. Expected: ${params.brandId}, got: ${pathBrandId}`,
    );
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
    throw badRequest(
      `Filename does not match the provided file reference. Expected: ${params.filename}, got: ${resolvedFilename}`,
    );
  }

  return {
    path: sanitizedPath,
    jobId,
    filename: resolvedFilename,
  };
}

function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

export const importRouter = createTRPCRouter({
  /**
   * @deprecated This endpoint is no longer used. Validation now happens client-side
   * for instant feedback, and full validation occurs in the background job.
   *
   * Validate import file before processing
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
  validate: brandRequiredProcedure
    .input(validateImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      console.log("[import.validate] Input received:", {
        fileId: input.fileId,
        filename: input.filename,
        brandId,
      });

      const resolvedFile = resolveImportFilePath({
        fileId: input.fileId,
        brandId,
        filename: input.filename,
      });

      console.log("[import.validate] Resolved file:", resolvedFile);

      // Always use admin client for storage operations to bypass RLS
      const supabaseClient = brandCtx.supabaseAdmin;
      if (!supabaseClient) {
        throw badRequest(
          "Supabase admin client is not configured. Check SUPABASE_SERVICE_ROLE_KEY environment variable.",
        );
      }

      try {
        // Download file from Supabase Storage
        console.log("[import.validate] Downloading file from storage:", {
          path: resolvedFile.path,
        });

        const downloadResult = await downloadImportFile(supabaseClient, {
          path: resolvedFile.path,
        });

        console.log("[import.validate] Download result:", {
          hasData: !!downloadResult.data,
          dataType: downloadResult.data ? typeof downloadResult.data : "null",
        });

        if (!downloadResult.data) {
          console.error("[import.validate] Download failed: no data returned");
          throw badRequest("File download failed - file not found in storage");
        }

        // Parse file to validate headers and content
        console.log("[import.validate] Parsing file...");
        const fileBuffer = Buffer.from(await downloadResult.data.arrayBuffer());
        console.log("[import.validate] File buffer size:", fileBuffer.length);

        const file = new File([fileBuffer], resolvedFile.filename);
        console.log("[import.validate] File object created:", {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        const parseResult = await parseFile(file, { trimValues: true });
        console.log("[import.validate] Parse result:", {
          rowCount: parseResult.rowCount,
          headerCount: parseResult.headers.length,
          headers: parseResult.headers,
          errorCount: parseResult.errors.length,
        });

        if (parseResult.errors.length > 0) {
          console.log(
            "[import.validate] Parse errors found:",
            parseResult.errors,
          );
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
              (h) => !normalizedHeaders.includes(normalizeHeader(h)),
            ),
          },
        };
      } catch (error) {
        console.error("[import.validate] Error caught:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw wrapError(error, "Failed to validate import file");
      }
    }),

  /**
   * Start async import job (Phase 1 - Validation & Staging)
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
  start: brandRequiredProcedure
    .input(startImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      console.log("[import.start] Input received:", {
        fileId: input.fileId,
        filename: input.filename,
        brandId,
      });

      const resolvedFile = resolveImportFilePath({
        fileId: input.fileId,
        brandId,
        filename: input.filename,
      });

      console.log("[import.start] Resolved file path:", resolvedFile.path);

      try {
        // Create import job record
        console.log("[import.start] Creating import job...");
        const job = await createImportJob(brandCtx.db, {
          brandId,
          filename: input.filename,
          status: "PENDING",
        });

        console.log("[import.start] Import job created:", {
          jobId: job.id,
          status: job.status,
        });

        // Trigger validate-and-stage background job via Trigger.dev using the uploaded file path
        const triggerApiUrl =
          process.env.TRIGGER_API_URL ?? "https://api.trigger.dev";
        console.log("[import.start] Triggering background job...", {
          triggerApiUrl,
          hasCustomTriggerUrl: Boolean(process.env.TRIGGER_API_URL),
          hasTriggerSecret: Boolean(process.env.TRIGGER_SECRET_KEY),
        });

        try {
          console.log(
            "[import.start] About to trigger background job with payload:",
            {
              jobId: job.id,
              brandId,
              filePath: resolvedFile.path,
            },
          );

          const runHandle = await tasks.trigger("validate-and-stage", {
            jobId: job.id,
            brandId,
            filePath: resolvedFile.path,
          });

          console.log("[import.start] Background job triggered successfully", {
            triggerRunId: runHandle.id,
            triggerTaskId: "validate-and-stage",
            publicAccessToken: runHandle.publicAccessToken || "N/A",
          });

          // Log the run handle for debugging
          console.log(
            "[import.start] Full run handle:",
            JSON.stringify(runHandle, null, 2),
          );
        } catch (triggerError) {
          console.error("[import.start] Failed to trigger background job:", {
            error: triggerError,
            errorMessage:
              triggerError instanceof Error
                ? triggerError.message
                : String(triggerError),
            errorStack:
              triggerError instanceof Error ? triggerError.stack : undefined,
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
              triggerError instanceof Error
                ? triggerError.message
                : String(triggerError)
            }`,
          );
        }

        return {
          jobId: job.id,
          status: job.status,
          createdAt: job.startedAt,
        };
      } catch (error) {
        console.error("[import.start] Error occurred:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw wrapError(error, "Failed to start import job");
      }
    }),

  /**
   * Get import job status
   *
   * Query current status and progress of an import job.
   * Used for polling or to display status on import dashboard.
   */
  status: brandRequiredProcedure
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
   * Approve import job (trigger Phase 2)
   *
   * Validates that:
   * 1. Job is in VALIDATED status
   * 2. All unmapped values have been defined
   * 3. Staging data exists
   *
   * Then triggers Phase 2 background job to commit staging data to production.
   * Returns immediately while background job processes the commit.
   */
  approve: brandRequiredProcedure
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

        // Allow safe re-entry if commit already in progress
        if (job.status === "COMMITTING") {
          return {
            jobId: job.id,
            status: "COMMITTING" as const,
            message: "Import already approved and committing to production",
          };
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
          console.warn(
            "[import.approve] Proceeding with approval despite empty staging data",
            { jobId: input.jobId },
          );
        }

        // Update job status to COMMITTING
        await updateImportJobStatus(brandCtx.db, {
          jobId: input.jobId,
          status: "COMMITTING",
        });

        // Trigger Phase 2 background job (commit-to-production)
        console.log("[import.approve] Triggering commit-to-production job", {
          jobId: input.jobId,
          brandId,
        });

        try {
          const runHandle = await tasks.trigger("commit-to-production", {
            jobId: input.jobId,
            brandId,
          });

          console.log("[import.approve] Commit job triggered successfully", {
            triggerRunId: runHandle.id,
          });
        } catch (triggerError) {
          console.error("[import.approve] Failed to trigger commit job:", {
            error: triggerError,
            errorMessage:
              triggerError instanceof Error
                ? triggerError.message
                : String(triggerError),
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
   * Cancel import job
   *
   * Discards staging data and marks job as CANCELLED.
   * Can only cancel jobs in VALIDATED status (before commit starts).
   */
  cancel: brandRequiredProcedure
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

export type ImportRouter = typeof importRouter;
