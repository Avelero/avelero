import { eq } from "@v1/db/queries";
import { brandBilling } from "@v1/db/schema";
import type { DatabaseOrTransaction } from "@v1/db/client";
import { getStripeClient } from "./client.js";

/**
 * Look up or create a Stripe Customer for the given brand.
 *
 * If `brand_billing.stripe_customer_id` already exists we return it.
 * Otherwise we create a new Stripe Customer, persist the ID, and return it.
 */
export async function findOrCreateStripeCustomer(opts: {
  brandId: string;
  brandName: string;
  email: string;
  db: DatabaseOrTransaction;
}): Promise<string> {
  const { brandId, brandName, email, db } = opts;

  // Check for an existing Stripe customer ID
  const [row] = await db
    .select({ stripeCustomerId: brandBilling.stripeCustomerId })
    .from(brandBilling)
    .where(eq(brandBilling.brandId, brandId))
    .limit(1);

  if (row?.stripeCustomerId) {
    return row.stripeCustomerId;
  }

  // Create a new Stripe Customer
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    name: brandName,
    email,
    metadata: { brand_id: brandId },
  });

  // Persist the customer ID
  await db
    .update(brandBilling)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandBilling.brandId, brandId));

  return customer.id;
}
