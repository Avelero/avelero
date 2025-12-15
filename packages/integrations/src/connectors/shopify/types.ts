/**
 * Shopify-specific Types
 *
 * Type definitions for Shopify GraphQL API responses.
 */

/**
 * Shopify GraphQL response wrapper.
 */
export interface ShopifyGraphQLResponse<T> {
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

/**
 * Shopify product variant from GraphQL response.
 */
export interface ShopifyVariantNode {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  compareAtPrice: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  image: { url: string } | null;
  product: ShopifyProductNode;
}

/**
 * Shopify linked metafield - identifies option type (color-pattern, size, etc.)
 */
export interface ShopifyLinkedMetafield {
  namespace: string | null;
  key: string | null;
}

/**
 * Shopify swatch - contains hex color value for color options
 */
export interface ShopifySwatch {
  /** Hex color value like "#FF8A00" */
  color: string | null;
  /** Optional image swatch */
  image: { id: string } | null;
}

/**
 * Shopify product option value (e.g., "Red", "Blue", "XS", "M")
 */
export interface ShopifyProductOptionValue {
  id: string;
  name: string;
  /** GID to the linked metaobject */
  linkedMetafieldValue: string | null;
  /** Swatch with color hex value */
  swatch: ShopifySwatch | null;
}

/**
 * Shopify product option (e.g., "Color", "Size")
 */
export interface ShopifyProductOption {
  id: string;
  name: string;
  /** Position 1, 2, or 3 */
  position: number;
  /** Identifies option type: "color-pattern", "size", etc. */
  linkedMetafield: ShopifyLinkedMetafield | null;
  /** Option values with swatches and ordering */
  optionValues: ShopifyProductOptionValue[];
  /** Simple string values */
  values: string[];
}

/**
 * Shopify product from GraphQL response.
 */
export interface ShopifyProductNode {
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
  /** Product options with linked metafields and swatches */
  options: ShopifyProductOption[] | null;
}

/**
 * Response type for productVariants query.
 */
export interface ProductVariantsQueryResponse {
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

/**
 * Response type for shop query.
 */
export interface ShopQueryResponse {
  shop: {
    name: string;
    email: string;
    primaryDomain: {
      url: string;
    } | null;
  };
}

/**
 * Selected option from Shopify variant.
 */
export interface ShopifySelectedOption {
  name: string;
  value: string;
}

