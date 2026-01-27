import { db } from "@v1/db/client";
import {
  deleteBrandIntegrationByShopDomain,
  deletePendingInstallation,
} from "@v1/db/queries/integrations";
import { verifyShopifyWebhookHmac } from "@v1/integrations";
/**
 * Shopify Compliance Webhook Handlers.
 *
 * These endpoints handle Shopify's mandatory compliance webhooks:
 * - customers/data_request - Customer requests their data
 * - customers/redact - Store owner requests customer data deletion
 * - shop/redact - 48 hours after app uninstall, delete shop data
 *
 * All webhooks must verify the HMAC signature and return:
 * - 401 Unauthorized if HMAC is invalid
 * - 200 OK if HMAC is valid
 *
 * @module routes/integrations/shopify-webhooks
 */
import type { Context } from "hono";
import { Hono } from "hono";

// Shopify client secret for HMAC verification
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";

/**
 * Payload types for compliance webhooks
 */
interface CustomerDataRequestPayload {
  shop_id: number;
  shop_domain: string;
  orders_requested: number[];
  customer: {
    id: number;
    email: string;
    phone?: string;
  };
  data_request: {
    id: number;
  };
}

interface CustomerRedactPayload {
  shop_id: number;
  shop_domain: string;
  customer: {
    id: number;
    email: string;
    phone?: string;
  };
  orders_to_redact: number[];
}

interface ShopRedactPayload {
  shop_id: number;
  shop_domain: string;
}

/**
 * Verifies Shopify webhook HMAC and parses the body.
 *
 * @returns The parsed payload if valid, or an error response if invalid
 */
async function verifyAndParseWebhook<T>(
  c: Context,
): Promise<
  { success: true; payload: T } | { success: false; response: Response }
> {
  // Check Content-Type
  const contentType = c.req.header("content-type");
  if (!contentType?.includes("application/json")) {
    console.warn("Shopify webhook: Invalid Content-Type:", contentType);
    return {
      success: false,
      response: c.json({ error: "Invalid Content-Type" }, 400),
    };
  }

  // Get HMAC header (case-insensitive)
  const hmacHeader = c.req.header("x-shopify-hmac-sha256");
  if (!hmacHeader) {
    console.warn("Shopify webhook: Missing HMAC header");
    return {
      success: false,
      response: c.json({ error: "Missing HMAC header" }, 401),
    };
  }

  // Validate client secret is configured
  if (!SHOPIFY_CLIENT_SECRET) {
    console.error("Shopify webhook: SHOPIFY_CLIENT_SECRET not configured");
    return {
      success: false,
      response: c.json({ error: "Server configuration error" }, 500),
    };
  }

  // Get raw body for HMAC verification
  const rawBody = await c.req.text();

  // Verify HMAC
  const isValid = verifyShopifyWebhookHmac(
    rawBody,
    hmacHeader,
    SHOPIFY_CLIENT_SECRET,
  );

  if (!isValid) {
    console.warn("Shopify webhook: Invalid HMAC signature");
    return {
      success: false,
      response: c.json({ error: "Invalid HMAC signature" }, 401),
    };
  }

  // Parse JSON body
  try {
    const payload = JSON.parse(rawBody) as T;
    return { success: true, payload };
  } catch {
    console.warn("Shopify webhook: Invalid JSON body");
    return {
      success: false,
      response: c.json({ error: "Invalid JSON body" }, 400),
    };
  }
}

/**
 * Shopify compliance webhooks router.
 */
export const shopifyWebhooksRouter = new Hono();

// =============================================================================
// TOPIC HANDLERS
// =============================================================================

/**
 * Handles customers/data_request topic.
 *
 * When a customer requests their data from a store, Shopify sends this webhook.
 * Since we only have read_products scope and do not store any customer data,
 * this is an intentional no-op. We acknowledge receipt and return success.
 */
async function handleCustomersDataRequest(
  c: Context,
  payload: CustomerDataRequestPayload,
): Promise<Response> {
  console.log(
    "Shopify webhook: customers/data_request received (no-op, we don't store customer data)",
    {
      shopDomain: payload.shop_domain,
      shopId: payload.shop_id,
      customerId: payload.customer.id,
    },
  );

  // No action needed - we don't store customer data (read_products scope only)
  return c.json({ success: true }, 200);
}

/**
 * Handles customers/redact topic.
 *
 * When a store owner requests customer data deletion, Shopify sends this webhook.
 * Since we only have read_products scope and do not store any customer data,
 * this is an intentional no-op. We acknowledge receipt and return success.
 */
async function handleCustomersRedact(
  c: Context,
  payload: CustomerRedactPayload,
): Promise<Response> {
  console.log(
    "Shopify webhook: customers/redact received (no-op, we don't store customer data)",
    {
      shopDomain: payload.shop_domain,
      shopId: payload.shop_id,
      customerId: payload.customer.id,
    },
  );

  // No action needed - we don't store customer data (read_products scope only)
  return c.json({ success: true }, 200);
}

/**
 * Handles shop/redact topic.
 *
 * 48 hours after a store uninstalls the app, Shopify sends this webhook.
 * We delete the brand integration record for this shop. Product data is
 * retained as it belongs to the brand, not the Shopify integration.
 * We also delete any pending installations for this shop.
 */
async function handleShopRedact(
  c: Context,
  payload: ShopRedactPayload,
): Promise<Response> {
  console.log("Shopify webhook: shop/redact received", {
    shopDomain: payload.shop_domain,
    shopId: payload.shop_id,
  });

  // Delete the brand integration for this shop
  try {
    const deleted = await deleteBrandIntegrationByShopDomain(
      db,
      payload.shop_domain,
    );
    if (deleted) {
      console.log("Shopify webhook: deleted brand integration", {
        shopDomain: payload.shop_domain,
        integrationId: deleted.id,
        brandId: deleted.brandId,
      });
    } else {
      console.log("Shopify webhook: no brand integration found for shop", {
        shopDomain: payload.shop_domain,
      });
    }
  } catch (error) {
    console.error("Shopify webhook: error deleting brand integration", {
      shopDomain: payload.shop_domain,
      error,
    });
    // Still return 200 to prevent Shopify from retrying
  }

  // Also delete any pending installations for this shop
  try {
    const deletedPending = await deletePendingInstallation(
      db,
      payload.shop_domain,
    );
    if (deletedPending) {
      console.log("Shopify webhook: deleted pending installation", {
        shopDomain: payload.shop_domain,
      });
    }
  } catch (error) {
    console.error("Shopify webhook: error deleting pending installation", {
      shopDomain: payload.shop_domain,
      error,
    });
    // Still return 200 to prevent Shopify from retrying
  }

  return c.json({ success: true }, 200);
}

// =============================================================================
// UNIFIED COMPLIANCE ENDPOINT
// =============================================================================

/**
 * POST /
 *
 * Unified compliance webhook handler.
 *
 * Routes to the appropriate handler based on the X-Shopify-Topic header.
 * This single endpoint handles all three mandatory compliance webhooks:
 * - customers/data_request
 * - customers/redact
 * - shop/redact
 */
shopifyWebhooksRouter.post("/", async (c) => {
  // Get the topic from the header (case-insensitive)
  const topic = c.req.header("x-shopify-topic");

  if (!topic) {
    console.warn("Shopify webhook: Missing X-Shopify-Topic header");
    return c.json({ error: "Missing X-Shopify-Topic header" }, 400);
  }

  // Route based on topic
  switch (topic) {
    case "customers/data_request": {
      const result = await verifyAndParseWebhook<CustomerDataRequestPayload>(c);
      if (!result.success) return result.response;
      return handleCustomersDataRequest(c, result.payload);
    }
    case "customers/redact": {
      const result = await verifyAndParseWebhook<CustomerRedactPayload>(c);
      if (!result.success) return result.response;
      return handleCustomersRedact(c, result.payload);
    }
    case "shop/redact": {
      const result = await verifyAndParseWebhook<ShopRedactPayload>(c);
      if (!result.success) return result.response;
      return handleShopRedact(c, result.payload);
    }
    default:
      console.warn("Shopify webhook: Unknown topic:", topic);
      return c.json({ error: "Unknown webhook topic" }, 400);
  }
});

type ShopifyWebhooksRouter = typeof shopifyWebhooksRouter;
