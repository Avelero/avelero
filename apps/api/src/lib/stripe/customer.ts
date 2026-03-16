/**
 * Finds or creates a Stripe customer and optionally synchronizes billing profile fields.
 */
import { eq } from "@v1/db/queries";
import { brandBilling } from "@v1/db/schema";
import type { DatabaseOrTransaction } from "@v1/db/client";
import { getStripeClient } from "./client.js";

interface StripeBillingProfileInput {
  legalName?: string | null;
  billingEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Builds the Stripe customer payload for optional billing profile fields.
 */
function buildStripeCustomerProfile(
  profile: StripeBillingProfileInput | undefined,
): {
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  name?: string;
  email?: string;
} {
  if (!profile) {
    return {};
  }

  const address = {
    line1: profile.addressLine1 ?? undefined,
    line2: profile.addressLine2 ?? undefined,
    city: profile.city ?? undefined,
    state: profile.region ?? undefined,
    postal_code: profile.postalCode ?? undefined,
    country: profile.country ?? undefined,
  };

  const hasAddress = Object.values(address).some(Boolean);

  return {
    ...(hasAddress ? { address } : {}),
    ...(profile.legalName ? { name: profile.legalName } : {}),
    ...(profile.billingEmail ? { email: profile.billingEmail } : {}),
  };
}

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
  billingProfile?: StripeBillingProfileInput;
}): Promise<string> {
  const { brandId, brandName, email, db, billingProfile } = opts;

  // Check for an existing Stripe customer ID
  const [row] = await db
    .select({ stripeCustomerId: brandBilling.stripeCustomerId })
    .from(brandBilling)
    .where(eq(brandBilling.brandId, brandId))
    .limit(1);

  if (row?.stripeCustomerId) {
    const stripe = getStripeClient();
    const customerProfile = buildStripeCustomerProfile(billingProfile);

    if (Object.keys(customerProfile).length > 0) {
      await stripe.customers.update(row.stripeCustomerId, customerProfile);
    }

    return row.stripeCustomerId;
  }

  // Create a new Stripe Customer
  const stripe = getStripeClient();
  const customerProfile = buildStripeCustomerProfile(billingProfile);
  const customer = await stripe.customers.create({
    name: customerProfile.name ?? brandName,
    email: customerProfile.email ?? email,
    ...(customerProfile.address ? { address: customerProfile.address } : {}),
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
