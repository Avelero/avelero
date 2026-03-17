/**
 * Resolves brand access after Stripe deletes a subscription.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  resolveBrandIdForSubscription,
  resolveSubscriptionProjection,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:subscription-deleted" });

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
): Promise<void> {
  // Preserve paid entitlements until the subscription's remaining access window ends.
  const subscription = event.data.object as Stripe.Subscription;
  const brandId = await resolveBrandIdForSubscription({ db, subscription });

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id,
      },
      "brand_id not resolvable for subscription deletion — brand state was NOT updated",
    );
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const reason = subscription.cancellation_details?.reason ?? null;
  const isBillingFailure =
    reason === "payment_failed" || reason === "payment_disputed";
  const projection = resolveSubscriptionProjection(subscription);
  const periodEnd = projection.currentPeriodEnd
    ? new Date(projection.currentPeriodEnd)
    : null;
  const hasRemainingAccess =
    periodEnd !== null && periodEnd.getTime() > now.getTime();

  await db
    .update(brandBilling)
    .set({
      stripeSubscriptionId: null,
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      pendingCancellation: false,
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  await db
    .update(brandPlan)
    .set({
      hasImpactPredictions: hasRemainingAccess
        ? projection.hasImpactPredictions
        : false,
      updatedAt: nowIso,
    })
    .where(eq(brandPlan.brandId, brandId));

  let resolvedPhase: string;

  if (hasRemainingAccess) {
    resolvedPhase = "active";
    await db
      .update(brandLifecycle)
      .set({
        phase: "active",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  } else if (isBillingFailure) {
    resolvedPhase = "expired";
    await db
      .update(brandLifecycle)
      .set({
        phase: "expired",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  } else {
    resolvedPhase = "cancelled";
    const hardDeleteDate = new Date(now);
    hardDeleteDate.setDate(hardDeleteDate.getDate() + 30);

    await db
      .update(brandLifecycle)
      .set({
        phase: "cancelled",
        phaseChangedAt: nowIso,
        cancelledAt: nowIso,
        hardDeleteAfter: hardDeleteDate.toISOString(),
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  }

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "subscription_deleted",
    stripeEventId: event.id,
    payload: {
      subscription_id: subscription.id,
      reason,
      resolved_phase: resolvedPhase,
      has_remaining_access: hasRemainingAccess,
      period_end: projection.currentPeriodEnd,
    },
  });

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      subscriptionId: subscription.id,
      reason,
      resolvedPhase,
      hasRemainingAccess,
      periodEnd: projection.currentPeriodEnd,
    },
    "subscription deleted: resolved phase",
  );
}
