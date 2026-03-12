import { Hono } from "hono";
import "../../lib/stripe/handlers/index.js"; // Register all webhook handlers
import {
  WebhookVerificationError,
  verifyAndDispatch,
} from "../../lib/stripe/webhook-handler.js";

/**
 * Stripe webhook route.
 *
 * Uses `c.req.text()` to read the raw body — Stripe signature verification
 * requires the exact raw string, not a parsed JSON object.
 */
export const stripeWebhookRouter = new Hono();

stripeWebhookRouter.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();

  try {
    const result = await verifyAndDispatch(rawBody, signature);
    return c.json(result, 200);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return c.json({ error: "Invalid signature" }, 401);
    }
    console.error("Stripe webhook processing error:", err);
    return c.json({ error: "Processing failed" }, 500);
  }
});
