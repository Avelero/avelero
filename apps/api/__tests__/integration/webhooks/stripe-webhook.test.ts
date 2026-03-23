/**
 * Integration Tests: Stripe webhook processing.
 *
 * Verifies already-logged webhook failures are not logged twice and that
 * success logs are emitted only after the webhook event is marked processed.
 */

import "../../setup";

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { db as appDb } from "@v1/db/client";
import { desc, eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { createTestBrand, testDb } from "@v1/db/testing";
import Stripe from "stripe";

const stripe = new Stripe("sk_test_codex");

// Ensure this test file uses a real Stripe client (guards against global
// mock.module leaking from other test files).
mock.module("../../../src/lib/stripe/client.js", () => ({
  getStripeClient: () => stripe,
  createStripeClient: (key?: string) => new Stripe(key ?? "sk_test_codex"),
  resetStripeClient: () => {},
  isStripeError: (err: unknown) => err instanceof Stripe.errors.StripeError,
}));

import {
  bindAppDbToTestDb,
  setBrandSubscriptionState,
} from "../../helpers/billing";
import {
  LoggedWebhookProcessingError,
  registerWebhookHandler,
  verifyAndDispatch,
} from "../../../src/lib/stripe/webhook-handler";
import { stripeWebhookRouter } from "../../../src/routes/webhooks/stripe";

/**
 * Creates a signed Stripe webhook payload for the requested event type.
 */
async function buildSignedWebhook(params: {
  eventType: string;
  eventId?: string;
  object?: Record<string, unknown>;
}): Promise<{
  eventId: string;
  rawBody: string;
  signature: string;
}> {
  const eventId = params.eventId ?? `evt_${crypto.randomUUID()}`;
  const rawBody = JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "2026-01-28.clover",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: params.object ?? { id: `obj_${crypto.randomUUID()}` },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: params.eventType,
  });

  return {
    eventId,
    rawBody,
    signature: await stripe.webhooks.generateTestHeaderStringAsync({
      payload: rawBody,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  };
}

/**
 * Parses billing log entries emitted during a single async action.
 */
async function captureBillingLogs<T>(
  action: () => Promise<T>,
): Promise<{ result: T; logs: Array<Record<string, unknown>> }> {
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
 * Looks up the stored webhook processing row for assertions.
 */
async function getWebhookEvent(eventId: string) {
  const [event] = await appDb
    .select({
      stripeEventId: schema.stripeWebhookEvents.stripeEventId,
      processedAt: schema.stripeWebhookEvents.processedAt,
    })
    .from(schema.stripeWebhookEvents)
    .where(eq(schema.stripeWebhookEvents.stripeEventId, eventId))
    .limit(1);

  return event ?? null;
}

/**
 * Removes the persisted webhook row created by a test case.
 */
async function cleanupWebhookEvent(eventId: string) {
  await appDb
    .delete(schema.stripeWebhookEvents)
    .where(eq(schema.stripeWebhookEvents.stripeEventId, eventId));
}

/**
 * Loads the plan credit state for a brand after webhook processing.
 */
async function getBrandPlanState(brandId: string) {
  const [plan] = await testDb
    .select({
      totalCredits: schema.brandPlan.totalCredits,
      onboardingDiscountUsed: schema.brandPlan.onboardingDiscountUsed,
    })
    .from(schema.brandPlan)
    .where(eq(schema.brandPlan.brandId, brandId))
    .limit(1);

  return plan ?? null;
}

/**
 * Counts billing events recorded for a specific Stripe event delivery.
 */
async function countBillingEventsForStripeEvent(eventId: string) {
  const rows = await testDb
    .select({
      stripeEventId: schema.brandBillingEvents.stripeEventId,
    })
    .from(schema.brandBillingEvents)
    .where(eq(schema.brandBillingEvents.stripeEventId, eventId));

  return rows.length;
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_codex";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_codex";
});

describe("Stripe webhook processing", () => {
  it("awards credits for payment-mode top-up checkouts", async () => {
    const restoreAppDb = bindAppDbToTestDb();

    try {
      const brandId = await createTestBrand("Webhook Top-up Brand");
      await setBrandSubscriptionState({
        brandId,
        phase: "active",
        planType: "growth",
        billingInterval: "quarterly",
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_topup_checkout_test",
        stripeSubscriptionId: "sub_topup_checkout_test",
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });

      const { rawBody, signature } = await buildSignedWebhook({
        eventType: "checkout.session.completed",
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: brandId,
          customer: "cus_topup_checkout_test",
          payment_intent: `pi_${crypto.randomUUID()}`,
          amount_total: 20_000,
          currency: "eur",
          metadata: {
            brand_id: brandId,
            tier: "growth",
            topup_quantity: "200",
            is_onboarding_discount: "true",
          },
        },
      });

      const response = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });

      expect(response.status).toBe(200);

      const plan = await getBrandPlanState(brandId);

      const [billingEvent] = await testDb
        .select({
          payload: schema.brandBillingEvents.payload,
        })
        .from(schema.brandBillingEvents)
        .where(
          eq(schema.brandBillingEvents.brandId, brandId),
        )
        .orderBy(desc(schema.brandBillingEvents.createdAt))
        .limit(1);

      expect(plan?.totalCredits).toBe(250);
      expect(plan?.onboardingDiscountUsed).toBe(true);
      expect((billingEvent?.payload as Record<string, unknown>)?.topup_quantity).toBe(200);
      expect((billingEvent?.payload as Record<string, unknown>)?.tier).toBe("growth");
    } finally {
      restoreAppDb();
    }
  });

  it("does not award credits when a payment-mode top-up session is not yet paid", async () => {
    const restoreAppDb = bindAppDbToTestDb();

    try {
      const brandId = await createTestBrand("Webhook Unpaid Top-up Brand");
      await setBrandSubscriptionState({
        brandId,
        phase: "active",
        planType: "growth",
        billingInterval: "quarterly",
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_topup_unpaid_test",
        stripeSubscriptionId: "sub_topup_unpaid_test",
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });

      const { rawBody, signature } = await buildSignedWebhook({
        eventType: "checkout.session.completed",
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "unpaid",
          client_reference_id: brandId,
          customer: "cus_topup_unpaid_test",
          payment_intent: `pi_${crypto.randomUUID()}`,
          amount_total: 20_000,
          currency: "eur",
          metadata: {
            brand_id: brandId,
            tier: "growth",
            topup_quantity: "200",
            is_onboarding_discount: "true",
          },
        },
      });

      const response = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });

      expect(response.status).toBe(200);
      expect(await getBrandPlanState(brandId)).toEqual({
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });
    } finally {
      restoreAppDb();
    }
  });

  it("does not award credits when the top-up quantity metadata is invalid", async () => {
    const restoreAppDb = bindAppDbToTestDb();

    try {
      const brandId = await createTestBrand("Webhook Invalid Top-up Quantity Brand");
      await setBrandSubscriptionState({
        brandId,
        phase: "active",
        planType: "growth",
        billingInterval: "quarterly",
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_topup_invalid_quantity_test",
        stripeSubscriptionId: "sub_topup_invalid_quantity_test",
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });

      const { rawBody, signature } = await buildSignedWebhook({
        eventType: "checkout.session.completed",
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: brandId,
          customer: "cus_topup_invalid_quantity_test",
          payment_intent: `pi_${crypto.randomUUID()}`,
          amount_total: 20_000,
          currency: "eur",
          metadata: {
            brand_id: brandId,
            tier: "growth",
            topup_quantity: "not-an-integer",
            is_onboarding_discount: "true",
          },
        },
      });

      const response = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });

      expect(response.status).toBe(200);
      expect(await getBrandPlanState(brandId)).toEqual({
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });
    } finally {
      restoreAppDb();
    }
  });

  it("adds credits without flipping onboarding discount when the top-up is full price", async () => {
    const restoreAppDb = bindAppDbToTestDb();

    try {
      const brandId = await createTestBrand("Webhook Full-price Top-up Brand");
      await setBrandSubscriptionState({
        brandId,
        phase: "active",
        planType: "growth",
        billingInterval: "quarterly",
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_topup_full_price_test",
        stripeSubscriptionId: "sub_topup_full_price_test",
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });

      const { rawBody, signature } = await buildSignedWebhook({
        eventType: "checkout.session.completed",
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: brandId,
          customer: "cus_topup_full_price_test",
          payment_intent: `pi_${crypto.randomUUID()}`,
          amount_total: 40_000,
          currency: "eur",
          metadata: {
            brand_id: brandId,
            tier: "growth",
            topup_quantity: "200",
            is_onboarding_discount: "false",
          },
        },
      });

      const response = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });

      expect(response.status).toBe(200);
      expect(await getBrandPlanState(brandId)).toEqual({
        totalCredits: 250,
        onboardingDiscountUsed: false,
      });
    } finally {
      restoreAppDb();
    }
  });

  it("does not double-award credits when the same top-up event is delivered twice", async () => {
    const restoreAppDb = bindAppDbToTestDb();

    try {
      const brandId = await createTestBrand("Webhook Duplicate Top-up Brand");
      await setBrandSubscriptionState({
        brandId,
        phase: "active",
        planType: "growth",
        billingInterval: "quarterly",
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_topup_duplicate_test",
        stripeSubscriptionId: "sub_topup_duplicate_test",
        totalCredits: 50,
        onboardingDiscountUsed: false,
      });

      const eventId = `evt_${crypto.randomUUID()}`;
      const { rawBody, signature } = await buildSignedWebhook({
        eventType: "checkout.session.completed",
        eventId,
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: brandId,
          customer: "cus_topup_duplicate_test",
          payment_intent: `pi_${crypto.randomUUID()}`,
          amount_total: 20_000,
          currency: "eur",
          metadata: {
            brand_id: brandId,
            tier: "growth",
            topup_quantity: "200",
            is_onboarding_discount: "true",
          },
        },
      });

      const first = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });
      const second = await stripeWebhookRouter.request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await getBrandPlanState(brandId)).toEqual({
        totalCredits: 250,
        onboardingDiscountUsed: true,
      });
      expect(await countBillingEventsForStripeEvent(eventId)).toBe(1);
    } finally {
      restoreAppDb();
    }
  });

  it("serializes duplicate deliveries of the same event", async () => {
    const eventType = `codex.webhook.race.${crypto.randomUUID()}`;
    const { eventId, rawBody, signature } = await buildSignedWebhook({
      eventType,
      object: { id: `obj_${crypto.randomUUID()}` },
    });

    let handlerCalls = 0;
    let releaseHandler!: () => void;
    let resolveFirstCall!: () => void;
    const handlerReleased = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    const firstCallStarted = new Promise<void>((resolve) => {
      resolveFirstCall = resolve;
    });

    registerWebhookHandler(eventType, async () => {
      handlerCalls += 1;
      if (handlerCalls === 1) {
        resolveFirstCall();
      }
      await handlerReleased;
    });

    try {
      const firstDispatch = verifyAndDispatch(rawBody, signature);
      await firstCallStarted;

      const secondDispatch = verifyAndDispatch(rawBody, signature);
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(handlerCalls).toBe(1);

      releaseHandler();
      await Promise.all([firstDispatch, secondDispatch]);

      expect(handlerCalls).toBe(1);

      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).not.toBeNull();
      expect(storedEvent?.processedAt).not.toBeNull();
    } finally {
      releaseHandler();
      await cleanupWebhookEvent(eventId);
    }
  });

  it("does not emit a second route-level error log when a handler already logged the failure", async () => {
    const eventType = `codex.webhook.failure.${crypto.randomUUID()}`;
    const { eventId, rawBody, signature } = await buildSignedWebhook({
      eventType,
      object: { id: `obj_${crypto.randomUUID()}` },
    });

    registerWebhookHandler(eventType, async () => {
      throw new Error("synthetic handler failure");
    });

    try {
      const { result, logs } = await captureBillingLogs(async () =>
        stripeWebhookRouter.request("http://localhost/", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          body: rawBody,
        }),
      );

      expect(result.status).toBe(500);

      // The event row is inserted inside the transaction, so a handler failure
      // rolls back the entire transaction including the row — nothing persists.
      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).toBeNull();

      const handlerFailureLogs = logs.filter(
        (entry) =>
          entry.msg === "webhook handler failed" &&
          entry.stripeEventId === eventId,
      );
      const unexpectedLogs = logs.filter(
        (entry) => entry.msg === "unexpected webhook processing error",
      );

      expect(handlerFailureLogs).toHaveLength(1);
      expect(unexpectedLogs).toHaveLength(0);
    } finally {
      await cleanupWebhookEvent(eventId);
    }
  });

  it("does not log webhook success before processed_at is persisted", async () => {
    const eventType = `codex.webhook.mark-processed.${crypto.randomUUID()}`;
    const { eventId, rawBody, signature } = await buildSignedWebhook({
      eventType,
      object: { id: `obj_${crypto.randomUUID()}` },
    });

    registerWebhookHandler(eventType, async () => {
      // Keep the handler side effects empty so only the processed-at write can fail.
    });

    // Intercept the transaction callback so that the `tx` object's `.update()`
    // is poisoned for stripeWebhookEvents. This mirrors the real failure mode
    // where markProcessed (now running inside the transaction) cannot persist
    // processed_at.
    const originalTransaction = appDb.transaction.bind(appDb);
    (appDb as any).transaction = async (fn: (tx: any) => Promise<any>, ...rest: any[]) => {
      return originalTransaction(async (tx: any) => {
        const originalTxUpdate = tx.update.bind(tx);
        tx.update = (table: unknown) => {
          if (table === schema.stripeWebhookEvents) {
            return {
              set() {
                return {
                  where: async () => {
                    throw new Error("failed to persist processed_at");
                  },
                };
              },
            } as any;
          }
          return originalTxUpdate(table as never);
        };
        return fn(tx);
      }, ...rest);
    };

    try {
      const { logs } = await captureBillingLogs(async () => {
        await expect(
          verifyAndDispatch(rawBody, signature),
        ).rejects.toMatchObject({
          name: LoggedWebhookProcessingError.name,
        });
      });

      // The poisoned update throws inside the transaction, rolling back everything
      // including the event row insert. No row persists after rollback.
      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).toBeNull();

      const successLogs = logs.filter(
        (entry) =>
          entry.msg === "webhook processed" &&
          entry.stripeEventId === eventId,
      );

      expect(successLogs).toHaveLength(0);
    } finally {
      (appDb as any).transaction = undefined;
      await cleanupWebhookEvent(eventId);
    }
  });
});
