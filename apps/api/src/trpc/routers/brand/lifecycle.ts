/**
 * Brand lifecycle router.
 *
 * Handles brand leave operations and permission checks.
 */
import {
  canLeaveBrand as qCanLeaveBrand,
  leaveBrand as qLeaveBrand,
} from "@v1/db/queries";
import { brandIdParamSchema } from "../../../schemas/index.js";
import { badRequest, soleOwnerError } from "../../../utils/errors.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";

/**
 * Router exposing brand lifecycle operations.
 */
export const brandLifecycleRouter = createTRPCRouter({
  /**
   * Checks whether the user can safely leave a brand.
   *
   * @param input - Brand identifier.
   * @returns Permission state describing constraints.
   */
  canLeave: protectedProcedure
    .input(brandIdParamSchema)
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const res = await qCanLeaveBrand(db, user.id, input.id);
      return res;
    }),

  /**
   * Removes the current user from the specified brand.
   *
   * @param input - Brand identifier.
   * @returns Success flag plus the next brand id when available.
   */
  leave: protectedProcedure
    .input(brandIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const res = await qLeaveBrand(db, user.id, input.id);
      if (!res.ok && res.code === "SOLE_OWNER") {
        throw soleOwnerError();
      }
      if (res.ok) {
        return { success: true, nextBrandId: res.nextBrandId } as const;
      }
      // Fallback safeguard (should never reach here due to checks above)
      throw badRequest("Unable to leave brand");
    }),
});
