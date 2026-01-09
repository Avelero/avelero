import { tasks } from "@trigger.dev/sdk/v3";
/**
 * Bulk import lifecycle router.
 *
 * Handles the fire-and-forget import workflow:
 * - start: Create job and trigger background processing
 * - status: Get real-time job progress
 * - getRecentImports: Get recent import jobs for the brand
 * - dismiss: Clean up staging data for failed imports
 * - exportCorrections: Generate Excel file with failed rows for correction
 */
import {
  createImportJob,
  deleteStagingDataForJob,
  getImportJobStatus,
  getRecentImportJobs,
  updateImportJobStatus,
} from "@v1/db/queries/bulk";
import { downloadImportFile } from "@v1/supabase/utils/product-imports";
import {
  normalizeHeader,
  normalizeHeaders,
  parseFile,
} from "../../../lib/csv-parser.js";
import {
  dismissFailedImportSchema,
  exportCorrectionsSchema,
  getImportStatusSchema,
  getRecentImportsSchema,
  startImportSchema,
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
        // Create import job record with mode
        console.log("[import.start] Creating import job...");
        const job = await createImportJob(brandCtx.db, {
          brandId,
          filename: input.filename,
          status: "PENDING",
          mode: input.mode,
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
              mode: input.mode,
            },
          );

          const runHandle = await tasks.trigger("validate-and-stage", {
            jobId: job.id,
            brandId,
            filePath: resolvedFile.path,
            mode: input.mode,
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
   * Get recent import jobs
   *
   * Returns the most recent import jobs for the active brand.
   * Used to display import history in the import modal.
   */
  getRecentImports: brandRequiredProcedure
    .input(getRecentImportsSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        const jobs = await getRecentImportJobs(brandCtx.db, brandId, input.limit);

        return {
          jobs: jobs.map((job) => ({
            id: job.id,
            filename: job.filename,
            mode: job.mode,
            status: job.status,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            hasExportableFailures: job.hasExportableFailures,
            summary: job.summary,
          })),
        };
      } catch (error) {
        throw wrapError(error, "Failed to get recent imports");
      }
    }),

  /**
   * Dismiss a failed import
   *
   * Cleans up staging data for a failed import and removes it
   * from the actionable imports list. Use this when the user
   * doesn't want to fix and re-import the failed rows.
   */
  dismiss: brandRequiredProcedure
    .input(dismissFailedImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Only allow dismissing jobs with failures or failed jobs
        const dismissableStatuses = ["COMPLETED_WITH_FAILURES", "FAILED"];
        if (!dismissableStatuses.includes(job.status)) {
          throw badRequest(
            `Cannot dismiss job with status ${job.status}. Only jobs with failures can be dismissed.`,
          );
        }

        // Delete staging data for this job
        await deleteStagingDataForJob(brandCtx.db, input.jobId);

        // Update job to mark as dismissed (clear the exportable failures flag)
        await updateImportJobStatus(brandCtx.db, {
          jobId: input.jobId,
          status: job.status, // Keep the same status
          summary: {
            ...(job.summary ?? {}),
            dismissed: true,
            dismissedAt: new Date().toISOString(),
          },
        });

        return {
          jobId: input.jobId,
          success: true,
          message: "Import dismissed - staging data cleaned up",
        };
      } catch (error) {
        throw wrapError(error, "Failed to dismiss import");
      }
    }),

  /**
   * Export corrections Excel file
   *
   * Generates an Excel file containing failed rows with error cells
   * highlighted in red. Users can correct the data and re-import.
   *
   * Note: The actual Excel generation is handled by a background job.
   * This endpoint triggers the generation and returns a download URL.
   */
  exportCorrections: brandRequiredProcedure
    .input(exportCorrectionsSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Check that job has exportable failures
        if (!job.hasExportableFailures) {
          throw badRequest(
            "No failed rows to export. This job completed successfully or has no exportable failures.",
          );
        }

        // TODO: Phase 3 will implement the actual Excel generation
        // For now, return a placeholder indicating the feature is not yet implemented
        return {
          jobId: input.jobId,
          status: "pending" as const,
          message: "Excel export will be implemented in Phase 3",
          downloadUrl: null,
        };
      } catch (error) {
        throw wrapError(error, "Failed to export corrections");
      }
    }),
});

export type ImportRouter = typeof importRouter;
