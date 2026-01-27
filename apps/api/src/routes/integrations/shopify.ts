/**
 * Shopify OAuth routes.
 *
 * These are raw HTTP endpoints (not tRPC) because Shopify redirects
 * directly to them during the OAuth flow.
 *
 * Flow (Shopify managed installation for non-embedded apps):
 * 1. Frontend redirects to https://admin.shopify.com/oauth/install?client_id=xxx&state=yyy
 * 2. Shopify handles login, store selection, and grant screen
 * 3. Shopify redirects to /app (application_url) with shop, hmac, timestamp, state
 * 4. /app validates HMAC, finds brand_id from state, redirects to OAuth authorize
 * 5. Shopify redirects to /callback with code
 * 6. /callback exchanges code for token and stores credentials
 *
 * Endpoints:
 * - GET /integrations/shopify/install - Create state and redirect to Shopify install
 * - GET /integrations/shopify/app - Handle post-install redirect, initiate OAuth
 * - GET /integrations/shopify/callback - Handle OAuth callback, exchange code for token
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
  exchangeCodeForToken,
  isValidShopDomain,
  validateShopifyHmac,
} from "@v1/integrations";
import { Hono } from "hono";

// Shopify OAuth configuration
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Shopify OAuth router.
 *
 * Note: Mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact)
 * are configured in shopify.app.avelero.toml and registered automatically by Shopify.
 * They cannot be subscribed to via the GraphQL Admin API.
 */
export const shopifyOAuthRouter = new Hono();

/**
 * GET /install
 *
 * Initiates the Shopify OAuth flow using Shopify's managed install.
 *
 * This endpoint uses Shopify's install URL (https://admin.shopify.com/oauth/install)
 * which handles login and store selection automatically - no shop URL input needed.
 * This complies with Shopify App Store requirement 2.3.1:
 * "Apps must not request the manual entry of a myshopify.com URL"
 *
 * Query params:
 * - brand_id: Brand ID to associate the integration with
 *
 * Steps:
 * 1. Validate brand_id
 * 2. Generate CSRF state token
 * 3. Store state in database with brand_id (shop domain comes later)
 * 4. Redirect to Shopify's managed install URL
 */
shopifyOAuthRouter.get("/install", async (c) => {
  try {
    const brandId = c.req.query("brand_id");

    // Validate required parameters
    if (!brandId) {
      return c.json({ error: "Missing required parameter: brand_id" }, 400);
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
      shopDomain: null,
      expiresAt,
    });

    // Build Shopify's managed install URL
    const installUrl = new URL("https://admin.shopify.com/oauth/install");
    installUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    installUrl.searchParams.set("state", state);

    // Redirect to Shopify's managed install
    return c.redirect(installUrl.toString());
  } catch (error) {
    console.error("Shopify OAuth install error:", error);
    return c.json({ error: "Failed to initiate OAuth flow" }, 500);
  }
});

/**
 * GET /app
 *
 * Handles the redirect from Shopify after managed installation.
 * This is the application_url configured in shopify.app.avelero.toml.
 *
 * For non-embedded apps, Shopify redirects here after the user approves the installation.
 * This endpoint then initiates the OAuth authorization code flow to get a code.
 *
 * Query params (from Shopify):
 * - shop: Shop domain (e.g., my-store.myshopify.com)
 * - hmac: HMAC signature for verification
 * - timestamp: Request timestamp
 * - state: CSRF state token (passed through from /install)
 *
 * Steps:
 * 1. Validate HMAC signature
 * 2. Verify state token and get brand_id
 * 3. Update state with shop domain
 * 4. Redirect to OAuth authorize to get authorization code
 */
shopifyOAuthRouter.get("/app", async (c) => {
  try {
    const { shop, hmac, timestamp, state } = c.req.query();

    // Validate required parameters
    if (!shop || !hmac || !timestamp || !state) {
      console.error("Shopify OAuth app: Missing parameters", {
        shop: !!shop,
        hmac: !!hmac,
        timestamp: !!timestamp,
        state: !!state,
      });
      return c.redirect(
        `${APP_URL}/settings/integrations?error=missing_params`,
      );
    }

    // Validate HMAC signature
    const isValidHmac = validateShopifyHmac(
      c.req.query() as Record<string, string>,
      hmac,
      SHOPIFY_CLIENT_SECRET,
    );
    if (!isValidHmac) {
      console.error("Shopify OAuth app: Invalid HMAC signature");
      return c.redirect(
        `${APP_URL}/settings/integrations?error=invalid_signature`,
      );
    }

    // Validate shop domain format
    if (!isValidShopDomain(shop)) {
      console.error("Shopify OAuth app: Invalid shop domain format");
      return c.redirect(`${APP_URL}/settings/integrations?error=invalid_shop`);
    }

    // Verify state token exists
    const oauthState = await findOAuthState(db, state);
    if (!oauthState) {
      console.error("Shopify OAuth app: Invalid or expired state token");
      return c.redirect(`${APP_URL}/settings/integrations?error=invalid_state`);
    }

    // Generate a new state for the OAuth authorize step
    // (We keep the same brand association but generate a fresh nonce)
    const newState = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Create new state with shop domain
    await createOAuthState(db, {
      state: newState,
      brandId: oauthState.brandId,
      integrationSlug: "shopify",
      shopDomain: shop,
      expiresAt,
    });

    // Clean up old state
    await deleteOAuthState(db, oauthState.id);

    // Build OAuth authorize URL
    // This will redirect back to /callback with the authorization code
    const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    authorizeUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authorizeUrl.searchParams.set(
      "redirect_uri",
      `${API_URL}/integrations/shopify/callback`,
    );
    authorizeUrl.searchParams.set("state", newState);

    // Redirect to Shopify OAuth authorize
    return c.redirect(authorizeUrl.toString());
  } catch (error) {
    console.error("Shopify OAuth app error:", error);
    return c.redirect(`${APP_URL}/settings/integrations?error=app_failed`);
  }
});

/**
 * GET /callback
 *
 * Handles the Shopify OAuth callback with the authorization code.
 *
 * Query params (from Shopify):
 * - code: Authorization code to exchange for access token
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
    const isValidHmac = validateShopifyHmac(
      c.req.query() as Record<string, string>,
      hmac,
      SHOPIFY_CLIENT_SECRET,
    );
    if (!isValidHmac) {
      console.error("Shopify OAuth callback: Invalid HMAC signature");
      return c.redirect(
        `${APP_URL}/settings/integrations?error=invalid_signature`,
      );
    }

    // Verify state token
    const oauthState = await findOAuthState(db, state);
    if (!oauthState) {
      console.error("Shopify OAuth callback: Invalid or expired state token");
      return c.redirect(`${APP_URL}/settings/integrations?error=invalid_state`);
    }

    // Exchange code for access token
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

    // Redirect to integration detail page
    return c.redirect(`${APP_URL}/settings/integrations/shopify`);
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return c.redirect(`${APP_URL}/settings/integrations?error=callback_failed`);
  }
});

type ShopifyOAuthRouter = typeof shopifyOAuthRouter;
