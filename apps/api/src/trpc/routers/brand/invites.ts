/**
 * Brand invites router implementation.
 *
 * Phase 4 changes:
 * - Renamed from workflowInvitesRouter to brandInvitesRouter
 * - Removed respond procedure (accept/decline moved to user.invites.*)
 * - Added revoke as separate endpoint
 *
 * Targets:
 * - brand.invites.list
 * - brand.invites.send
 * - brand.invites.revoke
 */
import { tasks } from "@trigger.dev/sdk/v3";
import { desc, eq } from "@v1/db/queries";
import {
  createBrandInvites,
  revokeBrandInviteByOwner,
} from "@v1/db/queries/brand";
import { brandInvites, users } from "@v1/db/schema";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { z } from "zod";
import { ROLES } from "../../../config/roles.js";
import { uuidSchema } from "../../../schemas/_shared/primitives.js";
import {
  brandIdOptionalSchema,
  inviteSendSchema,
} from "../../../schemas/brand.js";
import { badRequest, forbidden, wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
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

// Schema for revoking an invite
const inviteRevokeSchema = z.object({
  invite_id: uuidSchema,
});

export const brandInvitesRouter = createTRPCRouter({
  /**
   * Lists pending invites for the brand with inviter metadata.
   * Only accessible by brand owners.
   */
  list: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(brandIdOptionalSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (input.brand_id !== undefined && brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested brand");
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
          invite.invitedByFullName ?? invite.invitedByEmail ?? "Avelero Team",
        created_at: invite.created_at,
        expires_at: invite.expires_at,
      }));
    }),

  /**
   * Sends an invite to a prospective brand member and dispatches the email
   * notification when a record is created.
   * Only accessible by brand owners.
   */
  send: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(inviteSendSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      if (input.brand_id !== undefined && brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested brand");
      }

      const result = await createBrandInvites(db, {
        brandId,
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
            ? `${appUrl}/invites`
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
            "Failed to enqueue brand invite emails",
          );
        }
      }

      return result;
    }),

  /**
   * Revokes a pending invite.
   * Only accessible by brand owners.
   */
  revoke: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(inviteRevokeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      try {
        await revokeBrandInviteByOwner(db, user.id, input.invite_id);
        return { success: true as const };
      } catch (error) {
        if (error instanceof Error && error.message === "FORBIDDEN") {
          throw forbidden("You do not have permission to revoke this invite");
        }
        throw wrapError(error, "Failed to revoke invite");
      }
    }),
});

type BrandInvitesRouter = typeof brandInvitesRouter;
