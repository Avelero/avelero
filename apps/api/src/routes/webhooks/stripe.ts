/**
 * Exposes the public Stripe webhook endpoint and maps processing failures to HTTP responses.
 */
import { Hono } from "hono";
import { billingLogger } from "@v1/logger/billing";
import "../../lib/stripe/handlers/index.js"; // Register all webhook handlers
import {
  LoggedWebhookProcessingError,
  WebhookVerificationError,
  verifyAndDispatch,
} from "../../lib/stripe/webhook-handler.js";

const log = billingLogger.child({ component: "webhook-route" });

export const stripeWebhookRouter = new Hono();

stripeWebhookRouter.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    log.warn("missing stripe-signature header");
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();

  try {
    const result = await verifyAndDispatch(rawBody, signature);
    return c.json(result, 200);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      log.warn({ err }, "webhook signature verification failed");
      return c.json({ error: "Invalid signature" }, 401);
    }
    if (err instanceof LoggedWebhookProcessingError) {
      return c.json({ error: "Processing failed" }, 500);
    }
    // Handler-level errors are already logged in verifyAndDispatch.
    log.error({ err }, "unexpected webhook processing error");
    return c.json({ error: "Processing failed" }, 500);
  }
});
