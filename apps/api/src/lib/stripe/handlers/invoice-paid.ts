/**
 * Handles `invoice.paid` by refreshing the local invoice projection and clearing past-due state.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import type Stripe from "stripe";
import {
  applyEnterpriseInvoiceEntitlement,
  getInvoiceSubscriptionId,
  resolveBrandIdForInvoice,
  syncStripeSubscriptionProjectionById,
  upsertStripeInvoiceProjection,
} from "../projection.js";

/**
 * Persists the successful-invoice side effects for both subscriptions and managed enterprise invoices.
 */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const brandId = await resolveBrandIdForInvoice({ db, invoice });

  if (!brandId) {
    console.warn("invoice.paid: could not determine brand_id");
    return;
  }

  const projectedInvoice = await upsertStripeInvoiceProjection({
    db,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const nowIso = new Date().toISOString();

  if (subscriptionId) {
    await syncStripeSubscriptionProjectionById({
      db,
      subscriptionId,
      clearPastDue: true,
      brandId,
    });
  } else if (projectedInvoice.managedByAvelero) {
    await applyEnterpriseInvoiceEntitlement({
      db,
      brandId,
      invoice,
      clearPastDue: true,
    });
  }

  await db
    .update(brandLifecycle)
    .set({
      phase: "active",
      phaseChangedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(brandLifecycle.brandId, brandId));

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_paid",
    stripeEventId: event.id,
    payload: {
      amount_paid: invoice.amount_paid,
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      managed_by_avelero: projectedInvoice.managedByAvelero,
      service_period_start: projectedInvoice.servicePeriodStart,
      service_period_end: projectedInvoice.servicePeriodEnd,
    },
  });
}
