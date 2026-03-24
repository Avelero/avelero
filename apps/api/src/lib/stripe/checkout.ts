import type Stripe from "stripe";
import { getStripeClient } from "./client.js";
import { TIER_CONFIG, type BillingInterval, type PlanTier } from "./config.js";

/**
 * Create a Stripe hosted Checkout Session for a new subscription.
 *
 * The session creates a subscription with 1 or 2 line items:
 * - Always: the Avelero price for the chosen tier + interval
 * - Optionally: the matching Impact Predictions price
 *
 * Metadata is placed on both the Checkout Session and the
 * `subscription_data` so that subsequent subscription webhooks carry the
 * `brand_id` and plan details.
 */
function buildCheckoutMetadata(opts: {
  brandId: string;
  tier: PlanTier;
  interval: BillingInterval;
  includeImpact: boolean;
}) {
  return {
    brand_id: opts.brandId,
    plan_type: opts.tier,
    billing_interval: opts.interval,
    include_impact: String(opts.includeImpact),
  };
}

/**
 * Checks whether an open Checkout Session already matches the requested plan.
 */
function isMatchingOpenCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  brandId: string;
  metadata: Record<string, string>;
}): boolean {
  const { session, brandId, metadata } = params;

  // Require upgrade metadata to match exactly so regular and upgrade checkouts never alias.
  const sessionUpgradeSource =
    session.metadata?.upgrade_from_subscription_id ?? null;
  const requestedUpgradeSource =
    metadata.upgrade_from_subscription_id ?? null;

  return (
    session.mode === "subscription" &&
    session.client_reference_id === brandId &&
    session.metadata?.plan_type === metadata.plan_type &&
    session.metadata?.billing_interval === metadata.billing_interval &&
    session.metadata?.include_impact === metadata.include_impact &&
    sessionUpgradeSource === requestedUpgradeSource
  );
}

export async function createCheckoutSession(opts: {
  brandId: string;
  stripeCustomerId: string;
  tier: PlanTier;
  interval: BillingInterval;
  includeImpact: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const {
    brandId,
    stripeCustomerId,
    tier,
    interval,
    includeImpact,
    successUrl,
    cancelUrl,
  } = opts;

  const prices = TIER_CONFIG[tier].prices[interval];

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: prices.avelero, quantity: 1 },
  ];

  if (includeImpact) {
    lineItems.push({ price: prices.impact, quantity: 1 });
  }

  const metadata = {
    ...buildCheckoutMetadata({
      brandId,
      tier,
      interval,
      includeImpact,
    }),
  };

  const stripe = getStripeClient();
  const openSessions = await stripe.checkout.sessions.list({
    customer: stripeCustomerId,
    limit: 20,
    status: "open",
  });

  const reusableSession = openSessions.data.find((session) =>
    isMatchingOpenCheckoutSession({
      session,
      brandId,
      metadata,
    }),
  );

  for (const session of openSessions.data) {
    if (
      session.mode !== "subscription" ||
      session.client_reference_id !== brandId ||
      session.id === reusableSession?.id
    ) {
      continue;
    }

    // Expire older brand-scoped sessions so only one subscription checkout can remain usable.
    await stripe.checkout.sessions.expire(session.id);
  }

  if (reusableSession?.url) {
    return { sessionId: reusableSession.id, url: reusableSession.url };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: brandId,
    line_items: lineItems,
    metadata,
    subscription_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session was created without a URL");
  }

  return { sessionId: session.id, url: session.url };
}

/**
 * Create a Stripe Checkout Session for an upgrade from an existing subscription.
 *
 * Opens a fresh subscription checkout for the new tier without proration.
 * The old subscription is NOT cancelled here — it stays active until the
 * checkout.session.completed webhook fires, so abandoning checkout is safe.
 */
export async function createUpgradeCheckoutSession(opts: {
  brandId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  newTier: PlanTier;
  newInterval: BillingInterval;
  includeImpact: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const {
    brandId,
    stripeCustomerId,
    stripeSubscriptionId,
    newTier,
    newInterval,
    includeImpact,
    successUrl,
    cancelUrl,
  } = opts;

  const stripe = getStripeClient();

  const prices = TIER_CONFIG[newTier].prices[newInterval];
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: prices.avelero, quantity: 1 },
  ];
  if (includeImpact) {
    lineItems.push({ price: prices.impact, quantity: 1 });
  }

  const metadata = {
    ...buildCheckoutMetadata({
      brandId,
      tier: newTier,
      interval: newInterval,
      includeImpact,
    }),
    upgrade_from_subscription_id: stripeSubscriptionId,
  };

  // Expire any stale brand-scoped checkout sessions.
  const openSessions = await stripe.checkout.sessions.list({
    customer: stripeCustomerId,
    limit: 20,
    status: "open",
  });

  const reusableSession = openSessions.data.find((session) =>
    isMatchingOpenCheckoutSession({ session, brandId, metadata }),
  );

  for (const session of openSessions.data) {
    if (
      session.mode !== "subscription" ||
      session.client_reference_id !== brandId ||
      session.id === reusableSession?.id
    ) {
      continue;
    }
    await stripe.checkout.sessions.expire(session.id);
  }

  if (reusableSession?.url) {
    return { sessionId: reusableSession.id, url: reusableSession.url };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: brandId,
    line_items: lineItems,
    metadata,
    subscription_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session was created without a URL");
  }

  return { sessionId: session.id, url: session.url };
}
