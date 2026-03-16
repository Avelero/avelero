/**
 * Handles `customer.subscription.deleted` by ending the subscription link and resolving the lifecycle phase.
 */
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
  resolveBrandIdForSubscription,
  resolveSubscriptionProjection,
} from "../projection.js";

/**
 * Persists the final subscription teardown after Stripe has actually deleted the subscription.
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brandId = await resolveBrandIdForSubscription({ db, subscription });

  if (!brandId) {
    console.warn(
      `subscription.deleted: could not determine brand_id for ${subscription.id}`,
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
      hasImpactPredictions: false,
      updatedAt: nowIso,
    })
    .where(eq(brandPlan.brandId, brandId));

  if (hasRemainingAccess) {
    await db
      .update(brandLifecycle)
      .set({
        phase: "active",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  } else if (isBillingFailure) {
    await db
      .update(brandLifecycle)
      .set({
        phase: "expired",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  } else {
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
      resolved_phase: hasRemainingAccess
        ? "active"
        : isBillingFailure
          ? "expired"
          : "cancelled",
      has_remaining_access: hasRemainingAccess,
      period_end: projection.currentPeriodEnd,
    },
  });
}
