/**
 * Mock Shopify API Utility
 *
 * Uses MSW (Mock Service Worker) to intercept Shopify GraphQL API calls.
 * Provides factory functions to create mock products and variants.
 *
 * @module @v1/testing/mocks/shopify
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// =============================================================================
// SHOPIFY TYPES
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

// =============================================================================
// MOCK DATA STATE
// =============================================================================

let mockProducts: ShopifyProductNode[] = [];
let mockProductCount: number | null = null;

/**
 * Set the mock products that will be returned by the Shopify API.
 */
export function setMockProducts(products: ShopifyProductNode[]): void {
    mockProducts = products;
    mockProductCount = products.length;
}

/**
 * Clear all mock products.
 */
export function clearMockProducts(): void {
    mockProducts = [];
    mockProductCount = null;
}

/**
 * Override the product count returned by the API.
 */
export function setMockProductCount(count: number): void {
    mockProductCount = count;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

let productIdCounter = 1000;
let variantIdCounter = 2000;

/**
 * Reset the ID counters. Useful for deterministic test output.
 */
export function resetMockIds(): void {
    productIdCounter = 1000;
    variantIdCounter = 2000;
}

/**
 * Create a mock Shopify variant.
 */
export function createMockVariant(
    overrides: Partial<ShopifyVariantNode> & { selectedOptions?: ShopifySelectedOption[] } = {}
): ShopifyVariantNode {
    const id = overrides.id ?? `gid://shopify/ProductVariant/${variantIdCounter++}`;

    return {
        id,
        sku: `SKU-${variantIdCounter}`,
        barcode: null,
        title: "Default Title",
        price: "29.99",
        compareAtPrice: null,
        selectedOptions: [],
        image: null,
        ...overrides,
    };
}

/**
 * Create a mock Shopify product with variants.
 */
export function createMockProduct(
    overrides: Partial<Omit<ShopifyProductNode, "variants">> & {
        variants?: ShopifyVariantNode[];
        options?: ShopifyProductOption[];
    } = {}
): ShopifyProductNode {
    const id = overrides.id ?? `gid://shopify/Product/${productIdCounter++}`;
    const title = overrides.title ?? "Test Product";
    const handle = overrides.handle ?? title.toLowerCase().replace(/\s+/g, "-");

    // Create default variant if none provided
    const variants = overrides.variants ?? [
        createMockVariant({ sku: `${handle.toUpperCase()}-001` }),
    ];

    const product: ShopifyProductNode = {
        id,
        handle,
        title,
        description: "A test product description",
        descriptionHtml: "<p>A test product description</p>",
        status: "ACTIVE",
        productType: null,
        vendor: null,
        tags: [],
        onlineStoreUrl: `https://test-shop.myshopify.com/products/${handle}`,
        category: null,
        featuredImage: null,
        priceRangeV2: { minVariantPrice: { amount: "29.99", currencyCode: "USD" } },
        options: overrides.options ?? null,
        variants: { edges: variants.map((v) => ({ node: v })) },
    };

    // Apply overrides except variants (already handled)
    return {
        ...product,
        ...overrides,
        variants: { edges: variants.map((v) => ({ node: v })) },
    };
}

// =============================================================================
// MSW HANDLERS
// =============================================================================

const handlers = [
    // Shopify GraphQL endpoint - intercept all queries
    http.post("https://*.myshopify.com/admin/api/*/graphql.json", async ({ request }) => {
        const body = (await request.json()) as { query: string; variables?: Record<string, unknown> };
        const query = body.query ?? "";

        // Handle product count query
        if (query.includes("productsCount")) {
            return HttpResponse.json({
                data: {
                    productsCount: {
                        count: mockProductCount ?? mockProducts.length,
                    },
                },
            });
        }

        // Handle shop query (for connection testing)
        if (query.includes("shop {")) {
            return HttpResponse.json({
                data: {
                    shop: {
                        name: "Test Shop",
                        primaryDomain: { url: "https://test-shop.myshopify.com" },
                    },
                },
            });
        }

        // Handle products query
        if (query.includes("products(")) {
            return HttpResponse.json({
                data: {
                    products: {
                        pageInfo: {
                            hasNextPage: false,
                            endCursor: null,
                        },
                        edges: mockProducts.map((product) => ({ node: product })),
                    },
                },
                extensions: {
                    cost: {
                        requestedQueryCost: 100,
                        actualQueryCost: 50,
                        throttleStatus: {
                            maximumAvailable: 2000,
                            currentlyAvailable: 1950,
                            restoreRate: 100,
                        },
                    },
                },
            });
        }

        // Unknown query - return empty response
        return HttpResponse.json({
            data: {},
            errors: [{ message: `Unknown query: ${query.substring(0, 50)}...` }],
        });
    }),
];

/**
 * MSW server instance.
 * Started in setup.ts, reset between tests.
 */
export const mockServer = setupServer(...handlers);
