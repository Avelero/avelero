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
import { eq } from "@v1/db/queries";
import { brandBilling, brandLifecycle, brandPlan, brands } from "@v1/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createCheckoutSession } from "../../../lib/stripe/checkout.js";
import {
  type BillingInterval,
  TIER_CONFIG,
  type PlanTier,
} from "../../../lib/stripe/config.js";
import { findOrCreateStripeCustomer } from "../../../lib/stripe/customer.js";
import { createPortalSession } from "../../../lib/stripe/portal.js";
import {
  addImpactToSubscription,
  removeImpactFromSubscription,
  updateSubscriptionPlan,
} from "../../../lib/stripe/subscription.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const billingRouter = createTRPCRouter({
  /**
   * Create a Stripe Checkout Session for a new subscription.
   * Only allowed when the brand is in trial or expired phase.
   */
  createCheckoutSession: brandWriteProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "growth", "scale"]),
        interval: z.enum(["monthly", "yearly"]),
        include_impact: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      // Validate phase
      const [lifecycle] = await db
        .select({ phase: brandLifecycle.phase })
        .from(brandLifecycle)
        .where(eq(brandLifecycle.brandId, brandId))
        .limit(1);

      if (!lifecycle || !["trial", "expired"].includes(lifecycle.phase)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Checkout is only available for brands in trial or expired phase",
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

      const stripeCustomerId = await findOrCreateStripeCustomer({
        brandId,
        brandName: brand.name,
        email: ctx.user.email,
        db,
      });

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
    }),

  /**
   * Update the plan tier and/or interval for an active subscription.
   * Swaps line items in-place — does NOT create a new subscription.
   */
  updatePlan: brandWriteProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "growth", "scale"]),
        interval: z.enum(["monthly", "yearly"]),
        include_impact: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { brandId, db } = ctx;

      // Validate the brand is active with a subscription
      const [billing] = await db
        .select({ stripeSubscriptionId: brandBilling.stripeSubscriptionId })
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

      await updateSubscriptionPlan({
        stripeSubscriptionId: billing.stripeSubscriptionId,
        newTier: input.tier,
        newInterval: input.interval,
        hasImpact: input.include_impact,
      });

      // Optimistically update local state (webhook will confirm)
      const tierConfig = TIER_CONFIG[input.tier];
      await db
        .update(brandPlan)
        .set({
          planType: input.tier,
          billingInterval: input.interval,
          hasImpactPredictions: input.include_impact,
          skuAnnualLimit: tierConfig.skuAnnualLimit,
          skuOnboardingLimit: tierConfig.skuOnboardingLimit,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(brandPlan.brandId, brandId));

      return { success: true as const };
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

    const [plan] = await db
      .select({
        planType: brandPlan.planType,
        billingInterval: brandPlan.billingInterval,
        hasImpactPredictions: brandPlan.hasImpactPredictions,
      })
      .from(brandPlan)
      .where(eq(brandPlan.brandId, brandId))
      .limit(1);

    if (!plan?.planType || !plan.billingInterval) {
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

    await addImpactToSubscription({
      stripeSubscriptionId: billing.stripeSubscriptionId,
      tier: plan.planType as PlanTier,
      interval: plan.billingInterval as BillingInterval,
    });

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

    await removeImpactFromSubscription({
      stripeSubscriptionId: billing.stripeSubscriptionId,
    });

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
  getStatus: brandReadProcedure.query(async ({ ctx }) => {
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

    const [plan] = await db
      .select({
        planType: brandPlan.planType,
        billingInterval: brandPlan.billingInterval,
        hasImpactPredictions: brandPlan.hasImpactPredictions,
        planSelectedAt: brandPlan.planSelectedAt,
        skuAnnualLimit: brandPlan.skuAnnualLimit,
        skuOnboardingLimit: brandPlan.skuOnboardingLimit,
        skusCreatedThisYear: brandPlan.skusCreatedThisYear,
        skusCreatedOnboarding: brandPlan.skusCreatedOnboarding,
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
      sku_annual_limit: plan?.skuAnnualLimit ?? null,
      skus_created_this_year: plan?.skusCreatedThisYear ?? 0,
      sku_onboarding_limit: plan?.skuOnboardingLimit ?? null,
      skus_created_onboarding: plan?.skusCreatedOnboarding ?? 0,
      has_payment_method: !!billing?.stripeSubscriptionId,
      stripe_customer_id: billing?.stripeCustomerId ?? null,
    };
  }),

  /**
   * Get a Stripe Customer Portal URL for managing payment methods
   * and viewing invoice history.
   */
  getPortalUrl: brandReadProcedure.query(async ({ ctx }) => {
    const { brandId, db } = ctx;

    const [billing] = await db
      .select({ stripeCustomerId: brandBilling.stripeCustomerId })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    if (!billing?.stripeCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No billing account set up yet",
      });
    }

    const portal = await createPortalSession({
      stripeCustomerId: billing.stripeCustomerId,
      returnUrl: `${APP_URL}/settings/billing`,
    });

    return { url: portal.url };
  }),
});
