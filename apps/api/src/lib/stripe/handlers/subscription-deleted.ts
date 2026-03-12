import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import type Stripe from "stripe";

/**
 * Handle `customer.subscription.deleted` — subscription was cancelled.
 *
 * Updates:
 * - brand_billing: clear stripe_subscription_id
 * - brand_plan: clear has_impact_predictions
 * - brand_lifecycle: phase depends on cancellation reason:
 *   - `payment_failed` / `payment_disputed` → `expired` (can reactivate by paying)
 *   - Everything else (including `cancellation_requested`) → `cancelled` with 30-day hard delete
 * - brand_billing_events: audit log entry
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Determine brand ID from metadata or billing lookup
  let brandId = subscription.metadata?.brand_id;

  if (!brandId) {
    const [row] = await db
      .select({ brandId: brandBilling.brandId })
      .from(brandBilling)
      .where(eq(brandBilling.stripeSubscriptionId, subscription.id))
      .limit(1);
    brandId = row?.brandId;
  }

  if (!brandId) {
    console.warn(
      `subscription.deleted: could not determine brand_id for ${subscription.id}`,
    );
    return;
  }

  const nowIso = new Date().toISOString();
  const reason = subscription.cancellation_details?.reason ?? null;

  // Billing-failure reasons → expired (brand can reactivate by paying)
  // Voluntary cancellation or other reasons → cancelled with hard delete
  const isBillingFailure =
    reason === "payment_failed" || reason === "payment_disputed";

  // Clear subscription ID from billing
  await db
    .update(brandBilling)
    .set({
      stripeSubscriptionId: null,
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  // Clear impact predictions
  await db
    .update(brandPlan)
    .set({
      hasImpactPredictions: false,
      updatedAt: nowIso,
    })
    .where(eq(brandPlan.brandId, brandId));

  if (isBillingFailure) {
    // Expired: brand can reactivate by paying — no hard delete countdown
    await db
      .update(brandLifecycle)
      .set({
        phase: "expired",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  } else {
    // Cancelled: voluntary cancellation — start 30-day hard delete countdown
    const hardDeleteDate = new Date();
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

  // Log billing event
  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "subscription_deleted",
    stripeEventId: event.id,
    payload: {
      reason,
      resolved_phase: isBillingFailure ? "expired" : "cancelled",
    },
  });
}
