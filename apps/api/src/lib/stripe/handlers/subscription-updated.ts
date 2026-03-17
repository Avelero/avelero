import { db } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  isStripeSubscriptionPendingCancellation,
  projectStripeSubscription,
  resolveBrandIdForSubscription,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:subscription-updated" });

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brandId = await resolveBrandIdForSubscription({ db, subscription });

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

  const { projection } = await projectStripeSubscription({
    db,
    subscription,
    clearPastDue: subscription.status === "active",
    knownBrandId: brandId,
  });
  const nowIso = new Date().toISOString();
  let resolvedPhase: string | null = null;

  if (subscription.status === "active") {
    resolvedPhase = "active";
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
          notInArray(brandLifecycle.phase, ["expired", "suspended", "cancelled"]),
        ),
      );
  }

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    resolvedPhase = "past_due";
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
      .where(
        and(
          eq(brandLifecycle.brandId, brandId),
          notInArray(brandLifecycle.phase, ["expired", "suspended", "cancelled"]),
        ),
      );
  }

  const pendingCancellation = isStripeSubscriptionPendingCancellation(subscription);

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
