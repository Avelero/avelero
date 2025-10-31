/**
 * Global product category catalog router.
 *
 * Exposes read-only access to the platform-wide list of categories used when
 * creating or editing products.
 */
import { listCategories } from "@v1/db/queries";
import { listCategoriesSchema } from "@api/schemas/index.ts";
import { createTRPCRouter, protectedProcedure } from "@api/trpc/init.ts";

/**
 * Router exposing category lookup procedures.
 */
export const categoriesRouter = createTRPCRouter({
  /**
   * Returns the global list of product categories.
   *
   * @returns Array of categories ready for dropdowns.
   */
  list: protectedProcedure
    .input(listCategoriesSchema)
    .query(async ({ ctx }) => {
      const { db } = ctx;
      const data = await listCategories(db);
      return { data } as const;
    }),
});
