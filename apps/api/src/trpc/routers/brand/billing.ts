/**
 * Customer-facing billing tRPC router.
 *
 * Provides endpoints for brands to manage their subscription:
 * - createCheckoutSession: Start a new subscription via Stripe Checkout
 * - updatePlan: Change tier/interval on an existing subscription
 * - addImpact: Add Impact Predictions add-on
 * - removeImpact: Remove Impact Predictions add-on
 * - getStatus: Current billing state
 * - getPortalUrl: Stripe Customer Portal link
 */
import { desc, eq, sql } from "@v1/db/queries";
import { brandBilling, brandBillingInvoices, brandLifecycle, brandPlan, brands } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const log = billingLogger.child({ component: "billing-router" });
import { createCheckoutSession, createUpgradeCheckoutSession } from "../../../lib/stripe/checkout.js";
import {
  type BillingInterval,
  normalizeBillingInterval,
  type PlanTier,
  isUpgradeChange,
} from "../../../lib/stripe/config.js";
import { findOrCreateStripeCustomer } from "../../../lib/stripe/customer.js";
import { createTopupCheckoutSession } from "../../../lib/stripe/topup.js";
import { createPortalSession } from "../../../lib/stripe/portal.js";
import {
  addImpactToSubscription,
  removeImpactFromSubscription,
  updateSubscriptionPlan,
} from "../../../lib/stripe/subscription.js";

import { syncStripeSubscriptionProjectionById } from "../../../lib/stripe/projection.js";
import {
  brandBillingProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const STRIPE_PROJECTION_SYNC_MAX_AGE_MS = 5 * 60_000;
const billingIntervalInputSchema = z
  .enum(["quarterly", "yearly"])
  .transform((value) => normalizeBillingInterval(value) ?? "quarterly");

/**
 * Decides whether the local Stripe subscription projection is stale enough to refresh.
 */
function shouldSyncStripeProjection(params: {
  billingMode: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string | null;
}): boolean {
  if (
    params.billingMode !== "stripe_checkout" ||
    !params.stripeSubscriptionId
  ) {
    return false;
  }

  if (!params.updatedAt) {
    return true;
  }

  const updatedAtMs = new Date(params.updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }

  return Date.now() - updatedAtMs > STRIPE_PROJECTION_SYNC_MAX_AGE_MS;
}

/**
 * Normalizes billing interval values loaded from the database during the transition window.
 */
function getNormalizedBillingInterval(
  value: string | null | undefined,
): BillingInterval | null {
  return normalizeBillingInterval(value);
}

export const billingRouter = createTRPCRouter({
  /**
   * Create a Stripe Checkout Session for a new subscription.
   * Allowed for recovery states that need to start or restart a subscription.
   */
  createCheckoutSession: brandBillingProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "growth", "scale"]),
        interval: billingIntervalInputSchema,
        include_impact: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      const [state] = await db
        .select({
          phase: brandLifecycle.phase,
          stripeSubscriptionId: brandBilling.stripeSubscriptionId,
          billingMode: brandBilling.billingMode,
        })
        .from(brandLifecycle)
        .leftJoin(brandBilling, eq(brandBilling.brandId, brandLifecycle.brandId))
        .where(eq(brandLifecycle.brandId, brandId))
        .limit(1);

      if (!state) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing state is not initialized for this brand",
        });
      }

      if (state.stripeSubscriptionId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This brand already has an active Stripe subscription",
        });
      }

      if (state.billingMode === "stripe_invoice") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Stripe Checkout is not available for enterprise invoice billing",
        });
      }

      // Get brand name and owner email
      const [brand] = await db
        .select({ name: brands.name })
        .from(brands)
        .where(eq(brands.id, brandId))
        .limit(1);

      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      }

      if (!ctx.user.email) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "User email is required for billing",
        });
      }

      let stripeCustomerId: string;
      try {
        stripeCustomerId = await findOrCreateStripeCustomer({
          brandId,
          brandName: brand.name,
          email: ctx.user.email,
          db,
        });
      } catch (err) {
        log.error({ brandId, operation: "findOrCreateStripeCustomer", err }, "Stripe customer creation failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set up billing" });
      }

      // Serialize checkout creation per brand so duplicate clicks cannot create parallel sessions.
      // Uses pg_advisory_xact_lock inside a transaction that also spans the Stripe call,
      // guaranteeing lock and unlock happen on the same connection.
      try {
        const { url } = await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`stripe_checkout:${brandId}`}))`,
          );

          const session = await createCheckoutSession({
            brandId,
            stripeCustomerId,
            tier: input.tier,
            interval: input.interval,
            includeImpact: input.include_impact,
            successUrl: `${APP_URL}/settings/billing?checkout=success`,
            cancelUrl: `${APP_URL}/settings/billing?checkout=cancelled`,
          });

          return { url: session.url };
        });

        return { url };
      } catch (err) {
        log.error({ brandId, operation: "createCheckoutSession", tier: input.tier, interval: input.interval, err }, "checkout session creation failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      }
    }),

  /**
   * Create a Stripe Checkout Session for upgrading an existing subscription.
   * Opens a fresh checkout for the higher plan so the new billing cycle starts
   * immediately. The old subscription stays active until checkout completes.
   */
  createUpgradeCheckout: brandBillingProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "growth", "scale"]),
        interval: billingIntervalInputSchema,
        include_impact: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      const [billing] = await db
        .select({
          stripeSubscriptionId: brandBilling.stripeSubscriptionId,
          stripeCustomerId: brandBilling.stripeCustomerId,
        })
        .from(brandBilling)
        .where(eq(brandBilling.brandId, brandId))
        .limit(1);

      if (!billing?.stripeSubscriptionId || !billing.stripeCustomerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active subscription to upgrade",
        });
      }

      const [plan] = await db
        .select({
          planType: brandPlan.planType,
          billingInterval: brandPlan.billingInterval,
        })
        .from(brandPlan)
        .where(eq(brandPlan.brandId, brandId))
        .limit(1);

      if (!plan?.planType || !plan.billingInterval) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Current plan metadata is missing",
        });
      }

      const currentInterval = getNormalizedBillingInterval(plan.billingInterval);

      if (!currentInterval) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Current billing interval is missing or invalid",
        });
      }

      if (
        !isUpgradeChange({
          currentTier: plan.planType as PlanTier,
          currentInterval,
          newTier: input.tier,
          newInterval: input.interval,
        })
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This change is a downgrade — use the plan update flow instead",
        });
      }

      if (!ctx.user.email) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "User email is required for billing",
        });
      }

      try {
        const { url } = await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`stripe_upgrade_checkout:${brandId}`}))`,
          );

          const session = await createUpgradeCheckoutSession({
            brandId,
            stripeCustomerId: billing.stripeCustomerId!,
            stripeSubscriptionId: billing.stripeSubscriptionId!,
            newTier: input.tier,
            newInterval: input.interval,
            includeImpact: input.include_impact,
            successUrl: `${APP_URL}/settings/billing?checkout=success`,
            cancelUrl: `${APP_URL}/settings/billing?checkout=cancelled`,
          });

          return { url: session.url };
        });

        return { url };
      } catch (err) {
        log.error({ brandId, operation: "createUpgradeCheckoutSession", tier: input.tier, interval: input.interval, err }, "upgrade checkout session creation failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create upgrade checkout session" });
      }
    }),

  /**
   * Update the plan tier and/or interval for an active subscription.
   * Used for downgrades that take effect on the existing subscription. Upgrades
   * must use createUpgradeCheckout so the new billing cycle restarts immediately.
   */
  updatePlan: brandWriteProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "growth", "scale"]),
        interval: billingIntervalInputSchema,
        include_impact: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      // Validate the brand is active with a subscription
      const [billing] = await db
        .select({
          stripeSubscriptionId: brandBilling.stripeSubscriptionId,
        })
        .from(brandBilling)
        .where(eq(brandBilling.brandId, brandId))
        .limit(1);

      if (!billing?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active subscription to update",
        });
      }

      const [lifecycle] = await db
        .select({ phase: brandLifecycle.phase })
        .from(brandLifecycle)
        .where(eq(brandLifecycle.brandId, brandId))
        .limit(1);

      if (!lifecycle || lifecycle.phase !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Plan changes are only available for active subscriptions",
        });
      }

      // Block upgrades through this endpoint — they must use the checkout flow.
      const [plan] = await db
        .select({
          planType: brandPlan.planType,
          billingInterval: brandPlan.billingInterval,
        })
        .from(brandPlan)
        .where(eq(brandPlan.brandId, brandId))
        .limit(1);

      const currentInterval = getNormalizedBillingInterval(plan?.billingInterval);

      if (
        plan?.planType &&
        currentInterval &&
        isUpgradeChange({
          currentTier: plan.planType as PlanTier,
          currentInterval,
          newTier: input.tier,
          newInterval: input.interval,
        })
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Upgrades must use the checkout flow",
        });
      }

      try {
        await updateSubscriptionPlan({
          stripeSubscriptionId: billing.stripeSubscriptionId,
          newTier: input.tier,
          newInterval: input.interval,
          hasImpact: input.include_impact,
        });
      } catch (err) {
        log.error({ brandId, operation: "updateSubscriptionPlan", tier: input.tier, interval: input.interval, err }, "plan update failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update plan" });
      }

      return { success: true as const };
    }),

  /**
   * Create a Stripe Checkout Session for purchasing additional credits.
   */
  createTopupCheckout: brandBillingProcedure
    .input(
      z.object({
        quantity: z.number().int().min(1).max(100_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      const [billing] = await db
        .select({
          billingMode: brandBilling.billingMode,
          stripeCustomerId: brandBilling.stripeCustomerId,
          stripeSubscriptionId: brandBilling.stripeSubscriptionId,
        })
        .from(brandBilling)
        .where(eq(brandBilling.brandId, brandId))
        .limit(1);

      const [lifecycle] = await db
        .select({ phase: brandLifecycle.phase })
        .from(brandLifecycle)
        .where(eq(brandLifecycle.brandId, brandId))
        .limit(1);

      const [plan] = await db
        .select({
          planType: brandPlan.planType,
          onboardingDiscountUsed: brandPlan.onboardingDiscountUsed,
        })
        .from(brandPlan)
        .where(eq(brandPlan.brandId, brandId))
        .limit(1);

      if (
        !billing?.stripeCustomerId ||
        !billing.stripeSubscriptionId ||
        billing.billingMode !== "stripe_checkout"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Additional credits are only available for active Stripe subscriptions",
        });
      }

      const stripeCustomerId = billing.stripeCustomerId;

      if (lifecycle?.phase !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Additional credits are only available for active brands",
        });
      }

      if (!plan?.planType) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Current plan metadata is missing",
        });
      }

      try {
        const { url } = await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`stripe_topup_checkout:${brandId}`}))`,
          );

          const session = await createTopupCheckoutSession({
            brandId,
            stripeCustomerId,
            tier: plan.planType as PlanTier,
            quantity: input.quantity,
            applyOnboardingDiscount: !(plan?.onboardingDiscountUsed ?? false),
            successUrl: `${APP_URL}/settings/billing?checkout=success&topup=${input.quantity}`,
            cancelUrl: `${APP_URL}/settings/billing?checkout=cancelled`,
          });

          return { url: session.url };
        });

        return { url };
      } catch (err) {
        log.error(
          { brandId, operation: "createTopupCheckoutSession", quantity: input.quantity, err },
          "credit top-up checkout session creation failed",
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create credit top-up checkout session",
        });
      }
    }),

  /**
   * Add Impact Predictions to the current subscription.
   * Tier and interval are derived from the existing plan.
   */
  addImpact: brandWriteProcedure.mutation(async ({ ctx }) => {
    const { brandId, db } = ctx;

    const [billing] = await db
      .select({ stripeSubscriptionId: brandBilling.stripeSubscriptionId })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    if (!billing?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active subscription",
      });
    }

    let [plan] = await db
      .select({
        planType: brandPlan.planType,
        billingInterval: brandPlan.billingInterval,
        hasImpactPredictions: brandPlan.hasImpactPredictions,
      })
      .from(brandPlan)
      .where(eq(brandPlan.brandId, brandId))
      .limit(1);

    if (
      billing.stripeSubscriptionId &&
      (!plan?.planType || !plan.billingInterval)
    ) {
      try {
        await syncStripeSubscriptionProjectionById({
          db,
          subscriptionId: billing.stripeSubscriptionId,
          brandId,
        });
      } catch (err) {
        log.error(
          { brandId, operation: "syncStripeSubscriptionProjectionById", err },
          "failed to backfill plan interval before adding impact",
        );
      }

      [plan] = await db
        .select({
          planType: brandPlan.planType,
          billingInterval: brandPlan.billingInterval,
          hasImpactPredictions: brandPlan.hasImpactPredictions,
        })
        .from(brandPlan)
        .where(eq(brandPlan.brandId, brandId))
        .limit(1);
    }

    const normalizedInterval = getNormalizedBillingInterval(plan?.billingInterval);

    if (!plan?.planType || !normalizedInterval) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Plan type or billing interval not set",
      });
    }

    if (plan.hasImpactPredictions) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Impact Predictions is already active",
      });
    }

    try {
      await addImpactToSubscription({
        stripeSubscriptionId: billing.stripeSubscriptionId,
        tier: plan.planType as PlanTier,
        interval: normalizedInterval,
      });
    } catch (err) {
      log.error({ brandId, operation: "addImpactToSubscription", err }, "add impact failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add Impact Predictions" });
    }

    // Optimistically update local state (webhook will confirm)
    await db
      .update(brandPlan)
      .set({
        hasImpactPredictions: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(brandPlan.brandId, brandId));

    return { success: true as const };
  }),

  /**
   * Remove Impact Predictions from the current subscription.
   */
  removeImpact: brandWriteProcedure.mutation(async ({ ctx }) => {
    const { brandId, db } = ctx;

    const [billing] = await db
      .select({ stripeSubscriptionId: brandBilling.stripeSubscriptionId })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    if (!billing?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active subscription",
      });
    }

    const [plan] = await db
      .select({ hasImpactPredictions: brandPlan.hasImpactPredictions })
      .from(brandPlan)
      .where(eq(brandPlan.brandId, brandId))
      .limit(1);

    if (!plan?.hasImpactPredictions) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Impact Predictions is not active",
      });
    }

    try {
      await removeImpactFromSubscription({
        stripeSubscriptionId: billing.stripeSubscriptionId,
      });
    } catch (err) {
      log.error({ brandId, operation: "removeImpactFromSubscription", err }, "remove impact failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove Impact Predictions" });
    }

    // Optimistically update local state (webhook will confirm)
    await db
      .update(brandPlan)
      .set({
        hasImpactPredictions: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(brandPlan.brandId, brandId));

    return { success: true as const };
  }),

  /**
   * Get the current billing status for the brand.
   */
  getStatus: brandBillingProcedure.query(async ({ ctx }) => {
    const { brandId, db, brandAccess, skuAccess } = ctx;

    const [billingLink] = await db
      .select({
        billingMode: brandBilling.billingMode,
        stripeSubscriptionId: brandBilling.stripeSubscriptionId,
        updatedAt: brandBilling.updatedAt,
      })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    const [planLink] = await db
      .select({
        planType: brandPlan.planType,
        billingInterval: brandPlan.billingInterval,
      })
      .from(brandPlan)
      .where(eq(brandPlan.brandId, brandId))
      .limit(1);

    if (
      shouldSyncStripeProjection({
        billingMode: billingLink?.billingMode ?? null,
        stripeSubscriptionId: billingLink?.stripeSubscriptionId ?? null,
        updatedAt: billingLink?.updatedAt ?? null,
      }) ||
      (billingLink?.billingMode === "stripe_checkout" &&
        billingLink?.stripeSubscriptionId &&
        (!planLink?.planType || !planLink.billingInterval))
    ) {
      try {
        await syncStripeSubscriptionProjectionById({
          db,
          subscriptionId: billingLink!.stripeSubscriptionId!,
          brandId,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to refresh billing status",
          cause: err,
        });
      }
    }

    const [billing] = await db
      .select({
        billingMode: brandBilling.billingMode,
        stripeCustomerId: brandBilling.stripeCustomerId,
        stripeSubscriptionId: brandBilling.stripeSubscriptionId,
        currentPeriodStart: brandBilling.currentPeriodStart,
        currentPeriodEnd: brandBilling.currentPeriodEnd,
        pastDueSince: brandBilling.pastDueSince,
        pendingCancellation: brandBilling.pendingCancellation,
      })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    const [plan] = await db
      .select({
        planType: brandPlan.planType,
        billingInterval: brandPlan.billingInterval,
        hasImpactPredictions: brandPlan.hasImpactPredictions,
        planSelectedAt: brandPlan.planSelectedAt,
        totalCredits: brandPlan.totalCredits,
        onboardingDiscountUsed: brandPlan.onboardingDiscountUsed,
      })
      .from(brandPlan)
      .where(eq(brandPlan.brandId, brandId))
      .limit(1);

    const [lifecycle] = await db
      .select({
        phase: brandLifecycle.phase,
        trialEndsAt: brandLifecycle.trialEndsAt,
      })
      .from(brandLifecycle)
      .where(eq(brandLifecycle.brandId, brandId))
      .limit(1);

    return {
      plan_type: plan?.planType ?? null,
      billing_interval: plan?.billingInterval ?? null,
      has_impact_predictions: plan?.hasImpactPredictions ?? false,
      plan_selected_at: plan?.planSelectedAt ?? null,
      billing_mode: billing?.billingMode ?? null,
      phase: lifecycle?.phase ?? "demo",
      trial_ends_at: lifecycle?.trialEndsAt ?? null,
      current_period_start: billing?.currentPeriodStart ?? null,
      current_period_end: billing?.currentPeriodEnd ?? null,
      past_due_since: billing?.pastDueSince ?? null,
      pending_cancellation: billing?.pendingCancellation ?? false,
      grace_ends_at: brandAccess.graceEndsAt,
      total_credits: plan?.totalCredits ?? skuAccess.activeBudget.totalCredits,
      published_count: skuAccess.activeBudget.publishedCount,
      remaining_credits: skuAccess.activeBudget.remaining,
      utilization: skuAccess.activeBudget.utilization,
      onboarding_discount_used: plan?.onboardingDiscountUsed ?? false,
      has_active_subscription: !!billing?.stripeSubscriptionId,
      stripe_customer_id: billing?.stripeCustomerId ?? null,
    };
  }),

  /**
   * List invoices for the brand, ordered by creation date descending.
   */
  listInvoices: brandBillingProcedure.query(async ({ ctx }) => {
    const { brandId, db } = ctx;

    const invoices = await db
      .select({
        id: brandBillingInvoices.id,
        status: brandBillingInvoices.status,
        currency: brandBillingInvoices.currency,
        total: brandBillingInvoices.total,
        amountDue: brandBillingInvoices.amountDue,
        amountPaid: brandBillingInvoices.amountPaid,
        dueDate: brandBillingInvoices.dueDate,
        paidAt: brandBillingInvoices.paidAt,
        hostedInvoiceUrl: brandBillingInvoices.hostedInvoiceUrl,
        invoicePdfUrl: brandBillingInvoices.invoicePdfUrl,
        invoiceNumber: brandBillingInvoices.invoiceNumber,
        createdAt: brandBillingInvoices.createdAt,
      })
      .from(brandBillingInvoices)
      .where(eq(brandBillingInvoices.brandId, brandId))
      .orderBy(desc(brandBillingInvoices.createdAt))
      .limit(20);

    return invoices;
  }),

  /**
   * Get a Stripe Customer Portal URL for managing payment methods
   * and viewing invoice history.
   */
  getPortalUrl: brandBillingProcedure.mutation(async ({ ctx }) => {
    const { brandId, db } = ctx;

    const [billing] = await db
      .select({ stripeCustomerId: brandBilling.stripeCustomerId })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    if (!billing?.stripeCustomerId) {
      return { url: null };
    }

    try {
      const portal = await createPortalSession({
        stripeCustomerId: billing.stripeCustomerId,
        returnUrl: `${APP_URL}/settings/billing`,
      });

      return { url: portal.url };
    } catch (err) {
      log.error({ brandId, operation: "createPortalSession", err }, "portal session creation failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to open billing portal" });
    }
  }),
});
