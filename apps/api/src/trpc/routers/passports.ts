/**
 * Product passport insights router.
 *
 * These procedures power dashboards that show passport completion status and
 * bulk update tooling for brand managers.
 */
import {
  bulkUpdatePassports,
  countPassportsByStatus,
  getCompletionForProducts,
  getIncompleteCountsByModuleForBrand,
  getPassportStatusByProduct,
  listPassports,
  setPassportStatusByProduct,
} from "@v1/db/queries";
import type { BulkChanges, BulkSelection } from "@v1/db/queries";
import { z } from "zod";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../init.js";
import { wrapError } from "../../utils/errors.js";

/**
 * Router exposing read and update operations for passports.
 */
export const passportsRouter = createTRPCRouter({
  /**
   * Lists passports for the active brand with simple pagination.
   *
   * @param input - Page index starting at zero.
   * @returns Page of passport summaries for the dashboard.
   */
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return { data: [], meta: { total: 0 } } as const;
      try {
        return listPassports(db, brandId, input.page);
      } catch (error) {
        throw wrapError(error, "Failed to list passports");
      }
    }),

  /**
   * Counts passports grouped by publication status.
   *
   * @returns Aggregate counts or zero-valued buckets when no brand is selected.
   */
  countByStatus: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      if (!brandId)
        return {
          published: 0,
          scheduled: 0,
          unpublished: 0,
          archived: 0,
        } as const;
      try {
        return countPassportsByStatus(db, brandId);
      } catch (error) {
        throw wrapError(error, "Failed to count passports by status");
      }
    }),

  /**
   * Reports completion percentages for a set of product passports.
   *
   * @param input - Product identifiers to inspect.
   * @returns Completion metrics per product.
   */
  completionForProducts: protectedProcedure
    .input(
      z.object({
        product_ids: z.array(z.string().uuid()).min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return [] as const;
      try {
        return getCompletionForProducts(db, brandId, input.product_ids);
      } catch (error) {
        throw wrapError(error, "Failed to fetch passport completion data");
      }
    }),

  /**
   * Groups incomplete items by module to highlight remaining work.
   *
   * @returns List of modules with outstanding tasks for the brand.
   */
  incompleteCountsByModuleForBrand: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      if (!brandId) return [] as const;
      try {
        return getIncompleteCountsByModuleForBrand(db, brandId);
      } catch (error) {
        throw wrapError(
          error,
          "Failed to fetch incomplete passport counts for brand",
        );
      }
    }),

  /**
   * Fetches the current passport status for a product.
   *
   * @param input - Product identifier.
   * @returns Status string or `null` when unavailable.
   */
  getStatusByProduct: protectedProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return null;
      try {
        return getPassportStatusByProduct(db, brandId, input.product_id);
      } catch (error) {
        throw wrapError(error, "Failed to fetch passport status");
      }
    }),

  /**
   * Updates the passport status for a product.
   *
   * @param input - Product identifier and the new status value.
   * @returns Result of the status update.
   */
  setStatusByProduct: brandRequiredProcedure
    .input(
      z.object({ product_id: z.string().uuid(), status: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return setPassportStatusByProduct(
          db,
          brandId,
          input.product_id,
          input.status,
        );
      } catch (error) {
        throw wrapError(error, "Failed to update passport status");
      }
    }),

  /**
   * Applies bulk status updates to multiple passports at once.
   *
   * @param input - Selection strategy and the new status payload.
   * @returns Count of affected passports.
   */
  bulkUpdate: brandRequiredProcedure
    .input(
      z.object({
        selection: z.union([
          z.object({
            mode: z.literal("all"),
            excludeIds: z.array(z.string().uuid()),
          }),
          z.object({
            mode: z.literal("explicit"),
            includeIds: z.array(z.string().uuid()).min(1),
          }),
        ]),
        changes: z
          .object({
            status: z
              .enum(["published", "scheduled", "unpublished", "archived"])
              .optional(),
          })
          .refine((obj) => Object.keys(obj).length > 0, {
            message: "At least one change must be provided",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        const selection: BulkSelection =
          input.selection.mode === "all"
            ? {
                mode: "all",
                excludeIds: input.selection.excludeIds,
              }
            : {
                mode: "explicit",
                includeIds: input.selection.includeIds,
              };

        const changes: BulkChanges = {};
        if (input.changes.status) {
          changes.status = input.changes.status;
        }

        const affectedCount = await bulkUpdatePassports(
          db,
          brandId,
          selection,
          changes,
        );
        return { affectedCount } as const;
      } catch (error) {
        throw wrapError(error, "Failed to bulk update passports");
      }
    }),
});
