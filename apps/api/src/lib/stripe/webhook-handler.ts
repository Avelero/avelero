/**
 * Verifies and dispatches Stripe webhooks with idempotency tracking and structured logging.
 */
import { db } from "@v1/db/client";
import { eq, sql } from "@v1/db/queries";
import { stripeWebhookEvents } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";

const log = billingLogger.child({ component: "webhook-dispatcher" });

type WebhookHandler = (event: Stripe.Event) => Promise<void>;

const handlers: Record<string, WebhookHandler | undefined> = {};
const WEBHOOK_LOCK_NAMESPACE = "stripe_webhook";

/**
 * Register a handler for a Stripe webhook event type.
 * Called by each handler module at import time.
 */
export function registerWebhookHandler(
  eventType: string,
  handler: WebhookHandler,
): void {
  handlers[eventType] = handler;
}

/**
 * Custom error thrown when Stripe signature verification fails.
 */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * Signals a webhook failure that already emitted a structured log entry.
 */
export class LoggedWebhookProcessingError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LoggedWebhookProcessingError";
    this.cause = cause;
  }
}

/**
 * Persists the webhook row before dispatch so failed handlers still leave an
 * unprocessed record behind for later retries.
 */
async function ensureWebhookEventRow(params: {
  stripeEventId: string;
  eventType: string;
}): Promise<void> {
  await db
    .insert(stripeWebhookEvents)
    .values({
      stripeEventId: params.stripeEventId,
      eventType: params.eventType,
      processedAt: null,
    })
    .onConflictDoNothing({
      target: stripeWebhookEvents.stripeEventId,
    });
}

/**
 * Returns the advisory-lock key used to serialize duplicate deliveries of the
 * same Stripe event.
 */
function getWebhookLockKey(stripeEventId: string): string {
  return `${WEBHOOK_LOCK_NAMESPACE}:${stripeEventId}`;
}

/**
 * Marks a webhook event as fully processed once every side effect has succeeded.
 */
async function markProcessed(params: {
  stripeEventId: string;
  eventType: string;
}): Promise<void> {
  try {
    await db
      .update(stripeWebhookEvents)
      .set({ processedAt: new Date().toISOString() })
      .where(eq(stripeWebhookEvents.stripeEventId, params.stripeEventId));
  } catch (err) {
    log.error(
      {
        stripeEventId: params.stripeEventId,
        eventType: params.eventType,
        err,
      },
      "failed to mark webhook as processed",
    );
    throw new LoggedWebhookProcessingError(
      "Failed to mark webhook as processed",
      err,
    );
  }
}

/**
 * Verify the Stripe webhook signature, check idempotency, and dispatch
 * to the appropriate handler.
 */
export async function verifyAndDispatch(
  rawBody: string,
  signature: string,
): Promise<{ received: true }> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new WebhookVerificationError(
      err instanceof Error ? err.message : "Signature verification failed",
    );
  }

  // 2. Persist the event row up front so failed handlers leave a retryable record.
  await ensureWebhookEventRow({
    stripeEventId: event.id,
    eventType: event.type,
  });

  const startMs = Date.now();
  let didDispatchHandler = false;

  // 3. Hold a database-level lock for this Stripe event so duplicate deliveries
  //    cannot run the handler in parallel.
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${getWebhookLockKey(event.id)}))`,
    );

    const [existing] = await tx
      .select({
        processedAt: stripeWebhookEvents.processedAt,
      })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      .limit(1);

    if (existing?.processedAt) {
      return;
    }

    const handler = handlers[event.type];

    if (!handler) {
      log.info(
        { stripeEventId: event.id, eventType: event.type },
        "unhandled event type, skipping",
      );
      await markProcessed({
        stripeEventId: event.id,
        eventType: event.type,
      });
      return;
    }

    try {
      await handler(event);
      didDispatchHandler = true;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      log.error(
        {
          stripeEventId: event.id,
          eventType: event.type,
          durationMs,
          err,
        },
        "webhook handler failed",
      );
      throw new LoggedWebhookProcessingError("Webhook handler failed", err);
    }

    await markProcessed({
      stripeEventId: event.id,
      eventType: event.type,
    });
  });

  if (didDispatchHandler) {
    const durationMs = Date.now() - startMs;
    log.info(
      {
        stripeEventId: event.id,
        eventType: event.type,
        durationMs,
      },
      "webhook processed",
    );
  }

  return { received: true };
}
