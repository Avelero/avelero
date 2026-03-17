import Stripe from "stripe";

/**
 * Lazy-initialized Stripe SDK singleton.
 *
 * We intentionally omit an explicit `apiVersion` so the SDK uses the
 * version that matches its release (currently 2026-01-28.clover).
 */
let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * Type guard for Stripe SDK errors.
 */
export function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return err instanceof Stripe.errors.StripeError;
}
