/**
 * Stripe Checkout helpers for one-time credit pack purchases.
 */
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";
import {
  getPackPriceId,
  ONBOARDING_DISCOUNT_FACTOR,
  type PackSize,
} from "./config.js";

/**
 * Builds the metadata persisted onto a credit-pack checkout session.
 */
function buildPackCheckoutMetadata(opts: {
  brandId: string;
  packSize: PackSize;
  applyOnboardingDiscount: boolean;
}): Record<string, string> {
  return {
    brand_id: opts.brandId,
    pack_size: String(opts.packSize),
    is_onboarding_discount: String(opts.applyOnboardingDiscount),
  };
}

/**
 * Checks whether an open payment checkout session already matches the requested pack purchase.
 */
function isMatchingOpenPackCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  brandId: string;
  metadata: Record<string, string>;
}): boolean {
  const { session, brandId, metadata } = params;

  return (
    session.mode === "payment" &&
    session.client_reference_id === brandId &&
    session.metadata?.pack_size === metadata.pack_size &&
    session.metadata?.is_onboarding_discount ===
      metadata.is_onboarding_discount
  );
}

/**
 * Creates or reuses a Stripe Checkout Session for purchasing a one-time credit pack.
 */
export async function createPackCheckoutSession(opts: {
  stripeCustomerId: string;
  brandId: string;
  packSize: PackSize;
  applyOnboardingDiscount: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const {
    stripeCustomerId,
    brandId,
    packSize,
    applyOnboardingDiscount,
    successUrl,
    cancelUrl,
  } = opts;
  const stripe = getStripeClient();
  const metadata = buildPackCheckoutMetadata({
    brandId,
    packSize,
    applyOnboardingDiscount,
  });

  const openSessions = await stripe.checkout.sessions.list({
    customer: stripeCustomerId,
    limit: 20,
    status: "open",
  });

  const reusableSession = openSessions.data.find((session) =>
    isMatchingOpenPackCheckoutSession({
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

    // Expire older brand-scoped payment sessions so only one pack checkout remains active.
    await stripe.checkout.sessions.expire(session.id);
  }

  if (reusableSession?.url) {
    return { sessionId: reusableSession.id, url: reusableSession.url };
  }

  let couponId: string | null = null;

  if (applyOnboardingDiscount) {
    const coupon = await stripe.coupons.create({
      percent_off: ONBOARDING_DISCOUNT_FACTOR * 100,
      duration: "once",
      name: "Credit pack onboarding discount",
      redeem_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      metadata: {
        brand_id: brandId,
        pack_size: String(packSize),
      },
    });
    couponId = coupon.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: brandId,
    line_items: [{ price: getPackPriceId(packSize), quantity: 1 }],
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
