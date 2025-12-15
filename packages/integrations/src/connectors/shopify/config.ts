/**
 * Shopify Connector Configuration
 *
 * Constants and configuration for the Shopify integration.
 */

/**
 * Shopify GraphQL Admin API version to use.
 * @see https://shopify.dev/docs/api/usage/versioning
 */
export const SHOPIFY_API_VERSION = "2024-10";

/**
 * Default batch size for fetching variants.
 * Shopify allows up to 250 per request.
 */
export const SHOPIFY_BATCH_SIZE = 100;

/**
 * Shopify OAuth scopes required for sync.
 */
export const SHOPIFY_DEFAULT_SCOPES = "read_products";

/**
 * Build the Shopify GraphQL endpoint URL.
 */
export function buildShopifyEndpoint(shopDomain: string): string {
  // Normalize shop domain
  let domain = shopDomain.trim().toLowerCase();

  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, "");

  // Remove trailing slash
  domain = domain.replace(/\/$/, "");

  // Add .myshopify.com if not present
  if (!domain.includes(".")) {
    domain = `${domain}.myshopify.com`;
  }

  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

/**
 * Validate shop domain format.
 */
export function isValidShopDomain(shop: string): boolean {
  const shopRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
  return shopRegex.test(shop);
}

