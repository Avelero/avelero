/**
 * Shopify API Types
 */

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
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } } | null;
  options: ShopifyProductOption[] | null;
  variants: { edges: Array<{ node: ShopifyVariantNode }> };
}

export interface ProductsQueryResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: ShopifyProductNode }>;
  };
}
