/**
 * Keeps local subscription state aligned with Stripe subscription updates.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  isStripeSubscriptionPendingCancellation,
  resolveBrandIdForSubscription,
  syncStripeSubscriptionProjectionById,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:subscription-updated" });

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brandId = await resolveBrandIdForSubscription({
    db: conn,
    subscription,
  });

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id,
      },
      "brand_id not resolvable for subscription update — brand state was NOT updated",
    );
    return;
  }

  const { projection } = await syncStripeSubscriptionProjectionById({
    db: conn,
    subscriptionId: subscription.id,
    clearPastDue: subscription.status === "active",
    brandId,
  });
  const nowIso = new Date().toISOString();
  let resolvedPhase: string | null = null;

  if (subscription.status === "active") {
    resolvedPhase = "active";
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
  }

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    resolvedPhase = "past_due";
    const [billing] = await conn
      .select({ pastDueSince: brandBilling.pastDueSince })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    await conn
      .update(brandBilling)
      .set({
        pastDueSince: billing?.pastDueSince ?? nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandBilling.brandId, brandId));

    await conn
      .update(brandLifecycle)
      .set({
        phase: "past_due",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(brandLifecycle.brandId, brandId),
          notInArray(brandLifecycle.phase, ["suspended"]),
        ),
      );
  }

  const pendingCancellation = isStripeSubscriptionPendingCancellation(subscription);

  await conn.insert(brandBillingEvents).values({
    brandId,
    eventType: "subscription_updated",
    stripeEventId: event.id,
    payload: {
      subscription_id: subscription.id,
      status: subscription.status,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      pending_cancellation: pendingCancellation,
      current_period_start: projection.currentPeriodStart,
      current_period_end: projection.currentPeriodEnd,
      plan_type: projection.planType,
      billing_interval: projection.billingInterval,
      has_impact: projection.hasImpactPredictions,
    },
  });

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      subscriptionId: subscription.id,
      status: subscription.status,
      pendingCancellation,
      phase: resolvedPhase,
    },
    "subscription updated",
  );
}
