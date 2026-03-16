/**
 * Wraps Stripe invoice operations used by the platform-admin enterprise billing flow.
 */
import { getStripeClient } from "./client.js";
import { STRIPE_BILLING_METADATA_KEYS } from "./projection.js";

interface EnterpriseInvoiceRecipient {
  name: string;
  email: string;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface EnterpriseInvoiceInput {
  brandId: string;
  stripeCustomerId: string;
  amountCents: number;
  description: string;
  currency?: string;
  recipient: EnterpriseInvoiceRecipient;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  dueDate?: string | null;
  daysUntilDue?: number | null;
  footer?: string | null;
  internalReference?: string | null;
}

/**
 * Converts an ISO timestamp into a unix timestamp Stripe accepts.
 */
function isoToUnix(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return undefined;
  return Math.floor(parsed / 1000);
}

/**
 * Builds invoice custom fields from optional recipient metadata.
 */
function buildInvoiceCustomFields(opts: {
  taxId?: string | null;
  internalReference?: string | null;
}): Array<{ name: string; value: string }> | undefined {
  const fields = [
    opts.taxId ? { name: "Tax ID", value: opts.taxId } : null,
    opts.internalReference
      ? { name: "Reference", value: opts.internalReference }
      : null,
  ].filter((field): field is { name: string; value: string } => !!field);

  return fields.length > 0 ? fields : undefined;
}

/**
 * Creates, finalizes, and sends an enterprise invoice with a fixed service-period window.
 */
export async function createEnterpriseInvoice(
  opts: EnterpriseInvoiceInput,
): Promise<{
  invoiceId: string;
  invoiceUrl: string | null;
  status: string;
}> {
  const {
    brandId,
    stripeCustomerId,
    amountCents,
    currency = "eur",
    description,
    recipient,
    servicePeriodStart,
    servicePeriodEnd,
    dueDate,
    daysUntilDue,
    footer,
    internalReference,
  } = opts;

  const stripe = getStripeClient();
  const metadata = {
    [STRIPE_BILLING_METADATA_KEYS.brandId]: brandId,
    [STRIPE_BILLING_METADATA_KEYS.billingMode]: "stripe_invoice",
    [STRIPE_BILLING_METADATA_KEYS.servicePeriodStart]: servicePeriodStart,
    [STRIPE_BILLING_METADATA_KEYS.servicePeriodEnd]: servicePeriodEnd,
    [STRIPE_BILLING_METADATA_KEYS.managedByAvelero]: "true",
    [STRIPE_BILLING_METADATA_KEYS.recipientName]: recipient.name,
    [STRIPE_BILLING_METADATA_KEYS.recipientEmail]: recipient.email,
    [STRIPE_BILLING_METADATA_KEYS.recipientTaxId]: recipient.taxId ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressLine1]:
      recipient.addressLine1 ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressLine2]:
      recipient.addressLine2 ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressCity]: recipient.city ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressRegion]: recipient.region ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressPostalCode]:
      recipient.postalCode ?? "",
    [STRIPE_BILLING_METADATA_KEYS.recipientAddressCountry]:
      recipient.country ?? "",
    [STRIPE_BILLING_METADATA_KEYS.internalReference]: internalReference ?? "",
  };

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: amountCents,
    currency,
    description,
    metadata,
    period: {
      start: Math.floor(new Date(servicePeriodStart).getTime() / 1000),
      end: Math.floor(new Date(servicePeriodEnd).getTime() / 1000),
    },
  });

  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    auto_advance: false,
    pending_invoice_items_behavior: "include",
    description,
    footer: footer ?? undefined,
    custom_fields: buildInvoiceCustomFields({
      taxId: recipient.taxId ?? null,
      internalReference,
    }),
    due_date: isoToUnix(dueDate),
    days_until_due: dueDate ? undefined : daysUntilDue ?? undefined,
    metadata,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  const sent = await stripe.invoices.sendInvoice(finalized.id);

  return {
    invoiceId: sent.id,
    invoiceUrl: sent.hosted_invoice_url ?? null,
    status: sent.status ?? "open",
  };
}

/**
 * Sends an existing Stripe invoice email again.
 */
export async function sendEnterpriseInvoice(invoiceId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.invoices.sendInvoice(invoiceId);
}

/**
 * Voids an existing Stripe invoice.
 */
export async function voidEnterpriseInvoice(invoiceId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.invoices.voidInvoice(invoiceId);
}
