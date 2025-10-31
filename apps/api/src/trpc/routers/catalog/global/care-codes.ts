/**
 * Global care code catalog router.
 *
 * Provides read-only access to supported garment care instructions.
 */
import { listCareCodes } from "@v1/db/queries";
import { listCareCodesSchema } from "@api/schemas/index.ts";
import { createTRPCRouter, protectedProcedure } from "@api/trpc/init.ts";

/**
 * Router exposing care code lookup procedures.
 */
export const careCodesRouter = createTRPCRouter({
  /**
   * Supplies the supported garment care codes.
   *
   * @returns Array of care code records.
   */
  list: protectedProcedure
    .input(listCareCodesSchema)
    .query(async ({ ctx }) => {
      const { db } = ctx;
      const data = await listCareCodes(db);
      return { data } as const;
    }),
});
