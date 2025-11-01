/**
 * Workflow invites router implementation.
 *
 * Targets:
 * - workflow.invites.list
 * - workflow.invites.send
 * - workflow.invites.respond
 */
import { tasks } from "@trigger.dev/sdk/v3";
import {
  acceptBrandInvite,
  createBrandInvites,
  declineBrandInvite,
  revokeBrandInviteByOwner,
} from "@v1/db/queries";
import { brandInvites, users } from "@v1/db/schema";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { desc, eq } from "drizzle-orm";
import { ROLES } from "../../../config/roles.js";
import {
  workflowInvitesListSchema,
  workflowInvitesRespondSchema,
  workflowInvitesSendSchema,
} from "../../../schemas/workflow.js";
import {
  badRequest,
  forbidden,
  internalServerError,
  wrapError,
} from "../../../utils/errors.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

type InviteEmailPayload = {
  recipientEmail: string;
  brandName: string;
  role: typeof ROLES.OWNER | typeof ROLES.MEMBER;
  acceptUrl: string;
  ctaMode: "accept" | "view";
};

type InviteResultRow = {
  email: string;
  role: typeof ROLES.OWNER | typeof ROLES.MEMBER;
  brand: { id: string | null; name: string | null } | null;
  tokenHash: string | null;
  isExistingUser: boolean;
};

export const workflowInvitesRouter = createTRPCRouter({
  /**
   * Lists pending invites for the active workflow with inviter metadata.
   */
  list: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(workflowInvitesListSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested workflow");
      }

      const rows = await db
        .select({
          id: brandInvites.id,
          email: brandInvites.email,
          role: brandInvites.role,
          created_at: brandInvites.createdAt,
          expires_at: brandInvites.expiresAt,
          invitedByEmail: users.email,
          invitedByFullName: users.fullName,
        })
        .from(brandInvites)
        .leftJoin(users, eq(users.id, brandInvites.createdBy))
        .where(eq(brandInvites.brandId, brandId))
        .orderBy(desc(brandInvites.createdAt));

      return rows.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        invited_by:
          invite.invitedByFullName ??
          invite.invitedByEmail ??
          "Avelero Team",
        created_at: invite.created_at,
        expires_at: invite.expires_at,
      }));
    }),

  /**
   * Sends an invite to a prospective workflow member and dispatches the email
   * workflow when a record is created.
   */
  send: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(workflowInvitesSendSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      if (brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested workflow");
      }

      const result = await createBrandInvites(db, {
        brandId: input.brand_id,
        invites: [
          {
            email: input.email,
            role: input.role ?? "member",
            createdBy: user.id,
          },
        ],
      });

      const inviteResults = (result.results as InviteResultRow[]) ?? [];
      if (inviteResults.length > 0) {
        const appUrl = getAppUrl();
        const payload: InviteEmailPayload[] = inviteResults.map((invite) => {
          const isExisting = invite.isExistingUser;
          const acceptUrl = isExisting
            ? `${appUrl}/account/brands`
            : `${appUrl}/api/auth/accept?token_hash=${invite.tokenHash ?? ""}`;
          return {
            recipientEmail: invite.email,
            brandName: invite.brand?.name ?? "Avelero",
            role: invite.role,
            acceptUrl,
            ctaMode: isExisting ? ("view" as const) : ("accept" as const),
          };
        });

        try {
          await tasks.trigger("invite-brand-members", {
            invites: payload,
            from: "Avelero <no-reply@welcome.avelero.com>",
          });
        } catch (error) {
          logger.error(
            {
              err: error instanceof Error ? error : undefined,
              invites: payload.map((invite) => invite.recipientEmail),
            },
            "Failed to enqueue workflow invite emails",
          );
        }
      }

      return result;
    }),

  /**
   * Unified responder supporting invite acceptance, decline, and revocation.
   */
  respond: protectedProcedure
    .input(workflowInvitesRespondSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, role, user } = ctx;
      const action = input.action;

      if (action === "accept") {
        try {
          const res = await acceptBrandInvite(db, {
            id: input.invite_id,
            userId: user.id,
          });
          return { success: true as const, brandId: res.brandId };
        } catch (error) {
          throw wrapError(error, "Failed to accept workflow invite");
        }
      }

      if (action === "decline") {
        const email = user.email;
        if (!email) {
          throw internalServerError(
            "Authenticated user record is missing an email address",
          );
        }
        try {
          await declineBrandInvite(db, { id: input.invite_id, email });
          return { success: true as const };
        } catch (error) {
          throw wrapError(error, "Failed to decline workflow invite");
        }
      }

      if (role !== ROLES.OWNER) {
        throw forbidden("Only workflow owners can revoke invites");
      }

      try {
        await revokeBrandInviteByOwner(db, user.id, input.invite_id);
        return { success: true as const };
      } catch (error) {
        if (error instanceof Error && error.message === "FORBIDDEN") {
          throw forbidden(
            "You do not have permission to revoke this workflow invite",
          );
        }
        throw wrapError(error, "Failed to revoke workflow invite");
      }
    }),
});

export type WorkflowInvitesRouter = typeof workflowInvitesRouter;
