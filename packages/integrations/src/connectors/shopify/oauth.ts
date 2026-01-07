/**
 * Shopify OAuth Logic
 *
 * Core OAuth functionality for Shopify authentication.
 * These functions are used by the API routes.
 */

import { createHmac } from "node:crypto";

/**
 * Validates the HMAC signature from Shopify callback.
 *
 * Shopify signs the callback parameters with the API secret.
 * We verify this to ensure the request is legitimate.
 */
export function validateShopifyHmac(
  params: Record<string, string>,
  hmac: string,
  clientSecret: string
): boolean {
  // Remove hmac from params for verification
  const { hmac: _, ...rest } = params;

  // Sort and encode parameters
  const sortedParams = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  // Calculate expected HMAC
  const expectedHmac = createHmac("sha256", clientSecret)
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
export async function exchangeCodeForToken(
  shop: string,
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
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

/**
 * Build the Shopify OAuth authorization URL.
 */
export function buildAuthorizationUrl(
  shop: string,
  clientId: string,
  scopes: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Verifies the HMAC signature of a Shopify webhook.
 *
 * Shopify sends webhooks with an `X-Shopify-Hmac-Sha256` header containing
 * a base64-encoded HMAC-SHA256 hash of the raw request body signed with
 * the app's API secret (client secret).
 *
 * @param rawBody - The raw request body as a string (must be unparsed)
 * @param hmacHeader - The value of the X-Shopify-Hmac-Sha256 header
 * @param clientSecret - The Shopify app's client secret (API secret)
 * @returns true if the signature is valid, false otherwise
 */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string,
  clientSecret: string
): boolean {
  // Calculate the expected HMAC using SHA256 and base64 encoding
  // Note: This is different from OAuth HMAC which uses hex encoding
  const expectedHmac = createHmac("sha256", clientSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Compare using timing-safe comparison to prevent timing attacks
  return timingSafeEqual(hmacHeader, expectedHmac);
}

