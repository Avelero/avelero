import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import {
  brandBilling,
  brandBillingEvents,
  brandLifecycle,
} from "@v1/db/schema";
import type Stripe from "stripe";

/**
 * Handle `invoice.paid` — a Stripe Invoice was successfully paid.
 *
 * Covers both subscription renewals and Enterprise one-off invoices.
 * If the brand is in `past_due`, `trial`, or `expired`, transition to `active`.
 */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
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

  if (!brandId) {
    brandId = invoice.metadata?.brand_id;
  }

  if (!brandId) {
    console.warn("invoice.paid: could not determine brand_id");
    return;
  }

  // Check current phase
  const [lifecycle] = await db
    .select({ phase: brandLifecycle.phase })
    .from(brandLifecycle)
    .where(eq(brandLifecycle.brandId, brandId))
    .limit(1);

  const nowIso = new Date().toISOString();

  // Transition to active if in a recoverable phase
  if (
    lifecycle &&
    ["past_due", "trial", "expired"].includes(lifecycle.phase)
  ) {
    await db
      .update(brandLifecycle)
      .set({
        phase: "active",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(brandLifecycle.brandId, brandId));
  }

  // Log billing event
  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_paid",
    stripeEventId: event.id,
    payload: {
      amount_paid: invoice.amount_paid,
      invoice_id: invoice.id,
    },
  });
}
