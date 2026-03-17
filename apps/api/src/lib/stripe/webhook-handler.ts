/**
 * Verifies and dispatches Stripe webhooks with idempotency tracking and structured logging.
 */
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { stripeWebhookEvents } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";

const log = billingLogger.child({ component: "webhook-dispatcher" });

type WebhookHandler = (event: Stripe.Event) => Promise<void>;

const handlers: Record<string, WebhookHandler | undefined> = {};

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

  // 2. Idempotency check — only skip if the event was fully processed
  const [existing] = await db
    .select({
      id: stripeWebhookEvents.id,
      processedAt: stripeWebhookEvents.processedAt,
    })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id))
    .limit(1);

  if (existing?.processedAt) {
    return { received: true };
  }

  // 3. Insert event row (unprocessed). ON CONFLICT handles the race where
  //    two concurrent deliveries of the same event both pass the SELECT.
  if (!existing) {
    await db
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        processedAt: null,
      })
      .onConflictDoNothing({
        target: stripeWebhookEvents.stripeEventId,
      });
  }

  // 4. Dispatch to handler
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
    return { received: true };
  }

  const startMs = Date.now();

  try {
    await handler(event);
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

  const durationMs = Date.now() - startMs;
  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      durationMs,
    },
    "webhook processed",
  );

  return { received: true };
}
