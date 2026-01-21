/**
 * Shopify API Client
 *
 * Handles communication with Shopify's GraphQL Admin API.
 * Includes configuration constants and API response types.
 */

import type {
  FetchedProduct,
  FetchedProductBatch,
  FetchedVariant,
  IntegrationCredentials,
} from "../../types";
import { SHOPIFY_PRODUCTS_QUERY } from "./schema";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Shopify GraphQL Admin API version to use.
 * @see https://shopify.dev/docs/api/usage/versioning
 */
export const SHOPIFY_API_VERSION = "2025-07";

/**
 * Default batch size for fetching variants.
 * Shopify allows up to 250 per request.
 * Using max for better performance - reduces API calls by 60%.
 */
export const SHOPIFY_BATCH_SIZE = 250;

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

// =============================================================================
// GRAPHQL TYPES
// =============================================================================

export interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown[] }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus?: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface ShopQueryResponse {
  shop: {
    name: string;
    primaryDomain: { url: string };
  };
}

// =============================================================================
// PRODUCT TYPES
// =============================================================================

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyProductOptionValue {
  id: string;
  name: string;
  linkedMetafieldValue: string | null;
  swatch: { color: string | null } | null;
}

export interface ShopifyProductOption {
  id: string;
  name: string;
  position: number;
  linkedMetafield: { namespace: string; key: string } | null;
  optionValues: ShopifyProductOptionValue[];
}

export interface ShopifyVariantNode {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  compareAtPrice: string | null;
  selectedOptions: ShopifySelectedOption[];
  image: { url: string } | null;
}

export interface ShopifyProductNode {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  status: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  onlineStoreUrl: string | null;
  category: { id: string; name: string; fullName: string } | null;
  featuredImage: { url: string } | null;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
  } | null;
  options: ShopifyProductOption[] | null;
  variants: { edges: Array<{ node: ShopifyVariantNode }> };
}

export interface ProductsQueryResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: ShopifyProductNode }>;
  };
}

// =============================================================================
// QUERY EXECUTION
// =============================================================================

async function executeQuery<T>(
  credentials: IntegrationCredentials,
  query: string,
  variables: Record<string, unknown>,
): Promise<ShopifyGraphQLResponse<T>> {
  const storeDomain = (credentials.storeDomain ??
    credentials.shopDomain) as string;
  const accessToken = credentials.accessToken as string;

  if (!storeDomain || !accessToken) {
    throw new Error(
      "Missing storeDomain/shopDomain or accessToken in credentials",
    );
  }

  const endpoint = buildShopifyEndpoint(storeDomain);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<ShopifyGraphQLResponse<T>>;
}

// =============================================================================
// CONNECTION TESTING
// =============================================================================

const SHOP_QUERY = "query { shop { name primaryDomain { url } } }";

export async function testConnection(
  credentials: IntegrationCredentials,
): Promise<{ shopName: string; domain: string }> {
  const result = await executeQuery<ShopQueryResponse>(
    credentials,
    SHOP_QUERY,
    {},
  );

  if (result.errors?.length) {
    const errorMessages = result.errors.map((e) => e.message).join(", ");
    throw new Error(`Shopify API errors: ${errorMessages}`);
  }

  if (!result.data?.shop) {
    throw new Error("Invalid response: missing shop data");
  }

  return {
    shopName: result.data.shop.name,
    domain: result.data.shop.primaryDomain.url,
  };
}

// =============================================================================
// PRODUCT FETCHING
// =============================================================================

/**
 * Fetch products with nested variants from Shopify.
 * Yields batches of products with their variants embedded.
 */
export async function* fetchProducts(
  credentials: IntegrationCredentials,
  batchSize: number = SHOPIFY_BATCH_SIZE,
): AsyncGenerator<FetchedProductBatch, void, undefined> {
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      first: Math.min(batchSize, 250),
      after: cursor,
    };

    const result = await executeQuery<ProductsQueryResponse>(
      credentials,
      SHOPIFY_PRODUCTS_QUERY,
      variables,
    );

    if (result.errors?.length) {
      const errorMessages = result.errors.map((e) => e.message).join(", ");
      throw new Error(`Shopify API errors: ${errorMessages}`);
    }

    if (!result.data?.products) {
      throw new Error("Invalid response: missing products data");
    }

    const { products } = result.data;

    const batch: FetchedProductBatch = products.edges.map((edge) => {
      const productNode = edge.node;

      const variants: FetchedVariant[] = productNode.variants.edges.map(
        (variantEdge) => ({
          externalId: variantEdge.node.id,
          externalProductId: productNode.id,
          data: variantEdge.node as unknown as Record<string, unknown>,
        }),
      );

      return {
        externalId: productNode.id,
        data: productNode as unknown as Record<string, unknown>,
        variants,
      } satisfies FetchedProduct;
    });

    if (batch.length > 0) {
      yield batch;
    }

    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;

    // Rate limiting
    const delay = calculateRateLimitDelay(result.extensions);
    if (delay > 0) {
      await sleep(delay);
    }
  }
}

// =============================================================================
// COUNTING
// =============================================================================

const PRODUCT_COUNT_QUERY = "query { productsCount(limit: null) { count } }";

interface ProductCountResponse {
  productsCount: { count: number };
}

/**
 * Get the total product count from Shopify.
 */
export async function getProductCount(
  credentials: IntegrationCredentials,
): Promise<number> {
  const result = await executeQuery<ProductCountResponse>(
    credentials,
    PRODUCT_COUNT_QUERY,
    {},
  );

  if (result.errors?.length) {
    // Fall back to unknown if count query fails (older API versions)
    return -1;
  }

  return result.data?.productsCount?.count ?? -1;
}

// =============================================================================
// HELPERS
// =============================================================================

function extractNumericId(gid: string): string {
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? gid;
}

function calculateRateLimitDelay(extensions?: {
  cost?: {
    throttleStatus?: { currentlyAvailable: number; restoreRate: number };
  };
}): number {
  const status = extensions?.cost?.throttleStatus;
  if (!status) return 0;

  if (status.currentlyAvailable < 100) {
    const deficit = 100 - status.currentlyAvailable;
    return Math.ceil((deficit / status.restoreRate) * 1000);
  }
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
