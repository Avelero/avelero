/**
 * Handles `invoice.overdue` by projecting the invoice locally and starting past-due state.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import type Stripe from "stripe";
import {
  getStripeId,
  resolveBrandIdForInvoice,
  upsertStripeInvoiceProjection,
  unixToIso,
} from "../projection.js";

/**
 * Persists overdue state for send-invoice billing without changing the service-period anchor.
 */
export async function handleInvoiceOverdue(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const brandId = await resolveBrandIdForInvoice({ db, invoice });

  if (!brandId) {
    return;
  }

  await upsertStripeInvoiceProjection({
    db,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  const [billing] = await db
    .select({ pastDueSince: brandBilling.pastDueSince })
    .from(brandBilling)
    .where(eq(brandBilling.brandId, brandId))
    .limit(1);

  const nowIso = new Date().toISOString();

  await db
    .update(brandBilling)
    .set({
      stripeCustomerId: getStripeId(invoice.customer),
      pastDueSince: billing?.pastDueSince ?? unixToIso(invoice.due_date) ?? nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandBilling.brandId, brandId));

  await db
    .update(brandLifecycle)
    .set({
      phase: "past_due",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_overdue",
    stripeEventId: event.id,
    payload: {
      invoice_id: invoice.id,
      due_date: unixToIso(invoice.due_date),
      status: invoice.status,
    },
  });
}
