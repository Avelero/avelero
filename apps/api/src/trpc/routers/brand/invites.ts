/**
 * Brand invite management router.
 *
 * Handles sending, revoking, listing, accepting, and rejecting brand invites.
 */
import { tasks } from "@trigger.dev/sdk/v3";
import {
  acceptBrandInvite as acceptInviteForRecipientById,
  listBrandInvites,
  listInvitesByEmail,
  declineBrandInvite as rejectInviteForRecipientById,
  revokeBrandInviteByOwner,
  createBrandInvites as sendBrandInvite,
} from "@v1/db/queries";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { ROLES } from "../../../config/roles.js";
import {
  acceptInviteSchema,
  listInvitesSchema,
  rejectInviteSchema,
  revokeInviteSchema,
  sendInviteSchema,
} from "../../../schemas/index.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";
import {
  badRequest,
  internalServerError,
  unauthorized,
  wrapError,
} from "../../../utils/errors.js";
import { hasRole } from "@api/trpc/middleware/auth/roles.js";

/**
 * Router exposing brand invite operations.
 */
export const brandInvitesRouter = createTRPCRouter({
  /**
   * Sends a brand invite to a prospective member.
   *
   * @param input - Invite details including recipient email and role.
   * @returns Results from the invite creation query.
   */
  send: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(sendInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId: activeBrandId } = ctx;
      if (input.brand_id !== activeBrandId) {
        throw badRequest("Active brand does not match the invite brand id");
      }

      const res = await sendBrandInvite(db, {
        brandId: input.brand_id,
        invites: [{ email: input.email, role: input.role, createdBy: user.id }],
      });

      type InviteResult = {
        email: string;
        role: typeof ROLES.OWNER | typeof ROLES.MEMBER;
        brand: { id: string | null; name: string | null } | null;
        tokenHash: string | null;
        isExistingUser: boolean;
      };

      const appUrl = getAppUrl();
      const results = (res.results as InviteResult[]) ?? [];
      if (results.length > 0) {
        const invites = results.map((r) => {
          const isExisting = r.isExistingUser;
          const acceptUrl = isExisting
            ? `${appUrl}/account/brands`
            : `${appUrl}/api/auth/accept?token_hash=${r.tokenHash ?? ""}`;
          return {
            recipientEmail: r.email,
            brandName: r.brand?.name ?? "Avelero",
            role: r.role,
            acceptUrl,
            ctaMode: isExisting ? ("view" as const) : ("accept" as const),
          };
        });
        try {
          await tasks.trigger("invite-brand-members", {
            invites,
            from: "Avelero <no-reply@welcome.avelero.com>",
          });
        } catch (error) {
          logger.error(
            {
              err: error instanceof Error ? error : undefined,
              invites: invites.map((invite) => invite.recipientEmail),
            },
            "Failed to enqueue invite emails",
          );
        }
      }

      return res;
    }),

  /**
   * Revokes a pending invite previously created by the brand.
   *
   * @param input - Invite identifier to cancel.
   * @returns Result of the revoke operation.
   */
  revoke: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(revokeInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const inviteId = input.invite_id;
      if (!inviteId) throw badRequest("Invite id is required");
      return revokeBrandInviteByOwner(db, user.id, inviteId);
    }),

  /**
   * Lists outstanding invites for a specific brand.
   *
   * @param input - Brand identifier.
   * @returns Array of invites awaiting action.
   */
  list: brandRequiredProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(listInvitesSchema)
    .query(async ({ ctx, input }) => {
      const { db, user, brandId: activeBrandId } = ctx;
      const targetBrandId = input.brand_id;
      if (!targetBrandId) throw badRequest("Brand id is required");
      if (targetBrandId !== activeBrandId) throw badRequest("Active brand mismatch");
      return listBrandInvites(db, user.id, targetBrandId);
    }),

  /**
   * Returns invites sent to the caller's email address.
   *
   * @returns Array of invites the user can accept or reject.
   */
  myInvites: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    const userEmail = user.email;
    if (!userEmail) {
      throw unauthorized("Email address required to fetch invites");
    }
    return listInvitesByEmail(db, userEmail);
  }),

  /**
   * Accepts a brand invite using the provided token.
   *
   * @param input - Invite identifier.
   * @returns Success flag and the id of the joined brand.
   */
  accept: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      try {
        const res = await acceptInviteForRecipientById(db, {
          id: input.id,
          userId: user.id,
        });
        return { success: true, brandId: res.brandId } as const;
      } catch (error) {
        throw wrapError(error, "Failed to accept invite");
      }
    }),

  /**
   * Rejects a brand invite so it no longer appears in the inbox.
   *
   * @param input - Invite identifier.
   * @returns Success flag.
   */
  reject: protectedProcedure
    .input(rejectInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const userEmail = user.email;
      if (!userEmail) {
        throw internalServerError(
          "Authenticated user record is missing an email address",
        );
      }
      try {
        await rejectInviteForRecipientById(db, {
          id: input.id,
          email: userEmail,
        });
        return { success: true } as const;
      } catch (error) {
        throw wrapError(error, "Failed to reject invite");
      }
    }),
});
