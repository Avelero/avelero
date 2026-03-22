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
  const startedAt = Date.now();
  const signature = c.req.header("stripe-signature");
  const contentLength = c.req.header("content-length");

  log.info(
    {
      hasSignature: Boolean(signature),
      contentLength,
      userAgent: c.req.header("user-agent") ?? null,
    },
    "stripe webhook request received",
  );

  if (!signature) {
    log.warn("missing stripe-signature header");
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = Buffer.from(await c.req.arrayBuffer());
  log.info(
    {
      contentLength,
      rawBodyBytes: rawBody.byteLength,
      readDurationMs: Date.now() - startedAt,
    },
    "stripe webhook request body buffered",
  );

  try {
    const result = await verifyAndDispatch(rawBody, signature);
    log.info(
      {
        durationMs: Date.now() - startedAt,
      },
      "stripe webhook request completed successfully",
    );
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
    log.error(
      {
        err,
        durationMs: Date.now() - startedAt,
      },
      "unexpected webhook processing error",
    );
    return c.json({ error: "Processing failed" }, 500);
  }
});
