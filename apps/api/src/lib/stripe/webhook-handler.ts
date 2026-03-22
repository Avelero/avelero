/**
 * Verifies and dispatches Stripe webhooks with idempotency tracking and structured logging.
 */
import { db, type DatabaseOrTransaction } from "@v1/db/client";
import { eq, sql } from "@v1/db/queries";
import { stripeWebhookEvents } from "@v1/db/schema";
import { billingLogger } from "@v1/logger/billing";
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";

const log = billingLogger.child({ component: "webhook-dispatcher" });

type WebhookHandler = (
  event: Stripe.Event,
  conn: DatabaseOrTransaction,
) => Promise<void>;

const handlers: Record<string, WebhookHandler | undefined> = {};
const WEBHOOK_LOCK_NAMESPACE = "stripe_webhook";

/**
 * Limits concurrent webhook transactions so bursts of Stripe events cannot
 * exhaust the database connection pool. Each webhook transaction holds one
 * pool connection for the duration of processing; capping concurrency to
 * MAX_CONCURRENT_WEBHOOKS keeps headroom for health checks and other routes.
 */
const MAX_CONCURRENT_WEBHOOKS = 1;
let activeWebhooks = 0;
const webhookQueue: Array<() => void> = [];

function acquireWebhookSlot(): Promise<void> {
  if (activeWebhooks < MAX_CONCURRENT_WEBHOOKS) {
    activeWebhooks++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    webhookQueue.push(() => {
      activeWebhooks++;
      resolve();
    });
  });
}

function releaseWebhookSlot(): void {
  activeWebhooks--;
  const next = webhookQueue.shift();
  if (next) {
    next();
  }
}

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
  conn: DatabaseOrTransaction;
}): Promise<void> {
  await params.conn.execute(
    sql`INSERT INTO stripe_webhook_events (stripe_event_id, event_type, processed_at)
        VALUES (${params.stripeEventId}, ${params.eventType}, NULL)
        ON CONFLICT (stripe_event_id) DO NOTHING`,
  );
}

/**
 * Returns the advisory-lock key used to serialize duplicate deliveries of the
 * same Stripe event.
 */
function getWebhookLockKey(stripeEventId: string): string {
  return `${WEBHOOK_LOCK_NAMESPACE}:${stripeEventId}`;
}

/**
 * Returns a stable Stripe object lock key so related events do not race each other.
 */
function getWebhookResourceLockKey(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (subscriptionId) {
        return `stripe_subscription:${subscriptionId}`;
      }

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      if (customerId) {
        return `stripe_customer:${customerId}`;
      }

      return session.metadata?.brand_id
        ? `stripe_brand:${session.metadata.brand_id}`
        : `stripe_checkout:${session.id}`;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return `stripe_subscription:${subscription.id}`;
    }
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.overdue":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
    case "invoice.marked_uncollectible": {
      const invoice = event.data.object as Stripe.Invoice;
      return `stripe_invoice:${invoice.id}`;
    }
    default:
      return null;
  }
}

/**
 * Returns the ordered advisory locks required for the current webhook event.
 */
function getWebhookLockKeys(event: Stripe.Event): string[] {
  const keys = [
    getWebhookLockKey(event.id),
    getWebhookResourceLockKey(event),
  ].filter((value): value is string => !!value);

  return [...new Set(keys)].sort();
}

/**
 * Marks a webhook event as fully processed once every side effect has succeeded.
 *
 * Accepts an optional transaction connection so the update participates in the
 * same transaction as the handler side-effects, preserving atomicity.
 */
async function markProcessed(params: {
  stripeEventId: string;
  eventType: string;
  conn: DatabaseOrTransaction;
}): Promise<void> {
  const conn = params.conn;
  try {
    await conn
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
  rawBody: string | Buffer,
  signature: string,
): Promise<{ received: true }> {
  const requestStartedAt = Date.now();
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

  log.info(
    {
      stripeEventId: event.id,
      eventType: event.type,
      requestDurationMs: Date.now() - requestStartedAt,
    },
    "stripe webhook verified",
  );

  const startMs = Date.now();
  let didDispatchHandler = false;

  // 2. Wait for a concurrency slot so bursts of Stripe events do not exhaust the
  //    database connection pool. Each transaction holds one pooled connection.
  await acquireWebhookSlot();

  // 3. Process the webhook on a single transaction connection so concurrent
  //    Stripe deliveries cannot starve the pool or interleave related rows.
  try {
    await db.transaction(async (tx) => {
      log.info(
        {
          stripeEventId: event.id,
          eventType: event.type,
        },
        "stripe webhook transaction opened",
      );

      for (const lockKey of getWebhookLockKeys(event)) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      }

      log.info(
        {
          stripeEventId: event.id,
          eventType: event.type,
          transactionDurationMs: Date.now() - startMs,
        },
        "stripe webhook advisory lock acquired",
      );

      await ensureWebhookEventRow({
        stripeEventId: event.id,
        eventType: event.type,
        conn: tx,
      });

      log.info(
        {
          stripeEventId: event.id,
          eventType: event.type,
          requestDurationMs: Date.now() - requestStartedAt,
        },
        "stripe webhook row ensured",
      );

      const [existing] = await tx
        .select({
          processedAt: stripeWebhookEvents.processedAt,
        })
        .from(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.stripeEventId, event.id))
        .limit(1);

      if (existing?.processedAt) {
        log.info(
          {
            stripeEventId: event.id,
            eventType: event.type,
            processedAt: existing.processedAt,
          },
          "stripe webhook already processed, skipping handler",
        );
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
          conn: tx,
        });
        return;
      }

      try {
        log.info(
          {
            stripeEventId: event.id,
            eventType: event.type,
          },
          "stripe webhook handler starting",
        );
        await handler(event, tx);
        didDispatchHandler = true;
        log.info(
          {
            stripeEventId: event.id,
            eventType: event.type,
            handlerDurationMs: Date.now() - startMs,
          },
          "stripe webhook handler completed",
        );
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

      log.info(
        {
          stripeEventId: event.id,
          eventType: event.type,
          transactionDurationMs: Date.now() - startMs,
        },
        "stripe webhook marking event processed",
      );
      await markProcessed({
        stripeEventId: event.id,
        eventType: event.type,
        conn: tx,
      });
      log.info(
        {
          stripeEventId: event.id,
          eventType: event.type,
          transactionDurationMs: Date.now() - startMs,
        },
        "stripe webhook event marked processed",
      );
    });
  } finally {
    releaseWebhookSlot();
  }

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
