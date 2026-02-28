import { tasks } from "@trigger.dev/sdk/v3";
import {
  computeNextBrandIdForUser,
  createBrand,
  createBrandInvites,
  setActiveBrand,
} from "@v1/db/queries/brand";
import { and, eq } from "@v1/db/queries";
import { brandMembers, platformAdminAuditLogs, users } from "@v1/db/schema";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { z } from "zod";
import { brandCreateSchema } from "../../../schemas/brand.js";
import { assignableRoleSchema } from "../../../schemas/_shared/domain.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createTRPCRouter,
  platformAdminProcedure,
  type AuthenticatedTRPCContext,
} from "../../init.js";

const platformInviteSendSchema = z.object({
  brand_id: z.string().uuid(),
  email: z.string().trim().email(),
  role: assignableRoleSchema.default("member"),
});

const platformMemberSelfSchema = z.object({
  brand_id: z.string().uuid(),
});

type InviteResultRow = {
  email: string;
  role: "owner" | "member";
  brand: { id: string | null; name: string | null } | null;
  tokenHash: string | null;
  isExistingUser: boolean;
};

type InviteEmailPayload = {
  recipientEmail: string;
  brandName: string;
  role: "owner" | "member";
  acceptUrl: string;
  ctaMode: "accept" | "view";
};

async function logPlatformAdminAction(
  ctx: AuthenticatedTRPCContext,
  input: {
    action: string;
    resourceType: string;
    resourceId: string;
    payload: Record<string, unknown>;
  },
) {
  await ctx.db.insert(platformAdminAuditLogs).values({
    actorUserId: ctx.user.id,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    payload: input.payload,
  });
}

async function triggerInviteEmails(invites: InviteResultRow[]) {
  if (invites.length === 0) return;

  const appUrl = getAppUrl();
  const payload: InviteEmailPayload[] = invites.map((invite) => {
    const isExisting = invite.isExistingUser;
    const acceptUrl = isExisting
      ? `${appUrl}/invites`
      : `${appUrl}/api/auth/accept?token_hash=${invite.tokenHash ?? ""}`;
    return {
      recipientEmail: invite.email,
      brandName: invite.brand?.name ?? "Avelero",
      role: invite.role,
      acceptUrl,
      ctaMode: isExisting ? "view" : "accept",
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
      "Failed to enqueue platform-admin invite emails",
    );
  }
}

export const platformAdminRouter = createTRPCRouter({
  brands: createTRPCRouter({
    create: platformAdminProcedure
      .input(brandCreateSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        const payload = {
          name: input.name,
          slug: input.slug ?? null,
          email: input.email ?? user.email ?? null,
          country_code: input.country_code ?? null,
          logo_path: null,
        };

        try {
          const result = await createBrand(db, user.id, payload);
          await logPlatformAdminAction(ctx, {
            action: "platform_admin.brand.create",
            resourceType: "brand",
            resourceId: result.id,
            payload: {
              brandId: result.id,
              slug: result.slug,
            },
          });
          return result;
        } catch (error) {
          throw wrapError(error, "Failed to create brand");
        }
      }),
  }),

  invites: createTRPCRouter({
    send: platformAdminProcedure
      .input(platformInviteSendSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        const result = await createBrandInvites(db, {
          brandId: input.brand_id,
          invites: [
            {
              email: input.email,
              role: input.role,
              createdBy: user.id,
            },
          ],
        });

        const inviteResults = (result.results as InviteResultRow[]) ?? [];
        await triggerInviteEmails(inviteResults);

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.invite.send",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            email: input.email.toLowerCase(),
            role: input.role,
            created: inviteResults.length,
            skipped: result.skippedInvites,
          },
        });

        return result;
      }),
  }),

  members: createTRPCRouter({
    addSelf: platformAdminProcedure
      .input(platformMemberSelfSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        await db
          .insert(brandMembers)
          .values({
            brandId: input.brand_id,
            userId: user.id,
            role: "avelero",
          })
          .onConflictDoUpdate({
            target: [brandMembers.userId, brandMembers.brandId],
            set: { role: "avelero" },
          });

        await setActiveBrand(db, user.id, input.brand_id);

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.member.add_self",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            role: "avelero",
          },
        });

        return { success: true as const, brand_id: input.brand_id };
      }),

    removeSelf: platformAdminProcedure
      .input(platformMemberSelfSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        const [existing] = await db
          .select({ role: brandMembers.role })
          .from(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              eq(brandMembers.userId, user.id),
            ),
          )
          .limit(1);

        if (existing?.role !== "avelero") {
          throw badRequest(
            "Only an avelero membership can be removed with this action",
          );
        }

        await db
          .delete(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              eq(brandMembers.userId, user.id),
              eq(brandMembers.role, "avelero"),
            ),
          );

        const [current] = await db
          .select({ brandId: users.brandId })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        let nextBrandId = current?.brandId ?? null;
        if (nextBrandId === input.brand_id) {
          nextBrandId = await computeNextBrandIdForUser(
            db,
            user.id,
            input.brand_id,
          );

          await db
            .update(users)
            .set({ brandId: nextBrandId })
            .where(eq(users.id, user.id));
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.member.remove_self",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            nextBrandId,
            role: "avelero",
          },
        });

        return { success: true as const, nextBrandId };
      }),
  }),
});

type PlatformAdminRouter = typeof platformAdminRouter;
