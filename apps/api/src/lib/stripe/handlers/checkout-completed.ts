/**
 * Handles `checkout.session.completed` by syncing the subscription projection and activating the brand.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import type Stripe from "stripe";
import { TIER_CONFIG, type BillingInterval, type PlanTier } from "../config.js";
import {
  isoToDate,
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

/**
 * Persists the checkout-completion side effects for subscription-based billing.
 */
export async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const brandId = metadata.brand_id;

  if (!brandId) {
    console.warn("checkout.session.completed: missing brand_id in metadata");
    return;
  }

  const planType = metadata.plan_type as PlanTier | undefined;
  const billingInterval = metadata.billing_interval as
    | BillingInterval
    | undefined;
  const includeImpact = metadata.include_impact === "true";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const nowIso = new Date().toISOString();

  let currentPeriodStart: string | null = null;
  let currentPeriodEnd: string | null = null;

  if (subscriptionId) {
    const { projection } = await syncStripeSubscriptionProjectionById({
      db,
      subscriptionId,
      clearPastDue: true,
      brandId,
    });
    currentPeriodStart = projection.currentPeriodStart;
    currentPeriodEnd = projection.currentPeriodEnd;
  }

  if (planType && billingInterval) {
    const tierConfig = TIER_CONFIG[planType];

    await db
      .update(brandPlan)
      .set({
        planType,
        billingInterval,
        hasImpactPredictions: includeImpact,
        planSelectedAt: nowIso,
        ...(currentPeriodStart
          ? { skuYearStart: isoToDate(currentPeriodStart) }
          : {}),
        skuAnnualLimit: tierConfig.skuAnnualLimit,
        skuOnboardingLimit: tierConfig.skuOnboardingLimit,
        updatedAt: nowIso,
      })
      .where(eq(brandPlan.brandId, brandId));
  }

  await db
    .update(brandLifecycle)
    .set({
      phase: "active",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "checkout_completed",
    stripeEventId: event.id,
    payload: {
      plan_type: planType ?? null,
      billing_interval: billingInterval ?? null,
      include_impact: includeImpact,
      subscription_id: subscriptionId ?? null,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      customer_id:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null,
    },
  });
}
