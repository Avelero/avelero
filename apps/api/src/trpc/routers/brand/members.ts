/**
 * Brand member management router.
 *
 * Handles listing, updating roles, and removing brand members.
 */
import {
  getMembersByBrandId,
  deleteMember as qDeleteMember,
  updateMemberRole as qUpdateMemberRole,
} from "@v1/db/queries";
import { ROLES } from "../../../config/roles.js";
import {
  deleteMemberSchema,
  updateMemberSchema,
} from "../../../schemas/index.js";
import { soleOwnerError, wrapError } from "../../../utils/errors.js";
import { createSuccessResponse } from "../../../utils/response.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { hasRole } from "@api/trpc/middleware/auth/roles.js";

/**
 * Router exposing brand member operations.
 */
export const brandMembersRouter = createTRPCRouter({
  /**
   * Lists members belonging to the active brand.
   *
   * @returns Array of member records.
   */
  list: brandRequiredProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;
    return getMembersByBrandId(db, brandId);
  }),

  /**
   * Updates a member's role. Restricted to brand owners.
   *
   * @param input - Member identifier and new role.
   * @returns Success response.
   */
  update: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(updateMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      await qUpdateMemberRole(db, user.id, brandId, input.user_id, input.role);
      return createSuccessResponse();
    }),

  /**
   * Removes a member from the active brand.
   *
   * @param input - Member identifier.
   * @returns Success response or raises when the user is the sole owner.
   */
  delete: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(deleteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      try {
        await qDeleteMember(db, user.id, brandId, input.user_id);
        return createSuccessResponse();
      } catch (e) {
        if (e instanceof Error && e.message === "SOLE_OWNER") {
          throw soleOwnerError();
        }
        throw wrapError(e, "Failed to remove member");
      }
    }),
});
