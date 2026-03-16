/**
 * Handles Stripe invoice lifecycle events that only need local projection updates.
 */
import { db } from "@v1/db/client";
import { brandBillingEvents } from "@v1/db/schema";
import type Stripe from "stripe";
import {
  resolveBrandIdForInvoice,
  upsertStripeInvoiceProjection,
} from "../projection.js";

/**
 * Upserts the invoice projection and logs a passive invoice event.
 */
async function handlePassiveInvoiceEvent(
  event: Stripe.Event,
  eventType: string,
): Promise<void> {
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

  await db.insert(brandBillingEvents).values({
    brandId,
    eventType,
    stripeEventId: event.id,
    payload: {
      invoice_id: invoice.id,
      status: invoice.status,
    },
  });
}

/**
 * Handles `invoice.created` by storing a local projection row.
 */
export async function handleInvoiceCreated(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_created");
}

/**
 * Handles `invoice.finalized` by storing a local projection row.
 */
export async function handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_finalized");
}

/**
 * Handles `invoice.updated` by refreshing the local invoice projection.
 */
export async function handleInvoiceUpdated(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_updated");
}

/**
 * Handles `invoice.voided` by refreshing the local invoice projection.
 */
export async function handleInvoiceVoided(event: Stripe.Event): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_voided");
}

/**
 * Handles `invoice.marked_uncollectible` by refreshing the local invoice projection.
 */
export async function handleInvoiceMarkedUncollectible(
  event: Stripe.Event,
): Promise<void> {
  await handlePassiveInvoiceEvent(event, "invoice_marked_uncollectible");
}
