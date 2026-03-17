/**
 * Marks a brand as past due when Stripe emits an overdue invoice event.
 */
import { db } from "@v1/db/client";
import { and, eq, notInArray, sql } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  getStripeId,
  resolveBrandIdForInvoice,
  upsertStripeInvoiceProjection,
  unixToIso,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:invoice-overdue" });

export async function handleInvoiceOverdue(event: Stripe.Event): Promise<void> {
  // Use receipt time for grace-period tracking and avoid reviving terminal lifecycle states.
  const invoice = event.data.object as Stripe.Invoice;
  const brandId = await resolveBrandIdForInvoice({ db, invoice });

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        invoiceId: invoice.id,
        customerId: getStripeId(invoice.customer),
      },
      "brand_id not resolvable for overdue invoice — brand state was NOT updated",
    );
    return;
  }

  await upsertStripeInvoiceProjection({
    db,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  const [billing] = await db
    .select({
      pastDueSince: brandBilling.pastDueSince,
      phase: brandLifecycle.phase,
    })
    .from(brandBilling)
    .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brandBilling.brandId))
    .where(eq(brandBilling.brandId, brandId))
    .limit(1);

  const nowIso = new Date().toISOString();
  const preservesTerminalPhase =
    billing?.phase === "expired" ||
    billing?.phase === "suspended" ||
    billing?.phase === "cancelled";

  if (!preservesTerminalPhase) {
    await db
      .update(brandBilling)
      .set({
        stripeCustomerId: getStripeId(invoice.customer),
        pastDueSince: billing?.pastDueSince ?? nowIso,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(brandBilling.brandId, brandId),
          sql`EXISTS (
            SELECT 1 FROM brand_lifecycle
            WHERE brand_id = ${brandId}
            AND phase NOT IN ('expired', 'suspended', 'cancelled')
          )`,
        ),
      );

    // Use a conditional update so a concurrent request that sets a terminal phase
    // (expired / suspended / cancelled) between our SELECT and this UPDATE is not
    // overwritten back to past_due.
    await db
      .update(brandLifecycle)
      .set({
        phase: "past_due",
        phaseChangedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(brandLifecycle.brandId, brandId),
          notInArray(brandLifecycle.phase, ["expired", "suspended", "cancelled"]),
        ),
      );
  }

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

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      invoiceId: invoice.id,
      phase: preservesTerminalPhase ? billing?.phase : "past_due",
    },
    preservesTerminalPhase
      ? "invoice overdue: preserved terminal lifecycle phase"
      : "invoice overdue: brand marked past_due",
  );
}
