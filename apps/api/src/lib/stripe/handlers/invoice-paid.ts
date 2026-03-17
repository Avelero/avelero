import { db } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import { brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  applyEnterpriseInvoiceEntitlement,
  getInvoiceSubscriptionId,
  getStripeId,
  resolveBrandIdForInvoice,
  syncStripeSubscriptionProjectionById,
  upsertStripeInvoiceProjection,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:invoice-paid" });

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const brandId = await resolveBrandIdForInvoice({ db, invoice });

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        invoiceId: invoice.id,
        customerId: getStripeId(invoice.customer),
        subscriptionId: getInvoiceSubscriptionId(invoice),
      },
      "brand_id not resolvable for paid invoice — brand state was NOT updated",
    );
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
    .where(
      and(
        eq(brandLifecycle.brandId, brandId),
        notInArray(brandLifecycle.phase, ["expired", "suspended", "cancelled"]),
      ),
    );

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

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      invoiceId: invoice.id,
      amountPaid: invoice.amount_paid,
      subscriptionId,
      managedByAvelero: projectedInvoice.managedByAvelero,
      phase: "active",
    },
    "invoice paid: brand activated",
  );
}
