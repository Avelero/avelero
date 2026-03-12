import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import type Stripe from "stripe";
import { TIER_CONFIG, resolvePriceId } from "../config.js";

/**
 * Handle `customer.subscription.updated` — subscription changed.
 *
 * Covers: plan upgrades/downgrades, interval changes, adding/removing
 * Impact Predictions, and status transitions (e.g. past_due → active
 * after successful retry).
 *
 * Parses the current subscription items via `resolvePriceId()` to
 * determine the effective tier, interval, and whether Impact is present.
 */
export async function handleSubscriptionUpdated(
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
      `subscription.updated: could not determine brand_id for ${subscription.id}`,
    );
    return;
  }

  const nowIso = new Date().toISOString();

  // If subscription became active and brand is past_due, recover
  if (subscription.status === "active") {
    const [lifecycle] = await db
      .select({ phase: brandLifecycle.phase })
      .from(brandLifecycle)
      .where(eq(brandLifecycle.brandId, brandId))
      .limit(1);

    if (lifecycle?.phase === "past_due") {
      await db
        .update(brandLifecycle)
        .set({
          phase: "active",
          phaseChangedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(eq(brandLifecycle.brandId, brandId));
    }
  }

  // Parse subscription items to determine current plan state
  let resolvedTier: string | null = null;
  let resolvedInterval: string | null = null;
  let hasImpact = false;

  for (const item of subscription.items.data) {
    const resolved = resolvePriceId(item.price.id);
    if (!resolved) continue;

    if (resolved.product === "avelero") {
      resolvedTier = resolved.tier;
      resolvedInterval = resolved.interval;
    } else if (resolved.product === "impact") {
      hasImpact = true;
    }
  }

  // Update brand_plan if we resolved a valid tier
  if (resolvedTier && resolvedInterval) {
    const tierKey = resolvedTier as keyof typeof TIER_CONFIG;
    const tierConfig = TIER_CONFIG[tierKey];

    await db
      .update(brandPlan)
      .set({
        planType: resolvedTier,
        billingInterval: resolvedInterval,
        hasImpactPredictions: hasImpact,
        skuAnnualLimit: tierConfig.skuAnnualLimit,
        skuOnboardingLimit: tierConfig.skuOnboardingLimit,
        updatedAt: nowIso,
      })
      .where(eq(brandPlan.brandId, brandId));
  }

  // Log billing event
  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "subscription_updated",
    stripeEventId: event.id,
    payload: {
      status: subscription.status,
      plan_type: resolvedTier,
      billing_interval: resolvedInterval,
      has_impact: hasImpact,
    },
  });
}
