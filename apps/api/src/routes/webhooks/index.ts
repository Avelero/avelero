import { Hono } from "hono";
import { stripeWebhookRouter } from "./stripe.js";

/**
 * Webhook route aggregator.
 *
 * Mounted at `/webhooks` in the main app.
 * - POST /webhooks/stripe — Stripe billing events
 */
export const webhookRoutes = new Hono();

webhookRoutes.route("/stripe", stripeWebhookRouter);
