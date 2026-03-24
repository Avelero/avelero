/**
 * Resolves brand access after Stripe deletes a subscription.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
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
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  // Preserve paid entitlements until the subscription's remaining access window ends.
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
      "brand_id not resolvable for subscription deletion — brand state was NOT updated",
    );
    return;
  }

  // Guard: if the brand already has a different subscription (e.g. from an upgrade
  // checkout), this deletion is for the superseded subscription. Record the event
  // for the audit trail but skip all state teardown.
  const [currentBilling] = await conn
    .select({ stripeSubscriptionId: brandBilling.stripeSubscriptionId })
    .from(brandBilling)
    .where(eq(brandBilling.brandId, brandId))
    .limit(1);

  if (
    currentBilling?.stripeSubscriptionId &&
    currentBilling.stripeSubscriptionId !== subscription.id
  ) {
    await conn.insert(brandBillingEvents).values({
      brandId,
      eventType: "subscription_deleted",
      stripeEventId: event.id,
      payload: {
        subscription_id: subscription.id,
        reason: subscription.cancellation_details?.reason ?? null,
        resolved_phase: "skipped_superseded",
        has_remaining_access: false,
        period_end: null,
      },
    });

    log.info(
      {
        stripeEventId: event.id,
        brandId,
        deletedSubscriptionId: subscription.id,
        activeSubscriptionId: currentBilling.stripeSubscriptionId,
      },
      "subscription deleted was superseded by upgrade — skipping teardown",
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
  // Compare two Stripe-originated timestamps to determine whether the paid
  // entitlement window extends beyond the actual termination instant.  This
  // avoids any dependency on the server wall clock, which diverges from
  // Stripe test-clock simulated time and can also drift due to webhook
  // delivery delays in production.
  const endedAt = subscription.ended_at
    ? new Date(subscription.ended_at * 1000)
    : null;
  const hasRemainingAccess =
    periodEnd !== null &&
    endedAt !== null &&
    periodEnd.getTime() > endedAt.getTime();

  await conn
    .update(brandBilling)
    .set({
      stripeSubscriptionId: null,
      stripeSubscriptionScheduleId: null,
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      pendingCancellation: false,
      scheduledPlanType: null,
      scheduledBillingInterval: null,
      scheduledHasImpactPredictions: null,
      scheduledPlanChangeEffectiveAt: null,
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  await conn
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
          notInArray(brandLifecycle.phase, ["expired", "suspended", "cancelled"]),
        ),
      );
  } else if (isBillingFailure) {
    resolvedPhase = "expired";
    await conn
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

    await conn
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

  await conn.insert(brandBillingEvents).values({
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
