/**
 * Shopify OAuth routes.
 *
 * These are raw HTTP endpoints (not tRPC) because Shopify redirects
 * directly to them during the OAuth flow.
 *
 * Supports two entry points:
 * A) From Shopify App Store: User clicks "Install" → Shopify redirects to /app
 * B) From Avelero: User clicks "Connect" → redirects to /install with brand_id
 *
 * Both flows converge at /app, then proceed to /callback.
 *
 * Flow:
 * 1. /install (optional, for Avelero-initiated): Creates state with brand_id, redirects to Shopify
 * 2. Shopify handles login, store selection, and grant screen
 * 3. Shopify redirects to /app with shop, hmac, timestamp (and state if Avelero-initiated)
 * 4. /app validates HMAC, creates new state, redirects to OAuth authorize
 * 5. Shopify redirects to /callback with code
 * 6. /callback exchanges code for token:
 *    - If brand_id in state: auto-claim to brand_integrations
 *    - If no brand_id: save to pending_installations, redirect to /connect/shopify
 *
 * @module routes/integrations/shopify
 */
import { randomBytes } from "node:crypto";
import { db } from "@v1/db/client";
import {
  createBrandIntegration,
  createOrUpdatePendingInstallation,
  createOAuthState,
  deleteOAuthState,
  findOAuthState,
  getBrandIntegrationBySlug,
  getIntegrationBySlug,
  updateBrandIntegration,
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
 * This endpoint is used when the user starts from Avelero (not from Shopify App Store).
 *
 * Query params:
 * - brand_id (optional): Brand ID to associate the integration with
 *
 * Steps:
 * 1. If brand_id provided, store state in database for later retrieval
 * 2. Redirect to Shopify's managed install URL
 */
shopifyOAuthRouter.get("/install", async (c) => {
  try {
    const brandId = c.req.query("brand_id");

    // Validate Shopify credentials are configured
    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      console.error("Shopify OAuth: Missing client credentials");
      return c.json({ error: "Shopify integration is not configured" }, 500);
    }

    // Build Shopify's managed install URL
    const installUrl = new URL("https://admin.shopify.com/oauth/install");
    installUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);

    // Only create and pass state if we have a brand_id (Avelero-initiated flow)
    if (brandId) {
      const state = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await createOAuthState(db, {
        state,
        brandId,
        integrationSlug: "shopify",
        shopDomain: null,
        expiresAt,
      });
      installUrl.searchParams.set("state", state);
    }

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
 * Query params (from Shopify):
 * - shop: Shop domain (e.g., my-store.myshopify.com) - REQUIRED
 * - hmac: HMAC signature for verification - REQUIRED
 * - timestamp: Request timestamp - REQUIRED
 * - state: CSRF state token (only present for Avelero-initiated flow) - OPTIONAL
 *
 * Steps:
 * 1. Validate HMAC signature
 * 2. Validate shop domain format
 * 3. If state present, verify and extract brand_id
 * 4. Create new state for OAuth authorize step
 * 5. Redirect to OAuth authorize to get authorization code
 */
shopifyOAuthRouter.get("/app", async (c) => {
  try {
    const { shop, hmac, timestamp, state } = c.req.query();

    // HMAC, shop, and timestamp are always required
    if (!shop || !hmac || !timestamp) {
      console.error("Shopify OAuth app: Missing required parameters", {
        shop: !!shop,
        hmac: !!hmac,
        timestamp: !!timestamp,
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

    // State is optional (present for Avelero-initiated, absent for Shopify-initiated)
    let brandId: string | null = null;
    if (state) {
      const oauthState = await findOAuthState(db, state);
      if (oauthState) {
        brandId = oauthState.brandId;
        // Clean up old state
        await deleteOAuthState(db, oauthState.id);
      }
      // If state is provided but invalid/expired, continue anyway
      // (could be Shopify passing through old state or App Store flow)
    }

    // Generate a new state for the OAuth authorize step
    const newState = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Create new state with shop domain (brand_id may be null)
    await createOAuthState(db, {
      state: newState,
      brandId, // May be null for Shopify App Store initiated installs
      integrationSlug: "shopify",
      shopDomain: shop,
      expiresAt,
    });

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
 * 4. Encrypt credentials
 * 5. If brand_id in state: auto-claim to brand_integrations, redirect to settings
 * 6. If no brand_id: save to pending_installations, redirect to /connect/shopify
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

    // Encrypt credentials
    const { encrypted, iv } = encryptCredentials({
      accessToken,
      shop,
    });

    // Clean up OAuth state
    await deleteOAuthState(db, oauthState.id);

    // If we have a brand_id, auto-claim immediately to brand_integrations
    if (oauthState.brandId) {
      const integration = await getIntegrationBySlug(db, "shopify");
      if (!integration) {
        console.error(
          "Shopify OAuth: Shopify integration not found in database",
        );
        return c.redirect(
          `${APP_URL}/settings/integrations?error=integration_not_found`,
        );
      }

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

      // Redirect to integration detail page
      return c.redirect(`${APP_URL}/settings/integrations/shopify`);
    }

    // No brand_id - save to pending_installations and redirect to claim page
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    await createOrUpdatePendingInstallation(db, {
      shopDomain: shop,
      credentials: encrypted,
      credentialsIv: iv,
      expiresAt,
    });

    // Redirect to Avelero claim page
    return c.redirect(
      `${APP_URL}/connect/shopify?shop=${encodeURIComponent(shop)}`,
    );
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return c.redirect(`${APP_URL}/settings/integrations?error=callback_failed`);
  }
});

type ShopifyOAuthRouter = typeof shopifyOAuthRouter;
