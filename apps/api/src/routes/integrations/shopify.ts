/**
 * Shopify OAuth routes.
 *
 * These are raw HTTP endpoints (not tRPC) because Shopify redirects
 * directly to them during the OAuth flow.
 *
 * Endpoints:
 * - GET /api/integrations/shopify/install - Initiate OAuth flow
 * - GET /api/integrations/shopify/callback - Handle OAuth callback
 *
 * @module routes/integrations/shopify
 */
import { createHmac, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { db } from "@v1/db/client";
import {
  createBrandIntegration,
  createOAuthState,
  deleteOAuthState,
  findOAuthState,
  getBrandIntegrationBySlug,
  getIntegrationBySlug,
  updateBrandIntegration,
} from "@v1/db/queries";
import { encryptCredentials } from "@v1/db/utils";

// Shopify OAuth configuration
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:4000";

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
          error: "Invalid shop domain. Must be a valid Shopify domain (e.g., my-store.myshopify.com)",
        },
        400,
      );
    }

    // Validate Shopify credentials are configured
    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      console.error("Shopify OAuth: Missing client credentials");
      return c.json(
        { error: "Shopify integration is not configured" },
        500,
      );
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

    // Build Shopify OAuth URL
    const redirectUri = `${API_URL}/api/integrations/shopify/callback`;
    const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    installUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    installUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    installUrl.searchParams.set("redirect_uri", redirectUri);
    installUrl.searchParams.set("state", state);

    // Redirect to Shopify
    return c.redirect(installUrl.toString());
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

    // Validate HMAC signature
    const isValidHmac = validateShopifyHmac(c.req.query() as Record<string, string>, hmac);
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
      return c.redirect(
        `${APP_URL}/settings/integrations?error=invalid_state`,
      );
    }

    // Verify shop domain matches
    if (oauthState.shopDomain !== shop) {
      console.error("Shopify OAuth: Shop domain mismatch");
      await deleteOAuthState(db, oauthState.id);
      return c.redirect(
        `${APP_URL}/settings/integrations?error=shop_mismatch`,
      );
    }

    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(shop, code);
    if (!accessToken) {
      await deleteOAuthState(db, oauthState.id);
      return c.redirect(
        `${APP_URL}/settings/integrations?error=token_exchange_failed`,
      );
    }

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
        syncInterval: 21600, // 6 hours
        status: "active",
      });
    }

    // Clean up OAuth state
    await deleteOAuthState(db, oauthState.id);

    // Redirect to integration detail page (status comes from database, not URL)
    return c.redirect(`${APP_URL}/settings/integrations/shopify`);
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return c.redirect(
      `${APP_URL}/settings/integrations?error=callback_failed`,
    );
  }
});

/**
 * Validates the HMAC signature from Shopify.
 *
 * Shopify signs the callback parameters with the API secret.
 * We need to verify this to ensure the request is legitimate.
 */
function validateShopifyHmac(
  params: Record<string, string>,
  hmac: string,
): boolean {
  // Remove hmac from params for verification
  const { hmac: _, ...rest } = params;

  // Sort and encode parameters
  const sortedParams = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  // Calculate expected HMAC
  const expectedHmac = createHmac("sha256", SHOPIFY_CLIENT_SECRET)
    .update(sortedParams)
    .digest("hex");

  // Compare in constant time to prevent timing attacks
  return timingSafeEqual(hmac, expectedHmac);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Exchange the authorization code for an access token.
 */
async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<string | null> {
  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shopify token exchange failed:", response.status, errorText);
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (error) {
    console.error("Shopify token exchange error:", error);
    return null;
  }
}

export type ShopifyOAuthRouter = typeof shopifyOAuthRouter;
