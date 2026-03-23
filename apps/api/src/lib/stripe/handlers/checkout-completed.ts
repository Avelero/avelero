/**
 * Activates a brand after Stripe Checkout completes and billing metadata is valid.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
import { publishNotificationEvent } from "@v1/db/queries/notifications";
import { and, eq, notInArray } from "@v1/db/queries";
import {
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import { getStripeClient } from "../client.js";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  TIER_CONFIG,
  isBillingInterval,
  isPlanTier,
} from "../config.js";
import {
  awardCredits,
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:checkout-completed" });

/**
 * Parses the top-up quantity metadata stored on a payment-mode checkout session.
 */
function parseTopupQuantity(value: string | undefined): number | null {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * Applies a completed credit top-up checkout to the brand's credit balance.
 */
async function handleTopupCheckoutCompletedSession(opts: {
  conn: DatabaseOrTransaction;
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  brandId: string;
  metadata: Record<string, string>;
}): Promise<void> {
  const { conn, event, session, brandId, metadata } = opts;

  if (session.payment_status !== "paid") {
    log.warn(
      {
        stripeEventId: event.id,
        sessionId: session.id,
        brandId,
        paymentStatus: session.payment_status,
      },
      "payment checkout completed before the top-up purchase was fully paid",
    );
    return;
  }

  const topupQuantity = parseTopupQuantity(metadata.topup_quantity);
  const tier = isPlanTier(metadata.tier) ? metadata.tier : null;

  if (!topupQuantity) {
    log.warn(
      {
        stripeEventId: event.id,
        sessionId: session.id,
        brandId,
        metadata,
      },
      "payment checkout completed without a valid top-up quantity",
    );
    return;
  }

  const onboardingDiscountApplied = metadata.is_onboarding_discount === "true";
  const totalCredits = await awardCredits({
    db: conn,
    brandId,
    credits: topupQuantity,
    reason: "topup_purchase",
  });

  if (onboardingDiscountApplied) {
    await conn
      .update(brandPlan)
      .set({
        onboardingDiscountUsed: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(brandPlan.brandId, brandId));
  }

  await conn.insert(brandBillingEvents).values({
    brandId,
    eventType: "checkout_completed",
    stripeEventId: event.id,
    payload: {
      checkout_mode: "payment",
      tier,
      topup_quantity: topupQuantity,
      credits_awarded: topupQuantity,
      total_credits: totalCredits,
      onboarding_discount_applied: onboardingDiscountApplied,
      payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
    },
  });

  await publishNotificationEvent(conn, {
    event: "pack_purchased",
    brandId,
    payload: {
      brandId,
      credits: topupQuantity,
      purchaseId: session.id,
    },
  });

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      sessionId: session.id,
      tier,
      topupQuantity,
      creditsAwarded: topupQuantity,
      totalCredits,
      onboardingDiscountApplied,
    },
    "credit top-up checkout completed",
  );
}

export async function handleCheckoutCompleted(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
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

  if (session.mode === "payment") {
    await handleTopupCheckoutCompletedSession({
      conn,
      event,
      session,
      brandId,
      metadata,
    });
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
      db: conn,
      subscriptionId,
      clearPastDue: true,
      brandId,
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

    await conn
      .update(brandPlan)
      .set({
        planType,
        billingInterval,
        hasImpactPredictions: includeImpact,
        planSelectedAt: nowIso,
        variantGlobalCap: tierConfig.variantGlobalCap,
        updatedAt: nowIso,
      })
      .where(eq(brandPlan.brandId, brandId));
  }

  await conn
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

  await conn.insert(brandBillingEvents).values({
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

  // If this checkout was an upgrade, cancel the old subscription after the new one is live.
  const upgradeFromSubId = metadata.upgrade_from_subscription_id;
  if (upgradeFromSubId) {
    const stripe = getStripeClient();
    try {
      await stripe.subscriptions.cancel(upgradeFromSubId, {
        prorate: false,
        invoice_now: false,
      });
    } catch (cancelErr) {
      log.error(
        { stripeEventId: event.id, brandId, oldSubscriptionId: upgradeFromSubId, err: cancelErr },
        "failed to cancel old subscription during upgrade",
      );
    }
  }

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      planType: planType ?? null,
      billingInterval: billingInterval ?? null,
      includeImpact,
      subscriptionId: subscriptionId ?? null,
      upgradeFromSubscriptionId: upgradeFromSubId ?? null,
      phase: "active",
    },
    "checkout completed: brand activated",
  );
}
