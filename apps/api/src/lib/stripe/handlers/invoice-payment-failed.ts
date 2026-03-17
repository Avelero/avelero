import { db } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import { brandBilling, brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import {
  getStripeId,
  resolveBrandIdForInvoice,
  upsertStripeInvoiceProjection,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:invoice-payment-failed" });

export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
): Promise<void> {
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
      "brand_id not resolvable for failed invoice — brand state was NOT updated",
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
      .where(eq(brandBilling.brandId, brandId));

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
    eventType: "invoice_payment_failed",
    stripeEventId: event.id,
    payload: {
      attempt_count: invoice.attempt_count,
      invoice_id: invoice.id,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  });

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt,
      phase: "past_due",
    },
    "invoice payment failed: brand marked past_due",
  );
}
