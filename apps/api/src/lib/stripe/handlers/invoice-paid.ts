/**
 * Activates paid brands when Stripe confirms invoice collection.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
import { and, eq, notInArray } from "@v1/db/queries";
import { brandBillingEvents, brandLifecycle } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { creditsForPayment } from "../config.js";
import {
  applyEnterpriseInvoiceEntitlement,
  awardCredits,
  getInvoiceSubscriptionId,
  getStripeId,
  resolveBrandIdForInvoice,
  syncStripeSubscriptionProjectionById,
  upsertStripeInvoiceProjection,
} from "../projection.js";

const log = billingLogger.child({ component: "handler:invoice-paid" });

export async function handleInvoicePaid(
  event: Stripe.Event,
  conn: DatabaseOrTransaction = db,
): Promise<void> {
  const startedAt = Date.now();
  const invoice = event.data.object as Stripe.Invoice;
  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      status: invoice.status,
    },
    "invoice paid handler starting",
  );
  const brandId = await resolveBrandIdForInvoice({ db: conn, invoice });

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

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      brandId,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid brand resolved",
  );

  const projectedInvoice = await upsertStripeInvoiceProjection({
    db: conn,
    invoice,
    eventId: event.id,
    knownBrandId: brandId,
  });

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const nowIso = new Date().toISOString();
  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      brandId,
      subscriptionId,
      managedByAvelero: projectedInvoice.managedByAvelero,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid projection synced",
  );
  const [existingLifecycle] = await conn
    .select({ phase: brandLifecycle.phase })
    .from(brandLifecycle)
    .where(eq(brandLifecycle.brandId, brandId))
    .limit(1);

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      brandId,
      existingPhase: existingLifecycle?.phase ?? null,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid lifecycle state loaded",
  );

  let creditsAwarded = 0;
  let totalCredits: number | null = null;

  if (subscriptionId) {
    const { projection } = await syncStripeSubscriptionProjectionById({
      db: conn,
      subscriptionId,
      clearPastDue: true,
      brandId,
    });

    const shouldAwardSubscriptionCredits =
      invoice.amount_paid > 0 &&
      (invoice.billing_reason === "subscription_create" ||
        invoice.billing_reason === "subscription_cycle");

    if (
      shouldAwardSubscriptionCredits &&
      projection.planType &&
      projection.billingInterval
    ) {
      creditsAwarded = creditsForPayment(
        projection.planType,
        projection.billingInterval,
      );
      totalCredits = await awardCredits({
        db: conn,
        brandId,
        credits: creditsAwarded,
        reason: "subscription_payment",
      });
    }
  } else if (projectedInvoice.managedByAvelero) {
    await applyEnterpriseInvoiceEntitlement({
      db: conn,
      brandId,
      invoice,
      clearPastDue: true,
    });
  }

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      brandId,
      subscriptionId,
      managedByAvelero: projectedInvoice.managedByAvelero,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid entitlement sync completed",
  );

  await conn
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

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      invoiceId: invoice.id,
      brandId,
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid lifecycle updated",
  );

  await conn.insert(brandBillingEvents).values({
    brandId,
    eventType: "invoice_paid",
    stripeEventId: event.id,
    payload: {
      amount_paid: invoice.amount_paid,
      billing_reason: invoice.billing_reason ?? null,
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      managed_by_avelero: projectedInvoice.managedByAvelero,
      service_period_start: projectedInvoice.servicePeriodStart,
      service_period_end: projectedInvoice.servicePeriodEnd,
      credits_awarded: creditsAwarded,
      total_credits: totalCredits,
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
      creditsAwarded,
      totalCredits,
      phase: "active",
      handlerDurationMs: Date.now() - startedAt,
    },
    "invoice paid: brand activated",
  );
}
