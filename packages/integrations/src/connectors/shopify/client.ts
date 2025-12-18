/**
 * Shopify API Client
 *
 * Handles communication with Shopify's GraphQL Admin API.
 */

import type {
  FetchedProduct,
  FetchedProductBatch,
  FetchedVariant,
  IntegrationCredentials,
} from "../../sync/types.ts";
import { buildShopifyEndpoint, SHOPIFY_BATCH_SIZE } from "./config";
import { SHOPIFY_PRODUCTS_QUERY } from "./schema";
import type {
  ProductsQueryResponse,
  ShopifyGraphQLResponse,
  ShopQueryResponse,
} from "./types.ts";

// =============================================================================
// QUERY EXECUTION
// =============================================================================

async function executeQuery<T>(
  credentials: IntegrationCredentials,
  query: string,
  variables: Record<string, unknown>
): Promise<ShopifyGraphQLResponse<T>> {
  const storeDomain = (credentials.storeDomain ?? credentials.shopDomain) as string;
  const accessToken = credentials.accessToken as string;
  
  if (!storeDomain || !accessToken) {
    throw new Error("Missing storeDomain/shopDomain or accessToken in credentials");
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
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ShopifyGraphQLResponse<T>>;
}

// =============================================================================
// CONNECTION TESTING
// =============================================================================

const SHOP_QUERY = "query { shop { name primaryDomain { url } } }";

export async function testConnection(
  credentials: IntegrationCredentials
): Promise<{ shopName: string; domain: string }> {
  const result = await executeQuery<ShopQueryResponse>(credentials, SHOP_QUERY, {});

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
  batchSize: number = SHOPIFY_BATCH_SIZE
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
      variables
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

      const variants: FetchedVariant[] = productNode.variants.edges.map((variantEdge) => ({
        externalId: variantEdge.node.id,
        externalProductId: productNode.id,
        data: variantEdge.node as unknown as Record<string, unknown>,
      }));

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

const PRODUCT_COUNT_QUERY = "query { productsCount { count } }";

interface ProductCountResponse {
  productsCount: { count: number };
}

/**
 * Get the total product count from Shopify.
 */
export async function getProductCount(
  credentials: IntegrationCredentials
): Promise<number> {
  const result = await executeQuery<ProductCountResponse>(
    credentials,
    PRODUCT_COUNT_QUERY,
    {}
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

export function extractNumericId(gid: string): string {
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? gid;
}

function calculateRateLimitDelay(
  extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } }
): number {
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
