/**
 * Centralizes Stripe-to-local billing projection logic for subscriptions and invoices.
 */
import type { DatabaseOrTransaction } from "@v1/db/client";
import { eq, sql } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingInvoices,
  brandLifecycle,
  brandPlan,
} from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { getStripeClient, isStripeError } from "./client.js";
import {
  TIER_CONFIG,
  resolvePriceId,
  type BillingInterval,
  type PlanTier,
} from "./config.js";

const log = billingLogger.child({ component: "stripe-projection" });

export const STRIPE_BILLING_METADATA_KEYS = {
  brandId: "brand_id",
  billingMode: "billing_mode",
  servicePeriodStart: "service_period_start",
  servicePeriodEnd: "service_period_end",
  managedByAvelero: "managed_by_avelero",
  recipientName: "recipient_name",
  recipientEmail: "recipient_email",
  recipientTaxId: "recipient_tax_id",
  recipientAddressLine1: "recipient_address_line_1",
  recipientAddressLine2: "recipient_address_line_2",
  recipientAddressCity: "recipient_address_city",
  recipientAddressRegion: "recipient_address_region",
  recipientAddressPostalCode: "recipient_address_postal_code",
  recipientAddressCountry: "recipient_address_country",
  internalReference: "internal_reference",
} as const;

interface ResolvedSubscriptionProjection {
  customerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  planType: PlanTier | null;
  billingInterval: BillingInterval | null;
  hasImpactPredictions: boolean;
}

interface StripeSubscriptionPeriodFields {
  current_period_start?: number | null;
  current_period_end?: number | null;
}

/**
 * Converts a Stripe unix timestamp into an ISO string.
 */
export function unixToIso(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value * 1000).toISOString();
}

/**
 * Converts an ISO string into a Date object when the value is valid.
 */
export function isoToDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Safely returns a plain string customer identifier from a Stripe expandable field.
 */
export function getStripeId(
  value: { id: string } | string | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Determines whether Stripe has scheduled the subscription to end at a future date.
 */
export function isStripeSubscriptionPendingCancellation(
  subscription: Stripe.Subscription,
): boolean {
  if (subscription.cancel_at_period_end) return true;
  if (!subscription.cancel_at) return false;
  return !subscription.canceled_at && !subscription.ended_at;
}

/**
 * Extracts the subscription identifier from a Stripe invoice payload.
 */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription ?? null;
  if (!subscriptionRef) return null;
  return typeof subscriptionRef === "string"
    ? subscriptionRef
    : subscriptionRef.id;
}

/**
 * Resolves an Enterprise service-period window from Stripe metadata.
 */
export function getInvoiceServicePeriod(invoice: Stripe.Invoice): {
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
} {
  const metadata = invoice.metadata ?? {};
  const fallbackServicePeriodStart = unixToIso(invoice.period_start);
  const metadataServicePeriodStart =
    metadata[STRIPE_BILLING_METADATA_KEYS.servicePeriodStart] ?? null;
  const servicePeriodStart = isoToDate(metadataServicePeriodStart)
    ? metadataServicePeriodStart
    : fallbackServicePeriodStart;
  const metadataServicePeriodEnd =
    metadata[STRIPE_BILLING_METADATA_KEYS.servicePeriodEnd] ?? null;
  const explicitServicePeriodEnd = isoToDate(metadataServicePeriodEnd)
    ? metadataServicePeriodEnd
    : null;

  if (explicitServicePeriodEnd) {
    return {
      servicePeriodStart: servicePeriodStart ?? null,
      servicePeriodEnd: explicitServicePeriodEnd,
    };
  }

  if (!servicePeriodStart) {
    return { servicePeriodStart: null, servicePeriodEnd: null };
  }

  const derivedEnd = isoToDate(servicePeriodStart);
  if (!derivedEnd) {
    return { servicePeriodStart: null, servicePeriodEnd: null };
  }

  derivedEnd.setUTCFullYear(derivedEnd.getUTCFullYear() + 1);
  return {
    servicePeriodStart,
    servicePeriodEnd: derivedEnd.toISOString(),
  };
}

/**
 * Resolves the brand identifier for a Stripe subscription.
 */
export async function resolveBrandIdForSubscription(opts: {
  db: DatabaseOrTransaction;
  subscription: Stripe.Subscription;
}): Promise<string | null> {
  const { db, subscription } = opts;
  const metadataBrandId =
    subscription.metadata?.[STRIPE_BILLING_METADATA_KEYS.brandId] ?? null;

  if (metadataBrandId) {
    return metadataBrandId;
  }

  const [row] = await db
    .select({ brandId: brandBilling.brandId })
    .from(brandBilling)
    .where(eq(brandBilling.stripeSubscriptionId, subscription.id))
    .limit(1);

  return row?.brandId ?? null;
}

/**
 * Resolves the brand identifier for a Stripe invoice.
 */
export async function resolveBrandIdForInvoice(opts: {
  db: DatabaseOrTransaction;
  invoice: Stripe.Invoice;
}): Promise<string | null> {
  const { db, invoice } = opts;
  const metadataBrandId =
    invoice.metadata?.[STRIPE_BILLING_METADATA_KEYS.brandId] ?? null;

  if (metadataBrandId) {
    return metadataBrandId;
  }

  const [existingInvoice] = await db
    .select({ brandId: brandBillingInvoices.brandId })
    .from(brandBillingInvoices)
    .where(eq(brandBillingInvoices.stripeInvoiceId, invoice.id))
    .limit(1);

  if (existingInvoice?.brandId) {
    return existingInvoice.brandId;
  }

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (subscriptionId) {
    const [subscriptionMatch] = await db
      .select({ brandId: brandBilling.brandId })
      .from(brandBilling)
      .where(eq(brandBilling.stripeSubscriptionId, subscriptionId))
      .limit(1);

    if (subscriptionMatch?.brandId) {
      return subscriptionMatch.brandId;
    }
  }

  const customerId = getStripeId(invoice.customer);
  if (!customerId) {
    return null;
  }

  const [customerMatch] = await db
    .select({ brandId: brandBilling.brandId })
    .from(brandBilling)
    .where(eq(brandBilling.stripeCustomerId, customerId))
    .limit(1);

  return customerMatch?.brandId ?? null;
}

/**
 * Resolves the current subscription pricing and entitlement window from Stripe items.
 */
export function resolveSubscriptionProjection(
  subscription: Stripe.Subscription,
): ResolvedSubscriptionProjection {
  const subscriptionPeriods =
    subscription as Stripe.Subscription & StripeSubscriptionPeriodFields;
  let planType: PlanTier | null = null;
  let billingInterval: BillingInterval | null = null;
  let hasImpactPredictions = false;
  let currentPeriodStart: string | null =
    unixToIso(subscriptionPeriods.current_period_start);
  let currentPeriodEnd: string | null =
    unixToIso(subscriptionPeriods.current_period_end);

  for (const item of subscription.items.data) {
    const resolvedPrice = resolvePriceId(item.price.id);
    if (!resolvedPrice) continue;

    if (resolvedPrice.product === "avelero") {
      planType = resolvedPrice.tier;
      billingInterval = resolvedPrice.interval;
      currentPeriodStart =
        unixToIso(item.current_period_start) ?? currentPeriodStart;
      currentPeriodEnd =
        unixToIso(item.current_period_end) ?? currentPeriodEnd;
      continue;
    }

    if (resolvedPrice.product === "impact") {
      hasImpactPredictions = true;
    }
  }

  return {
    customerId: getStripeId(subscription.customer),
    currentPeriodStart,
    currentPeriodEnd,
    planType,
    billingInterval,
    hasImpactPredictions,
  };
}

/**
 * Projects a Stripe subscription into the local billing and plan tables.
 */
export async function projectStripeSubscription(opts: {
  db: DatabaseOrTransaction;
  subscription: Stripe.Subscription;
  clearPastDue?: boolean;
  knownBrandId?: string | null;
}): Promise<{
  brandId: string | null;
  projection: ResolvedSubscriptionProjection;
}> {
  const {
    db,
    subscription,
    clearPastDue = false,
    knownBrandId,
  } = opts;
  const brandId =
    knownBrandId ?? (await resolveBrandIdForSubscription({ db, subscription }));
  const projection = resolveSubscriptionProjection(subscription);

  if (!brandId) {
    return { brandId: null, projection };
  }

  const nowIso = new Date().toISOString();

  await db
    .update(brandBilling)
    .set({
      stripeCustomerId: projection.customerId,
      stripeSubscriptionId: subscription.id,
      billingMode: "stripe_checkout",
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      pendingCancellation: isStripeSubscriptionPendingCancellation(subscription),
      ...(clearPastDue ? { pastDueSince: null } : {}),
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  if (projection.planType && projection.billingInterval) {
    const tierConfig = TIER_CONFIG[projection.planType];

    await db
      .update(brandPlan)
      .set({
        planType: projection.planType,
        billingInterval: projection.billingInterval,
        hasImpactPredictions: projection.hasImpactPredictions,
        variantGlobalCap: tierConfig.variantGlobalCap,
        updatedAt: nowIso,
      })
      .where(eq(brandPlan.brandId, brandId));
  }

  return { brandId, projection };
}

/**
 * Adds newly awarded credits onto the brand's cumulative balance.
 */
export async function awardCredits(opts: {
  db: DatabaseOrTransaction;
  brandId: string;
  credits: number;
  reason: "subscription_payment" | "pack_purchase";
}): Promise<number> {
  const [updated] = await opts.db
    .update(brandPlan)
    .set({
      totalCredits: sql`${brandPlan.totalCredits} + ${opts.credits}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandPlan.brandId, opts.brandId))
    .returning({ totalCredits: brandPlan.totalCredits });

  if (!updated) {
    throw new Error(
      `Unable to award ${opts.credits} credits for brand ${opts.brandId} (${opts.reason})`,
    );
  }

  return updated.totalCredits;
}

/**
 * Upserts a local invoice projection from a Stripe invoice payload.
 */
export async function upsertStripeInvoiceProjection(opts: {
  db: DatabaseOrTransaction;
  invoice: Stripe.Invoice;
  eventId?: string;
  knownBrandId?: string | null;
}): Promise<{
  brandId: string | null;
  managedByAvelero: boolean;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
}> {
  const { db, invoice, eventId, knownBrandId } = opts;
  const brandId =
    knownBrandId ?? (await resolveBrandIdForInvoice({ db, invoice }));
  const metadata = invoice.metadata ?? {};
  const nowIso = new Date().toISOString();
  const customerId = getStripeId(invoice.customer);
  const servicePeriod = getInvoiceServicePeriod(invoice);
  const managedByAvelero =
    metadata[STRIPE_BILLING_METADATA_KEYS.managedByAvelero] === "true";
  const customerAddress = invoice.customer_address;
  const customerTaxId =
    metadata[STRIPE_BILLING_METADATA_KEYS.recipientTaxId] ??
    invoice.customer_tax_ids?.[0]?.value ??
    null;

  if (!brandId) {
    return {
      brandId: null,
      managedByAvelero,
      servicePeriodStart: servicePeriod.servicePeriodStart,
      servicePeriodEnd: servicePeriod.servicePeriodEnd,
    };
  }

  await db
    .insert(brandBillingInvoices)
    .values({
      brandId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      status: invoice.status ?? "draft",
      collectionMethod: invoice.collection_method,
      currency: invoice.currency,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      amountRemaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      total: invoice.total,
      dueDate: unixToIso(invoice.due_date),
      paidAt: unixToIso(invoice.status_transitions.paid_at),
      voidedAt: unixToIso(invoice.status_transitions.voided_at),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      invoiceNumber: invoice.number ?? null,
      servicePeriodStart: servicePeriod.servicePeriodStart,
      servicePeriodEnd: servicePeriod.servicePeriodEnd,
      recipientName:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientName] ??
        invoice.customer_name ??
        null,
      recipientEmail:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientEmail] ??
        invoice.customer_email ??
        null,
      recipientTaxId: customerTaxId,
      recipientAddressLine1:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressLine1] ??
        customerAddress?.line1 ??
        null,
      recipientAddressLine2:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressLine2] ??
        customerAddress?.line2 ??
        null,
      recipientAddressCity:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressCity] ??
        customerAddress?.city ??
        null,
      recipientAddressRegion:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressRegion] ??
        customerAddress?.state ??
        null,
      recipientAddressPostalCode:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressPostalCode] ??
        customerAddress?.postal_code ??
        null,
      recipientAddressCountry:
        metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressCountry] ??
        customerAddress?.country ??
        null,
      description: invoice.description ?? invoice.lines.data[0]?.description ?? null,
      footer: invoice.footer ?? null,
      internalReference:
        metadata[STRIPE_BILLING_METADATA_KEYS.internalReference] ?? null,
      managedByAvelero,
      lastSyncedFromStripeAt: nowIso,
      lastStripeEventId: eventId ?? null,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: brandBillingInvoices.stripeInvoiceId,
      set: {
        brandId,
        stripeCustomerId: customerId,
        status: invoice.status ?? "draft",
        collectionMethod: invoice.collection_method,
        currency: invoice.currency,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        amountRemaining: invoice.amount_remaining,
        subtotal: invoice.subtotal,
        total: invoice.total,
        dueDate: unixToIso(invoice.due_date),
        paidAt: unixToIso(invoice.status_transitions.paid_at),
        voidedAt: unixToIso(invoice.status_transitions.voided_at),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice.invoice_pdf ?? null,
        invoiceNumber: invoice.number ?? null,
        servicePeriodStart: servicePeriod.servicePeriodStart,
        servicePeriodEnd: servicePeriod.servicePeriodEnd,
        recipientName:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientName] ??
          invoice.customer_name ??
          null,
        recipientEmail:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientEmail] ??
          invoice.customer_email ??
          null,
        recipientTaxId: customerTaxId,
        recipientAddressLine1:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressLine1] ??
          customerAddress?.line1 ??
          null,
        recipientAddressLine2:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressLine2] ??
          customerAddress?.line2 ??
          null,
        recipientAddressCity:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressCity] ??
          customerAddress?.city ??
          null,
        recipientAddressRegion:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressRegion] ??
          customerAddress?.state ??
          null,
        recipientAddressPostalCode:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressPostalCode] ??
          customerAddress?.postal_code ??
          null,
        recipientAddressCountry:
          metadata[STRIPE_BILLING_METADATA_KEYS.recipientAddressCountry] ??
          customerAddress?.country ??
          null,
        description:
          invoice.description ?? invoice.lines.data[0]?.description ?? null,
        footer: invoice.footer ?? null,
        internalReference:
          metadata[STRIPE_BILLING_METADATA_KEYS.internalReference] ?? null,
        managedByAvelero,
        lastSyncedFromStripeAt: nowIso,
        lastStripeEventId: eventId ?? null,
        updatedAt: nowIso,
      },
    });

  if (customerId) {
    await db
      .update(brandBilling)
      .set({
        stripeCustomerId: customerId,
        updatedAt: nowIso,
      })
      .where(eq(brandBilling.brandId, brandId));
  }

  return {
    brandId,
    managedByAvelero,
    servicePeriodStart: servicePeriod.servicePeriodStart,
    servicePeriodEnd: servicePeriod.servicePeriodEnd,
  };
}

/**
 * Applies the Enterprise entitlement window stored on an invoice projection to the brand.
 */
export async function applyEnterpriseInvoiceEntitlement(opts: {
  db: DatabaseOrTransaction;
  brandId: string;
  invoice: Stripe.Invoice;
  clearPastDue?: boolean;
}): Promise<void> {
  const {
    db,
    brandId,
    invoice,
    clearPastDue = false,
  } = opts;
  const servicePeriod = getInvoiceServicePeriod(invoice);
  const nowIso = new Date().toISOString();
  const customerId = getStripeId(invoice.customer);

  await db
    .update(brandBilling)
    .set({
      billingMode: "stripe_invoice",
      stripeCustomerId: customerId,
      currentPeriodStart: servicePeriod.servicePeriodStart,
      currentPeriodEnd: servicePeriod.servicePeriodEnd,
      pendingCancellation: false,
      ...(clearPastDue ? { pastDueSince: null } : {}),
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  await db
    .update(brandPlan)
      .set({
        planType: "enterprise",
        billingInterval: "yearly",
        updatedAt: nowIso,
      })
      .where(eq(brandPlan.brandId, brandId));

  await db
    .update(brandLifecycle)
    .set({
      phase: "active",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));
}

/**
 * Retrieves a Stripe subscription and refreshes the local projection from live Stripe state.
 */
export async function syncStripeSubscriptionProjectionById(opts: {
  db: DatabaseOrTransaction;
  subscriptionId: string;
  clearPastDue?: boolean;
  brandId?: string | null;
}): Promise<{
  brandId: string | null;
  projection: ResolvedSubscriptionProjection;
}> {
  const stripe = getStripeClient();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(opts.subscriptionId);
  } catch (err) {
    log.error(
      {
        brandId: opts.brandId ?? null,
        subscriptionId: opts.subscriptionId,
        stripeErrorType: isStripeError(err) ? err.type : "unknown",
        stripeErrorCode: isStripeError(err) ? err.code : undefined,
        stripeStatusCode: isStripeError(err) ? err.statusCode : undefined,
      },
      "failed to retrieve subscription from Stripe",
    );
    throw err;
  }
  return projectStripeSubscription({
    db: opts.db,
    subscription,
    clearPastDue: opts.clearPastDue,
    knownBrandId: opts.brandId ?? null,
  });
}

/**
 * Retrieves a Stripe invoice and refreshes the local invoice projection from live Stripe state.
 */
export async function syncStripeInvoiceProjectionById(opts: {
  db: DatabaseOrTransaction;
  invoiceId: string;
  eventId?: string;
  brandId?: string | null;
}): Promise<{
  brandId: string | null;
  managedByAvelero: boolean;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
}> {
  const stripe = getStripeClient();
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(opts.invoiceId);
  } catch (err) {
    log.error(
      {
        brandId: opts.brandId ?? null,
        invoiceId: opts.invoiceId,
        stripeErrorType: isStripeError(err) ? err.type : "unknown",
        stripeErrorCode: isStripeError(err) ? err.code : undefined,
        stripeStatusCode: isStripeError(err) ? err.statusCode : undefined,
      },
      "failed to retrieve invoice from Stripe",
    );
    throw err;
  }
  return upsertStripeInvoiceProjection({
    db: opts.db,
    invoice,
    eventId: opts.eventId,
    knownBrandId: opts.brandId ?? null,
  });
}
