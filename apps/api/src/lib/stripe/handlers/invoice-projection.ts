import { db } from "@v1/db/client";
import { brandBillingEvents } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  getStripeId,
  resolveBrandIdForInvoice,
  upsertStripeInvoiceProjection,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:invoice-projection" });

async function handlePassiveInvoiceEvent(
  event: Stripe.Event,
  eventType: string,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const brandId = await resolveBrandIdForInvoice({ db, invoice });

  if (!brandId) {
    log.warn(
      {
        stripeEventId: event.id,
        eventType: event.type,
        invoiceId: invoice.id,
        customerId: getStripeId(invoice.customer),
      },
      "brand_id not resolvable for invoice projection",
    );
    return;
  }

  await upsertStripeInvoiceProjection({
    db,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType,
    stripeEventId: event.id,
    payload: {
      invoice_id: invoice.id,
      status: invoice.status,
    },
  });

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      invoiceId: invoice.id,
      eventType,
      status: invoice.status,
    },
    "invoice projection synced",
  );
}

export async function handleInvoiceCreated(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_created");
}

export async function handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_finalized");
}

export async function handleInvoiceUpdated(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_updated");
}

export async function handleInvoiceVoided(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_voided");
}

export async function handleInvoiceMarkedUncollectible(
  event: Stripe.Event,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_marked_uncollectible");
}
