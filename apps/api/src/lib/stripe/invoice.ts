import { getStripeClient } from "./client.js";

/**
 * Create and finalize a Stripe Invoice for an Enterprise brand.
 *
 * Enterprise brands use custom invoicing (not Checkout). This creates a
 * single invoice item with the specified amount, attaches it to the
 * customer's next invoice, then finalizes the invoice so it can be paid.
 */
export async function createEnterpriseInvoice(opts: {
  brandId: string;
  stripeCustomerId: string;
  amountCents: number;
  description: string;
  currency?: string;
}): Promise<{ invoiceId: string; invoiceUrl: string | null }> {
  const {
    brandId,
    stripeCustomerId,
    amountCents,
    description,
    currency = "eur",
  } = opts;

  const stripe = getStripeClient();

  // Create the invoice item on the customer
  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: amountCents,
    currency,
    description,
  });

  // Create the invoice, pulling in the pending invoice item we just created
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    metadata: { brand_id: brandId, plan_type: "enterprise" },
    pending_invoice_items_behavior: "include",
    auto_advance: true,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  return {
    invoiceId: finalized.id,
    invoiceUrl: finalized.hosted_invoice_url ?? null,
  };
}
