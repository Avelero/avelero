/**
 * Bulk QR export router implementation.
 *
 * Handles the QR export workflow:
 * - start: Create QR export job and trigger background processing
 * - status: Get real-time job progress and download URL when complete
 */
import { auth, tasks } from "@trigger.dev/sdk/v3";
import {
  createQrExportJob,
  getQrExportJobStatus,
  getQrExportSelectionSummary,
  resolveQrExportProductIds,
  updateQrExportJobStatus,
} from "@v1/db/queries";
import { eq } from "@v1/db/queries";
import { brandCustomDomains } from "@v1/db/schema";
import {
  getQrExportStatusSchema,
  startQrExportSchema,
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
 * Calculate percentage for progress display.
 */
function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

/**
 * Get verified custom domain for a brand, if configured.
 */
async function getVerifiedCustomDomain(
  db: BrandContext["db"],
  brandId: string,
): Promise<string | null> {
  const [domain] = await db
    .select({
      domain: brandCustomDomains.domain,
      status: brandCustomDomains.status,
    })
    .from(brandCustomDomains)
    .where(eq(brandCustomDomains.brandId, brandId))
    .limit(1);

  if (!domain || domain.status !== "verified") {
    return null;
  }

  return domain.domain;
}

export const qrExportRouter = createTRPCRouter({
  /**
   * Start a QR export job.
   */
  start: brandRequiredProcedure
    .input(startQrExportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrand(ctx);

      const brandId = brandCtx.brandId;
      const userId = ctx.user.id;
      const userEmail = ctx.user.email;

      if (!userEmail) {
        throw badRequest("User email is required for export notifications");
      }

      const selectionMode = input.selection.mode;
      const includeIds =
        selectionMode === "explicit" ? input.selection.includeIds : [];
      const excludeIds =
        selectionMode === "all" ? input.selection.excludeIds ?? [] : [];

      try {
        const verifiedDomain = await getVerifiedCustomDomain(brandCtx.db, brandId);
        if (!verifiedDomain) {
          throw badRequest(
            "A verified custom domain is required to export GS1 QR codes.",
          );
        }

        const productIds = await resolveQrExportProductIds(brandCtx.db, brandId, {
          selectionMode,
          includeIds,
          excludeIds,
          filterState: input.filterState ?? null,
          searchQuery: input.search ?? null,
        });

        const summary = await getQrExportSelectionSummary(
          brandCtx.db,
          brandId,
          productIds,
        );
        if (summary.variantsWithBarcode === 0) {
          throw badRequest(
            "No eligible variants found. QR export requires at least one variant with a barcode.",
          );
        }

        const job = await createQrExportJob(brandCtx.db, {
          brandId,
          userId,
          userEmail,
          selectionMode,
          includeIds,
          excludeIds,
          filterState: input.filterState ?? null,
          searchQuery: input.search ?? null,
          customDomain: verifiedDomain,
          totalProducts: summary.selectedProducts,
          totalVariants: summary.selectedVariants,
          eligibleVariants: summary.variantsWithBarcode,
          status: "PENDING",
        });

        let handle: Awaited<ReturnType<typeof tasks.trigger>>;
        try {
          handle = await tasks.trigger("export-qr-codes", {
            jobId: job.id,
            brandId,
          });
        } catch (triggerError) {
          await updateQrExportJobStatus(brandCtx.db, {
            jobId: job.id,
            status: "FAILED",
            finishedAt: new Date().toISOString(),
            summary: {
              error: `Failed to start background job: ${
                triggerError instanceof Error
                  ? triggerError.message
                  : String(triggerError)
              }`,
            },
          });

          throw new Error(
            `Failed to start background QR export job. Please ensure Trigger.dev dev server is running. Error: ${
              triggerError instanceof Error
                ? triggerError.message
                : String(triggerError)
            }`,
          );
        }

        let publicToken: string | null = null;
        try {
          publicToken = await auth.createPublicToken({
            scopes: {
              read: { runs: [handle.id] },
            },
          });
        } catch {
          console.warn(
            `Failed to create public token for QR export job ${job.id}, client will need to poll`,
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
        throw wrapError(error, "Failed to start QR export job");
      }
    }),

  /**
   * Get QR export job status.
   */
  status: brandRequiredProcedure
    .input(getQrExportStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrand(ctx);

      const brandId = brandCtx.brandId;

      try {
        const job = await getQrExportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("QR export job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        const total = job.eligibleVariants ?? 0;
        const processed = job.variantsProcessed ?? 0;

        return {
          jobId: job.id,
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          progress: {
            total,
            processed,
            percentage: calculatePercentage(processed, total),
          },
          downloadUrl: job.downloadUrl,
          expiresAt: job.expiresAt,
          summary: job.summary,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get QR export status");
      }
    }),
});

type QrExportRouter = typeof qrExportRouter;
