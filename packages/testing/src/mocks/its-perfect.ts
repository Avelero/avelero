/**
 * Mock It's Perfect API Utility
 *
 * Uses MSW (Mock Service Worker) to intercept It's Perfect API calls.
 * Provides factory functions to create mock products and variants.
 *
 * NOTE: This is a placeholder mock that mirrors the Shopify structure.
 * When the actual It's Perfect integration is built, update this file
 * to match the real API response format.
 *
 * @module @v1/testing/mocks/its-perfect
 */

import { http, HttpResponse } from "msw";

// =============================================================================
// IT'S PERFECT TYPES (Placeholder - update when real API is known)
// =============================================================================

export interface ItsPerfectAttribute {
    name: string;
    value: string;
}

export interface ItsPerfectVariant {
    id: string;
    sku: string | null;
    barcode: string | null;
    title: string;
    price: string | null;
    currency: string | null;
    attributes: ItsPerfectAttribute[];
    /** Material breakdown - unique to It's Perfect */
    materials: Array<{ name: string; percentage: number }> | null;
    /** Weight data - unique to It's Perfect */
    weight: { value: number; unit: string } | null;
}

export interface ItsPerfectProduct {
    id: string;
    articleNumber: string;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    variants: ItsPerfectVariant[];
    /** Sustainability data - unique to It's Perfect */
    sustainabilityScore: number | null;
    /** Origin country - unique to It's Perfect */
    originCountry: string | null;
}

// =============================================================================
// MOCK DATA STATE
// =============================================================================

let mockProducts: ItsPerfectProduct[] = [];
let mockProductCount: number | null = null;

/**
 * Set the mock products that will be returned by the It's Perfect API.
 */
export function setItsPerfectMockProducts(products: ItsPerfectProduct[]): void {
    mockProducts = products;
    mockProductCount = products.length;
}

/**
 * Clear all mock products.
 */
export function clearItsPerfectMockProducts(): void {
    mockProducts = [];
    mockProductCount = null;
}

/**
 * Override the product count returned by the API.
 */
export function setItsPerfectMockProductCount(count: number): void {
    mockProductCount = count;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

let productIdCounter = 5000;
let variantIdCounter = 6000;

/**
 * Reset the ID counters. Useful for deterministic test output.
 */
export function resetItsPerfectMockIds(): void {
    productIdCounter = 5000;
    variantIdCounter = 6000;
}

/**
 * Create a mock It's Perfect variant.
 */
export function createItsPerfectMockVariant(
    overrides: Partial<ItsPerfectVariant> = {}
): ItsPerfectVariant {
    const currentId = variantIdCounter++;
    const id = overrides.id ?? `itsp-variant-${currentId}`;

    return {
        id,
        sku: overrides.sku ?? `ITSP-SKU-${currentId}`,
        barcode: null,
        title: "Default Variant",
        price: "49.99",
        currency: "EUR",
        attributes: [],
        materials: null,
        weight: null,
        ...overrides,
    };
}

/**
 * Create a mock It's Perfect product with variants.
 */
export function createItsPerfectMockProduct(
    overrides: Partial<Omit<ItsPerfectProduct, "variants">> & {
        variants?: ItsPerfectVariant[];
    } = {}
): ItsPerfectProduct {
    const currentId = productIdCounter++;
    const id = overrides.id ?? `itsp-product-${currentId}`;
    const name = overrides.name ?? "Test It's Perfect Product";
    const articleNumber = overrides.articleNumber ?? `ART-${currentId}`;

    // Create default variant if none provided
    const variants = overrides.variants ?? [
        createItsPerfectMockVariant({ sku: `${articleNumber}-001` }),
    ];

    return {
        id,
        articleNumber,
        name,
        description: "A test product from It's Perfect",
        brand: null,
        category: null,
        sustainabilityScore: null,
        originCountry: null,
        ...overrides,
        variants,
    };
}

// =============================================================================
// HELPER: Transform It's Perfect format to Avelero FetchedProduct format
// =============================================================================

/**
 * Transform an It's Perfect product to the internal FetchedProduct format
 * used by the sync engine. This mimics what a real It's Perfect fetcher would do.
 */
export function toFetchedProduct(product: ItsPerfectProduct) {
    return {
        externalId: product.id,
        data: {
            id: product.id,
            articleNumber: product.articleNumber,
            name: product.name,
            description: product.description,
            brand: product.brand,
            category: product.category,
            sustainabilityScore: product.sustainabilityScore,
            originCountry: product.originCountry,
        },
        variants: product.variants.map((v) => ({
            externalId: v.id,
            data: {
                id: v.id,
                sku: v.sku,
                barcode: v.barcode,
                title: v.title,
                price: v.price,
                currency: v.currency,
                selectedOptions: v.attributes.map((a) => ({
                    name: a.name,
                    value: a.value,
                })),
                materials: v.materials,
                weight: v.weight,
            },
        })),
    };
}

// =============================================================================
// MSW HANDLERS (Placeholder for future real API integration)
// =============================================================================

/**
 * Create MSW handlers for It's Perfect API.
 * TODO: Update this when the real It's Perfect API format is known.
 */
export function createItsPerfectHandlers(baseUrl: string = "https://api.its-perfect.example.com") {
    return [
        // Products list endpoint
        http.get(`${baseUrl}/products`, () => {
            return HttpResponse.json({
                data: mockProducts,
                meta: {
                    total: mockProductCount ?? mockProducts.length,
                    page: 1,
                    perPage: 100,
                },
            });
        }),

        // Single product endpoint
        http.get(`${baseUrl}/products/:id`, ({ params }) => {
            const product = mockProducts.find((p) => p.id === params.id);
            if (!product) {
                return HttpResponse.json({ error: "Product not found" }, { status: 404 });
            }
            return HttpResponse.json({ data: product });
        }),

        // Product count endpoint
        http.get(`${baseUrl}/products/count`, () => {
            return HttpResponse.json({
                count: mockProductCount ?? mockProducts.length,
            });
        }),
    ];
}

// =============================================================================
// MOCK CONNECTOR FOR TESTING
// =============================================================================

/**
 * Mock It's Perfect schema for testing.
 */
const mockItsPerfectSchema = {
    slug: "its-perfect",
    name: "It's Perfect",
    description: "PLM system mock for testing",
    authType: "api_key" as const,
    entities: {
        variant: {
            table: "product_variants",
            identifiedBy: ["sku", "barcode"],
            primaryIdentifier: "sku",
        },
        product: {
            table: "products",
            identifiedBy: "productHandle",
            linkedThrough: "variant" as const,
        },
    },
    fields: {
        "variant.sku": {
            targetField: "variant.sku",
            entity: "variant" as const,
            description: "SKU",
            alwaysEnabled: true,
            sourceOptions: [{ key: "sku", label: "SKU", path: "sku" }],
            defaultSource: "sku",
        },
        "variant.barcode": {
            targetField: "variant.barcode",
            entity: "variant" as const,
            description: "Barcode",
            alwaysEnabled: true,
            sourceOptions: [{ key: "barcode", label: "Barcode", path: "barcode" }],
            defaultSource: "barcode",
        },
        "product.name": {
            targetField: "product.name",
            entity: "product" as const,
            description: "Product name",
            sourceOptions: [{ key: "name", label: "Name", path: "name" }],
            defaultSource: "name",
        },
    },
};

/**
 * Fetch products generator for mock It's Perfect.
 * Returns mock products in FetchedProduct format.
 */
async function* mockFetchProducts(
    _credentials: unknown,
    _batchSize?: number
): AsyncGenerator<Array<{
    externalId: string;
    data: Record<string, unknown>;
    variants: Array<{
        externalId: string;
        externalProductId: string;
        data: Record<string, unknown>;
    }>;
}>, void, undefined> {
    // Yield all mock products as a single batch
    const batch = mockProducts.map((product) => ({
        externalId: product.id,
        data: {
            id: product.id,
            articleNumber: product.articleNumber,
            name: product.name,
            title: product.name, // For compatibility with extractProductData
            description: product.description,
            brand: product.brand,
            category: product.category,
            sustainabilityScore: product.sustainabilityScore,
            originCountry: product.originCountry,
        },
        variants: product.variants.map((v) => ({
            externalId: v.id,
            externalProductId: product.id,
            data: {
                id: v.id,
                sku: v.sku,
                barcode: v.barcode,
                title: v.title,
                price: v.price,
                currency: v.currency,
                selectedOptions: v.attributes.map((a) => ({
                    name: a.name,
                    value: a.value,
                })),
                materials: v.materials,
                weight: v.weight,
            },
        })),
    }));

    if (batch.length > 0) {
        yield batch;
    }
}

/**
 * Mock test connection for It's Perfect.
 */
async function mockTestConnection(_credentials: unknown): Promise<{ name: string }> {
    return { name: "Mock It's Perfect" };
}

/**
 * Mock get product count for It's Perfect.
 */
async function mockGetProductCount(_credentials: unknown): Promise<number> {
    return mockProducts.length;
}

/**
 * Get a mock It's Perfect connector that can be registered for testing.
 * 
 * @example
 * ```ts
 * import { getMockItsPerfectConnector } from "@v1/testing/mocks/its-perfect";
 * import { registerConnector } from "@v1/integrations";
 * 
 * // In test setup:
 * registerConnector(getMockItsPerfectConnector());
 * ```
 */
export function getMockItsPerfectConnector() {
    return {
        slug: "its-perfect",
        schema: mockItsPerfectSchema,
        testConnection: mockTestConnection,
        fetchProducts: mockFetchProducts,
        getProductCount: mockGetProductCount,
    };
}

