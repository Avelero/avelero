/**
 * Shopify OAuth routes.
 *
 * These are raw HTTP endpoints (not tRPC) because Shopify redirects
 * directly to them during the OAuth flow.
 *
 * Endpoints:
 * - GET /integrations/shopify/install - Initiate OAuth flow
 * - GET /integrations/shopify/callback - Handle OAuth callback
 *
 * @module routes/integrations/shopify
 */
import { randomBytes } from "node:crypto";
import { db } from "@v1/db/client";
import {
  createBrandIntegration,
  getBrandIntegrationBySlug,
  getIntegrationBySlug,
  updateBrandIntegration,
} from "@v1/db/queries/integrations";
import {
  createOAuthState,
  deleteOAuthState,
  findOAuthState,
} from "@v1/db/queries/integrations";
import { encryptCredentials } from "@v1/db/utils";
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  validateShopifyHmac,
} from "@v1/integrations";
import { Hono } from "hono";

// Shopify OAuth configuration
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:4000";

// API version for Shopify Admin API
const SHOPIFY_API_VERSION = "2025-10";

/**
 * Creates the mandatory compliance webhook subscriptions for a shop.
 *
 * This is called after a shop installs the app to ensure the three
 * required compliance webhooks are registered:
 * - CUSTOMERS_DATA_REQUEST
 * - CUSTOMERS_REDACT
 * - SHOP_REDACT
 *
 * @param shop - The shop domain (e.g., "my-store.myshopify.com")
 * @param accessToken - The shop's Admin API access token
 */
async function createComplianceWebhookSubscriptions(
  shop: string,
  accessToken: string,
): Promise<void> {
  // All compliance webhooks go to the same endpoint, differentiated by X-Shopify-Topic header
  const webhookEndpoint = `${API_URL}/integrations/webhooks/compliance`;

  const topics = ["CUSTOMERS_DATA_REQUEST", "CUSTOMERS_REDACT", "SHOP_REDACT"];

  for (const topic of topics) {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          userErrors {
            field
            message
          }
          webhookSubscription {
            id
            topic
          }
        }
      }
    `;

    const variables = {
      topic,
      webhookSubscription: {
        callbackUrl: webhookEndpoint,
        format: "JSON",
      },
    };

    try {
      const response = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ query: mutation, variables }),
        },
      );

      if (!response.ok) {
        console.error(
          `Failed to create webhook subscription for ${topic}:`,
          response.status,
          await response.text(),
        );
        continue;
      }

      const result = (await response.json()) as {
        data?: {
          webhookSubscriptionCreate?: {
            userErrors?: Array<{ field: string; message: string }>;
            webhookSubscription?: { id: string; topic: string };
          };
        };
        errors?: Array<{ message: string }>;
      };

      // Check for top-level GraphQL errors (auth failures, rate limits, invalid queries)
      if (result.errors && result.errors.length > 0) {
        console.error(
          `GraphQL errors creating webhook for ${topic}:`,
          result.errors,
        );
        continue;
      }

      const userErrors = result.data?.webhookSubscriptionCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        // Check if it's just a "already exists" error, which is fine
        const alreadyExists = userErrors.some((e) =>
          e.message.toLowerCase().includes("already exists"),
        );
        if (!alreadyExists) {
          console.error(
            `Webhook subscription errors for ${topic}:`,
            userErrors,
          );
        } else {
          console.log(`Webhook subscription for ${topic} already exists`);
        }
        continue;
      }

      console.log(
        `Created webhook subscription for ${topic}:`,
        result.data?.webhookSubscriptionCreate?.webhookSubscription?.id,
      );
    } catch (error) {
      console.error(`Error creating webhook subscription for ${topic}:`, error);
    }
  }
}

/**
 * Shopify OAuth router.
 */
export const shopifyOAuthRouter = new Hono();

/**
 * GET /install
 *
 * Initiates the Shopify OAuth flow.
 *
 * Query params:
 * - shop: Shopify shop domain (e.g., "my-store.myshopify.com")
 * - brand_id: Brand ID to associate the integration with
 *
 * Steps:
 * 1. Validate shop domain format
 * 2. Generate CSRF state token
 * 3. Store state in database with brand_id
 * 4. Redirect to Shopify OAuth authorize URL
 */
shopifyOAuthRouter.get("/install", async (c) => {
  try {
    const shop = c.req.query("shop");
    const brandId = c.req.query("brand_id");

    // Validate required parameters
    if (!shop) {
      return c.json({ error: "Missing required parameter: shop" }, 400);
    }
    if (!brandId) {
      return c.json({ error: "Missing required parameter: brand_id" }, 400);
    }

    // Validate shop domain format
    const shopRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
    if (!shopRegex.test(shop)) {
      return c.json(
        {
          error:
            "Invalid shop domain. Must be a valid Shopify domain (e.g., my-store.myshopify.com)",
        },
        400,
      );
    }

    // Validate Shopify credentials are configured
    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      console.error("Shopify OAuth: Missing client credentials");
      return c.json({ error: "Shopify integration is not configured" }, 500);
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString("hex");

    // Store state in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await createOAuthState(db, {
      state,
      brandId,
      integrationSlug: "shopify",
      shopDomain: shop,
      expiresAt,
    });

    // Build Shopify OAuth URL using shared utility
    const redirectUri = `${API_URL}/integrations/shopify/callback`;
    const installUrl = buildAuthorizationUrl(
      shop,
      SHOPIFY_CLIENT_ID,
      SHOPIFY_SCOPES,
      redirectUri,
      state,
    );

    // Redirect to Shopify
    return c.redirect(installUrl);
  } catch (error) {
    console.error("Shopify OAuth install error:", error);
    return c.json({ error: "Failed to initiate OAuth flow" }, 500);
  }
});

/**
 * GET /callback
 *
 * Handles the Shopify OAuth callback.
 *
 * Query params (from Shopify):
 * - code: Authorization code
 * - hmac: HMAC signature for verification
 * - shop: Shop domain
 * - state: CSRF state token
 * - timestamp: Request timestamp
 *
 * Steps:
 * 1. Validate HMAC signature
 * 2. Verify state token matches stored state
 * 3. Exchange code for access token
 * 4. Encrypt and store credentials
 * 5. Clean up OAuth state
 * 6. Redirect to success page
 */
shopifyOAuthRouter.get("/callback", async (c) => {
  try {
    const { code, hmac, shop, state, timestamp } = c.req.query();

    // Validate required parameters
    if (!code || !hmac || !shop || !state || !timestamp) {
      return c.redirect(
        `${APP_URL}/settings/integrations?error=missing_params`,
      );
    }

    // Validate HMAC signature using shared utility
    const isValidHmac = validateShopifyHmac(
      c.req.query() as Record<string, string>,
      hmac,
      SHOPIFY_CLIENT_SECRET,
    );
    if (!isValidHmac) {
      console.error("Shopify OAuth: Invalid HMAC signature");
      return c.redirect(
        `${APP_URL}/settings/integrations?error=invalid_signature`,
      );
    }

    // Verify state token
    const oauthState = await findOAuthState(db, state);
    if (!oauthState) {
      console.error("Shopify OAuth: Invalid or expired state token");
      return c.redirect(`${APP_URL}/settings/integrations?error=invalid_state`);
    }

    // Verify shop domain matches
    if (oauthState.shopDomain !== shop) {
      console.error("Shopify OAuth: Shop domain mismatch");
      await deleteOAuthState(db, oauthState.id);
      return c.redirect(`${APP_URL}/settings/integrations?error=shop_mismatch`);
    }

    // Exchange code for access token using shared utility
    const accessToken = await exchangeCodeForToken(
      shop,
      code,
      SHOPIFY_CLIENT_ID,
      SHOPIFY_CLIENT_SECRET,
    );
    if (!accessToken) {
      await deleteOAuthState(db, oauthState.id);
      return c.redirect(
        `${APP_URL}/settings/integrations?error=token_exchange_failed`,
      );
    }

    // Create mandatory compliance webhook subscriptions
    // These are required for Shopify app review
    await createComplianceWebhookSubscriptions(shop, accessToken);

    // Get the Shopify integration type
    const integration = await getIntegrationBySlug(db, "shopify");
    if (!integration) {
      console.error("Shopify OAuth: Shopify integration not found in database");
      await deleteOAuthState(db, oauthState.id);
      return c.redirect(
        `${APP_URL}/settings/integrations?error=integration_not_found`,
      );
    }

    // Encrypt credentials
    const { encrypted, iv } = encryptCredentials({
      accessToken,
      shop,
    });

    // Check if brand already has Shopify connected
    const existing = await getBrandIntegrationBySlug(
      db,
      oauthState.brandId,
      "shopify",
    );

    if (existing) {
      // Update existing integration
      await updateBrandIntegration(db, oauthState.brandId, existing.id, {
        credentials: encrypted,
        credentialsIv: iv,
        shopDomain: shop,
        status: "active",
        errorMessage: null,
      });
    } else {
      // Create new integration
      await createBrandIntegration(db, oauthState.brandId, {
        integrationId: integration.id,
        credentials: encrypted,
        credentialsIv: iv,
        shopDomain: shop,
        syncInterval: 86400, // 24 hours
        status: "active",
      });
    }

    // Clean up OAuth state
    await deleteOAuthState(db, oauthState.id);

    // Redirect to integration detail page (status comes from database, not URL)
    return c.redirect(`${APP_URL}/settings/integrations/shopify`);
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return c.redirect(`${APP_URL}/settings/integrations?error=callback_failed`);
  }
});

export type ShopifyOAuthRouter = typeof shopifyOAuthRouter;
