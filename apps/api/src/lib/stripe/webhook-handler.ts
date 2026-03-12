import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { stripeWebhookEvents } from "@v1/db/schema";
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";

/**
 * Supported webhook event types and their handler functions.
 *
 * Handlers are registered lazily in Step 4. For now the dispatcher
 * recognises these event types and will skip any that are not yet
 * wired up.
 */
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
 * Verify the Stripe webhook signature, check idempotency, and dispatch
 * to the appropriate handler.
 *
 * 1. Verify signature via `stripe.webhooks.constructEvent()`
 * 2. Check `stripe_webhook_events` for duplicate (idempotency)
 * 3. Insert event row with `processed_at = null`
 * 4. Dispatch to registered handler
 * 5. Mark `processed_at`
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
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
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
    // Successfully processed in a previous attempt — skip
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
  if (handler) {
    await handler(event);
  } else {
    console.log(`Stripe webhook: unhandled event type "${event.type}"`);
  }

  // 5. Mark processed
  await db
    .update(stripeWebhookEvents)
    .set({ processedAt: new Date().toISOString() })
    .where(eq(stripeWebhookEvents.stripeEventId, event.id));

  return { received: true };
}
