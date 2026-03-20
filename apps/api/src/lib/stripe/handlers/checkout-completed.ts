/**
 * Activates a brand after Stripe Checkout completes and billing metadata is valid.
 */
import { db } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import {
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  TIER_CONFIG,
  isBillingInterval,
  isPlanTier,
  type BillingInterval,
  type PlanTier,
} from "../config.js";
import {
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:checkout-completed" });

export async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<void> {
  // Validate the Checkout payload before projecting plan state into the database.
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

  const planType = isPlanTier(metadata.plan_type)
    ? metadata.plan_type
    : undefined;
  const billingInterval = isBillingInterval(metadata.billing_interval)
    ? metadata.billing_interval
    : undefined;
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
      syncPaidSkuAnchors: true,
      allowAnnualAnchorRealignment: true,
    });
    currentPeriodStart = projection.currentPeriodStart;
    currentPeriodEnd = projection.currentPeriodEnd;
  }

  if (
    (metadata.plan_type || metadata.billing_interval) &&
    (!planType || !billingInterval)
  ) {
    log.warn(
      {
        stripeEventId: event.id,
        sessionId: session.id,
        brandId,
        metadata,
      },
      "checkout metadata contained an invalid plan or billing interval",
    );
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
        skuAnnualLimit: tierConfig.skuAnnualLimit,
        skuOnboardingLimit: tierConfig.skuOnboardingLimit,
        variantGlobalCap: tierConfig.variantGlobalCap,
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
    .where(
      and(
        eq(brandLifecycle.brandId, brandId),
        notInArray(brandLifecycle.phase, ["suspended"]),
      ),
    );

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
