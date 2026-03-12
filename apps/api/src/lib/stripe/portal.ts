import { getStripeClient } from "./client.js";

/**
 * Create a Stripe Customer Portal session.
 *
 * The portal lets customers manage payment methods and view invoice history.
 * Must be configured in the Stripe Dashboard beforehand (one-time setup).
 */
export async function createPortalSession(opts: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const { stripeCustomerId, returnUrl } = opts;
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}
