import { tasks } from "@trigger.dev/sdk/v3";
import { and, asc, desc, eq, inArray, isNull, sql } from "@v1/db/queries";
import {
  computeNextBrandIdForUser,
  createBrand,
  createBrandInvites,
  isSlugTaken,
  setActiveBrand,
} from "@v1/db/queries/brand";
import {
  brandBilling,
  brandBillingEvents,
  brandInvites,
  brandLifecycle,
  brandMembers,
  brandPlan,
  brands,
  platformAdminAuditLogs,
  users,
} from "@v1/db/schema";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { z } from "zod";
import { brandCreateSchema } from "../../../schemas/brand.js";
import { assignableRoleSchema } from "../../../schemas/_shared/domain.js";
import { createCheckoutSession } from "../../../lib/stripe/checkout.js";
import { findOrCreateStripeCustomer } from "../../../lib/stripe/customer.js";
import { createEnterpriseInvoice } from "../../../lib/stripe/invoice.js";
import { badRequest, notFound, wrapError } from "../../../utils/errors.js";
import {
  createTRPCRouter,
  platformAdminProcedure,
  type AuthenticatedTRPCContext,
} from "../../init.js";

const phaseValues = [
  "demo",
  "trial",
  "expired",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;

const phaseSchema = z.enum(phaseValues);
const billingOverrideSchema = z.enum([
  "none",
  "temporary_allow",
  "temporary_block",
]);
const billingModeSchema = z.enum(["stripe_checkout", "stripe_invoice"]);
const planTypeSchema = z.enum(["starter", "growth", "scale", "enterprise"]);

const platformInviteSendSchema = z.object({
  brand_id: z.string().uuid(),
  email: z.string().trim().email(),
  role: assignableRoleSchema.default("member"),
});

const platformMemberSelfSchema = z.object({
  brand_id: z.string().uuid(),
});

const platformBrandIdSchema = z.object({
  brand_id: z.string().uuid(),
});

const platformBrandsListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  phase: phaseSchema.optional(),
  sort_by: z
    .enum([
      "name",
      "phase",
      "plan",
      "sku_usage",
      "trial_ends",
      "members",
      "created",
    ])
    .default("created"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(25),
});

const platformBrandIdentityUpdateSchema = z
  .object({
    brand_id: z.string().uuid(),
    name: z.string().trim().min(1).max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    email: z.string().trim().email().nullable().optional(),
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .length(2)
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.email === undefined &&
      value.country_code === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update",
      });
    }
  });

const platformExtendTrialSchema = z.object({
  brand_id: z.string().uuid(),
  trial_ends_at: z.string().datetime(),
});

const platformPlanUpdateSchema = z
  .object({
    brand_id: z.string().uuid(),
    plan_type: planTypeSchema.nullable().optional(),
    sku_annual_limit: z.number().int().min(0).nullable().optional(),
    sku_onboarding_limit: z.number().int().min(0).nullable().optional(),
    sku_limit_override: z.number().int().min(0).nullable().optional(),
    billing_mode: billingModeSchema.nullable().optional(),
    custom_price_cents: z.number().int().min(0).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.plan_type === undefined &&
      value.sku_annual_limit === undefined &&
      value.sku_onboarding_limit === undefined &&
      value.sku_limit_override === undefined &&
      value.billing_mode === undefined &&
      value.custom_price_cents === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update",
      });
    }
  });

const platformBillingOverrideSchema = z.object({
  brand_id: z.string().uuid(),
  override: billingOverrideSchema,
  expires_at: z.string().datetime().nullable().optional(),
});

const platformMemberRemoveSchema = z.object({
  brand_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

const platformInviteRevokeSchema = z.object({
  invite_id: z.string().uuid(),
});

const platformAuditListSchema = z.object({
  brand_id: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(25),
});


type InviteResultRow = {
  email: string;
  role: "owner" | "member";
  brand: { id: string | null; name: string | null } | null;
  tokenHash: string | null;
};

type InviteEmailPayload = {
  recipientEmail: string;
  brandName: string;
  role: "owner" | "member";
  acceptUrl: string;
  ctaMode: "accept";
};

function normalizeSearch(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function buildStorageProxyUrl(
  bucket: "avatars" | "brand-avatars",
  path: string | null,
) {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/${bucket}/${encoded}`;
}

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
  const payload = invites.reduce<InviteEmailPayload[]>((acc, invite) => {
    if (!invite.tokenHash) {
      logger.error(
        {
          inviteEmail: invite.email,
          brandId: invite.brand?.id,
        },
        "Invite email skipped because token hash is missing",
      );
      return acc;
    }

    acc.push({
      recipientEmail: invite.email,
      brandName: invite.brand?.name ?? "Avelero",
      role: invite.role,
      acceptUrl: `${appUrl}/api/auth/accept?token_hash=${invite.tokenHash}`,
      ctaMode: "accept",
    });

    return acc;
  }, []);

  if (payload.length === 0) return;

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
  viewer: createTRPCRouter({
    get: platformAdminProcedure.query(async ({ ctx }) => {
      const [profile] = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          avatarPath: users.avatarPath,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      return {
        id: profile?.id ?? ctx.user.id,
        email: profile?.email ?? ctx.user.email ?? null,
        full_name: profile?.fullName ?? null,
        avatar_url: buildStorageProxyUrl(
          "avatars",
          profile?.avatarPath ?? null,
        ),
      };
    }),
  }),

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
          const result = await createBrand(db, user.id, payload, {
            creatorRole: "avelero",
          });
          await logPlatformAdminAction(ctx, {
            action: "platform_admin.brand.create",
            resourceType: "brand",
            resourceId: result.id,
            payload: {
              brandId: result.id,
              creatorRole: "avelero",
              slug: result.slug,
            },
          });
          return result;
        } catch (error) {
          throw wrapError(error, "Failed to create brand");
        }
      }),

    list: platformAdminProcedure
      .input(platformBrandsListSchema)
      .query(async ({ ctx, input }) => {
        const normalizedSearch = normalizeSearch(input.search);
        const filters = [isNull(brands.deletedAt)];

        if (input.phase) {
          filters.push(eq(brandLifecycle.phase, input.phase));
        }

        if (normalizedSearch) {
          filters.push(
            sql`LOWER(${brands.name}) LIKE ${`%${normalizedSearch}%`}`,
          );
        }

        const whereClause = and(...filters);
        const membersCountExpr = sql<number>`COUNT(${brandMembers.userId})::int`;
        const sortDirection = input.sort_dir === "asc" ? asc : desc;
        const sortExpression = (() => {
          switch (input.sort_by) {
            case "name":
              return brands.name;
            case "phase":
              return sql`COALESCE(${brandLifecycle.phase}, 'demo')`;
            case "plan":
              return sql`COALESCE(${brandPlan.planType}, '')`;
            case "sku_usage":
              return sql`COALESCE(${brandPlan.skusCreatedThisYear}, 0)`;
            case "trial_ends":
              return sql`COALESCE(${brandLifecycle.trialEndsAt}, '1970-01-01T00:00:00.000Z'::timestamptz)`;
            case "members":
              return sql`COUNT(${brandMembers.userId})`;
            default:
              return brands.createdAt;
          }
        })();

        const [countRow] = await ctx.db
          .select({
            total: sql<number>`COUNT(DISTINCT ${brands.id})::int`,
          })
          .from(brands)
          .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brands.id))
          .where(whereClause);

        const rows = await ctx.db
          .select({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
            createdAt: brands.createdAt,
            phase: brandLifecycle.phase,
            trialEndsAt: brandLifecycle.trialEndsAt,
            planType: brandPlan.planType,
            skuAnnualLimit: brandPlan.skuAnnualLimit,
            skuLimitOverride: brandPlan.skuLimitOverride,
            skusCreatedThisYear: brandPlan.skusCreatedThisYear,
            membersCount: membersCountExpr,
          })
          .from(brands)
          .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brands.id))
          .leftJoin(brandPlan, eq(brandPlan.brandId, brands.id))
          .leftJoin(
            brandMembers,
            and(
              eq(brandMembers.brandId, brands.id),
              inArray(brandMembers.role, ["owner", "member"]),
            ),
          )
          .where(whereClause)
          .groupBy(
            brands.id,
            brands.name,
            brands.slug,
            brands.createdAt,
            brandLifecycle.phase,
            brandLifecycle.trialEndsAt,
            brandPlan.planType,
            brandPlan.skuAnnualLimit,
            brandPlan.skuLimitOverride,
            brandPlan.skusCreatedThisYear,
          )
          .orderBy(sortDirection(sortExpression), asc(brands.id))
          .limit(input.page_size)
          .offset((input.page - 1) * input.page_size);

        const items = rows.map((row) => {
          const annualLimit = row.skuLimitOverride ?? row.skuAnnualLimit;
          const annualUsed = row.skusCreatedThisYear ?? 0;

          return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            created_at: row.createdAt,
            phase: row.phase ?? "demo",
            plan_type: row.planType,
            sku_usage: {
              used: annualUsed,
              limit: annualLimit,
            },
            trial_ends_at: row.trialEndsAt,
            members_count: row.membersCount,
          };
        });

        return {
          items,
          total: countRow?.total ?? 0,
          page: input.page,
          page_size: input.page_size,
        };
      }),

    get: platformAdminProcedure
      .input(platformBrandIdSchema)
      .query(async ({ ctx, input }) => {
        const [brand] = await ctx.db
          .select({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
            email: brands.email,
            countryCode: brands.countryCode,
            logoPath: brands.logoPath,
            createdAt: brands.createdAt,
            lifecyclePhase: brandLifecycle.phase,
            phaseChangedAt: brandLifecycle.phaseChangedAt,
            trialStartedAt: brandLifecycle.trialStartedAt,
            trialEndsAt: brandLifecycle.trialEndsAt,
            cancelledAt: brandLifecycle.cancelledAt,
            hardDeleteAfter: brandLifecycle.hardDeleteAfter,
            planType: brandPlan.planType,
            planSelectedAt: brandPlan.planSelectedAt,
            skuAnnualLimit: brandPlan.skuAnnualLimit,
            skuOnboardingLimit: brandPlan.skuOnboardingLimit,
            skuLimitOverride: brandPlan.skuLimitOverride,
            skusCreatedThisYear: brandPlan.skusCreatedThisYear,
            skusCreatedOnboarding: brandPlan.skusCreatedOnboarding,
            skuYearStart: brandPlan.skuYearStart,
            maxSeats: brandPlan.maxSeats,
            billingMode: brandBilling.billingMode,
            stripeCustomerId: brandBilling.stripeCustomerId,
            stripeSubscriptionId: brandBilling.stripeSubscriptionId,
            planCurrency: brandBilling.planCurrency,
            customPriceCents: brandBilling.customPriceCents,
            billingAccessOverride: brandBilling.billingAccessOverride,
            billingOverrideExpiresAt: brandBilling.billingOverrideExpiresAt,
          })
          .from(brands)
          .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brands.id))
          .leftJoin(brandPlan, eq(brandPlan.brandId, brands.id))
          .leftJoin(brandBilling, eq(brandBilling.brandId, brands.id))
          .where(and(eq(brands.id, input.brand_id), isNull(brands.deletedAt)))
          .limit(1);

        if (!brand) {
          throw notFound("Brand", input.brand_id);
        }

        const [memberCount] = await ctx.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              inArray(brandMembers.role, ["owner", "member"]),
            ),
          );

        const [totalMemberCount] = await ctx.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(brandMembers)
          .where(eq(brandMembers.brandId, input.brand_id));

        const billingEvents = await ctx.db
          .select({
            id: brandBillingEvents.id,
            event_type: brandBillingEvents.eventType,
            stripe_event_id: brandBillingEvents.stripeEventId,
            payload: brandBillingEvents.payload,
            created_at: brandBillingEvents.createdAt,
          })
          .from(brandBillingEvents)
          .where(eq(brandBillingEvents.brandId, input.brand_id))
          .orderBy(desc(brandBillingEvents.createdAt))
          .limit(10);

        const annualLimit = brand.skuLimitOverride ?? brand.skuAnnualLimit;
        const annualUsed = brand.skusCreatedThisYear ?? 0;
        const annualRemaining =
          annualLimit === null ? null : Math.max(annualLimit - annualUsed, 0);

        const onboardingLimit = brand.skuOnboardingLimit;
        const onboardingUsed = brand.skusCreatedOnboarding ?? 0;
        const onboardingRemaining =
          onboardingLimit === null
            ? null
            : Math.max(onboardingLimit - onboardingUsed, 0);

        return {
          brand: {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            email: brand.email,
            country_code: brand.countryCode,
            logo_url: buildStorageProxyUrl("brand-avatars", brand.logoPath),
            created_at: brand.createdAt,
            members_count: memberCount?.count ?? 0,
            members_total_count: totalMemberCount?.count ?? 0,
          },
          lifecycle: {
            phase: brand.lifecyclePhase ?? "demo",
            phase_changed_at: brand.phaseChangedAt,
            trial_started_at: brand.trialStartedAt,
            trial_ends_at: brand.trialEndsAt,
            cancelled_at: brand.cancelledAt,
            hard_delete_after: brand.hardDeleteAfter,
          },
          plan: {
            plan_type: brand.planType,
            plan_selected_at: brand.planSelectedAt,
            sku_annual_limit: brand.skuAnnualLimit,
            sku_onboarding_limit: brand.skuOnboardingLimit,
            sku_limit_override: brand.skuLimitOverride,
            skus_created_this_year: annualUsed,
            skus_created_onboarding: onboardingUsed,
            sku_year_start: brand.skuYearStart,
            max_seats: brand.maxSeats,
          },
          usage: {
            annual: {
              used: annualUsed,
              limit: annualLimit,
              remaining: annualRemaining,
            },
            onboarding: {
              used: onboardingUsed,
              limit: onboardingLimit,
              remaining: onboardingRemaining,
            },
          },
          billing: {
            billing_mode: brand.billingMode,
            stripe_customer_id: brand.stripeCustomerId,
            stripe_subscription_id: brand.stripeSubscriptionId,
            plan_currency: brand.planCurrency,
            custom_price_cents: brand.customPriceCents,
            billing_access_override: brand.billingAccessOverride,
            billing_override_expires_at: brand.billingOverrideExpiresAt,
            events: billingEvents,
          },
        };
      }),

    updateIdentity: platformAdminProcedure
      .input(platformBrandIdentityUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const updates: Partial<{
          name: string;
          slug: string | null;
          email: string | null;
          countryCode: string | null;
        }> = {};

        if (input.slug !== undefined) {
          const taken = await isSlugTaken(ctx.db, input.slug, input.brand_id);
          if (taken) {
            throw badRequest("This slug is already taken");
          }
          updates.slug = input.slug;
        }

        if (input.name !== undefined) {
          updates.name = input.name;
        }
        if (input.email !== undefined) {
          updates.email = input.email;
        }
        if (input.country_code !== undefined) {
          updates.countryCode = input.country_code;
        }

        const [updatedBrand] = await ctx.db
          .update(brands)
          .set(updates)
          .where(and(eq(brands.id, input.brand_id), isNull(brands.deletedAt)))
          .returning({ id: brands.id });

        if (!updatedBrand) {
          throw notFound("Brand", input.brand_id);
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.brand.update_identity",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            updates,
          },
        });

        return { success: true as const };
      }),
  }),

  lifecycle: createTRPCRouter({
    extendTrial: platformAdminProcedure
      .input(platformExtendTrialSchema)
      .mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db
          .select({
            phase: brandLifecycle.phase,
            trialStartedAt: brandLifecycle.trialStartedAt,
          })
          .from(brandLifecycle)
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .limit(1);

        if (!existing) {
          throw badRequest("Brand lifecycle row not found");
        }

        if (existing.phase !== "trial" && existing.phase !== "expired") {
          throw badRequest(
            "Trial can only be extended for trial or expired brands",
          );
        }

        const nowIso = new Date().toISOString();

        await ctx.db
          .update(brandLifecycle)
          .set({
            phase: "trial",
            phaseChangedAt:
              existing.phase === "expired"
                ? nowIso
                : brandLifecycle.phaseChangedAt,
            trialStartedAt: existing.trialStartedAt ?? nowIso,
            trialEndsAt: input.trial_ends_at,
          })
          .where(eq(brandLifecycle.brandId, input.brand_id));

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.lifecycle.extend_trial",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            trialEndsAt: input.trial_ends_at,
          },
        });

        return { success: true as const, phase: "trial" as const };
      }),

    suspend: platformAdminProcedure
      .input(platformBrandIdSchema)
      .mutation(async ({ ctx, input }) => {
        const nowIso = new Date().toISOString();

        const [updatedLifecycle] = await ctx.db
          .update(brandLifecycle)
          .set({
            phase: "suspended",
            phaseChangedAt: nowIso,
          })
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .returning({ id: brandLifecycle.id });

        if (!updatedLifecycle) {
          throw badRequest("Brand lifecycle row not found");
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.lifecycle.suspend",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
          },
        });

        return { success: true as const, phase: "suspended" as const };
      }),

    reactivate: platformAdminProcedure
      .input(platformBrandIdSchema)
      .mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db
          .select({
            phase: brandLifecycle.phase,
            trialEndsAt: brandLifecycle.trialEndsAt,
            planType: brandPlan.planType,
          })
          .from(brandLifecycle)
          .leftJoin(brandPlan, eq(brandPlan.brandId, brandLifecycle.brandId))
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .limit(1);

        if (!existing) {
          throw badRequest("Brand lifecycle row not found");
        }

        if (existing.phase !== "suspended") {
          throw badRequest("Only suspended brands can be reactivated");
        }

        const now = Date.now();
        let nextPhase: "trial" | "expired" | "active" = "active";

        if (
          existing.trialEndsAt &&
          new Date(existing.trialEndsAt).getTime() > now &&
          !existing.planType
        ) {
          nextPhase = "trial";
        } else if (!existing.planType) {
          nextPhase = "expired";
        }

        await ctx.db
          .update(brandLifecycle)
          .set({
            phase: nextPhase,
            phaseChangedAt: new Date(now).toISOString(),
          })
          .where(eq(brandLifecycle.brandId, input.brand_id));

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.lifecycle.reactivate",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            nextPhase,
          },
        });

        return { success: true as const, phase: nextPhase };
      }),

    cancel: platformAdminProcedure
      .input(
        z.object({
          brand_id: z.string().uuid(),
          hard_delete_after: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const now = new Date();
        const hardDeleteAfter =
          input.hard_delete_after ??
          new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const [updatedLifecycle] = await ctx.db
          .update(brandLifecycle)
          .set({
            phase: "cancelled",
            phaseChangedAt: now.toISOString(),
            cancelledAt: now.toISOString(),
            hardDeleteAfter,
          })
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .returning({ id: brandLifecycle.id });

        if (!updatedLifecycle) {
          throw badRequest("Brand lifecycle row not found");
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.lifecycle.cancel",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            hardDeleteAfter,
          },
        });

        return { success: true as const, phase: "cancelled" as const };
      }),
  }),

  plan: createTRPCRouter({
    update: platformAdminProcedure
      .input(platformPlanUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const nowIso = new Date().toISOString();

        const planUpdates: Partial<{
          planType: "starter" | "growth" | "scale" | "enterprise" | null;
          planSelectedAt: string | null;
          skuAnnualLimit: number | null;
          skuOnboardingLimit: number | null;
          skuLimitOverride: number | null;
        }> = {};

        const billingUpdates: Partial<{
          billingMode: "stripe_checkout" | "stripe_invoice" | null;
          customPriceCents: number | null;
        }> = {};

        if (input.plan_type !== undefined) {
          planUpdates.planType = input.plan_type;
          planUpdates.planSelectedAt = input.plan_type ? nowIso : null;
        }
        if (input.sku_annual_limit !== undefined) {
          planUpdates.skuAnnualLimit = input.sku_annual_limit;
        }
        if (input.sku_onboarding_limit !== undefined) {
          planUpdates.skuOnboardingLimit = input.sku_onboarding_limit;
        }
        if (input.sku_limit_override !== undefined) {
          planUpdates.skuLimitOverride = input.sku_limit_override;
        }

        if (input.billing_mode !== undefined) {
          billingUpdates.billingMode = input.billing_mode;
        }
        if (input.custom_price_cents !== undefined) {
          billingUpdates.customPriceCents =
            input.custom_price_cents;
        }

        if (Object.keys(planUpdates).length > 0) {
          await ctx.db
            .update(brandPlan)
            .set(planUpdates)
            .where(eq(brandPlan.brandId, input.brand_id));
        }

        if (Object.keys(billingUpdates).length > 0) {
          await ctx.db
            .update(brandBilling)
            .set(billingUpdates)
            .where(eq(brandBilling.brandId, input.brand_id));
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.plan.update",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            planUpdates,
            billingUpdates,
          },
        });

        return { success: true as const };
      }),
  }),

  billing: createTRPCRouter({
    setAccessOverride: platformAdminProcedure
      .input(platformBillingOverrideSchema)
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(brandBilling)
          .set({
            billingAccessOverride: input.override,
            billingOverrideExpiresAt:
              input.override === "none" ? null : input.expires_at ?? null,
          })
          .where(eq(brandBilling.brandId, input.brand_id));

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.set_access_override",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            override: input.override,
            expiresAt: input.expires_at ?? null,
          },
        });

        return { success: true as const };
      }),

    createCheckoutLink: platformAdminProcedure
      .input(
        z.object({
          brand_id: z.string().uuid(),
          tier: z.enum(["starter", "growth", "scale"]),
          interval: z.enum(["monthly", "yearly"]),
          include_impact: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;

        // Only allow checkout for brands in trial or expired phase
        const [lifecycle] = await db
          .select({ phase: brandLifecycle.phase })
          .from(brandLifecycle)
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .limit(1);

        if (
          !lifecycle ||
          !["trial", "expired"].includes(lifecycle.phase)
        ) {
          throw badRequest(
            "Checkout links can only be created for brands in trial or expired phase. Use the Stripe Customer Portal for active or past_due brands.",
          );
        }

        const [brand] = await db
          .select({ name: brands.name, email: brands.email })
          .from(brands)
          .where(eq(brands.id, input.brand_id))
          .limit(1);

        if (!brand) {
          throw notFound("Brand not found");
        }

        if (!brand.email) {
          throw badRequest(
            "Brand has no email set. Set the brand email first before creating a checkout link.",
          );
        }

        const stripeCustomerId = await findOrCreateStripeCustomer({
          brandId: input.brand_id,
          brandName: brand.name,
          email: brand.email,
          db,
        });

        const appUrl = getAppUrl();
        const session = await createCheckoutSession({
          brandId: input.brand_id,
          stripeCustomerId,
          tier: input.tier,
          interval: input.interval,
          includeImpact: input.include_impact,
          successUrl: `${appUrl}/settings/billing?checkout=success`,
          cancelUrl: `${appUrl}/settings/billing?checkout=cancelled`,
        });

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.create_checkout_link",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            tier: input.tier,
            interval: input.interval,
            includeImpact: input.include_impact,
            checkoutUrl: session.url,
          },
        });

        return { ok: true as const, url: session.url };
      }),

    createInvoice: platformAdminProcedure
      .input(
        z.object({
          brand_id: z.string().uuid(),
          amount_cents: z.number().int().positive(),
          description: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;

        const [brand] = await db
          .select({ name: brands.name, email: brands.email })
          .from(brands)
          .where(eq(brands.id, input.brand_id))
          .limit(1);

        if (!brand) {
          throw notFound("Brand not found");
        }

        // Verify brand is Enterprise
        const [billing] = await db
          .select({ billingMode: brandBilling.billingMode })
          .from(brandBilling)
          .where(eq(brandBilling.brandId, input.brand_id))
          .limit(1);

        if (billing?.billingMode !== "stripe_invoice") {
          throw badRequest(
            "Invoices can only be created for Enterprise brands (billing_mode = stripe_invoice)",
          );
        }

        if (!brand.email) {
          throw badRequest(
            "Brand has no email set. Set the brand email first before creating an invoice.",
          );
        }

        const stripeCustomerId = await findOrCreateStripeCustomer({
          brandId: input.brand_id,
          brandName: brand.name,
          email: brand.email,
          db,
        });

        const result = await createEnterpriseInvoice({
          brandId: input.brand_id,
          stripeCustomerId,
          amountCents: input.amount_cents,
          description: input.description ?? "Avelero Enterprise",
        });

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.create_invoice",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            amountCents: input.amount_cents,
            description: input.description,
            invoiceId: result.invoiceId,
          },
        });

        return {
          ok: true as const,
          invoice_id: result.invoiceId,
          invoice_url: result.invoiceUrl,
        };
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

    list: platformAdminProcedure
      .input(platformBrandIdSchema)
      .query(async ({ ctx, input }) => {
        const nowIso = new Date().toISOString();
        const rows = await ctx.db
          .select({
            id: brandInvites.id,
            email: brandInvites.email,
            role: brandInvites.role,
            createdAt: brandInvites.createdAt,
            expiresAt: brandInvites.expiresAt,
            invitedByEmail: users.email,
            invitedByFullName: users.fullName,
          })
          .from(brandInvites)
          .leftJoin(users, eq(users.id, brandInvites.createdBy))
          .where(
            and(
              eq(brandInvites.brandId, input.brand_id),
              sql`("brand_invites"."expires_at" IS NULL OR "brand_invites"."expires_at" > ${nowIso})`,
            ),
          )
          .orderBy(desc(brandInvites.createdAt));

        return {
          items: rows.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            created_at: invite.createdAt,
            expires_at: invite.expiresAt,
            invited_by:
              invite.invitedByFullName ??
              invite.invitedByEmail ??
              "Avelero Team",
          })),
        };
      }),

    revoke: platformAdminProcedure
      .input(platformInviteRevokeSchema)
      .mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db
          .select({
            id: brandInvites.id,
            brandId: brandInvites.brandId,
            email: brandInvites.email,
          })
          .from(brandInvites)
          .where(eq(brandInvites.id, input.invite_id))
          .limit(1);

        if (!existing) {
          throw notFound("Invite", input.invite_id);
        }

        await ctx.db
          .delete(brandInvites)
          .where(eq(brandInvites.id, input.invite_id));

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.invite.revoke",
          resourceType: "brand",
          resourceId: existing.brandId,
          payload: {
            brandId: existing.brandId,
            inviteId: input.invite_id,
            email: existing.email,
          },
        });

        return { success: true as const };
      }),
  }),

  members: createTRPCRouter({
    list: platformAdminProcedure
      .input(platformBrandIdSchema)
      .query(async ({ ctx, input }) => {
        const rows = await ctx.db
          .select({
            userId: brandMembers.userId,
            role: brandMembers.role,
            createdAt: brandMembers.createdAt,
            email: users.email,
            fullName: users.fullName,
            avatarPath: users.avatarPath,
          })
          .from(brandMembers)
          .leftJoin(users, eq(users.id, brandMembers.userId))
          .where(eq(brandMembers.brandId, input.brand_id))
          .orderBy(asc(brandMembers.createdAt));

        return {
          items: rows.map((member) => ({
            user_id: member.userId,
            role: member.role,
            joined_at: member.createdAt,
            email: member.email,
            full_name: member.fullName,
            avatar_url: buildStorageProxyUrl("avatars", member.avatarPath),
          })),
        };
      }),

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

        if (existing?.role !== "avelero" && existing?.role !== "owner") {
          throw badRequest(
            "Only an owner or avelero membership can be removed with this action",
          );
        }

        let ownerCountBefore: number | null = null;
        if (existing.role === "owner") {
          const [ownerCount] = await db
            .select({
              count: sql<number>`COUNT(*)::int`,
            })
            .from(brandMembers)
            .where(
              and(
                eq(brandMembers.brandId, input.brand_id),
                eq(brandMembers.role, "owner"),
              ),
            );

          ownerCountBefore = ownerCount?.count ?? 0;
        }

        await db
          .delete(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              eq(brandMembers.userId, user.id),
            ),
          );

        const ownerCountAfter =
          ownerCountBefore === null ? null : Math.max(ownerCountBefore - 1, 0);
        const orphaned = ownerCountAfter === 0;

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
            role: existing.role,
            ownerCountBefore,
            ownerCountAfter,
            orphaned,
          },
        });

        return { success: true as const, nextBrandId };
      }),

    remove: platformAdminProcedure
      .input(platformMemberRemoveSchema)
      .mutation(async ({ ctx, input }) => {
        const [target] = await ctx.db
          .select({
            role: brandMembers.role,
          })
          .from(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              eq(brandMembers.userId, input.user_id),
            ),
          )
          .limit(1);

        if (!target) {
          throw notFound("Member", input.user_id);
        }

        let ownerCountBefore: number | null = null;
        if (target.role === "owner") {
          const [ownerCount] = await ctx.db
            .select({
              count: sql<number>`COUNT(*)::int`,
            })
            .from(brandMembers)
            .where(
              and(
                eq(brandMembers.brandId, input.brand_id),
                eq(brandMembers.role, "owner"),
              ),
            );

          ownerCountBefore = ownerCount?.count ?? 0;
        }

        await ctx.db
          .delete(brandMembers)
          .where(
            and(
              eq(brandMembers.brandId, input.brand_id),
              eq(brandMembers.userId, input.user_id),
            ),
          );

        const ownerCountAfter =
          ownerCountBefore === null ? null : Math.max(ownerCountBefore - 1, 0);
        const orphaned = ownerCountAfter === 0;

        const [current] = await ctx.db
          .select({ brandId: users.brandId })
          .from(users)
          .where(eq(users.id, input.user_id))
          .limit(1);

        let nextBrandId = current?.brandId ?? null;
        if (nextBrandId === input.brand_id) {
          nextBrandId = await computeNextBrandIdForUser(
            ctx.db,
            input.user_id,
            input.brand_id,
          );

          await ctx.db
            .update(users)
            .set({ brandId: nextBrandId })
            .where(eq(users.id, input.user_id));
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.member.remove",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            userId: input.user_id,
            removedRole: target.role,
            ownerCountBefore,
            ownerCountAfter,
            orphaned,
            nextBrandId,
          },
        });

        return { success: true as const, nextBrandId };
      }),
  }),

  audit: createTRPCRouter({
    list: platformAdminProcedure
      .input(platformAuditListSchema)
      .query(async ({ ctx, input }) => {
        const [countRow] = await ctx.db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(platformAdminAuditLogs)
          .where(
            and(
              eq(platformAdminAuditLogs.resourceType, "brand"),
              eq(platformAdminAuditLogs.resourceId, input.brand_id),
            ),
          );

        const offset = (input.page - 1) * input.page_size;

        const rows = await ctx.db
          .select({
            id: platformAdminAuditLogs.id,
            action: platformAdminAuditLogs.action,
            payload: platformAdminAuditLogs.payload,
            createdAt: platformAdminAuditLogs.createdAt,
            actorEmail: users.email,
            actorFullName: users.fullName,
          })
          .from(platformAdminAuditLogs)
          .leftJoin(users, eq(users.id, platformAdminAuditLogs.actorUserId))
          .where(
            and(
              eq(platformAdminAuditLogs.resourceType, "brand"),
              eq(platformAdminAuditLogs.resourceId, input.brand_id),
            ),
          )
          .orderBy(desc(platformAdminAuditLogs.createdAt))
          .limit(input.page_size)
          .offset(offset);

        return {
          items: rows.map((row) => ({
            id: row.id,
            action: row.action,
            payload: row.payload,
            created_at: row.createdAt,
            actor_email: row.actorEmail,
            actor_full_name: row.actorFullName,
          })),
          total: countRow?.count ?? 0,
          page: input.page,
          page_size: input.page_size,
        };
      }),
  }),
});

type PlatformAdminRouter = typeof platformAdminRouter;
