import {
  BrandMemberForbiddenError,
  BrandMemberSoleOwnerError,
  asc,
  deleteMember,
  eq,
  updateMemberRole,
} from "@v1/db/queries";
import { brandMembers, users } from "@v1/db/schema";
import { z } from "zod";
/**
 * Brand members router implementation.
 *
 * Phase 4 changes:
 * - Renamed from workflowMembersRouter to brandMembersRouter
 * - Removed leave functionality (moved to user.brands.leave)
 * - Split update into separate `update` and `remove` endpoints
 *
 * Targets:
 * - brand.members.list
 * - brand.members.update (role changes only)
 * - brand.members.remove
 */
import { ROLES } from "../../../config/roles.js";
import { roleSchema } from "../../../schemas/_shared/domain.js";
import { uuidSchema } from "../../../schemas/_shared/primitives.js";
import { brandIdOptionalSchema } from "../../../schemas/brand.js";
import {
  badRequest,
  forbidden,
  soleOwnerError,
  wrapError,
} from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

function computeMemberCanLeave(role: "owner" | "member", ownerCount: number) {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

// Schema for updating member role
const memberUpdateSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,
});

// Schema for removing a member
const memberRemoveSchema = z.object({
  user_id: uuidSchema,
});

export const brandMembersRouter = createTRPCRouter({
  /**
   * Lists members for the brand, including computed `canLeave`
   * metadata derived from owner counts.
   */
  list: brandRequiredProcedure
    .input(brandIdOptionalSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (input.brand_id !== undefined && brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested brand");
      }

      const rows = await db
        .select({
          userId: brandMembers.userId,
          email: users.email,
          fullName: users.fullName,
          role: brandMembers.role,
        })
        .from(brandMembers)
        .leftJoin(users, eq(users.id, brandMembers.userId))
        .where(eq(brandMembers.brandId, brandId))
        .orderBy(asc(brandMembers.createdAt));

      const ownerCount = rows.reduce(
        (count, member) => (member.role === "owner" ? count + 1 : count),
        0,
      );

      return rows.map((member) => {
        const role = member.role === "owner" ? "owner" : ("member" as const);
        return {
          user_id: member.userId,
          email: member.email ?? null,
          full_name: member.fullName ?? null,
          role,
          canLeave: computeMemberCanLeave(role, ownerCount),
        };
      });
    }),

  /**
   * Updates a member's role.
   * Only brand owners can change roles.
   */
  update: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(memberUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId, user } = ctx;

      try {
        await updateMemberRole(
          db,
          user.id,
          brandId,
          input.user_id,
          input.role,
        );
        return { success: true as const };
      } catch (error) {
        throw wrapError(error, "Failed to update member role");
      }
    }),

  /**
   * Removes a member from the brand.
   * Only brand owners can remove members.
   */
  remove: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(memberRemoveSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId, user } = ctx;

      try {
        await deleteMember(db, user.id, brandId, input.user_id);
        return { success: true as const };
      } catch (error) {
        if (error instanceof BrandMemberSoleOwnerError) {
          throw soleOwnerError();
        }
        if (error instanceof BrandMemberForbiddenError) {
          throw forbidden(
            "You do not have permission to remove this member",
          );
        }
        throw wrapError(error, "Failed to remove member");
      }
    }),
});

export type BrandMembersRouter = typeof brandMembersRouter;
