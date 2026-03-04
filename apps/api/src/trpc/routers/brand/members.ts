import { asc, eq } from "@v1/db/queries";
import {
  BrandMemberForbiddenError,
  BrandMemberSoleOwnerError,
  deleteMember,
  updateMemberRole,
} from "@v1/db/queries/brand";
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
import { OWNER_EQUIVALENT_ROLES } from "../../../config/roles.js";
import { assignableRoleSchema } from "../../../schemas/_shared/domain.js";
import { uuidSchema } from "../../../schemas/_shared/primitives.js";
import { brandIdOptionalSchema } from "../../../schemas/brand.js";
import {
  badRequest,
  forbidden,
  soleOwnerError,
  wrapError,
} from "../../../utils/errors.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

function computeMemberCanLeave(role: "owner" | "member", ownerCount: number) {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

// Schema for updating member role
const memberUpdateSchema = z.object({
  user_id: uuidSchema,
  role: assignableRoleSchema,
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
  list: brandReadProcedure
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

      // Hide internal-only avelero memberships from customer-facing members UI.
      const visibleRows = rows.filter((member) => member.role !== "avelero");

      const ownerCount = visibleRows.reduce(
        (count, member) => (member.role === "owner" ? count + 1 : count),
        0,
      );

      return visibleRows.map((member) => {
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
  update: brandWriteProcedure
    .use(hasRole(OWNER_EQUIVALENT_ROLES))
    .input(memberUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId, user } = ctx;

      try {
        await updateMemberRole(db, user.id, brandId, input.user_id, input.role);
        return { success: true as const };
      } catch (error) {
        if (error instanceof BrandMemberSoleOwnerError) {
          throw soleOwnerError();
        }
        throw wrapError(error, "Failed to update member role");
      }
    }),

  /**
   * Removes a member from the brand.
   * Only brand owners can remove members.
   */
  remove: brandWriteProcedure
    .use(hasRole(OWNER_EQUIVALENT_ROLES))
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
          throw forbidden("You do not have permission to remove this member");
        }
        throw wrapError(error, "Failed to remove member");
      }
    }),
});

type BrandMembersRouter = typeof brandMembersRouter;
