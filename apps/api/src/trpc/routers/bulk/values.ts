/**
 * Bulk import value mapping router.
 *
 * Handles value mapping operations:
 * - unmapped: Get CSV values that need entity definitions
 * - define: Create single catalog entity inline
 * - batchDefine: Create multiple catalog entities at once
 */
import {
  getImportJobStatus,
  getUnmappedValuesForJob,
  validateAndCreateEntity,
  createValueMapping,
  updateImportJobProgress,
} from "@v1/db/queries";
import {
  getUnmappedValuesSchema,
  defineValueSchema,
  batchDefineValuesSchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

export const valuesRouter = createTRPCRouter({
  /**
   * Get unmapped values needing definition
   *
   * Returns list of CSV values that don't have corresponding database entities.
   * User must define these before approval.
   */
  unmapped: brandRequiredProcedure
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
   * Define single value inline
   *
   * Creates a new catalog entity (material, color, size, etc.) during import review.
   * Updates value mapping and job summary.
   */
  define: brandRequiredProcedure
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
          input.entityType as
            | "COLOR"
            | "SIZE"
            | "MATERIAL"
            | "ECO_CLAIM"
            | "FACILITY"
            | "SHOWCASE_BRAND"
            | "CERTIFICATION",
          input.entityData,
        );

        // Create value mapping
        await createValueMapping(brandCtx.db, {
          brandId,
          sourceColumn: input.sourceColumn,
          rawValue: input.rawValue,
          target: input.entityType as
            | "COLOR"
            | "SIZE"
            | "MATERIAL"
            | "ECO_CLAIM"
            | "FACILITY"
            | "SHOWCASE_BRAND"
            | "CERTIFICATION",
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
   * Batch define multiple values
   *
   * Creates multiple catalog entities at once.
   * Useful for bulk approval of simple entities.
   */
  batchDefine: brandRequiredProcedure
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
              value.entityType as
                | "COLOR"
                | "SIZE"
                | "MATERIAL"
                | "ECO_CLAIM"
                | "FACILITY"
                | "SHOWCASE_BRAND"
                | "CERTIFICATION",
              value.entityData,
            );

            // Create value mapping
            await createValueMapping(brandCtx.db, {
              brandId,
              sourceColumn: value.sourceColumn,
              rawValue: value.rawValue,
              target: value.entityType as
                | "COLOR"
                | "SIZE"
                | "MATERIAL"
                | "ECO_CLAIM"
                | "FACILITY"
                | "SHOWCASE_BRAND"
                | "CERTIFICATION",
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
});

export type ValuesRouter = typeof valuesRouter;
