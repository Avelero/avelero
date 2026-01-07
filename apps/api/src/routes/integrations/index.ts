/**
 * Integration OAuth routes aggregator.
 *
 * Combines all integration OAuth routes into a single Hono app
 * that can be mounted at /integrations.
 *
 * @module routes/integrations
 */
import { Hono } from "hono";
import { shopifyOAuthRouter } from "./shopify.js";
import { shopifyWebhooksRouter } from "./shopify-webhooks.js";

/**
 * Main integrations route handler.
 *
 * Mounts OAuth routes for each integration provider:
 * - /shopify/* - Shopify OAuth flow
 * - /webhooks/compliance/* - Shopify compliance webhooks
 *
 * Usage in main app:
 * ```ts
 * import { integrationRoutes } from "./routes/integrations/index.js";
 * app.route("/integrations", integrationRoutes);
 * ```
 */
export const integrationRoutes = new Hono();

// Mount Shopify OAuth routes
integrationRoutes.route("/shopify", shopifyOAuthRouter);

// Mount Shopify compliance webhooks
// These handle: customers/data_request, customers/redact, shop/redact
integrationRoutes.route("/webhooks/compliance", shopifyWebhooksRouter);

// Health check for integration routes
integrationRoutes.get("/health", (c) => {
  return c.json({ status: "ok", service: "integrations" });
});

export type IntegrationRoutes = typeof integrationRoutes;
