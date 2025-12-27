/**
 * Integration sync router.
 *
 * Handles sync operations:
 * - Trigger manual sync
 * - View sync history
 * - Get current sync status
 *
 * @module trpc/routers/integrations/sync
 */
import { tasks } from "@trigger.dev/sdk/v3";
import {
  getBrandIntegration,
  getLatestSyncJob,
  getSyncJob,
  listSyncJobs,
  updateSyncJob,
} from "@v1/db/queries/integrations";
import {
  getSyncJobSchema,
  getSyncStatusSchema,
  listSyncHistorySchema,
  triggerSyncSchema,
} from "../../../schemas/integrations.js";
import { badRequest, notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Sync sub-router for integration synchronization.
 *
 * Endpoints:
 * - trigger: Manually trigger a sync job
 * - history: List past sync jobs
 * - status: Get current sync status
 * - getJob: Get details of a specific sync job
 */
export const syncRouter = createTRPCRouter({
  /**
   * Manually trigger a sync for an integration.
   *
   * Creates a new sync job with "manual" trigger type.
   * The actual sync is executed by a background job (Phase 4).
   *
   * Prevents triggering if:
   * - Integration is not active
   * - A sync is already in progress
   */
  trigger: brandRequiredProcedure
    .input(triggerSyncSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the brand integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Check integration is active
        if (integration.status !== "active") {
          throw badRequest(
            `Cannot sync integration with status "${integration.status}". Activate the integration first.`,
          );
        }

        // Check if a sync is already in progress
        const latestJob = await getLatestSyncJob(
          brandCtx.db,
          input.brand_integration_id,
        );
        
        if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
          // Check if the job is stale (older than 10 minutes)
          // This handles cases where Trigger.dev tasks timed out but DB wasn't updated
          const jobAge = Date.now() - new Date(latestJob.createdAt).getTime();
          const staleThresholdMs = 10 * 60 * 1000; // 10 minutes
          
          if (jobAge > staleThresholdMs) {
            // Mark the stale job as failed
            await updateSyncJob(brandCtx.db, latestJob.id, {
              status: "failed",
              finishedAt: new Date().toISOString(),
              errorSummary: "Job timed out or was interrupted",
            });
          } else {
            throw badRequest(
              "A sync is already in progress. Please wait for it to complete.",
            );
          }
        }

        // Trigger the background sync task
        // The task will create its own sync job record
        const handle = await tasks.trigger("sync-integration", {
          brandIntegrationId: input.brand_integration_id,
          brandId: brandCtx.brandId,
          triggerType: "manual",
        });

        return createEntityResponse({
          id: handle.id,
          status: "triggered",
          message: "Sync job triggered successfully",
        });
      } catch (error) {
        throw wrapError(error, "Failed to trigger sync");
      }
    }),

  /**
   * List sync job history for an integration.
   *
   * Returns past sync jobs with stats and status.
   * Most recent jobs first.
   */
  history: brandRequiredProcedure
    .input(listSyncHistorySchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the brand integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        const jobs = await listSyncJobs(brandCtx.db, input.brand_integration_id, {
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
        });

        return createListResponse(jobs);
      } catch (error) {
        throw wrapError(error, "Failed to list sync history");
      }
    }),

  /**
   * Get current sync status for an integration.
   *
   * Returns:
   * - Whether a sync is currently running
   * - Latest sync job info (if any)
   * - Time until next scheduled sync
   */
  status: brandRequiredProcedure
    .input(getSyncStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Get the integration with sync info
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Get the latest sync job
        const latestJob = await getLatestSyncJob(
          brandCtx.db,
          input.brand_integration_id,
        );

        // Check if the job is stale (older than 2 minutes with no progress, or 5 minutes total)
        // This handles cases where Trigger.dev tasks were cancelled/crashed but DB wasn't updated
        if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
          const jobAge = Date.now() - new Date(latestJob.createdAt).getTime();
          const lastUpdate = latestJob.updatedAt ? new Date(latestJob.updatedAt).getTime() : new Date(latestJob.createdAt).getTime();
          const timeSinceUpdate = Date.now() - lastUpdate;
          
          const staleNoProgressMs = 2 * 60 * 1000; // 2 minutes with no progress
          const staleAbsoluteMs = 5 * 60 * 1000; // 5 minutes absolute max
          
          if (timeSinceUpdate > staleNoProgressMs || jobAge > staleAbsoluteMs) {
            // Mark the stale job as cancelled
            await updateSyncJob(brandCtx.db, latestJob.id, {
              status: "cancelled",
              finishedAt: new Date().toISOString(),
              errorSummary: "Job was cancelled or timed out",
            });
            latestJob.status = "cancelled";
            latestJob.finishedAt = new Date().toISOString();
            latestJob.errorSummary = "Job was cancelled or timed out";
          }
        }

        // Calculate next sync time
        let nextSyncAt: string | null = null;
        if (integration.status === "active" && integration.lastSyncAt) {
          const lastSync = new Date(integration.lastSyncAt);
          const nextSync = new Date(
            lastSync.getTime() + integration.syncInterval * 1000,
          );
          nextSyncAt = nextSync.toISOString();
        }

        // Determine if sync is in progress
        const isSyncing =
          latestJob?.status === "pending" || latestJob?.status === "running";

        return createEntityResponse({
          integrationStatus: integration.status,
          lastSyncAt: integration.lastSyncAt,
          syncInterval: integration.syncInterval,
          nextSyncAt,
          isSyncing,
          latestJob: latestJob
            ? {
                id: latestJob.id,
                status: latestJob.status,
                triggerType: latestJob.triggerType,
                startedAt: latestJob.startedAt,
                finishedAt: latestJob.finishedAt,
                productsTotal: latestJob.productsTotal,
                productsProcessed: latestJob.productsProcessed,
                productsCreated: latestJob.productsCreated,
                productsUpdated: latestJob.productsUpdated,
                productsFailed: latestJob.productsFailed,
                productsSkipped: latestJob.productsSkipped,
                errorSummary: latestJob.errorSummary,
              }
            : null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to get sync status");
      }
    }),

  /**
   * Get details of a specific sync job.
   *
   * Includes the full error log (if any) for debugging.
   */
  getJob: brandRequiredProcedure
    .input(getSyncJobSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const job = await getSyncJob(brandCtx.db, input.id);
        if (!job) {
          throw notFound("Sync job", input.id);
        }

        // Verify the job belongs to an integration owned by this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          job.brandIntegrationId,
        );
        if (!integration) {
          throw notFound("Sync job", input.id);
        }

        return createEntityResponse(job);
      } catch (error) {
        throw wrapError(error, "Failed to get sync job");
      }
    }),
});

export type SyncRouter = typeof syncRouter;
