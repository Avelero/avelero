import { serviceDb } from "@v1/db/client";
/**
 * Bulk import value mapping router.
 *
 * Handles value mapping operations:
 * - unmapped: Get CSV values that need entity definitions
 * - define: Create single catalog entity inline
 * - batchDefine: Create multiple catalog entities at once
 */
import { categories } from "@v1/db/schema";
import {
  and,
  eq,
  isNull,
  createValueMapping,
  getImportJobStatus,
  getUnmappedValuesForJob,
  getValueMapping,
  updateImportJobProgress,
  updateValueMapping,
  validateAndCreateEntity,
  createSeason,
  createBrandTag,
} from "@v1/db/queries";
import type { SQL, ValueMappingTarget } from "@v1/db/queries";
import { z } from "zod";
import {
  batchDefineValuesSchema,
  defineValueSchema,
  getUnmappedValuesSchema,
  mapToExistingEntitySchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

async function createEntityForType(
  db: BrandContext["db"],
  brandId: string,
  entityType: ValueMappingTarget,
  entityData: unknown,
) {
  switch (entityType) {
    case "SEASON": {
      const payload = entityData as {
        name: string;
        startDate?: string;
        endDate?: string;
        isOngoing?: boolean;
      };

      if (!payload.name?.trim()) {
        throw badRequest("Season name is required");
      }

      const startDate =
        payload.startDate != null ? new Date(payload.startDate) : null;
      const endDate =
        payload.endDate != null ? new Date(payload.endDate) : null;

      if (startDate !== null && Number.isNaN(startDate.getTime())) {
        throw badRequest("Invalid season start date");
      }
      if (endDate !== null && Number.isNaN(endDate.getTime())) {
        throw badRequest("Invalid season end date");
      }

      const created = await createSeason(db, brandId, {
        name: payload.name.trim(),
        startDate,
        endDate,
        ongoing: payload.isOngoing ?? false,
      });

      if (!created?.id) {
        throw new Error("Failed to create season");
      }

      return { id: created.id };
    }
    case "TAG": {
      const payload = entityData as { name: string; hex?: string | null };
      if (!payload.name?.trim()) {
        throw badRequest("Tag name is required");
      }
      const created = await createBrandTag(db, brandId, {
        name: payload.name.trim(),
        hex: payload.hex ?? null,
      });
      if (!created?.id) {
        throw new Error("Failed to create tag");
      }
      return { id: created.id };
    }
    case "CATEGORY": {
      throw badRequest(
        "Categories are created via ensureCategory path handling. Inline creation is not supported.",
      );
    }
    default:
      return validateAndCreateEntity(db, brandId, entityType, entityData);
  }
}

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
   * Fetches all entity types in parallel for maximum speed.
   * The cost of fetching unused entity types is negligible compared to
   * the overhead of checking which types are needed first.
   */
  catalogData: brandRequiredProcedure
    .input(getUnmappedValuesSchema)
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

        // Fetch ALL entity types in parallel for maximum speed
        // This is faster than querying unmapped values first to determine which types are needed
        const [
          colors,
          materials,
          sizes,
          facilities,
          showcaseBrands,
          categories,
          certifications,
          seasons,
          tags,
        ] = await Promise.all([
          brandCtx.db.query.brandColors.findMany({
            where: (colors, { eq }) => eq(colors.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (colors, { asc }) => [asc(colors.name)],
          }),
          brandCtx.db.query.brandMaterials.findMany({
            where: (materials, { eq }) => eq(materials.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (materials, { asc }) => [asc(materials.name)],
          }),
          brandCtx.db.query.brandSizes.findMany({
            where: (sizes, { eq }) => eq(sizes.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (sizes, { asc }) => [asc(sizes.name)],
          }),
          brandCtx.db.query.brandFacilities.findMany({
            where: (facilities, { eq }) => eq(facilities.brandId, brandId),
            columns: { id: true, displayName: true },
            orderBy: (facilities, { asc }) => [asc(facilities.displayName)],
          }),
          brandCtx.db.query.showcaseBrands.findMany({
            where: (brands, { eq }) => eq(brands.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (brands, { asc }) => [asc(brands.name)],
          }),
          brandCtx.db.query.categories.findMany({
            columns: { id: true, name: true },
            orderBy: (categories, { asc }) => [asc(categories.name)],
          }),
          brandCtx.db.query.brandCertifications.findMany({
            where: (certs, { eq }) => eq(certs.brandId, brandId),
            columns: { id: true, title: true },
            orderBy: (certs, { asc }) => [asc(certs.title)],
          }),
          brandCtx.db.query.brandSeasons.findMany({
            where: (season, { eq }) => eq(season.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (season, { asc }) => [asc(season.name)],
          }),
          brandCtx.db.query.brandTags.findMany({
            where: (tag, { eq }) => eq(tag.brandId, brandId),
            columns: { id: true, name: true, hex: true },
            orderBy: (tag, { asc }) => [asc(tag.name)],
          }),
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
          seasons: seasons.map((s) => ({ id: s.id, name: s.name })),
          tags: tags.map((t) => ({
            id: t.id,
            name: t.name,
            hex: t.hex ?? undefined,
          })),
        };
      } catch (error) {
        throw wrapError(error, "Failed to get catalog data");
      }
    }),

  /**
   * Ensure category path exists in database
   */
  ensureCategory: brandRequiredProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        path: z.array(z.string().min(1).max(200)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        const labels = input.path.map((label) => label.trim()).filter(Boolean);

        if (labels.length === 0) {
          throw badRequest("Invalid category path provided");
        }

        let parentId: string | null = null;
        let created = false;
        let lastCategoryId: string | null = null;

        for (const label of labels) {
          const parentCondition: SQL<unknown> = parentId
            ? eq(categories.parentId, parentId)
            : isNull(categories.parentId);

          // Check if category exists using regular db connection (with RLS)
          const existing: Array<{ id: string }> = await brandCtx.db
            .select({ id: categories.id })
            .from(categories)
            .where(and(parentCondition, eq(categories.name, label)))
            .limit(1);

          let currentId: string | null = existing[0]?.id ?? null;

          if (!currentId) {
            // Use serviceDb to bypass RLS for category insertion
            // Categories are system-managed and have restrictive RLS policies
            const inserted: Array<{ id: string }> = await serviceDb
              .insert(categories)
              .values({
                name: label,
                parentId,
              })
              .onConflictDoNothing({
                target: [categories.parentId, categories.name],
              })
              .returning({ id: categories.id });

            currentId = inserted[0]?.id ?? null;

            if (!currentId) {
              // Fallback: check again in case of race condition
              const fallback = await brandCtx.db
                .select({ id: categories.id })
                .from(categories)
                .where(and(parentCondition, eq(categories.name, label)))
                .limit(1);

              currentId = fallback[0]?.id ?? null;
            } else {
              created = true;
            }
          }

          if (!currentId) {
            throw new Error(`Unable to persist category segment "${label}"`);
          }

          parentId = currentId;
          lastCategoryId = currentId;
        }

        if (!lastCategoryId) {
          throw new Error("Failed to resolve category path");
        }

        return {
          id: lastCategoryId,
          created,
        };
      } catch (error) {
        throw wrapError(error, "Failed to ensure category exists");
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
        const entity = await createEntityForType(
          brandCtx.db,
          brandId,
          input.entityType as ValueMappingTarget,
          input.entityData,
        );

        // Create value mapping and capture the ID
        const mapping = await createValueMapping(brandCtx.db, {
          brandId,
          sourceColumn: input.sourceColumn,
          rawValue: input.rawValue,
          target: input.entityType as ValueMappingTarget,
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
          valueMappingId: mapping.id,
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
            const entity = await createEntityForType(
              brandCtx.db,
              brandId,
              value.entityType as ValueMappingTarget,
              value.entityData,
            );

            // Create value mapping
            await createValueMapping(brandCtx.db, {
              brandId,
              sourceColumn: value.sourceColumn,
              rawValue: value.rawValue,
              target: value.entityType as ValueMappingTarget,
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

        // Filter out successfully created values from pending (match by both name and type)
        const createdSet = new Set(
          created.map((c) => `${c.entityType}:${c.name}`),
        );
        const updatedPending = pendingApproval.filter((item) => {
          const val = item as { name: string; type: string };
          const key = `${val.type}:${val.name}`;
          return !createdSet.has(key);
        });

        // Add all created values to approved (ensure consistent shape with type, not entityType)
        approvedValues.push(
          ...created.map((c) => ({
            type: c.entityType,
            name: c.name,
            entityId: c.entityId,
          })),
        );

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

        const existingMapping = await getValueMapping(
          brandCtx.db,
          brandId,
          input.sourceColumn,
          input.rawValue,
        );

        const target = input.entityType as ValueMappingTarget;

        if (existingMapping) {
          const needsUpdate =
            existingMapping.target_id !== input.entityId ||
            existingMapping.target !== input.entityType;

          if (needsUpdate) {
            await updateValueMapping(brandCtx.db, {
              id: existingMapping.id,
              brandId,
              target,
              targetId: input.entityId,
            });
          }
        } else {
          await createValueMapping(brandCtx.db, {
            brandId,
            sourceColumn: input.sourceColumn,
            rawValue: input.rawValue,
            target,
            targetId: input.entityId,
          });
        }

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
