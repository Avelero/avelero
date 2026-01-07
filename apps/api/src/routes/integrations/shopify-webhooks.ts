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
import { verifyShopifyWebhookHmac } from "@v1/integrations";

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
    c: Context
): Promise<{ success: true; payload: T } | { success: false; response: Response }> {
    // Check Content-Type
    const contentType = c.req.header("content-type");
    if (!contentType?.includes("application/json")) {
        console.warn("Shopify webhook: Invalid Content-Type:", contentType);
        return { success: false, response: c.json({ error: "Invalid Content-Type" }, 400) };
    }

    // Get HMAC header (case-insensitive)
    const hmacHeader = c.req.header("x-shopify-hmac-sha256");
    if (!hmacHeader) {
        console.warn("Shopify webhook: Missing HMAC header");
        return { success: false, response: c.json({ error: "Missing HMAC header" }, 401) };
    }

    // Validate client secret is configured
    if (!SHOPIFY_CLIENT_SECRET) {
        console.error("Shopify webhook: SHOPIFY_CLIENT_SECRET not configured");
        return { success: false, response: c.json({ error: "Server configuration error" }, 500) };
    }

    // Get raw body for HMAC verification
    const rawBody = await c.req.text();

    // Verify HMAC
    const isValid = verifyShopifyWebhookHmac(
        rawBody,
        hmacHeader,
        SHOPIFY_CLIENT_SECRET
    );

    if (!isValid) {
        console.warn("Shopify webhook: Invalid HMAC signature");
        return { success: false, response: c.json({ error: "Invalid HMAC signature" }, 401) };
    }

    // Parse JSON body
    try {
        const payload = JSON.parse(rawBody) as T;
        return { success: true, payload };
    } catch {
        console.warn("Shopify webhook: Invalid JSON body");
        return { success: false, response: c.json({ error: "Invalid JSON body" }, 400) };
    }
}

/**
 * Shopify compliance webhooks router.
 */
export const shopifyWebhooksRouter = new Hono();

// =============================================================================
// COMPLIANCE WEBHOOK HANDLERS
// =============================================================================

/**
 * POST /customers-data-request
 *
 * Handles customers/data_request webhook.
 *
 * When a customer requests their data from a store, Shopify sends this webhook.
 * The app should:
 * 1. Find all data stored for this customer
 * 2. Prepare it for the merchant to share with the customer
 *
 * For now, we log the request. In a production app, you would:
 * - Query your database for customer data
 * - Generate a report
 * - Notify the merchant or queue a background job
 */
shopifyWebhooksRouter.post("/customers-data-request", async (c) => {
    const result = await verifyAndParseWebhook<CustomerDataRequestPayload>(c);

    if (!result.success) {
        return result.response;
    }

    const { payload } = result;

    console.log("Shopify webhook: customers/data_request received", {
        shopDomain: payload.shop_domain,
        shopId: payload.shop_id,
        customerId: payload.customer.id,
        customerEmail: payload.customer.email,
        dataRequestId: payload.data_request.id,
        ordersRequested: payload.orders_requested,
    });

    // TODO: Implement actual data request handling
    // - Query database for customer data
    // - Queue background job to prepare data export
    // - Notify merchant via email or dashboard

    // Respond with 200 to acknowledge receipt
    return c.json({ success: true }, 200);
});

/**
 * POST /customers-redact
 *
 * Handles customers/redact webhook.
 *
 * When a store owner requests customer data deletion, Shopify sends this webhook.
 * The app should:
 * 1. Delete or anonymize all customer data
 * 2. This must be completed within 30 days
 *
 * For now, we log the request. In a production app, you would:
 * - Delete customer records from your database
 * - Anonymize any data you're legally required to retain
 * - Queue a background job for the deletion
 */
shopifyWebhooksRouter.post("/customers-redact", async (c) => {
    const result = await verifyAndParseWebhook<CustomerRedactPayload>(c);

    if (!result.success) {
        return result.response;
    }

    const { payload } = result;

    console.log("Shopify webhook: customers/redact received", {
        shopDomain: payload.shop_domain,
        shopId: payload.shop_id,
        customerId: payload.customer.id,
        customerEmail: payload.customer.email,
        ordersToRedact: payload.orders_to_redact,
    });

    // TODO: Implement actual customer data redaction
    // - Delete customer data from database
    // - Anonymize data if legally required to retain
    // - Queue background job for cleanup

    // Respond with 200 to acknowledge receipt
    return c.json({ success: true }, 200);
});

/**
 * POST /shop-redact
 *
 * Handles shop/redact webhook.
 *
 * 48 hours after a store uninstalls the app, Shopify sends this webhook.
 * The app should:
 * 1. Delete all data related to the shop
 *
 * For now, we log the request. In a production app, you would:
 * - Delete the shop's integration record
 * - Delete all products synced from this shop
 * - Delete any other shop-specific data
 */
shopifyWebhooksRouter.post("/shop-redact", async (c) => {
    const result = await verifyAndParseWebhook<ShopRedactPayload>(c);

    if (!result.success) {
        return result.response;
    }

    const { payload } = result;

    console.log("Shopify webhook: shop/redact received", {
        shopDomain: payload.shop_domain,
        shopId: payload.shop_id,
    });

    // TODO: Implement actual shop data redaction
    // - Delete brand integration record
    // - Delete synced products
    // - Delete any other shop-specific data
    // - Queue background job for cleanup

    // Respond with 200 to acknowledge receipt
    return c.json({ success: true }, 200);
});

export type ShopifyWebhooksRouter = typeof shopifyWebhooksRouter;
