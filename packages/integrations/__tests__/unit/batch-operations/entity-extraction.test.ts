/**
 * Unit Tests: Batch Entity Extraction (P1)
 *
 * Tests for extractUniqueEntitiesFromBatch() function.
 * This function extracts unique entities (tags, attributes, values) from product batches.
 */

import { describe, expect, test } from "bun:test";
import {
    extractUniqueEntitiesFromBatch,
    type ExtractedEntities,
} from "../../../src/sync/batch-operations";
import type { EffectiveFieldMapping } from "../../../src/sync/processor";
import type { FetchedProduct, FetchedProductBatch } from "../../../src/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a minimal product for testing
 */
function createProduct(
    externalId: string,
    data: Record<string, unknown>,
    variants: Array<{ externalId: string; data: Record<string, unknown> }> = []
): FetchedProduct {
    return {
        externalId,
        data,
        variants: variants.map((v) => ({
            externalId: v.externalId,
            externalProductId: externalId,
            data: v.data,
        })),
    };
}

/**
 * Create field mappings for testing
 */
function createMappings(options: {
    tags?: boolean;
    attributes?: boolean;
}): EffectiveFieldMapping[] {
    const mappings: EffectiveFieldMapping[] = [];

    // Always include basic product mapping
    mappings.push({
        fieldKey: "product.name",
        sourceKey: "title",
        definition: {
            targetField: "product.name",
            entity: "product",
            sourceOptions: [{ key: "title", label: "Title", path: "title" }],
            defaultSource: "title",
        },
    });

    if (options.tags) {
        mappings.push({
            fieldKey: "product.tags",
            sourceKey: "tags",
            definition: {
                targetField: "product.tags",
                entity: "product",
                sourceOptions: [
                    {
                        key: "tags",
                        label: "Tags",
                        path: "tags",
                        transform: (v: unknown) =>
                            Array.isArray(v) ? v.map((t) => String(t).trim()).filter(Boolean) : [],
                    },
                ],
                defaultSource: "tags",
                isRelation: true,
                relationType: "tags",
            },
        });
    }

    if (options.attributes) {
        mappings.push({
            fieldKey: "variant.attributes",
            sourceKey: "selectedOptions",
            definition: {
                targetField: "variant.attributes",
                entity: "variant",
                sourceOptions: [
                    { key: "selectedOptions", label: "Options", path: "selectedOptions" },
                ],
                defaultSource: "selectedOptions",
            },
        });
    }

    return mappings;
}

// =============================================================================
// 8.1 extractUniqueEntitiesFromBatch() Tests
// =============================================================================

describe("extractUniqueEntitiesFromBatch()", () => {
    test("single product, single tag extracted", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1", tags: ["summer"] }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        expect(result.tags.has("summer")).toBe(true);
        expect(result.tags.size).toBe(1);
    });

    test("multiple products, duplicate tags deduplicated", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1", tags: ["summer"] }),
            createProduct("p2", { title: "Product 2", tags: ["summer"] }),
            createProduct("p3", { title: "Product 3", tags: ["summer", "sports"] }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        // "summer" appears 3 times but should only be in set once
        expect(result.tags.has("summer")).toBe(true);
        expect(result.tags.has("sports")).toBe(true);
        expect(result.tags.size).toBe(2);
    });

    test("single attribute extracted", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1", options: [] }, [
                {
                    externalId: "v1",
                    data: { selectedOptions: [{ name: "Size", value: "M" }] },
                },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        expect(result.attributeNames.has("Size")).toBe(true);
        expect(result.attributeNames.size).toBe(1);
    });

    test("multiple attribute values collected per attribute", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1" }, [
                {
                    externalId: "v1",
                    data: { selectedOptions: [{ name: "Size", value: "S" }] },
                },
                {
                    externalId: "v2",
                    data: { selectedOptions: [{ name: "Size", value: "M" }] },
                },
                {
                    externalId: "v3",
                    data: { selectedOptions: [{ name: "Size", value: "L" }] },
                },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        const sizeValues = result.attributeValuesByName.get("Size");
        expect(sizeValues?.has("S")).toBe(true);
        expect(sizeValues?.has("M")).toBe(true);
        expect(sizeValues?.has("L")).toBe(true);
        expect(sizeValues?.size).toBe(3);
    });

    test("attribute taxonomy hints preserved", () => {
        const batch: FetchedProductBatch = [
            createProduct(
                "p1",
                {
                    title: "Product 1",
                    options: [
                        {
                            name: "Size",
                            linkedMetafield: { namespace: "shopify", key: "size" },
                        },
                    ],
                },
                [
                    {
                        externalId: "v1",
                        data: {
                            selectedOptions: [{ name: "Size", value: "M" }],
                            product: {
                                options: [
                                    {
                                        name: "Size",
                                        linkedMetafield: { namespace: "shopify", key: "size" },
                                    },
                                ],
                            },
                        },
                    },
                ]
            ),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        expect(result.attributeTaxonomyHints.get("Size")).toBe("size");
    });

    test("empty batch returns empty sets", () => {
        const result = extractUniqueEntitiesFromBatch(
            [],
            createMappings({ tags: true, attributes: true })
        );

        expect(result.tags.size).toBe(0);
        expect(result.productIds.size).toBe(0);
        expect(result.variantIds.size).toBe(0);
        expect(result.attributeNames.size).toBe(0);
        expect(result.attributeValuesByName.size).toBe(0);
    });

    test("products without tags returns empty tags set", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1" }),
            createProduct("p2", { title: "Product 2" }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        expect(result.tags.size).toBe(0);
    });

    test("simple variants without attributes returns empty attribute maps", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1" }, [
                { externalId: "v1", data: {} },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        expect(result.attributeNames.size).toBe(0);
        expect(result.attributeValuesByName.size).toBe(0);
    });

    test("mixed content: tags + attributes + values all collected", () => {
        const batch: FetchedProductBatch = [
            createProduct(
                "p1",
                { title: "Product 1", tags: ["summer", "sports"] },
                [
                    {
                        externalId: "v1",
                        data: {
                            selectedOptions: [
                                { name: "Color", value: "Red" },
                                { name: "Size", value: "M" },
                            ],
                        },
                    },
                ]
            ),
            createProduct("p2", { title: "Product 2", tags: ["winter"] }, [
                {
                    externalId: "v2",
                    data: {
                        selectedOptions: [
                            { name: "Color", value: "Blue" },
                            { name: "Size", value: "L" },
                        ],
                    },
                },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ tags: true, attributes: true })
        );

        // Tags
        expect(result.tags.size).toBe(3);
        expect(result.tags.has("summer")).toBe(true);
        expect(result.tags.has("sports")).toBe(true);
        expect(result.tags.has("winter")).toBe(true);

        // Attributes
        expect(result.attributeNames.has("Color")).toBe(true);
        expect(result.attributeNames.has("Size")).toBe(true);

        // Attribute values
        const colorValues = result.attributeValuesByName.get("Color");
        expect(colorValues?.has("Red")).toBe(true);
        expect(colorValues?.has("Blue")).toBe(true);

        const sizeValues = result.attributeValuesByName.get("Size");
        expect(sizeValues?.has("M")).toBe(true);
        expect(sizeValues?.has("L")).toBe(true);

        // Product/Variant IDs
        expect(result.productIds.has("p1")).toBe(true);
        expect(result.productIds.has("p2")).toBe(true);
        expect(result.variantIds.has("v1")).toBe(true);
        expect(result.variantIds.has("v2")).toBe(true);
    });

    test("product IDs tracked", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1" }),
            createProduct("p2", { title: "Product 2" }),
            createProduct("p3", { title: "Product 3" }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({}));

        expect(result.productIds.size).toBe(3);
        expect(result.productIds.has("p1")).toBe(true);
        expect(result.productIds.has("p2")).toBe(true);
        expect(result.productIds.has("p3")).toBe(true);
    });

    test("variant IDs tracked", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1" }, [
                { externalId: "v1", data: {} },
                { externalId: "v2", data: {} },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({}));

        expect(result.variantIds.size).toBe(2);
        expect(result.variantIds.has("v1")).toBe(true);
        expect(result.variantIds.has("v2")).toBe(true);
    });

    test("whitespace-only tags filtered", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "Product 1", tags: ["summer", "  ", "sports", ""] }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        expect(result.tags.size).toBe(2);
        expect(result.tags.has("summer")).toBe(true);
        expect(result.tags.has("sports")).toBe(true);
    });
});

// =============================================================================
// 8.2 Entity Deduplication Tests
// =============================================================================

describe("Entity Deduplication", () => {
    test("case-sensitive tags (no normalization in extraction)", () => {
        // Note: Tags are stored as-is during extraction
        // Normalization happens at cache lookup (lowercase)
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "P1", tags: ["Summer"] }),
            createProduct("p2", { title: "P2", tags: ["SUMMER"] }),
            createProduct("p3", { title: "P3", tags: ["summer"] }),
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        // All three are distinct in the Set (case-sensitive)
        expect(result.tags.size).toBe(3);
        expect(result.tags.has("Summer")).toBe(true);
        expect(result.tags.has("SUMMER")).toBe(true);
        expect(result.tags.has("summer")).toBe(true);
    });

    test("attributes are case-sensitive in Set", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "P1" }, [
                { externalId: "v1", data: { selectedOptions: [{ name: "Color", value: "Red" }] } },
            ]),
            createProduct("p2", { title: "P2" }, [
                { externalId: "v2", data: { selectedOptions: [{ name: "color", value: "Blue" }] } },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        // Case-sensitive: "Color" and "color" are different
        expect(result.attributeNames.size).toBe(2);
        expect(result.attributeNames.has("Color")).toBe(true);
        expect(result.attributeNames.has("color")).toBe(true);
    });

    test("duplicate attribute values within same attribute deduplicated", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "P1" }, [
                { externalId: "v1", data: { selectedOptions: [{ name: "Color", value: "Red" }] } },
                { externalId: "v2", data: { selectedOptions: [{ name: "Color", value: "Red" }] } },
                { externalId: "v3", data: { selectedOptions: [{ name: "Color", value: "Blue" }] } },
            ]),
        ];

        const result = extractUniqueEntitiesFromBatch(
            batch,
            createMappings({ attributes: true })
        );

        const colorValues = result.attributeValuesByName.get("Color");
        expect(colorValues?.size).toBe(2);
        expect(colorValues?.has("Red")).toBe(true);
        expect(colorValues?.has("Blue")).toBe(true);
    });

    test("cross-product deduplication", () => {
        const batch: FetchedProductBatch = [
            createProduct("p1", { title: "P1", tags: ["sale"] }),
            createProduct("p2", { title: "P2", tags: ["other"] }),
            createProduct("p3", { title: "P3", tags: ["sale"] }), // Duplicate
        ];

        const result = extractUniqueEntitiesFromBatch(batch, createMappings({ tags: true }));

        expect(result.tags.size).toBe(2);
        expect(result.tags.has("sale")).toBe(true);
        expect(result.tags.has("other")).toBe(true);
    });
});
