/**
 * Platform admin router for brand, billing, and membership operations.
 */
import { tasks } from "@trigger.dev/sdk/v3";
import { and, asc, desc, eq, inArray, isNull, sql } from "@v1/db/queries";
import {
  FREE_CREDITS,
  countPublishedPassports,
  computeNextBrandIdForUser,
  createBrand,
  createBrandInvites,
  isSlugTaken,
  setActiveBrand,
} from "@v1/db/queries/brand";
import {
  brandBilling,
  brandBillingInvoices,
  brandBillingEvents,
  brandInvites,
  brandLifecycle,
  brandMembers,
  brandPlan,
  brands,
  platformAdminAuditLogs,
  products,
  productVariants,
  users,
} from "@v1/db/schema";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { z } from "zod";
import type {
  BrandLifecyclePhase,
} from "../../../lib/access-policy/types.js";
import { brandCreateSchema } from "../../../schemas/brand.js";
import { assignableRoleSchema } from "../../../schemas/_shared/domain.js";
import { createCheckoutSession } from "../../../lib/stripe/checkout.js";
import { normalizeBillingInterval } from "../../../lib/stripe/config.js";
import { findOrCreateStripeCustomer } from "../../../lib/stripe/customer.js";
import {
  createEnterpriseInvoice,
  sendEnterpriseInvoice,
  voidEnterpriseInvoice,
} from "../../../lib/stripe/invoice.js";
import {
  isoToDate,
  syncStripeSubscriptionProjectionById,
  syncStripeInvoiceProjectionById,
} from "../../../lib/stripe/projection.js";
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
const billingIntervalSchema = z.enum(["quarterly", "yearly"]);
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
    billing_mode: billingModeSchema.nullable().optional(),
    billing_interval: billingIntervalSchema.nullable().optional(),
    custom_price_cents: z.number().int().min(0).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.plan_type === undefined &&
      value.billing_mode === undefined &&
      value.billing_interval === undefined &&
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

const platformEnterpriseInvoiceSchema = z
  .object({
    brand_id: z.string().uuid(),
    recipient_name: z.string().trim().min(1).max(255),
    recipient_email: z.string().trim().email(),
    recipient_tax_id: z.string().trim().max(100).nullable().optional(),
    recipient_address_line_1: z.string().trim().max(255).nullable().optional(),
    recipient_address_line_2: z.string().trim().max(255).nullable().optional(),
    recipient_address_city: z.string().trim().max(255).nullable().optional(),
    recipient_address_region: z.string().trim().max(255).nullable().optional(),
    recipient_address_postal_code: z
      .string()
      .trim()
      .max(50)
      .nullable()
      .optional(),
    recipient_address_country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2)
      .nullable()
      .optional(),
    description: z.string().trim().min(1).max(500),
    amount_cents: z.number().int().positive(),
    currency: z.string().trim().toLowerCase().length(3).default("eur"),
    service_period_start: z.string().datetime(),
    service_period_end: z.string().datetime().optional(),
    due_date: z.string().datetime().nullable().optional(),
    days_until_due: z.number().int().min(1).max(365).nullable().optional(),
    footer: z.string().trim().max(1000).nullable().optional(),
    internal_reference: z.string().trim().max(255).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.due_date && value.days_until_due) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either due_date or days_until_due, not both",
        path: ["due_date"],
      });
    }
  });

const platformInvoiceActionSchema = z.object({
  brand_id: z.string().uuid(),
  invoice_id: z.string().min(1),
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

/**
 * Builds a normalized credit usage snapshot for admin responses.
 */
function buildCreditUsage(totalCredits: number, publishedCount: number) {
  const remaining = Math.max(0, totalCredits - publishedCount);
  const utilization = totalCredits === 0 ? 1 : publishedCount / totalCredits;

  return {
    total: totalCredits,
    published: publishedCount,
    remaining,
    utilization,
  };
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

/**
 * Computes the service-period end by adding one calendar year to the start.
 */
function addOneYearIso(startIso: string): string {
  const value = new Date(startIso);
  value.setUTCFullYear(value.getUTCFullYear() + 1);
  return value.toISOString();
}

/**
 * Derives the billing mode from the selected plan type.
 */
function deriveBillingModeFromPlanType(
  planType: "starter" | "growth" | "scale" | "enterprise" | null,
): "stripe_checkout" | "stripe_invoice" | null {
  if (planType === "enterprise") return "stripe_invoice";
  if (planType === "starter" || planType === "growth" || planType === "scale") {
    return "stripe_checkout";
  }

  return null;
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
        const publishedCountExpr = sql<number>`(
          SELECT COUNT(*)::int
          FROM ${products}
          WHERE ${products.brandId} = ${brands.id}
            AND ${products.status} = 'published'
        )`;

        const rows = await ctx.db
          .select({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
            createdAt: brands.createdAt,
            phase: brandLifecycle.phase,
            trialStartedAt: brandLifecycle.trialStartedAt,
            trialEndsAt: brandLifecycle.trialEndsAt,
            planType: brandPlan.planType,
            totalCredits: brandPlan.totalCredits,
            publishedCount: publishedCountExpr,
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
            brandLifecycle.trialStartedAt,
            brandLifecycle.trialEndsAt,
            brandPlan.planType,
            brandPlan.totalCredits,
          )
          .orderBy(asc(brands.id));

        const items = rows.map((row) => {
          const creditUsage = buildCreditUsage(
            row.totalCredits ?? 0,
            row.publishedCount ?? 0,
          );

          return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            created_at: row.createdAt,
            phase: row.phase ?? "demo",
            plan_type: row.planType,
            sku_usage: {
              used: creditUsage.published,
              limit: creditUsage.total,
            },
            trial_ends_at: row.trialEndsAt,
            members_count: row.membersCount,
          };
        });

        const direction = input.sort_dir === "asc" ? 1 : -1;
        const sortedItems = [...items].sort((left, right) => {
          const compareValue = (() => {
            switch (input.sort_by) {
              case "name":
                return left.name.localeCompare(right.name);
              case "phase":
                return left.phase.localeCompare(right.phase);
              case "plan":
                return (left.plan_type ?? "").localeCompare(right.plan_type ?? "");
              case "sku_usage":
                return left.sku_usage.used - right.sku_usage.used;
              case "trial_ends": {
                const leftTime = left.trial_ends_at
                  ? Date.parse(left.trial_ends_at)
                  : 0;
                const rightTime = right.trial_ends_at
                  ? Date.parse(right.trial_ends_at)
                  : 0;
                return leftTime - rightTime;
              }
              case "members":
                return left.members_count - right.members_count;
              default:
                return (
                  Date.parse(left.created_at) - Date.parse(right.created_at)
                );
            }
          })();

          if (compareValue !== 0) {
            return compareValue * direction;
          }

          return left.id.localeCompare(right.id);
        });
        const paginatedItems = sortedItems.slice(
          (input.page - 1) * input.page_size,
          input.page * input.page_size,
        );

        return {
          items: paginatedItems,
          total: items.length,
          page: input.page,
          page_size: input.page_size,
        };
      }),

    get: platformAdminProcedure
      .input(platformBrandIdSchema)
      .query(async ({ ctx, input }) => {
        const [billingLink] = await ctx.db
          .select({
            billingMode: brandBilling.billingMode,
            stripeSubscriptionId: brandBilling.stripeSubscriptionId,
          })
          .from(brandBilling)
          .where(eq(brandBilling.brandId, input.brand_id))
          .limit(1);

        if (
          billingLink?.billingMode === "stripe_checkout" &&
          billingLink.stripeSubscriptionId
        ) {
          await syncStripeSubscriptionProjectionById({
            db: ctx.db,
            subscriptionId: billingLink.stripeSubscriptionId,
            brandId: input.brand_id,
          });
        }

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
            totalCredits: brandPlan.totalCredits,
            onboardingDiscountUsed: brandPlan.onboardingDiscountUsed,
            billingInterval: brandPlan.billingInterval,
            maxSeats: brandPlan.maxSeats,
            billingMode: brandBilling.billingMode,
            stripeCustomerId: brandBilling.stripeCustomerId,
            stripeSubscriptionId: brandBilling.stripeSubscriptionId,
            planCurrency: brandBilling.planCurrency,
            customPriceCents: brandBilling.customPriceCents,
            currentPeriodStart: brandBilling.currentPeriodStart,
            currentPeriodEnd: brandBilling.currentPeriodEnd,
            pastDueSince: brandBilling.pastDueSince,
            pendingCancellation: brandBilling.pendingCancellation,
            billingAccessOverride: brandBilling.billingAccessOverride,
            billingOverrideExpiresAt: brandBilling.billingOverrideExpiresAt,
            billingLegalName: brandBilling.billingLegalName,
            billingEmail: brandBilling.billingEmail,
            billingTaxId: brandBilling.billingTaxId,
            billingAddressLine1: brandBilling.billingAddressLine1,
            billingAddressLine2: brandBilling.billingAddressLine2,
            billingAddressCity: brandBilling.billingAddressCity,
            billingAddressRegion: brandBilling.billingAddressRegion,
            billingAddressPostalCode: brandBilling.billingAddressPostalCode,
            billingAddressCountry: brandBilling.billingAddressCountry,
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

        const publishedCount = await countPublishedPassports(
          ctx.db,
          input.brand_id,
        );
        const creditUsage = buildCreditUsage(
          brand.totalCredits ?? 0,
          publishedCount,
        );

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

        const invoiceRows = await ctx.db
          .select({
            id: brandBillingInvoices.id,
            stripe_invoice_id: brandBillingInvoices.stripeInvoiceId,
            status: brandBillingInvoices.status,
            collection_method: brandBillingInvoices.collectionMethod,
            currency: brandBillingInvoices.currency,
            amount_due: brandBillingInvoices.amountDue,
            amount_paid: brandBillingInvoices.amountPaid,
            amount_remaining: brandBillingInvoices.amountRemaining,
            due_date: brandBillingInvoices.dueDate,
            paid_at: brandBillingInvoices.paidAt,
            voided_at: brandBillingInvoices.voidedAt,
            hosted_invoice_url: brandBillingInvoices.hostedInvoiceUrl,
            invoice_pdf_url: brandBillingInvoices.invoicePdfUrl,
            invoice_number: brandBillingInvoices.invoiceNumber,
            service_period_start: brandBillingInvoices.servicePeriodStart,
            service_period_end: brandBillingInvoices.servicePeriodEnd,
            recipient_name: brandBillingInvoices.recipientName,
            recipient_email: brandBillingInvoices.recipientEmail,
            description: brandBillingInvoices.description,
            internal_reference: brandBillingInvoices.internalReference,
            managed_by_avelero: brandBillingInvoices.managedByAvelero,
            last_synced_from_stripe_at: brandBillingInvoices.lastSyncedFromStripeAt,
            last_stripe_event_id: brandBillingInvoices.lastStripeEventId,
            created_at: brandBillingInvoices.createdAt,
            updated_at: brandBillingInvoices.updatedAt,
          })
          .from(brandBillingInvoices)
          .where(eq(brandBillingInvoices.brandId, input.brand_id))
          .orderBy(desc(brandBillingInvoices.createdAt))
          .limit(20);

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
            billing_interval: brand.billingInterval,
            total_credits: brand.totalCredits ?? 0,
            published_count: publishedCount,
            remaining_credits: creditUsage.remaining,
            utilization: creditUsage.utilization,
            onboarding_discount_used: brand.onboardingDiscountUsed ?? false,
            max_seats: brand.maxSeats,
          },
          usage: {
            credits: {
              total: creditUsage.total,
              published: creditUsage.published,
              remaining: creditUsage.remaining,
              utilization: creditUsage.utilization,
            },
          },
          billing: {
            billing_mode: brand.billingMode,
            stripe_customer_id: brand.stripeCustomerId,
            stripe_subscription_id: brand.stripeSubscriptionId,
            plan_currency: brand.planCurrency,
            custom_price_cents: brand.customPriceCents,
            current_period_start: brand.currentPeriodStart,
            current_period_end: brand.currentPeriodEnd,
            past_due_since: brand.pastDueSince,
            pending_cancellation: brand.pendingCancellation,
            billing_access_override: brand.billingAccessOverride,
            billing_override_expires_at: brand.billingOverrideExpiresAt,
            billing_legal_name: brand.billingLegalName,
            billing_email: brand.billingEmail,
            billing_tax_id: brand.billingTaxId,
            billing_address_line_1: brand.billingAddressLine1,
            billing_address_line_2: brand.billingAddressLine2,
            billing_address_city: brand.billingAddressCity,
            billing_address_region: brand.billingAddressRegion,
            billing_address_postal_code: brand.billingAddressPostalCode,
            billing_address_country: brand.billingAddressCountry,
            invoices: invoiceRows,
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

        await ctx.db
          .update(brandPlan)
          .set({
            totalCredits: sql`GREATEST(${brandPlan.totalCredits}, ${FREE_CREDITS})`,
            updatedAt: nowIso,
          })
          .where(eq(brandPlan.brandId, input.brand_id));

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
        const [existingPlanState] = await ctx.db
          .select({
            planType: brandPlan.planType,
            billingInterval: brandPlan.billingInterval,
            billingMode: brandBilling.billingMode,
            currentPeriodStart: brandBilling.currentPeriodStart,
            currentPeriodEnd: brandBilling.currentPeriodEnd,
            lifecyclePhase: brandLifecycle.phase,
          })
          .from(brandPlan)
          .leftJoin(brandBilling, eq(brandBilling.brandId, brandPlan.brandId))
          .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brandPlan.brandId))
          .where(eq(brandPlan.brandId, input.brand_id))
          .limit(1);

        if (!existingPlanState) {
          throw badRequest("Brand plan row not found");
        }

        const nextPlanType = (
          input.plan_type !== undefined
            ? input.plan_type
            : existingPlanState.planType
        ) as "starter" | "growth" | "scale" | "enterprise" | null;
        const nextBillingMode = deriveBillingModeFromPlanType(nextPlanType);
        const nextBillingInterval =
          input.billing_interval !== undefined
            ? input.billing_interval
            : existingPlanState.billingInterval;

        const planUpdates: Partial<{
          planType: "starter" | "growth" | "scale" | "enterprise" | null;
          planSelectedAt: string | null;
          billingInterval: "quarterly" | "yearly" | null;
        }> = {};

        const billingUpdates: Partial<{
          billingMode: "stripe_checkout" | "stripe_invoice" | null;
          customPriceCents: number | null;
          currentPeriodStart: string | null;
          currentPeriodEnd: string | null;
        }> = {};

        if (nextPlanType === "enterprise" && nextBillingInterval === "quarterly") {
          throw badRequest("Enterprise billing is yearly-only");
        }

        if (input.plan_type !== undefined) {
          planUpdates.planType = input.plan_type;
          planUpdates.planSelectedAt = input.plan_type ? nowIso : null;
        }
        if (input.billing_interval !== undefined) {
          planUpdates.billingInterval = input.billing_interval;
        }

        if (input.custom_price_cents !== undefined) {
          billingUpdates.customPriceCents = input.custom_price_cents;
        }

        if (existingPlanState.billingMode !== nextBillingMode) {
          billingUpdates.billingMode = nextBillingMode;
        }

        if (input.plan_type === null) {
          planUpdates.billingInterval = null;
          billingUpdates.currentPeriodStart = null;
          billingUpdates.currentPeriodEnd = null;
        }

        if (nextPlanType === "enterprise") {
          planUpdates.billingInterval = "yearly";

          const anchorStart =
            existingPlanState.currentPeriodStart ?? nowIso;

          if (!existingPlanState.currentPeriodStart && nextBillingMode === "stripe_invoice") {
            billingUpdates.currentPeriodStart = anchorStart;
            billingUpdates.currentPeriodEnd = addOneYearIso(anchorStart);
          }
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

        if (
          nextPlanType === "enterprise" &&
          nextBillingMode === "stripe_invoice" &&
          existingPlanState.lifecyclePhase !== "suspended"
        ) {
          await ctx.db
            .update(brandLifecycle)
            .set({
              phase: "active",
              phaseChangedAt: nowIso,
              cancelledAt: null,
              hardDeleteAfter: null,
            })
            .where(eq(brandLifecycle.brandId, input.brand_id));
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
          interval: z.enum(["quarterly", "yearly"]),
          include_impact: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;

        const [billingState] = await db
          .select({
            phase: brandLifecycle.phase,
            billingMode: brandBilling.billingMode,
            stripeSubscriptionId: brandBilling.stripeSubscriptionId,
          })
          .from(brandLifecycle)
          .leftJoin(brandBilling, eq(brandBilling.brandId, brandLifecycle.brandId))
          .where(eq(brandLifecycle.brandId, input.brand_id))
          .limit(1);

        if (!billingState) {
          throw badRequest("Brand billing state not found");
        }

        if (billingState.stripeSubscriptionId) {
          throw badRequest("Brand already has an active Stripe subscription");
        }

        if (billingState.billingMode === "stripe_invoice") {
          throw badRequest(
            "Checkout links are not available for enterprise invoice billing",
          );
        }

        if (
          !["trial", "expired", "cancelled"].includes(billingState.phase)
        ) {
          throw badRequest(
            "Checkout links can only be created for trial, expired, or cancelled brands that need to start or restart checkout billing.",
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
        const normalizedInterval = normalizeBillingInterval(input.interval);

        if (!normalizedInterval) {
          throw badRequest("Unsupported billing interval for Stripe Checkout");
        }

        const session = await createCheckoutSession({
          brandId: input.brand_id,
          stripeCustomerId,
          tier: input.tier,
          interval: normalizedInterval,
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
      .input(platformEnterpriseInvoiceSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;

        const [brand] = await db
          .select({
            name: brands.name,
            billingMode: brandBilling.billingMode,
            currentPeriodStart: brandBilling.currentPeriodStart,
            currentPeriodEnd: brandBilling.currentPeriodEnd,
          })
          .from(brands)
          .leftJoin(brandBilling, eq(brandBilling.brandId, brands.id))
          .where(eq(brands.id, input.brand_id))
          .limit(1);

        if (!brand) {
          throw notFound("Brand not found");
        }

        if (brand.billingMode !== "stripe_invoice") {
          throw badRequest(
            "Invoices can only be created for Enterprise brands (billing_mode = stripe_invoice)",
          );
        }

        const servicePeriodEnd =
          input.service_period_end ?? addOneYearIso(input.service_period_start);

        const stripeCustomerId = await findOrCreateStripeCustomer({
          brandId: input.brand_id,
          brandName: brand.name,
          email: input.recipient_email,
          db,
          billingProfile: {
            legalName: input.recipient_name,
            billingEmail: input.recipient_email,
            addressLine1: input.recipient_address_line_1 ?? null,
            addressLine2: input.recipient_address_line_2 ?? null,
            city: input.recipient_address_city ?? null,
            region: input.recipient_address_region ?? null,
            postalCode: input.recipient_address_postal_code ?? null,
            country: input.recipient_address_country ?? null,
          },
        });

        await db
          .update(brandBilling)
          .set({
            billingLegalName: input.recipient_name,
            billingEmail: input.recipient_email,
            billingTaxId: input.recipient_tax_id ?? null,
            billingAddressLine1: input.recipient_address_line_1 ?? null,
            billingAddressLine2: input.recipient_address_line_2 ?? null,
            billingAddressCity: input.recipient_address_city ?? null,
            billingAddressRegion: input.recipient_address_region ?? null,
            billingAddressPostalCode: input.recipient_address_postal_code ?? null,
            billingAddressCountry: input.recipient_address_country ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(brandBilling.brandId, input.brand_id));

        const result = await createEnterpriseInvoice({
          brandId: input.brand_id,
          stripeCustomerId,
          amountCents: input.amount_cents,
          currency: input.currency,
          description: input.description,
          recipient: {
            name: input.recipient_name,
            email: input.recipient_email,
            taxId: input.recipient_tax_id ?? null,
            addressLine1: input.recipient_address_line_1 ?? null,
            addressLine2: input.recipient_address_line_2 ?? null,
            city: input.recipient_address_city ?? null,
            region: input.recipient_address_region ?? null,
            postalCode: input.recipient_address_postal_code ?? null,
            country: input.recipient_address_country ?? null,
          },
          servicePeriodStart: input.service_period_start,
          servicePeriodEnd: servicePeriodEnd,
          dueDate: input.due_date ?? null,
          daysUntilDue: input.days_until_due ?? null,
          footer: input.footer ?? null,
          internalReference: input.internal_reference ?? null,
        });

        await syncStripeInvoiceProjectionById({
          db,
          invoiceId: result.invoiceId,
          brandId: input.brand_id,
        });

        if (!brand.currentPeriodStart || !brand.currentPeriodEnd) {
          await db
            .update(brandBilling)
            .set({
              currentPeriodStart: input.service_period_start,
              currentPeriodEnd: servicePeriodEnd,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(brandBilling.brandId, input.brand_id));

          await db
            .update(brandPlan)
            .set({
              billingInterval: "yearly",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(brandPlan.brandId, input.brand_id));
        }

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.create_invoice",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            amountCents: input.amount_cents,
            description: input.description,
            invoiceId: result.invoiceId,
            servicePeriodStart: input.service_period_start,
            servicePeriodEnd,
          },
        });

        return {
          ok: true as const,
          invoice_id: result.invoiceId,
          invoice_url: result.invoiceUrl,
          invoice_status: result.status,
        };
      }),

    resendInvoice: platformAdminProcedure
      .input(platformInvoiceActionSchema)
      .mutation(async ({ ctx, input }) => {
        await sendEnterpriseInvoice(input.invoice_id);
        await syncStripeInvoiceProjectionById({
          db: ctx.db,
          invoiceId: input.invoice_id,
          brandId: input.brand_id,
        });

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.resend_invoice",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            invoiceId: input.invoice_id,
          },
        });

        return { success: true as const };
      }),

    voidInvoice: platformAdminProcedure
      .input(platformInvoiceActionSchema)
      .mutation(async ({ ctx, input }) => {
        await voidEnterpriseInvoice(input.invoice_id);
        await syncStripeInvoiceProjectionById({
          db: ctx.db,
          invoiceId: input.invoice_id,
          brandId: input.brand_id,
        });

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.void_invoice",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            invoiceId: input.invoice_id,
          },
        });

        return { success: true as const };
      }),

    syncInvoice: platformAdminProcedure
      .input(platformInvoiceActionSchema)
      .mutation(async ({ ctx, input }) => {
        await syncStripeInvoiceProjectionById({
          db: ctx.db,
          invoiceId: input.invoice_id,
          brandId: input.brand_id,
        });

        await logPlatformAdminAction(ctx, {
          action: "platform_admin.billing.sync_invoice",
          resourceType: "brand",
          resourceId: input.brand_id,
          payload: {
            brandId: input.brand_id,
            invoiceId: input.invoice_id,
          },
        });

        return { success: true as const };
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
