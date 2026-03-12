import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import type Stripe from "stripe";
import {
  TIER_CONFIG,
  type BillingInterval,
  type PlanTier,
} from "../config.js";

/**
 * Handle `checkout.session.completed` — a customer completed Stripe Checkout.
 *
 * Updates:
 * - brand_billing: stripe_customer_id, stripe_subscription_id, billing_mode
 * - brand_plan: plan_type, billing_interval, has_impact_predictions, limits
 * - brand_lifecycle: phase → active
 * - brand_billing_events: audit log entry
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

  if (!planType || !billingInterval) {
    console.warn(
      "checkout.session.completed: missing plan_type or billing_interval in metadata",
    );
    return;
  }

  const tierConfig = TIER_CONFIG[planType];
  const nowIso = new Date().toISOString();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  // Update brand_billing
  await db
    .update(brandBilling)
    .set({
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      billingMode: "stripe_checkout",
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  // Update brand_plan
  await db
    .update(brandPlan)
    .set({
      planType,
      billingInterval,
      hasImpactPredictions: includeImpact,
      planSelectedAt: nowIso,
      skuYearStart: new Date(nowIso),
      skuAnnualLimit: tierConfig.skuAnnualLimit,
      skuOnboardingLimit: tierConfig.skuOnboardingLimit,
      updatedAt: nowIso,
    })
    .where(eq(brandPlan.brandId, brandId));

  // Update brand_lifecycle → active
  await db
    .update(brandLifecycle)
    .set({
      phase: "active",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));

  // Log billing event
  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "checkout_completed",
    stripeEventId: event.id,
    payload: {
      plan_type: planType,
      billing_interval: billingInterval,
      include_impact: includeImpact,
      subscription_id: subscriptionId,
      customer_id: customerId,
    },
  });
}
