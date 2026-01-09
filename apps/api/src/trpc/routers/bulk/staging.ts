/**
 * Bulk import staging operations router.
 *
 * Handles staging data operations:
 * - reviewSummary: Get comprehensive review data in a single request
 * - preview: View validated staging data with pagination and filtering
 * - errors: Get paginated list of validation errors
 */
import {
  countStagingProductsByAction,
  getImportErrors,
  getImportJobStatus,
  getStagingPreview,
} from "@v1/db/queries/bulk";
import {
  exportFailedRowsSchema,
  getImportErrorsSchema,
  getStagingPreviewSchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

export const stagingRouter = createTRPCRouter({
  /**
   * Get comprehensive review data in a single request
   *
   * Optimized endpoint that fetches all necessary data for the review dialog:
   * - Job status and summary
   * - First page of staging preview
   * - First page of errors
   * - Summary statistics
   *
   * This reduces multiple round-trips to a single efficient query.
   */
  reviewSummary: brandRequiredProcedure
    .input(exportFailedRowsSchema) // Reuse schema (just needs jobId)
    .query(async ({ ctx, input }) => {
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

        // Fetch all data in parallel for maximum efficiency
        const [preview, errors, counts] = await Promise.all([
          getStagingPreview(brandCtx.db, input.jobId, 100, 0),
          getImportErrors(brandCtx.db, input.jobId, 50, 0),
          countStagingProductsByAction(brandCtx.db, input.jobId),
        ]);

        return {
          jobId: input.jobId,
          status: job.status,
          summary: {
            total: (job.summary as any)?.total ?? 0,
            valid: counts.create + counts.update,
            invalid: errors.total,
            will_create: counts.create,
            will_update: counts.update,
            pending_approval: (job.summary as any)?.pending_approval ?? [],
          },
          previewData: {
            rows: preview.products.map((p) => ({
              rowNumber: p.rowNumber,
              action: p.action,
              existingProductId: p.existingProductId,
              // Per-row status and errors (new in fire-and-forget flow)
              rowStatus: p.variant?.rowStatus ?? "PENDING",
              errors: p.variant?.errors ?? [],
              product: {
                name: p.name,
                description: p.description,
                categoryId: p.categoryId,
                seasonId: p.seasonId,
                imagePath: p.imagePath,
              },
              variant: p.variant
                ? {
                    upid: p.variant.upid,
                    barcode: p.variant.barcode,
                    sku: p.variant.sku,
                  }
                : null,
            })),
            total: preview.total,
          },
          errorsData: {
            errors: errors.errors.map((err) => ({
              rowNumber: err.rowNumber,
              rawData: err.raw,
              error: err.error ?? "Unknown error",
              field: null,
            })),
            total: errors.total,
          },
        };
      } catch (error) {
        throw wrapError(error, "Failed to get review summary");
      }
    }),

  /**
   * Get staging preview with pagination
   *
   * Retrieves validated staging data for user review before approval.
   * Shows exactly what will be created/updated when approved.
   */
  preview: brandRequiredProcedure
    .input(getStagingPreviewSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          console.error("[Staging Preview API] Job not found:", {
            jobId: input.jobId,
            brandId,
          });
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          console.error("[Staging Preview API] Access denied:", {
            jobId: input.jobId,
            jobBrandId: job.brandId,
            requestBrandId: brandId,
          });
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Debug logging - Request details
        console.log("[Staging Preview API] Request:", {
          jobId: input.jobId,
          brandId,
          jobStatus: job.status,
          limit: input.limit,
          offset: input.offset,
        });

        // Get staging preview with optional status filter
        const preview = await getStagingPreview(brandCtx.db, input.jobId, {
          limit: input.limit,
          offset: input.offset,
          status: input.status,
        });

        // Get action counts
        const counts = await countStagingProductsByAction(
          brandCtx.db,
          input.jobId,
        );

        // Debug logging - Response details
        console.log("[Staging Preview API] Response:", {
          jobId: input.jobId,
          rowCount: preview.products.length,
          totalValid: preview.total,
          willCreate: counts.create,
          willUpdate: counts.update,
        });

        const result = {
          stagingData: preview.products.map((p) => ({
            rowNumber: p.rowNumber,
            action: p.action,
            existingProductId: p.existingProductId,
            // Per-row status and errors (new in fire-and-forget flow)
            rowStatus: p.variant?.rowStatus ?? "PENDING",
            errors: p.variant?.errors ?? [],
            product: {
              name: p.name,
              description: p.description,
              categoryId: p.categoryId,
              seasonId: p.seasonId,
              imagePath: p.imagePath,
            },
            variant: p.variant
              ? {
                  upid: p.variant.upid,
                  barcode: p.variant.barcode,
                  sku: p.variant.sku,
                  nameOverride: p.variant.nameOverride,
                  descriptionOverride: p.variant.descriptionOverride,
                  imagePathOverride: p.variant.imagePathOverride,
                }
              : null,
          })),
          totalValid: preview.total,
          willCreate: counts.create,
          willUpdate: counts.update,
          limit: input.limit,
          offset: input.offset,
          // Include the status filter in response for client reference
          statusFilter: input.status ?? null,
        };

        console.log(
          "[Staging Preview API] Returning result with",
          result.stagingData.length,
          "rows",
        );
        return result;
      } catch (error) {
        console.error("[Staging Preview API] Error occurred:", {
          error,
          message: (error as Error).message,
          stack: (error as Error).stack,
        });
        throw wrapError(error, "Failed to get staging preview");
      }
    }),

  /**
   * Get import errors with pagination
   *
   * Retrieve detailed error information for failed rows in an import job.
   * Supports pagination for large error lists.
   */
  errors: brandRequiredProcedure
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

});

export type StagingRouter = typeof stagingRouter;
