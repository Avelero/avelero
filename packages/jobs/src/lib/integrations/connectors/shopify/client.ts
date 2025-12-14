/**
 * Shopify API Client
 *
 * Handles communication with Shopify's GraphQL Admin API.
 * Uses OAuth access tokens for authentication.
 *
 * Features:
 * - Connection testing
 * - Paginated variant fetching via async generator
 * - Rate limit handling
 * - Error normalization
 *
 * @see https://shopify.dev/docs/api/admin-graphql
 */

import type {
  FetchedVariant,
  FetchedVariantBatch,
  IntegrationCredentials,
} from "../../types";
import { SHOPIFY_BATCH_SIZE, SHOPIFY_PRODUCT_VARIANTS_QUERY } from "./schema";

// =============================================================================
// TYPES
// =============================================================================

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

interface ShopifyVariantNode {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  compareAtPrice: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  image: { url: string } | null;
  product: {
    id: string;
    title: string;
    handle: string;
    description: string | null;
    descriptionHtml: string | null;
    status: string;
    productType: string | null;
    vendor: string | null;
    tags: string[];
    onlineStoreUrl: string | null;
    category: {
      id: string;
      name: string;
      fullName: string;
    } | null;
    featuredImage: { url: string } | null;
    priceRangeV2: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    } | null;
  };
}

interface ProductVariantsQueryResponse {
  productVariants: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    edges: Array<{
      node: ShopifyVariantNode;
    }>;
  };
}

interface ShopQueryResponse {
  shop: {
    name: string;
    email: string;
    primaryDomain: {
      url: string;
    } | null;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SHOPIFY_API_VERSION = "2024-10";

const SHOP_QUERY = `
  query GetShop {
    shop {
      name
      email
      primaryDomain {
        url
      }
    }
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the Shopify GraphQL endpoint URL.
 */
function buildEndpoint(shopDomain: string): string {
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
 * Execute a GraphQL query against Shopify.
 */
async function executeQuery<T>(
  credentials: IntegrationCredentials,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphQLResponse<T>> {
  const { accessToken, shopDomain } = credentials;

  if (!accessToken || !shopDomain) {
    throw new Error(
      "Missing Shopify credentials: accessToken and shopDomain are required",
    );
  }

  const endpoint = buildEndpoint(shopDomain);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<ShopifyGraphQLResponse<T>>;
}

/**
 * Handle rate limiting by checking available query cost.
 * Returns delay in milliseconds if we need to wait.
 */
function calculateRateLimitDelay(
  extensions?: ShopifyGraphQLResponse<unknown>["extensions"],
): number {
  if (!extensions?.cost?.throttleStatus) return 0;

  const { currentlyAvailable, restoreRate } = extensions.cost.throttleStatus;
  const requestCost = extensions.cost.actualQueryCost;

  // If we have enough budget, no delay needed
  if (currentlyAvailable > requestCost * 2) return 0;

  // Calculate how long to wait to restore enough budget
  const needed = requestCost * 2 - currentlyAvailable;
  const delaySeconds = needed / restoreRate;

  return Math.ceil(delaySeconds * 1000);
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Test connection to Shopify.
 * Verifies credentials by fetching shop information.
 *
 * @returns Shop info if successful
 * @throws Error if connection fails
 */
export async function testConnection(
  credentials: IntegrationCredentials,
): Promise<{ shopName: string; email: string; domain: string | null }> {
  const result = await executeQuery<ShopQueryResponse>(credentials, SHOP_QUERY);

  if (result.errors?.length) {
    const errorMessages = result.errors.map((e) => e.message).join(", ");
    throw new Error(`Shopify API errors: ${errorMessages}`);
  }

  if (!result.data?.shop) {
    throw new Error("Failed to fetch shop information");
  }

  const { shop } = result.data;

  return {
    shopName: shop.name,
    email: shop.email,
    domain: shop.primaryDomain?.url ?? null,
  };
}

/**
 * Fetch product variants from Shopify.
 *
 * Returns an async generator that yields batches of variants.
 * Handles pagination automatically and respects rate limits.
 *
 * @param credentials - Shopify OAuth credentials
 * @param batchSize - Number of variants per batch (max 250, default 100)
 * @yields Batches of FetchedVariant objects
 */
export async function* fetchVariants(
  credentials: IntegrationCredentials,
  batchSize: number = SHOPIFY_BATCH_SIZE,
): AsyncGenerator<FetchedVariantBatch, void, undefined> {
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      first: Math.min(batchSize, 250), // Shopify max is 250
      after: cursor,
    };

    const result = await executeQuery<ProductVariantsQueryResponse>(
      credentials,
      SHOPIFY_PRODUCT_VARIANTS_QUERY,
      variables,
    );

    // Check for errors
    if (result.errors?.length) {
      const errorMessages = result.errors.map((e) => e.message).join(", ");
      throw new Error(`Shopify API errors: ${errorMessages}`);
    }

    if (!result.data?.productVariants) {
      throw new Error("Invalid response: missing productVariants data");
    }

    const { productVariants } = result.data;

    // Transform nodes to FetchedVariant format
    const batch: FetchedVariantBatch = productVariants.edges.map((edge) => {
      const node = edge.node;
      return {
        externalId: node.id,
        externalProductId: node.product.id,
        data: node as unknown as Record<string, unknown>,
      } satisfies FetchedVariant;
    });

    // Yield the batch
    if (batch.length > 0) {
      yield batch;
    }

    // Update pagination state
    hasNextPage = productVariants.pageInfo.hasNextPage;
    cursor = productVariants.pageInfo.endCursor;

    // Handle rate limiting
    const delay = calculateRateLimitDelay(result.extensions);
    if (delay > 0) {
      await sleep(delay);
    }
  }
}

/**
 * Count total variants in the Shopify store.
 * Useful for progress tracking.
 *
 * Note: Shopify doesn't provide a direct count endpoint,
 * so this is estimated from the first query's pagination info.
 */
export async function estimateVariantCount(
  credentials: IntegrationCredentials,
): Promise<number | null> {
  // Shopify doesn't provide a count endpoint for variants
  // We return null to indicate count is unknown
  // The sync engine will handle this by not showing percentage progress
  return null;
}

/**
 * Extract the numeric ID from a Shopify GID.
 * Example: "gid://shopify/ProductVariant/123456" → "123456"
 */
export function extractNumericId(gid: string): string | null {
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? null;
}
