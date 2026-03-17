/**
 * Stripe helpers for mutating live subscriptions.
 */
import { getStripeClient } from "./client.js";
import {
  TIER_CONFIG,
  resolvePriceId,
  type BillingInterval,
  type PlanTier,
} from "./config.js";

/**
 * Add Impact Predictions to an existing subscription.
 *
 * Retrieves the subscription first to check whether an Impact line item
 * already exists (idempotency). If it does, this is a no-op. Otherwise
 * appends a new line item for the matching Impact price.
 * Stripe handles proration automatically.
 */
export async function addImpactToSubscription(opts: {
  stripeSubscriptionId: string;
  tier: PlanTier;
  interval: BillingInterval;
}): Promise<void> {
  // Fetch the latest subscription state so add-on updates stay idempotent.
  const { stripeSubscriptionId, tier, interval } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Check if an Impact item already exists
  const existingImpact = subscription.items.data.some((item) => {
    const resolved = resolvePriceId(item.price.id);
    return resolved?.product === "impact";
  });

  if (existingImpact) {
    return; // Already has Impact — no-op
  }

  const impactPriceId = TIER_CONFIG[tier].prices[interval].impact;

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ price: impactPriceId }],
    metadata: { include_impact: "true" },
    proration_behavior: "create_prorations",
  });
}

/**
 * Remove Impact Predictions from an existing subscription.
 *
 * Retrieves the subscription, finds the Impact line item via
 * `resolvePriceId()`, and deletes it. If no Impact item exists this
 * is a no-op (idempotent).
 */
export async function removeImpactFromSubscription(opts: {
  stripeSubscriptionId: string;
}): Promise<void> {
  // Fetch the latest subscription state so add-on removals stay idempotent.
  const { stripeSubscriptionId } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const impactItem = subscription.items.data.find((item) => {
    const resolved = resolvePriceId(item.price.id);
    return resolved?.product === "impact";
  });

  if (!impactItem) {
    return; // No Impact item — no-op
  }

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: impactItem.id, deleted: true }],
    metadata: { include_impact: "false" },
    proration_behavior: "create_prorations",
  });
}

/**
 * Update the plan tier and/or interval for an existing subscription.
 *
 * Swaps every line item's price to the new tier/interval equivalent.
 * If `hasImpact` is true but no Impact line item exists, one is added.
 * If `hasImpact` is false but an Impact line item exists, it is removed.
 */
export async function updateSubscriptionPlan(opts: {
  stripeSubscriptionId: string;
  newTier: PlanTier;
  newInterval: BillingInterval;
  hasImpact: boolean;
}): Promise<void> {
  // Swap the active plan items and clear any scheduled cancellation in the same update.
  const { stripeSubscriptionId, newTier, newInterval, hasImpact } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const newPrices = TIER_CONFIG[newTier].prices[newInterval];
  const items: Array<{
    id?: string;
    price?: string;
    deleted?: boolean;
  }> = [];

  let hasExistingImpact = false;
  let foundAvelero = false;

  for (const item of subscription.items.data) {
    const resolved = resolvePriceId(item.price.id);
    if (!resolved) {
      throw new Error(
        `Subscription ${stripeSubscriptionId} contains unrecognised price ${item.price.id}. Cannot safely update — manual intervention required.`,
      );
    }

    if (resolved.product === "avelero") {
      foundAvelero = true;
      items.push({ id: item.id, price: newPrices.avelero });
    } else if (resolved.product === "impact") {
      hasExistingImpact = true;
      if (hasImpact) {
        items.push({ id: item.id, price: newPrices.impact });
      } else {
        items.push({ id: item.id, deleted: true });
      }
    }
  }

  if (!foundAvelero) {
    throw new Error(
      `Subscription ${stripeSubscriptionId} has no Avelero line item. Cannot update plan — subscription may be in an inconsistent state.`,
    );
  }

  // Add Impact line item if requested but not currently present
  if (hasImpact && !hasExistingImpact) {
    items.push({ price: newPrices.impact });
  }

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items,
    cancel_at_period_end: false,
    metadata: {
      plan_type: newTier,
      billing_interval: newInterval,
      include_impact: String(hasImpact),
    },
    proration_behavior: "create_prorations",
  });
}
