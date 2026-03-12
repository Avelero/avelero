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
    brand_id: brandId,
    plan_type: tier,
    billing_interval: interval,
    include_impact: String(includeImpact),
  };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
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
