/**
 * Integration Tests: invoice.payment_failed handler.
 *
 * Verifies missing lifecycle rows do not produce a false past-due transition
 * or partial billing grace-period state.
 */

import "../../setup";

import { describe, expect, it, spyOn } from "bun:test";
import { db as appDb } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { createTestBrand, testDb } from "@v1/db/testing";
import type Stripe from "stripe";
import { handleInvoicePaymentFailed } from "../../../src/lib/stripe/handlers/invoice-payment-failed";

const APP_DB_METHOD_NAMES = [
  "select",
  "insert",
  "update",
  "delete",
  "execute",
  "query",
  "transaction",
] as const;

type AppDbMethodName = (typeof APP_DB_METHOD_NAMES)[number];

/**
 * Routes the app DB proxy through the single-connection test DB for this test.
 */
function bindAppDbToTestDb(): () => void {
  // Swap the handler's shared DB proxy onto the transaction-scoped test connection.
  const appDbProxy = appDb as Record<AppDbMethodName, unknown>;
  const testDbProxy = testDb as Record<AppDbMethodName, unknown>;
  const originalMethods = Object.fromEntries(
    APP_DB_METHOD_NAMES.map((name) => [name, appDbProxy[name]]),
  ) as Record<AppDbMethodName, unknown>;

  for (const name of APP_DB_METHOD_NAMES) {
    const method = testDbProxy[name];
    appDbProxy[name] =
      typeof method === "function"
        ? (...args: unknown[]) =>
            (method as (...args: unknown[]) => unknown).apply(testDb, args)
        : method;
  }

  return () => {
    for (const name of APP_DB_METHOD_NAMES) {
      appDbProxy[name] = originalMethods[name];
    }
  };
}

/**
 * Captures structured billing logs emitted while the handler runs.
 */
async function captureBillingLogs<T>(
  action: () => Promise<T>,
): Promise<{ result: T; logs: Array<Record<string, unknown>> }> {
  // Buffer stdout so the test can assert on the structured log payload.
  const chunks: string[] = [];
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(
    ((chunk: string | Uint8Array, encoding?: unknown, callback?: unknown) => {
      chunks.push(
        typeof chunk === "string"
          ? chunk
          : Buffer.from(chunk).toString("utf8"),
      );

      if (typeof encoding === "function") {
        encoding();
      }

      if (typeof callback === "function") {
        callback();
      }

      return true;
    }) as typeof process.stdout.write,
  );

  try {
    const result = await action();
    await Promise.resolve();

    const logs = chunks
      .join("")
      .split("\n")
      .filter((line) => line.length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          return [];
        }
      });

    return { result, logs };
  } finally {
    writeSpy.mockRestore();
  }
}

/**
 * Builds a minimal Stripe event payload for the failed-invoice handler.
 */
function buildInvoicePaymentFailedEvent(params: {
  brandId: string;
  customerId: string;
  invoiceId?: string;
}): Stripe.Event {
  // Provide only the invoice fields that the projection and handler logic read.
  const invoiceId = params.invoiceId ?? `in_${crypto.randomUUID()}`;

  return {
    id: `evt_${crypto.randomUUID()}`,
    object: "event",
    api_version: "2026-01-28.clover",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: "invoice.payment_failed",
    data: {
      object: {
        id: invoiceId,
        object: "invoice",
        metadata: {
          brand_id: params.brandId,
        },
        customer: params.customerId,
        attempt_count: 2,
        next_payment_attempt: null,
        period_start: Math.floor(Date.now() / 1000),
        status: "open",
        collection_method: "charge_automatically",
        currency: "usd",
        amount_due: 1500,
        amount_paid: 0,
        amount_remaining: 1500,
        subtotal: 1500,
        total: 1500,
        due_date: null,
        status_transitions: {
          paid_at: null,
          voided_at: null,
        },
        hosted_invoice_url: null,
        invoice_pdf: null,
        number: null,
        description: null,
        footer: null,
        lines: {
          data: [],
        },
        parent: null,
        customer_address: null,
        customer_email: null,
        customer_name: null,
        customer_tax_ids: [],
      },
    },
  } as unknown as Stripe.Event;
}

describe("invoice.payment_failed handler", () => {
  it("warns and skips past-due billing state when the lifecycle row is missing", async () => {
    const restoreAppDb = bindAppDbToTestDb();
    try {
      const brandId = await createTestBrand(
        "Invoice Payment Failed Missing Lifecycle",
      );
      const event = buildInvoicePaymentFailedEvent({
        brandId,
        customerId: "cus_invoice_payment_failed_missing_lifecycle",
      });

      await testDb.insert(schema.brandBilling).values({
        brandId,
      });

      const { logs } = await captureBillingLogs(async () =>
        handleInvoicePaymentFailed(event),
      );

      const [billing] = await testDb
        .select({
          pastDueSince: schema.brandBilling.pastDueSince,
          stripeCustomerId: schema.brandBilling.stripeCustomerId,
        })
        .from(schema.brandBilling)
        .where(eq(schema.brandBilling.brandId, brandId))
        .limit(1);

      const [lifecycle] = await testDb
        .select({
          phase: schema.brandLifecycle.phase,
        })
        .from(schema.brandLifecycle)
        .where(eq(schema.brandLifecycle.brandId, brandId))
        .limit(1);

      const warningLogs = logs.filter(
        (entry) =>
          entry.msg ===
            "invoice payment failed: skipped past_due transition because lifecycle row was missing or changed concurrently" &&
          entry.stripeEventId === event.id,
      );

      expect(billing?.pastDueSince).toBeNull();
      expect(billing?.stripeCustomerId).toBe(
        "cus_invoice_payment_failed_missing_lifecycle",
      );
      expect(lifecycle).toBeUndefined();
      expect(warningLogs).toHaveLength(1);
      expect(warningLogs[0]?.phaseUpdated).toBe(false);
      expect(warningLogs[0]?.phase).toBeNull();
      expect(
        logs.some(
          (entry) =>
            entry.msg === "invoice payment failed: brand marked past_due" &&
            entry.stripeEventId === event.id,
        ),
      ).toBe(false);
    } finally {
      restoreAppDb();
    }
  });
});
