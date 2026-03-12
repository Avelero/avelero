import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
} from "@v1/db/schema";
import type Stripe from "stripe";

/**
 * Handle `invoice.payment_failed` — a payment attempt failed.
 *
 * Covers both subscription renewals and Enterprise one-off invoices.
 * Transitions the brand from `active` to `past_due`. Brands in other
 * phases are left untouched (defensive).
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  // Determine brand: via subscription lookup or invoice metadata
  let brandId: string | undefined;

  const subscriptionRef =
    invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef?.id ?? null;

  if (subscriptionId) {
    const [row] = await db
      .select({ brandId: brandBilling.brandId })
      .from(brandBilling)
      .where(eq(brandBilling.stripeSubscriptionId, subscriptionId))
      .limit(1);
    brandId = row?.brandId;
  }

  // Fallback: Enterprise invoices carry brand_id in metadata
  if (!brandId) {
    brandId = invoice.metadata?.brand_id;
  }

  if (!brandId) {
    console.warn("invoice.payment_failed: could not determine brand_id");
    return;
  }

  // Only transition active → past_due
  const [lifecycle] = await db
    .select({ phase: brandLifecycle.phase })
    .from(brandLifecycle)
    .where(eq(brandLifecycle.brandId, brandId))
    .limit(1);

  if (!lifecycle || lifecycle.phase !== "active") {
    return;
  }

  const nowIso = new Date().toISOString();

  await db
    .update(brandLifecycle)
    .set({
      phase: "past_due",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));

  // Log billing event
  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_payment_failed",
    stripeEventId: event.id,
    payload: {
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  });
}
