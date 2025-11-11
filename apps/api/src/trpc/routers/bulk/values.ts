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
  mapToExistingEntitySchema,
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
   * Get all catalog entities for unmapped values
   *
   * Single optimized endpoint that returns all entity types needed
   * for the unmapped values section. Reduces N queries to 1.
   *
   * Only fetches entity types that are present in unmapped values.
   */
  catalogData: brandRequiredProcedure
    .input(getUnmappedValuesSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // First verify job ownership and get unmapped values
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Get unmapped values to determine which entity types to fetch
        const unmappedResult = await getUnmappedValuesForJob(
          brandCtx.db,
          input.jobId,
        );

        // Determine which entity types are needed
        const entityTypes = new Set(
          unmappedResult.unmappedValues.map((group) => group.entityType),
        );

        // Fetch only the entity types that are actually needed
        // This is done in parallel for maximum efficiency
        const [
          colors,
          materials,
          sizes,
          facilities,
          showcaseBrands,
          categories,
          certifications,
        ] = await Promise.all([
          entityTypes.has("COLOR")
            ? brandCtx.db.query.brandColors.findMany({
                where: (colors, { eq }) => eq(colors.brandId, brandId),
                columns: { id: true, name: true },
                orderBy: (colors, { asc }) => [asc(colors.name)],
              })
            : Promise.resolve([]),
          entityTypes.has("MATERIAL")
            ? brandCtx.db.query.brandMaterials.findMany({
                where: (materials, { eq }) => eq(materials.brandId, brandId),
                columns: { id: true, name: true },
                orderBy: (materials, { asc }) => [asc(materials.name)],
              })
            : Promise.resolve([]),
          entityTypes.has("SIZE")
            ? brandCtx.db.query.brandSizes.findMany({
                where: (sizes, { eq }) => eq(sizes.brandId, brandId),
                columns: { id: true, name: true },
                orderBy: (sizes, { asc }) => [asc(sizes.name)],
              })
            : Promise.resolve([]),
          entityTypes.has("FACILITY")
            ? brandCtx.db.query.brandFacilities.findMany({
                where: (facilities, { eq }) =>
                  eq(facilities.brandId, brandId),
                columns: { id: true, displayName: true },
                orderBy: (facilities, { asc }) => [
                  asc(facilities.displayName),
                ],
              })
            : Promise.resolve([]),
          entityTypes.has("SHOWCASE_BRAND")
            ? brandCtx.db.query.showcaseBrands.findMany({
                where: (brands, { eq }) => eq(brands.brandId, brandId),
                columns: { id: true, name: true },
                orderBy: (brands, { asc }) => [asc(brands.name)],
              })
            : Promise.resolve([]),
          entityTypes.has("CATEGORY")
            ? brandCtx.db.query.categories.findMany({
                columns: { id: true, name: true },
                orderBy: (categories, { asc }) => [asc(categories.name)],
              })
            : Promise.resolve([]),
          entityTypes.has("CERTIFICATION")
            ? brandCtx.db.query.brandCertifications.findMany({
                where: (certs, { eq }) => eq(certs.brandId, brandId),
                columns: { id: true, title: true },
                orderBy: (certs, { asc }) => [asc(certs.title)],
              })
            : Promise.resolve([]),
        ]);

        return {
          colors: colors.map((c) => ({ id: c.id, name: c.name })),
          materials: materials.map((m) => ({ id: m.id, name: m.name })),
          sizes: sizes.map((s) => ({ id: s.id, name: s.name })),
          facilities: facilities.map((f) => ({
            id: f.id,
            name: f.displayName,
          })),
          showcaseBrands: showcaseBrands.map((b) => ({
            id: b.id,
            name: b.name,
          })),
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          certifications: certifications.map((c) => ({
            id: c.id,
            name: c.title,
          })),
          // TODO: Add seasons and tags when database tables are created
          seasons: [],
          tags: [],
        };
      } catch (error) {
        throw wrapError(error, "Failed to get catalog data");
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

  /**
   * Map CSV value to existing entity
   *
   * Instead of creating a new entity, this maps an unmapped CSV value
   * to an entity that already exists in the catalog.
   */
  mapToExisting: brandRequiredProcedure
    .input(mapToExistingEntitySchema)
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

        // Validate job status
        if (job.status !== "VALIDATED") {
          throw badRequest(
            `Cannot map values for job with status ${job.status}. Job must be VALIDATED.`,
          );
        }

        // Create value mapping to existing entity
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
          targetId: input.entityId,
        });

        // Update job summary
        const summary = (job.summary as Record<string, unknown>) ?? {};
        const pendingApproval = (summary.pending_approval as unknown[]) ?? [];
        const approvedValues = (summary.approved_values as unknown[]) ?? [];

        // Remove from pending
        const updatedPending = pendingApproval.filter((item) => {
          const val = item as { name: string; type: string };
          return !(
            val.name === input.rawValue && val.type === input.entityType
          );
        });

        // Add to approved
        approvedValues.push({
          type: input.entityType,
          name: input.rawValue,
          entityId: input.entityId,
        });

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
          entityId: input.entityId,
          entityType: input.entityType,
          name: input.rawValue,
          remainingUnmapped: updatedPending.length,
        };
      } catch (error) {
        throw wrapError(error, "Failed to map value to existing entity");
      }
    }),
});

export type ValuesRouter = typeof valuesRouter;
