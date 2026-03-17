/**
 * Integration Tests: Stripe webhook processing.
 *
 * Verifies already-logged webhook failures are not logged twice and that
 * success logs are emitted only after the webhook event is marked processed.
 */

import "../../setup";

import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { db as appDb } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import Stripe from "stripe";
import {
  LoggedWebhookProcessingError,
  registerWebhookHandler,
  verifyAndDispatch,
} from "../../../src/lib/stripe/webhook-handler";
import { stripeWebhookRouter } from "../../../src/routes/webhooks/stripe";

const stripe = new Stripe("sk_test_codex");

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

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_codex";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_codex";
});

describe("Stripe webhook processing", () => {
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

      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).not.toBeNull();
      expect(storedEvent?.processedAt).not.toBeNull();
    } finally {
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

      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).not.toBeNull();
      expect(storedEvent?.processedAt).toBeNull();

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

    // Direct property assignment bypasses spyOn's reliance on
    // Object.getOwnPropertyDescriptor, which doesn't work through the
    // lazy-init Proxy that wraps the Drizzle db instance.
    const originalUpdate = appDb.update.bind(appDb);
    const mockUpdate = ((table: unknown) => {
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

      return originalUpdate(table as never);
    }) as typeof appDb.update;

    (appDb as any).update = mockUpdate;

    try {
      const { logs } = await captureBillingLogs(async () => {
        await expect(
          verifyAndDispatch(rawBody, signature),
        ).rejects.toMatchObject({
          name: LoggedWebhookProcessingError.name,
        });
      });

      const storedEvent = await getWebhookEvent(eventId);
      expect(storedEvent).not.toBeNull();
      expect(storedEvent?.processedAt).toBeNull();

      const successLogs = logs.filter(
        (entry) =>
          entry.msg === "webhook processed" &&
          entry.stripeEventId === eventId,
      );
      const markProcessedFailureLogs = logs.filter(
        (entry) =>
          entry.msg === "failed to mark webhook as processed" &&
          entry.stripeEventId === eventId,
      );

      expect(successLogs).toHaveLength(0);
      expect(markProcessedFailureLogs).toHaveLength(1);
    } finally {
      // Remove the override so the Proxy falls back to the real _db.update
      (appDb as any).update = undefined;
      await cleanupWebhookEvent(eventId);
    }
  });
});
