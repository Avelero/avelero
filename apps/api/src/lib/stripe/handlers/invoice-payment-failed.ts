/**
 * Handles Stripe invoice.payment_failed events and only records past-due state when the lifecycle transition persists.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
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
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  // Route bare-db calls through a transaction so lifecycle and billing writes stay atomic.
  if (conn === db) {
    await db.transaction(async (tx) => {
      await handleInvoicePaymentFailed(event, tx);
    });
    return;
  }

  // Transition eligible brands to past_due and keep billing grace-period state aligned with the persisted lifecycle phase.
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = getStripeId(invoice.customer);
  const brandId = await resolveBrandIdForInvoice({ db: conn, invoice });

  if (!brandId) {
    log.error(
      {
        stripeEventId: event.id,
        eventType: event.type,
        invoiceId: invoice.id,
        customerId,
      },
      "brand_id not resolvable for failed invoice — brand state was NOT updated",
    );
    return;
  }

  await upsertStripeInvoiceProjection({
    db: conn,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  const [billing] = await conn
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
  let phaseUpdated = false;
  let resolvedPhase = billing?.phase ?? null;
  let logMessage =
    "invoice payment failed: terminal phase preserved, skipping past_due transition";

  if (!preservesTerminalPhase) {
    // Reuse the dispatcher transaction so lifecycle and billing writes stay atomic.
    const [updatedLifecycle] = await conn
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
      )
      .returning({ phase: brandLifecycle.phase });

    if (!updatedLifecycle) {
      const [currentLifecycle] = await conn
        .select({ phase: brandLifecycle.phase })
        .from(brandLifecycle)
        .where(eq(brandLifecycle.brandId, brandId))
        .limit(1);

      phaseUpdated = false;
      resolvedPhase = currentLifecycle?.phase ?? null;
    } else {
      await conn
        .update(brandBilling)
        .set({
          stripeCustomerId: customerId,
          pastDueSince: billing?.pastDueSince ?? nowIso,
          updatedAt: nowIso,
        })
        .where(eq(brandBilling.brandId, brandId));

      phaseUpdated = true;
      resolvedPhase = updatedLifecycle.phase;
    }

    logMessage = phaseUpdated
      ? "invoice payment failed: brand marked past_due"
      : "invoice payment failed: skipped past_due transition because lifecycle row was missing or changed concurrently";
  }

  await conn.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_payment_failed",
    stripeEventId: event.id,
    payload: {
      attempt_count: invoice.attempt_count,
      invoice_id: invoice.id,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  });

  if (!preservesTerminalPhase && !phaseUpdated) {
    log.warn(
      {
        stripeEventId: event.id,
        brandId,
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt,
        phaseUpdated,
        phase: resolvedPhase,
      },
      logMessage,
    );
    return;
  }

  log.info(
    {
      stripeEventId: event.id,
      brandId,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt,
      phaseUpdated,
      phase: resolvedPhase,
    },
    logMessage,
  );
}
