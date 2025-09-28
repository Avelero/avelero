import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";
import {
  getCompletionForProducts,
  getIncompleteCountsByModuleForBrand,
  getPassportStatusByProduct,
  setPassportStatusByProduct,
  listPassports,
  countPassportsByStatus,
  bulkUpdatePassports,
} from "@v1/db/queries";

export const passportsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return { data: [], meta: { total: 0 } } as const;
      return listPassports(db, brandId, input.page);
    }),

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
      return countPassportsByStatus(db, brandId);
    }),

  completionForProducts: protectedProcedure
    .input(
      z.object({
        product_ids: z.array(z.string().uuid()).min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return [] as const;
      return getCompletionForProducts(db, brandId, input.product_ids);
    }),

  incompleteCountsByModuleForBrand: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      if (!brandId) return [] as const;
      return getIncompleteCountsByModuleForBrand(db, brandId);
    }),

  getStatusByProduct: protectedProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return null;
      return getPassportStatusByProduct(db, brandId, input.product_id);
    }),

  setStatusByProduct: protectedProcedure
    .input(
      z.object({ product_id: z.string().uuid(), status: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) throw new Error("No active brand");
      return setPassportStatusByProduct(db, brandId, input.product_id, input.status);
    }),

  bulkUpdate: protectedProcedure
    .input(
      z.object({
        selection: z.union([
          z.object({ mode: z.literal("all"), excludeIds: z.array(z.string().uuid()) }),
          z.object({ mode: z.literal("explicit"), includeIds: z.array(z.string().uuid()).min(1) }),
        ]),
        changes: z
          .object({
            status: z.enum(["published", "scheduled", "unpublished", "archived"]).optional(),
          })
          .refine((obj) => Object.keys(obj).length > 0, {
            message: "At least one change must be provided",
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) throw new Error("No active brand");
      const affectedCount = await bulkUpdatePassports(db, brandId, input.selection as any, input.changes as any);
      return { affectedCount } as const;
    }),
});


