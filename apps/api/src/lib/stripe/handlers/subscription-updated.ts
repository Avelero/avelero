/**
 * Handles `customer.subscription.updated` by refreshing the subscription projection and cancellation flags.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import type Stripe from "stripe";
import {
  isStripeSubscriptionPendingCancellation,
  projectStripeSubscription,
  resolveBrandIdForSubscription,
} from "../projection.js";

/**
 * Persists subscription updates, including cancel-at-period-end and recovery from past due.
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brandId = await resolveBrandIdForSubscription({ db, subscription });

  if (!brandId) {
    console.warn(
      `subscription.updated: could not determine brand_id for ${subscription.id}`,
    );
    return;
  }

  const { projection } = await projectStripeSubscription({
    db,
    subscription,
    clearPastDue: subscription.status === "active",
    knownBrandId: brandId,
  });
  const nowIso = new Date().toISOString();

  if (subscription.status === "active") {
    await db
      .update(brandLifecycle)
      .set({
        phase: "active",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  }

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    const [billing] = await db
      .select({ pastDueSince: brandBilling.pastDueSince })
      .from(brandBilling)
      .where(eq(brandBilling.brandId, brandId))
      .limit(1);

    await db
      .update(brandBilling)
      .set({
        pastDueSince: billing?.pastDueSince ?? nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandBilling.brandId, brandId));

    await db
      .update(brandLifecycle)
      .set({
        phase: "past_due",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  }

  await db.insert(brandBillingEvents).values({
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
      pending_cancellation:
        isStripeSubscriptionPendingCancellation(subscription),
      current_period_start: projection.currentPeriodStart,
      current_period_end: projection.currentPeriodEnd,
      plan_type: projection.planType,
      billing_interval: projection.billingInterval,
      has_impact: projection.hasImpactPredictions,
    },
  });
}
