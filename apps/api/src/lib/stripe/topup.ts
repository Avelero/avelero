/**
 * Stripe Checkout helpers for quantity-based credit top-ups.
 */
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";
import {
  ONBOARDING_DISCOUNT_CAP,
  ONBOARDING_DISCOUNT_FACTOR,
  TOPUP_RATES,
  type PlanTier,
  getPassportsPriceId,
} from "./config.js";

/**
 * Builds the metadata persisted onto a top-up checkout session.
 */
function buildTopupCheckoutMetadata(opts: {
  brandId: string;
  tier: PlanTier;
  quantity: number;
  applyOnboardingDiscount: boolean;
}): Record<string, string> {
  return {
    brand_id: opts.brandId,
    tier: opts.tier,
    topup_quantity: String(opts.quantity),
    is_onboarding_discount: String(opts.applyOnboardingDiscount),
  };
}

/**
 * Checks whether an open payment checkout session already matches the requested top-up.
 */
function isMatchingOpenTopupCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  brandId: string;
  metadata: Record<string, string>;
}): boolean {
  const { session, brandId, metadata } = params;

  return (
    session.mode === "payment" &&
    session.client_reference_id === brandId &&
    session.metadata?.tier === metadata.tier &&
    session.metadata?.topup_quantity === metadata.topup_quantity &&
    session.metadata?.is_onboarding_discount ===
      metadata.is_onboarding_discount
  );
}

/**
 * Creates a coupon that applies the onboarding discount for the requested top-up.
 */
async function createTopupDiscountCoupon(opts: {
  stripe: Stripe;
  brandId: string;
  tier: PlanTier;
  quantity: number;
}): Promise<string> {
  const { stripe, brandId, tier, quantity } = opts;
  const cap = ONBOARDING_DISCOUNT_CAP[tier];
  const centsPerCredit = TOPUP_RATES[tier];

  if (quantity <= cap) {
    const coupon = await stripe.coupons.create({
      percent_off: ONBOARDING_DISCOUNT_FACTOR * 100,
      duration: "once",
      name: "Passport top-up onboarding discount",
      redeem_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      metadata: {
        brand_id: brandId,
        tier,
        topup_quantity: String(quantity),
      },
    });

    return coupon.id;
  }

  const cappedDiscountAmount = Math.round(
    cap * centsPerCredit * ONBOARDING_DISCOUNT_FACTOR,
  );
  const coupon = await stripe.coupons.create({
    amount_off: cappedDiscountAmount,
    currency: "eur",
    duration: "once",
    name: "Passport top-up onboarding discount",
    redeem_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    metadata: {
      brand_id: brandId,
      tier,
      topup_quantity: String(quantity),
      capped_credits: String(cap),
    },
  });

  return coupon.id;
}

/**
 * Creates or reuses a Stripe Checkout Session for purchasing additional credits.
 */
export async function createTopupCheckoutSession(opts: {
  stripeCustomerId: string;
  brandId: string;
  tier: PlanTier;
  quantity: number;
  applyOnboardingDiscount: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const {
    stripeCustomerId,
    brandId,
    tier,
    quantity,
    applyOnboardingDiscount,
    successUrl,
    cancelUrl,
  } = opts;
  const stripe = getStripeClient();
  const metadata = buildTopupCheckoutMetadata({
    brandId,
    tier,
    quantity,
    applyOnboardingDiscount,
  });

  const openSessions = await stripe.checkout.sessions.list({
    customer: stripeCustomerId,
    limit: 20,
    status: "open",
  });

  const reusableSession = openSessions.data.find((session) =>
    isMatchingOpenTopupCheckoutSession({
      session,
      brandId,
      metadata,
    }),
  );

  for (const session of openSessions.data) {
    if (
      session.mode !== "payment" ||
      session.client_reference_id !== brandId ||
      session.id === reusableSession?.id
    ) {
      continue;
    }

    // Expire older brand-scoped payment sessions so only one top-up checkout remains active.
    await stripe.checkout.sessions.expire(session.id);
  }

  if (reusableSession?.url) {
    return { sessionId: reusableSession.id, url: reusableSession.url };
  }

  const couponId = applyOnboardingDiscount
    ? await createTopupDiscountCoupon({
        stripe,
        brandId,
        tier,
        quantity,
      })
    : null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: brandId,
    line_items: [{ price: getPassportsPriceId(tier), quantity }],
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session was created without a URL");
  }

  return { sessionId: session.id, url: session.url };
}
