/**
 * Activates a brand after Stripe Checkout completes and billing metadata is valid.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
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
  PACK_CONFIG,
  TIER_CONFIG,
  isBillingInterval,
  isPlanTier,
  type PackSize,
} from "../config.js";
import {
  awardCredits,
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:checkout-completed" });

/**
 * Parses the pack size metadata stored on a payment-mode checkout session.
 */
function parsePackSize(value: string | undefined): PackSize | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !(parsed in PACK_CONFIG)) {
    return null;
  }

  return parsed as PackSize;
}

/**
 * Applies a completed credit-pack checkout to the brand's credit balance.
 */
async function handlePackCheckoutCompletedSession(opts: {
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
      "payment checkout completed before the pack purchase was fully paid",
    );
    return;
  }

  const packSize = parsePackSize(metadata.pack_size);

  if (!packSize) {
    log.warn(
      {
        stripeEventId: event.id,
        sessionId: session.id,
        brandId,
        metadata,
      },
      "payment checkout completed without a valid credit pack size",
    );
    return;
  }

  const packConfig = PACK_CONFIG[packSize];
  const onboardingDiscountApplied = metadata.is_onboarding_discount === "true";
  const totalCredits = await awardCredits({
    db: conn,
    brandId,
    credits: packConfig.credits,
    reason: "pack_purchase",
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
      pack_size: packSize,
      credits_awarded: packConfig.credits,
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

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      sessionId: session.id,
      packSize,
      creditsAwarded: packConfig.credits,
      totalCredits,
      onboardingDiscountApplied,
    },
    "credit pack checkout completed",
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
    await handlePackCheckoutCompletedSession({
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
