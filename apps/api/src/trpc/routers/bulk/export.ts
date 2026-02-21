/**
 * Bulk export router implementation.
 *
 * Handles the product export workflow:
 * - start: Create export job and trigger background processing
 * - status: Get real-time job progress and download URL when complete
 */
import { auth, tasks } from "@trigger.dev/sdk/v3";
import {
  createExportJob,
  getExportJobStatus,
  updateExportJobStatus,
} from "@v1/db/queries/bulk";

import {
  getExportStatusSchema,
  startExportSchema,
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

/**
 * Calculate percentage for progress display
 */
function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

export const exportRouter = createTRPCRouter({
  /**
   * Start a product export job
   *
   * Creates export job record and triggers background processing.
   * Returns job ID for status tracking.
   */
  start: brandRequiredProcedure
    .input(startExportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrand(ctx);

      const brandId = brandCtx.brandId;
      const userId = ctx.user.id;
      const userEmail = ctx.user.email;

      if (!userEmail) {
        throw badRequest("User email is required for export notifications");
      }

      try {
        // Extract selection data
        const selectionMode = input.selection.mode;
        const includeIds =
          selectionMode === "explicit" ? input.selection.includeIds : [];
        const excludeIds =
          selectionMode === "all" ? input.selection.excludeIds ?? [] : [];

        // Create export job record
        const job = await createExportJob(brandCtx.db, {
          brandId,
          userId,
          userEmail,
          selectionMode,
          includeIds,
          excludeIds,
          filterState: input.filterState ?? null,
          searchQuery: input.search ?? null,
          status: "PENDING",
        });

        // Trigger background job - failure here should mark job as FAILED
        let handle: Awaited<ReturnType<typeof tasks.trigger>>;
        try {
          handle = await tasks.trigger("export-products", {
            jobId: job.id,
            brandId,
            userId,
            userEmail,
            selectionMode,
            includeIds,
            excludeIds,
            filterState: input.filterState ?? null,
            searchQuery: input.search ?? null,
          });
        } catch (triggerError) {
          // Update job status to FAILED - the trigger itself failed
          await updateExportJobStatus(brandCtx.db, {
            jobId: job.id,
            status: "FAILED",
            summary: {
              error: `Failed to start background job: ${
                triggerError instanceof Error
                  ? triggerError.message
                  : String(triggerError)
              }`,
            },
          });

          throw new Error(
            `Failed to start background export job. Please ensure Trigger.dev dev server is running. Error: ${
              triggerError instanceof Error
                ? triggerError.message
                : String(triggerError)
            }`,
          );
        }

        // Generate a public access token for realtime updates
        // Token creation failure should NOT mark the job as failed since
        // the background job is already running successfully
        let publicToken: string | null = null;
        try {
          publicToken = await auth.createPublicToken({
            scopes: {
              read: { runs: [handle.id] },
            },
          });
        } catch {
          // Token creation failed but job is still running - client can poll instead
          console.warn(
            `Failed to create public token for export job ${job.id}, client will need to poll`,
          );
        }

        return {
          jobId: job.id,
          status: job.status,
          createdAt: job.startedAt,
          runId: handle.id,
          publicAccessToken: publicToken,
        };
      } catch (error) {
        throw wrapError(error, "Failed to start export job");
      }
    }),

  /**
   * Get export job status
   *
   * Returns current status, progress, and download URL when ready.
   * Used for polling from the export modal.
   */
  status: brandRequiredProcedure
    .input(getExportStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrand(ctx);

      const brandId = brandCtx.brandId;

      try {
        const job = await getExportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Export job not found");
        }

        // Verify brand ownership
        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        return {
          jobId: job.id,
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          progress: {
            total: job.totalProducts ?? 0,
            processed: job.productsProcessed ?? 0,
            percentage: calculatePercentage(
              job.productsProcessed ?? 0,
              job.totalProducts ?? 0,
            ),
          },
          downloadUrl: job.downloadUrl,
          expiresAt: job.expiresAt,
          summary: job.summary,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get export status");
      }
    }),
});

type ExportRouter = typeof exportRouter;
