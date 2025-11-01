import {
  BrandMemberForbiddenError,
  BrandMemberSoleOwnerError,
  deleteMember,
  leaveBrand,
  updateMemberRole,
} from "@v1/db/queries";
import { brandMembers, users } from "@v1/db/schema";
/**
 * Workflow members router implementation.
 *
 * Targets:
 * - workflow.members.list
 * - workflow.members.update
 */
import { asc, eq } from "drizzle-orm";
import { ROLES } from "../../../config/roles.js";
import {
  workflowBrandIdSchema,
  workflowMembersUpdateSchema,
} from "../../../schemas/workflow.js";
import {
  badRequest,
  forbidden,
  soleOwnerError,
  wrapError,
} from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

function computeMemberCanLeave(role: "owner" | "member", ownerCount: number) {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

export const workflowMembersRouter = createTRPCRouter({
  /**
   * Lists members for the requested workflow, including computed `canLeave`
   * metadata derived from owner counts.
   */
  list: brandRequiredProcedure
    .input(workflowBrandIdSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested workflow");
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
   * Multi-purpose mutation that supports:
   * - Leave brand (no `user_id`, no `role`)
   * - Update role (`user_id` + `role`)
   * - Remove member (`user_id` + `role` = null)
   */
  update: brandRequiredProcedure
    .input(workflowMembersUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId, role: actingRole, user } = ctx;
      if (brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested workflow");
      }

      const targetUserId = input.user_id;

      if (!targetUserId) {
        const result = await leaveBrand(db, user.id, brandId);
        if (!result.ok && result.code === "SOLE_OWNER") {
          throw soleOwnerError();
        }
        if (!result.ok) {
          throw badRequest("Unable to leave workflow");
        }
        return {
          success: true as const,
          nextBrandId: result.nextBrandId ?? null,
        };
      }

      if (input.role === null) {
        try {
          await deleteMember(db, user.id, brandId, targetUserId);
          return { success: true as const };
        } catch (error) {
          if (error instanceof BrandMemberSoleOwnerError) {
            throw soleOwnerError();
          }
          if (error instanceof BrandMemberForbiddenError) {
            throw forbidden(
              "You do not have permission to remove this workflow member",
            );
          }
          throw wrapError(error, "Failed to remove workflow member");
        }
      }

      if (actingRole !== ROLES.OWNER) {
        throw forbidden(
          "Only workflow owners can change another member's role",
        );
      }

      const roleToAssign = input.role;
      if (roleToAssign === undefined) {
        throw badRequest("Role is required when updating a workflow member");
      }

      try {
        await updateMemberRole(
          db,
          user.id,
          brandId,
          targetUserId,
          roleToAssign,
        );
        return { success: true as const };
      } catch (error) {
        throw wrapError(error, "Failed to update member role");
      }
    }),
});

export type WorkflowMembersRouter = typeof workflowMembersRouter;
