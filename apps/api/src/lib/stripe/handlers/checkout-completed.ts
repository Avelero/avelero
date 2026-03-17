import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { TIER_CONFIG, type BillingInterval, type PlanTier } from "../config.js";
import {
  isoToDate,
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:checkout-completed" });

export async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const brandId = metadata.brand_id;

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        sessionId: session.id,
        customerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null,
        metadata,
      },
      "brand_id missing from checkout session metadata — brand state was NOT updated",
    );
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

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      planType: planType ?? null,
      billingInterval: billingInterval ?? null,
      includeImpact,
      subscriptionId: subscriptionId ?? null,
      phase: "active",
    },
    "checkout completed: brand activated",
  );
}
