/**
 * Product Fixtures for Bulk Import Tests
 *
 * Provides test product definitions for various import scenarios.
 * These can be used with ExcelBuilder to create test Excel files.
 *
 * @module @v1/testing/bulk-import/fixtures/product-fixtures
 */

import type { TestProduct, TestVariant } from "../excel-builder";

// ============================================================================
// Single Product Fixtures
// ============================================================================

/**
 * Basic single-variant product
 * Minimum viable product for import testing
 */
export const basicProduct: TestProduct = {
    handle: "basic-tshirt",
    title: "Basic T-Shirt",
    variants: [
        {
            sku: "BASIC-001",
            barcode: "1234567890123",
        },
    ],
};

/**
 * Product with all fields populated
 * Used to test full data extraction
 */
export const completeProduct: TestProduct = {
    handle: "complete-hoodie",
    title: "Complete Hoodie",
    manufacturer: "Premium Textiles Co",
    description: "A fully specified hoodie with all fields",
    image: "https://example.com/images/hoodie.jpg",
    status: "published",
    category: "Clothing",
    season: "FW25",
    tags: ["Bestseller", "New Arrival"],
    ecoClaims: ["GOTS Certified", "Fair Trade"],
    materials: [
        { name: "Organic Cotton", percentage: 80 },
        { name: "Recycled Polyester", percentage: 20 },
    ],
    environmental: {
        kilogramsCO2: 5.2,
        litersWaterUsed: 2700,
        carbonFootprint: "Low impact",
        gramsWeight: 450,
    },
    journey: {
        rawMaterial: "Cotton Farm Italy",
        weaving: "Textile Mill Portugal",
        dyeingPrinting: "Dyeing Factory Spain",
        stitching: "Stitching Workshop Poland",
        assembly: "Assembly Plant Germany",
        finishing: "Finishing Center Netherlands",
    },
    variants: [
        {
            sku: "HOODIE-S-BLK",
            barcode: "2234567890123",
            attributes: [
                { name: "Size", value: "S" },
                { name: "Color", value: "Black" },
            ],
        },
    ],
};

/**
 * Multi-variant product
 * Used to test Shopify-style row grouping
 */
export const multiVariantProduct: TestProduct = {
    handle: "multi-variant-tee",
    title: "Multi-Variant T-Shirt",
    manufacturer: "Eco Fashion Manufacturing",
    category: "Clothing",
    season: "SS26",
    materials: [{ name: "Cotton", percentage: 100 }],
    variants: [
        {
            sku: "TEE-S-RED",
            barcode: "3234567890123",
            attributes: [
                { name: "Size", value: "S" },
                { name: "Color", value: "Red" },
            ],
        },
        {
            sku: "TEE-M-RED",
            barcode: "3234567890124",
            attributes: [
                { name: "Size", value: "M" },
                { name: "Color", value: "Red" },
            ],
        },
        {
            sku: "TEE-L-RED",
            barcode: "3234567890125",
            attributes: [
                { name: "Size", value: "L" },
                { name: "Color", value: "Red" },
            ],
        },
        {
            sku: "TEE-S-BLUE",
            barcode: "3234567890126",
            attributes: [
                { name: "Size", value: "S" },
                { name: "Color", value: "Blue" },
            ],
        },
        {
            sku: "TEE-M-BLUE",
            barcode: "3234567890127",
            attributes: [
                { name: "Size", value: "M" },
                { name: "Color", value: "Blue" },
            ],
        },
    ],
};

/**
 * Product with variant-level overrides
 * Used to test child row override behavior
 */
export const productWithOverrides: TestProduct = {
    handle: "product-with-overrides",
    title: "Parent Product Title",
    description: "Parent description",
    image: "https://example.com/parent.jpg",
    category: "Clothing",
    materials: [{ name: "Cotton", percentage: 100 }],
    environmental: {
        kilogramsCO2: 3.0,
        gramsWeight: 200,
    },
    variants: [
        {
            // First variant inherits parent data
            sku: "OVERRIDE-001",
            barcode: "4234567890123",
            attributes: [{ name: "Size", value: "S" }],
        },
        {
            // Second variant has overrides
            sku: "OVERRIDE-002",
            barcode: "4234567890124",
            attributes: [{ name: "Size", value: "M" }],
            titleOverride: "Overridden Title",
            descriptionOverride: "Overridden description",
            imageOverride: "https://example.com/override.jpg",
            environmentalOverride: {
                gramsWeight: 220,
            },
        },
    ],
};

// ============================================================================
// Edge Case Products
// ============================================================================

/**
 * Product with minimal data (only required fields)
 */
export const minimalProduct: TestProduct = {
    handle: "minimal-product",
    title: "Minimal Product",
    variants: [
        {
            sku: "MIN-001",
            barcode: "5234567890123",
        },
    ],
};

/**
 * Product with SKU only (no barcode)
 */
export const skuOnlyProduct: TestProduct = {
    handle: "sku-only-product",
    title: "SKU Only Product",
    variants: [
        {
            sku: "SKU-ONLY-001",
        },
    ],
};

/**
 * Product with barcode only (no SKU)
 */
export const barcodeOnlyProduct: TestProduct = {
    handle: "barcode-only-product",
    title: "Barcode Only Product",
    variants: [
        {
            barcode: "6234567890123",
        },
    ],
};

/**
 * Product with special characters
 */
export const specialCharsProduct: TestProduct = {
    handle: "special-chars-product-2024",
    title: "Product with Special Chars: Café & Naïve",
    description: 'Description with "quotes" and <angles>',
    tags: ["Tag with; semicolon", "Tag/with/slashes"],
    variants: [
        {
            sku: "SPECIAL-001",
            barcode: "7234567890123",
        },
    ],
};

/**
 * Product with very long text fields
 */
export const longTextProduct: TestProduct = {
    handle: "long-text-product",
    title: "A".repeat(255), // Max length title
    description: "B".repeat(10000), // Very long description
    variants: [
        {
            sku: "LONG-001",
            barcode: "8234567890123",
        },
    ],
};

/**
 * Product with many variants (50)
 */
export function createManyVariantsProduct(variantCount = 50): TestProduct {
    const variants: TestVariant[] = [];
    for (let i = 1; i <= variantCount; i++) {
        variants.push({
            sku: `MANY-${String(i).padStart(3, "0")}`,
            barcode: `9${String(i).padStart(12, "0")}`,
            attributes: [
                { name: "Size", value: i <= 6 ? ["XS", "S", "M", "L", "XL", "XXL"][i - 1] || "M" : "M" },
                { name: "Color", value: `Color${i}` },
            ],
        });
    }

    return {
        handle: "many-variants-product",
        title: "Product with Many Variants",
        category: "Clothing",
        variants,
    };
}

// ============================================================================
// Invalid/Error Case Products
// ============================================================================

/**
 * Product missing required SKU/barcode
 * Used to test validation error handling
 */
export const missingIdentifierProduct: TestProduct = {
    handle: "missing-identifier",
    title: "Missing Identifier Product",
    variants: [
        {
            // No SKU or barcode
        },
    ],
};

/**
 * Product with duplicate SKUs within same product
 */
export const duplicateSkuProduct: TestProduct = {
    handle: "duplicate-sku-product",
    title: "Duplicate SKU Product",
    variants: [
        {
            sku: "DUP-SKU-001",
            barcode: "1111111111111",
        },
        {
            sku: "DUP-SKU-001", // Duplicate!
            barcode: "1111111111112",
        },
    ],
};

/**
 * Product with invalid material format
 */
export const invalidMaterialProduct: TestProduct = {
    handle: "invalid-material",
    title: "Invalid Material Product",
    materials: [
        { name: "Cotton", percentage: 150 }, // Invalid: >100%
    ],
    variants: [
        {
            sku: "INVALID-MAT-001",
            barcode: "1211111111111",
        },
    ],
};

// ============================================================================
// Product Sets (Multiple Products)
// ============================================================================

/**
 * Standard set of products for basic import tests
 */
export const standardProductSet: TestProduct[] = [
    basicProduct,
    multiVariantProduct,
    completeProduct,
];

/**
 * Products that should all import successfully
 */
export const validProductSet: TestProduct[] = [
    {
        handle: "valid-product-1",
        title: "Valid Product 1",
        category: "Clothing",
        variants: [{ sku: "VALID-001", barcode: "1000000000001" }],
    },
    {
        handle: "valid-product-2",
        title: "Valid Product 2",
        category: "Clothing",
        variants: [{ sku: "VALID-002", barcode: "1000000000002" }],
    },
    {
        handle: "valid-product-3",
        title: "Valid Product 3",
        category: "Accessories",
        variants: [{ sku: "VALID-003", barcode: "1000000000003" }],
    },
];

/**
 * Products for testing CREATE_AND_ENRICH mode
 * Contains entities that don't exist in catalog and should be auto-created
 */
export const enrichModeProducts: TestProduct[] = [
    {
        handle: "enrich-product-1",
        title: "Product Needing Enrichment",
        manufacturer: "New Manufacturer", // Should be auto-created
        season: "SS27", // Should be auto-created
        tags: ["NewTag1", "NewTag2"], // Should be auto-created
        materials: [
            { name: "New Material", percentage: 100 }, // Should be auto-created
        ],
        journey: {
            rawMaterial: "New Facility", // Should be auto-created
        },
        variants: [
            {
                sku: "ENRICH-001",
                barcode: "2000000000001",
                attributes: [
                    { name: "NewAttribute", value: "NewValue" }, // Should be auto-created
                ],
            },
        ],
    },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a batch of unique products
 * Useful for performance testing
 */
export function generateProductBatch(count: number, prefix = "BATCH"): TestProduct[] {
    const products: TestProduct[] = [];
    for (let i = 1; i <= count; i++) {
        products.push({
            handle: `${prefix.toLowerCase()}-product-${i}`,
            title: `${prefix} Product ${i}`,
            category: "Clothing",
            variants: [
                {
                    sku: `${prefix}-${String(i).padStart(4, "0")}`,
                    barcode: `${String(i).padStart(13, "0")}`,
                },
            ],
        });
    }
    return products;
}

/**
 * Clone a product with a new handle and variant identifiers
 * Useful for creating variations of test products
 */
export function cloneProduct(
    product: TestProduct,
    newHandle: string,
    skuPrefix: string
): TestProduct {
    return {
        ...product,
        handle: newHandle,
        variants: product.variants.map((v, i) => ({
            ...v,
            sku: v.sku ? `${skuPrefix}-${i + 1}` : undefined,
            barcode: v.barcode
                ? `${skuPrefix.replace(/\D/g, "") || "999"}${String(i + 1).padStart(10, "0")}`
                : undefined,
        })),
    };
}
