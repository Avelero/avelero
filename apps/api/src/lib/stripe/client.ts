/**
 * Stripe client helpers.
 *
 * Exposes a shared singleton for application code and explicit factory/reset
 * helpers for tests that need isolated live Stripe clients.
 */
import Stripe from "stripe";

/**
 * Lazy-initialized Stripe SDK singleton.
 *
 * We intentionally omit an explicit `apiVersion` so the SDK uses the
 * version that matches its release (currently 2026-01-28.clover).
 */
let _stripe: Stripe | null = null;

/**
 * Creates a fresh Stripe SDK client for the provided secret key.
 */
export function createStripeClient(secretKey?: string): Stripe {
  // Resolve the API key lazily so tests can override the environment per run.
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

export function getStripeClient(): Stripe {
  // Reuse the shared client for normal application traffic.
  if (_stripe) return _stripe;
  _stripe = createStripeClient();
  return _stripe;
}

/**
 * Clears the cached Stripe SDK singleton.
 */
export function resetStripeClient(): void {
  // Allow tests to force a new client after mutating process environment.
  _stripe = null;
}

/**
 * Type guard for Stripe SDK errors.
 */
export function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  // Narrow unknown errors to Stripe's typed SDK errors when possible.
  return err instanceof Stripe.errors.StripeError;
}
