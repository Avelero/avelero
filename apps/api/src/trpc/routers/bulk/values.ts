import { serviceDb } from "@v1/db/client";
import { and, eq, isNull } from "@v1/db/queries";
import type { SQL } from "@v1/db/queries";
import {
  getImportJobStatus,
  getUnmappedValuesForJob,
} from "@v1/db/queries/bulk";
/**
 * Bulk import value mapping router.
 *
 * Handles value mapping operations:
 * - unmapped: Get CSV values that need entity definitions
 * - catalogData: Get all catalog entities for dropdown selection
 * - ensureCategory: Create category path in database
 */
import { taxonomyCategories } from "@v1/db/schema";
import { z } from "zod";
import { getUnmappedValuesSchema } from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

export const valuesRouter = createTRPCRouter({
  /**
   * Get unmapped values needing definition
   *
   * Returns list of CSV values that don't have corresponding database entities.
   *
   * Note: With the auto-create approach, most entities are automatically created
   * during import. Only categories cannot be auto-created (they're hierarchical
   * and pre-seeded). This endpoint now primarily returns category errors.
   */
  unmapped: brandReadProcedure
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
  catalogData: brandReadProcedure
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
          materials,
          operators,
          manufacturers,
          categories,
          certifications,
          seasons,
          tags,
        ] = await Promise.all([
          brandCtx.db.query.brandMaterials.findMany({
            where: (materials, { eq }) => eq(materials.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (materials, { asc }) => [asc(materials.name)],
          }),
          brandCtx.db.query.brandOperators.findMany({
            where: (operators, { eq }) => eq(operators.brandId, brandId),
            columns: { id: true, displayName: true },
            orderBy: (operators, { asc }) => [asc(operators.displayName)],
          }),
          brandCtx.db.query.brandManufacturers.findMany({
            where: (manufacturers, { eq }) =>
              eq(manufacturers.brandId, brandId),
            columns: { id: true, name: true },
            orderBy: (manufacturers, { asc }) => [asc(manufacturers.name)],
          }),
          brandCtx.db.query.taxonomyCategories.findMany({
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
          colors: [],
          materials: materials.map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          })),
          sizes: [],
          operators: operators.map(
            (op: { id: string; displayName: string }) => ({
              id: op.id,
              name: op.displayName,
            }),
          ),
          manufacturers: manufacturers.map(
            (m: { id: string; name: string }) => ({
              id: m.id,
              name: m.name,
            }),
          ),
          categories: categories.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
          certifications: certifications.map(
            (c: { id: string; title: string }) => ({
              id: c.id,
              name: c.title,
            }),
          ),
          seasons: seasons.map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          })),
          tags: tags.map(
            (t: { id: string; name: string; hex: string | null }) => ({
              id: t.id,
              name: t.name,
              hex: t.hex ?? undefined,
            }),
          ),
        };
      } catch (error) {
        throw wrapError(error, "Failed to get catalog data");
      }
    }),

  /**
   * Ensure category path exists in database
   */
  ensureCategory: brandWriteProcedure
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
            ? eq(taxonomyCategories.parentId, parentId)
            : isNull(taxonomyCategories.parentId);

          // Check if category exists using regular db connection (with RLS)
          const existing: Array<{ id: string }> = await brandCtx.db
            .select({ id: taxonomyCategories.id })
            .from(taxonomyCategories)
            .where(and(parentCondition, eq(taxonomyCategories.name, label)))
            .limit(1);

          let currentId: string | null = existing[0]?.id ?? null;

          if (!currentId) {
            // Use serviceDb to bypass RLS for category insertion
            // Categories are system-managed and have restrictive RLS policies
            // Generate a publicId from the label (slugified)
            const publicId = label
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");

            const inserted: Array<{ id: string }> = await serviceDb
              .insert(taxonomyCategories)
              .values({
                publicId: `${publicId}-${crypto.randomUUID().slice(0, 8)}`,
                name: label,
                parentId,
              })
              .onConflictDoNothing({
                target: [taxonomyCategories.parentId, taxonomyCategories.name],
              })
              .returning({ id: taxonomyCategories.id });

            currentId = inserted[0]?.id ?? null;

            if (!currentId) {
              // Fallback: check again in case of race condition
              const fallback = await brandCtx.db
                .select({ id: taxonomyCategories.id })
                .from(taxonomyCategories)
                .where(and(parentCondition, eq(taxonomyCategories.name, label)))
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
});

type ValuesRouter = typeof valuesRouter;
