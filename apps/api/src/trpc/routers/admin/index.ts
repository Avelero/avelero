import { tasks } from "@trigger.dev/sdk/v3";
import {
  addBrandMemberByEmailAsAdmin,
  AdminBrandNotFoundError,
  AdminInviteNotFoundError,
  AdminMemberAlreadyExistsError,
  AdminMemberNotFoundError,
  AdminSoleOwnerError,
  AdminUserNotFoundError,
  assertAdminBrandExists,
  createBrand,
  createBrandInvites,
  getAdminBrandDetail,
  getBrandControlByBrandId,
  insertPlatformAdminAuditLog,
  listAdminBrands,
  listPlatformAdminAuditLogsByBrand,
  removeBrandMemberAsAdmin,
  revokeBrandInviteByAdmin,
  upsertBrandControl,
} from "@v1/db/queries";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import {
  adminAuditListSchema,
  adminBrandCreateSchema,
  adminBrandGetSchema,
  adminBrandsListSchema,
  adminBrandUpdateControlSchema,
  adminInviteRevokeSchema,
  adminInviteSendSchema,
  adminMemberAddSchema,
  adminMemberRemoveSchema,
} from "../../../schemas/admin.js";
import {
  alreadyExists,
  badRequest,
  notFound,
  soleOwnerError,
  wrapError,
} from "../../../utils/errors.js";
import { createTRPCRouter, platformAdminProcedure } from "../../init.js";

type InviteEmailPayload = {
  recipientEmail: string;
  brandName: string;
  role: "owner" | "member";
  acceptUrl: string;
};

function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;

  const appUrl = getAppUrl();
  const knownPrefixes = [
    "/api/storage/brand-avatars/",
    `${appUrl}/api/storage/brand-avatars/`,
  ];

  for (const prefix of knownPrefixes) {
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
  }

  const match = url.match(/brand-avatars\/(.+)$/);
  if (match) {
    return match[1] ?? null;
  }

  return url;
}

function buildBrandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const appUrl = getAppUrl();
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${appUrl}/api/storage/brand-avatars/${encoded}`;
}

function toControlPayload(input: {
  qualificationStatus: string;
  operationalStatus: string;
  billingStatus: string;
  billingMode: string | null;
  billingAccessOverride: string;
  planType: string | null;
  planCurrency: string;
  customMonthlyPriceCents: number | null;
}) {
  return {
    qualification_status: input.qualificationStatus,
    operational_status: input.operationalStatus,
    billing_status: input.billingStatus,
    billing_mode: input.billingMode,
    billing_access_override: input.billingAccessOverride,
    plan_type: input.planType,
    plan_currency: input.planCurrency,
    custom_monthly_price_cents: input.customMonthlyPriceCents,
  };
}

const adminBrandsRouter = createTRPCRouter({
  list: platformAdminProcedure
    .input(adminBrandsListSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const result = await listAdminBrands(ctx.db, {
        search: input.search,
        limit: input.limit,
        offset: input.offset,
        includeDeleted: input.include_deleted,
      });

      return {
        total: result.total,
        items: result.items.map((brand) => ({
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          email: brand.email,
          country_code: brand.countryCode,
          logo_url: buildBrandLogoUrl(brand.logoPath),
          created_at: brand.createdAt,
          updated_at: brand.updatedAt,
          deleted_at: brand.deletedAt,
          member_count: brand.memberCount,
          pending_invite_count: brand.pendingInviteCount,
          control: toControlPayload(brand.control),
        })),
      };
    }),

  get: platformAdminProcedure
    .input(adminBrandGetSchema)
    .query(async ({ ctx, input }) => {
      const detail = await getAdminBrandDetail(ctx.db, input.brand_id);
      if (!detail) {
        throw notFound("Brand", input.brand_id);
      }

      return {
        brand: {
          id: detail.brand.id,
          name: detail.brand.name,
          slug: detail.brand.slug,
          email: detail.brand.email,
          country_code: detail.brand.countryCode,
          logo_url: buildBrandLogoUrl(detail.brand.logoPath),
          created_at: detail.brand.createdAt,
          updated_at: detail.brand.updatedAt,
          deleted_at: detail.brand.deletedAt,
        },
        control: toControlPayload(detail.control),
        members: detail.members.map((member) => ({
          user_id: member.userId,
          email: member.email,
          full_name: member.fullName,
          avatar_url: member.avatarPath
            ? `${getAppUrl()}/api/storage/avatars/${member.avatarPath
                .split("/")
                .map((segment) => encodeURIComponent(segment))
                .join("/")}`
            : null,
          role: member.role,
          created_at: member.createdAt,
        })),
        pending_invites: detail.pendingInvites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          created_at: invite.createdAt,
          expires_at: invite.expiresAt,
          invited_by_user_id: invite.invitedByUserId,
          invited_by_email: invite.invitedByEmail,
          invited_by_full_name: invite.invitedByFullName,
        })),
      };
    }),

  create: platformAdminProcedure
    .input(adminBrandCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const created = await createBrand(db, user.id, {
        name: input.name,
        slug: input.slug ?? undefined,
        email: input.email ?? undefined,
        country_code: input.country_code ?? undefined,
        logo_path: extractStoragePath(input.logo_url),
      });

      await insertPlatformAdminAuditLog(db, {
        actorUserId: user.id,
        actorEmail: user.email ?? "unknown",
        action: "admin.brand.created",
        targetType: "brand",
        targetId: created.id,
        brandId: created.id,
        metadata: {
          name: input.name,
          slug: created.slug,
        },
      });

      return {
        success: true as const,
        brand_id: created.id,
        slug: created.slug,
      };
    }),

  updateControl: platformAdminProcedure
    .input(adminBrandUpdateControlSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      try {
        await assertAdminBrandExists(db, input.brand_id);

        const existingControl = await getBrandControlByBrandId(
          db,
          input.brand_id,
        );
        const nextPlanType = input.plan_type ?? existingControl?.planType ?? null;
        const nextCustomPrice =
          input.custom_monthly_price_cents ??
          existingControl?.customMonthlyPriceCents ??
          null;

        if (nextPlanType === "custom" && nextCustomPrice == null) {
          throw badRequest("Custom plan requires custom_monthly_price_cents.");
        }

        if (nextPlanType !== "custom" && nextCustomPrice != null) {
          throw badRequest(
            "custom_monthly_price_cents can only be set when plan_type is custom.",
          );
        }

        const updatedControl = await upsertBrandControl(db, {
          brandId: input.brand_id,
          qualificationStatus: input.qualification_status,
          operationalStatus: input.operational_status,
          billingStatus: input.billing_status,
          billingMode: input.billing_mode,
          billingAccessOverride: input.billing_access_override,
          planType: input.plan_type,
          planCurrency: input.plan_currency,
          customMonthlyPriceCents: input.custom_monthly_price_cents,
        });

        await insertPlatformAdminAuditLog(db, {
          actorUserId: user.id,
          actorEmail: user.email ?? "unknown",
          action: "admin.brand.control_updated",
          targetType: "brand",
          targetId: input.brand_id,
          brandId: input.brand_id,
          metadata: {
            patch: {
              qualification_status: input.qualification_status,
              operational_status: input.operational_status,
              billing_status: input.billing_status,
              billing_mode: input.billing_mode,
              billing_access_override: input.billing_access_override,
              plan_type: input.plan_type,
              plan_currency: input.plan_currency,
              custom_monthly_price_cents: input.custom_monthly_price_cents,
            },
          },
        });

        return {
          success: true as const,
          brand_id: input.brand_id,
          control: toControlPayload({
            qualificationStatus: updatedControl.qualificationStatus,
            operationalStatus: updatedControl.operationalStatus,
            billingStatus: updatedControl.billingStatus,
            billingMode: updatedControl.billingMode,
            billingAccessOverride: updatedControl.billingAccessOverride,
            planType: updatedControl.planType,
            planCurrency: updatedControl.planCurrency,
            customMonthlyPriceCents: updatedControl.customMonthlyPriceCents,
          }),
        };
      } catch (error) {
        if (error instanceof AdminBrandNotFoundError) {
          throw notFound("Brand", input.brand_id);
        }
        throw wrapError(error, "Failed to update brand control");
      }
    }),
});

const adminMembersRouter = createTRPCRouter({
  add: platformAdminProcedure
    .input(adminMemberAddSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      try {
        const added = await addBrandMemberByEmailAsAdmin(db, {
          brandId: input.brand_id,
          email: input.email,
          role: input.role,
        });

        await insertPlatformAdminAuditLog(db, {
          actorUserId: user.id,
          actorEmail: user.email ?? "unknown",
          action: "admin.member.added",
          targetType: "brand_member",
          targetId: added.userId,
          brandId: input.brand_id,
          metadata: {
            email: added.email,
            role: added.role,
          },
        });

        return {
          success: true as const,
          brand_id: input.brand_id,
          member: {
            user_id: added.userId,
            email: added.email,
            full_name: added.fullName,
            role: added.role,
          },
        };
      } catch (error) {
        if (error instanceof AdminBrandNotFoundError) {
          throw notFound("Brand", input.brand_id);
        }
        if (error instanceof AdminUserNotFoundError) {
          throw notFound("User", input.email);
        }
        if (error instanceof AdminMemberAlreadyExistsError) {
          throw alreadyExists("Brand member", input.email);
        }
        throw wrapError(error, "Failed to add brand member");
      }
    }),

  remove: platformAdminProcedure
    .input(adminMemberRemoveSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      try {
        const removed = await removeBrandMemberAsAdmin(db, {
          brandId: input.brand_id,
          userId: input.user_id,
        });

        await insertPlatformAdminAuditLog(db, {
          actorUserId: user.id,
          actorEmail: user.email ?? "unknown",
          action: "admin.member.removed",
          targetType: "brand_member",
          targetId: input.user_id,
          brandId: input.brand_id,
          metadata: {
            next_brand_id: removed.nextBrandId,
          },
        });

        return {
          success: true as const,
          brand_id: input.brand_id,
          user_id: removed.removedUserId,
          next_brand_id: removed.nextBrandId,
        };
      } catch (error) {
        if (error instanceof AdminBrandNotFoundError) {
          throw notFound("Brand", input.brand_id);
        }
        if (error instanceof AdminMemberNotFoundError) {
          throw notFound("Brand member");
        }
        if (error instanceof AdminSoleOwnerError) {
          throw soleOwnerError();
        }
        throw wrapError(error, "Failed to remove brand member");
      }
    }),
});

const adminInvitesRouter = createTRPCRouter({
  send: platformAdminProcedure
    .input(adminInviteSendSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      try {
        await assertAdminBrandExists(db, input.brand_id);

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

        const inviteResults = result.results.filter(
          (
            invite,
          ): invite is NonNullable<(typeof result.results)[number]> =>
            invite !== null,
        );

        const appUrl = getAppUrl();
        const payload: InviteEmailPayload[] = inviteResults
          .filter((invite) => Boolean(invite.tokenHash))
          .map((invite) => ({
            recipientEmail: invite.email,
            brandName: invite.brand?.name ?? "Avelero",
            role: invite.role === "owner" ? "owner" : "member",
            acceptUrl: `${appUrl}/api/auth/accept?token_hash=${invite.tokenHash}`,
          }));

        if (payload.length > 0) {
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
              "Failed to enqueue admin invite emails",
            );
          }
        }

        await insertPlatformAdminAuditLog(db, {
          actorUserId: user.id,
          actorEmail: user.email ?? "unknown",
          action: "admin.invite.sent",
          targetType: "brand_invite",
          brandId: input.brand_id,
          metadata: {
            requested_email: input.email,
            role: input.role,
            sent_count: result.results.length,
            skipped_count: result.skippedInvites.length,
            skipped_invites: result.skippedInvites,
          },
        });

        return {
          success: true as const,
          results: inviteResults.map((invite) => ({
            email: invite.email,
            role: invite.role === "owner" ? "owner" : "member",
            brand_id: invite.brand?.id ?? null,
            brand_name: invite.brand?.name ?? null,
          })),
          skipped_invites: result.skippedInvites,
        };
      } catch (error) {
        if (error instanceof AdminBrandNotFoundError) {
          throw notFound("Brand", input.brand_id);
        }
        throw wrapError(error, "Failed to send invite");
      }
    }),

  revoke: platformAdminProcedure
    .input(adminInviteRevokeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      try {
        const revoked = await revokeBrandInviteByAdmin(db, input.invite_id);

        await insertPlatformAdminAuditLog(db, {
          actorUserId: user.id,
          actorEmail: user.email ?? "unknown",
          action: "admin.invite.revoked",
          targetType: "brand_invite",
          targetId: revoked.id,
          brandId: revoked.brandId,
          metadata: {
            email: revoked.email,
            role: revoked.role,
          },
        });

        return {
          success: true as const,
          invite_id: revoked.id,
          brand_id: revoked.brandId,
        };
      } catch (error) {
        if (error instanceof AdminInviteNotFoundError) {
          throw notFound("Brand invite", input.invite_id);
        }
        throw wrapError(error, "Failed to revoke invite");
      }
    }),
});

const adminAuditRouter = createTRPCRouter({
  list: platformAdminProcedure
    .input(adminAuditListSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      try {
        await assertAdminBrandExists(db, input.brand_id);

        const logs = await listPlatformAdminAuditLogsByBrand(
          db,
          input.brand_id,
          input.limit,
        );

        return logs.map((log) => ({
          id: log.id,
          actor_user_id: log.actorUserId,
          actor_email: log.actorEmail,
          action: log.action,
          target_type: log.targetType,
          target_id: log.targetId,
          brand_id: log.brandId,
          metadata: log.metadata,
          created_at: log.createdAt,
        }));
      } catch (error) {
        if (error instanceof AdminBrandNotFoundError) {
          throw notFound("Brand", input.brand_id);
        }
        throw wrapError(error, "Failed to list admin audit logs");
      }
    }),
});

export const adminRouter = createTRPCRouter({
  brands: adminBrandsRouter,
  members: adminMembersRouter,
  invites: adminInvitesRouter,
  audit: adminAuditRouter,
});

type AdminRouter = typeof adminRouter;
