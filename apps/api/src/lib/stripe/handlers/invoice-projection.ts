/**
 * Projects passive Stripe invoice lifecycle events into the local billing tables.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
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
  conn: DatabaseOrTransaction,
): Promise<void> {
  const startedAt = Date.now();
  const invoice = event.data.object as Stripe.Invoice;
  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      projectionEventType: eventType,
      invoiceId: invoice.id,
      status: invoice.status,
    },
    "invoice projection handler starting",
  );
  const brandId = await resolveBrandIdForInvoice({ db: conn, invoice });

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

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      projectionEventType: eventType,
      invoiceId: invoice.id,
      brandId,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice projection brand resolved",
  );

  await upsertStripeInvoiceProjection({
    db: conn,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      projectionEventType: eventType,
      invoiceId: invoice.id,
      brandId,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice projection upsert completed",
  );

  await conn.insert(brandBillingEvents).values({
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
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice projection synced",
  );
}

export async function handleInvoiceCreated(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_created", conn);
}

export async function handleInvoiceFinalized(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_finalized", conn);
}

export async function handleInvoiceUpdated(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_updated", conn);
}

export async function handleInvoiceVoided(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_voided", conn);
}

export async function handleInvoiceMarkedUncollectible(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_marked_uncollectible", conn);
}
