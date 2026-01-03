/**
 * Unit Tests: Field Mapping (P0)
 *
 * Tests for buildEffectiveFieldMappings() and isFieldEnabled() functions.
 * These are pure functions that build field mappings from schema and config.
 */

import { describe, expect, test } from "bun:test";
import {
    buildEffectiveFieldMappings,
    type EffectiveFieldMapping,
} from "../../../src/sync/processor";
import type { ConnectorSchema, FieldConfig } from "../../../src/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a minimal ConnectorSchema for testing
 */
const createTestSchema = (
    fields: Record<
        string,
        {
            entity: "product" | "variant";
            defaultSource: string;
            sources?: Array<{ key: string; path: string; label: string }>;
        }
    >
): ConnectorSchema => ({
    slug: "test",
    name: "Test Connector",
    description: "Test connector for unit tests",
    authType: "oauth",
    entities: {
        variant: { table: "product_variants", identifiedBy: "sku" },
        product: { table: "products", identifiedBy: "productHandle" },
    },
    fields: Object.fromEntries(
        Object.entries(fields).map(([key, def]) => [
            key,
            {
                targetField: key,
                entity: def.entity,
                sourceOptions: def.sources ?? [
                    { key: def.defaultSource, label: "Default", path: def.defaultSource },
                ],
                defaultSource: def.defaultSource,
            },
        ])
    ),
});

/**
 * Check if a specific field key is in the effective mappings
 */
const isFieldEnabled = (
    mappings: EffectiveFieldMapping[],
    fieldKey: string
): boolean => {
    return mappings.some((m) => m.fieldKey === fieldKey);
};

// =============================================================================
// 2.1 buildEffectiveFieldMappings() Tests
// =============================================================================

describe("buildEffectiveFieldMappings()", () => {
    test("all fields enabled by default when no configs provided", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
            "product.description": { entity: "product", defaultSource: "description" },
            "variant.sku": { entity: "variant", defaultSource: "sku" },
        });

        const mappings = buildEffectiveFieldMappings(schema, []);

        expect(mappings.length).toBe(3);
        expect(isFieldEnabled(mappings, "product.name")).toBe(true);
        expect(isFieldEnabled(mappings, "product.description")).toBe(true);
        expect(isFieldEnabled(mappings, "variant.sku")).toBe(true);
    });

    test("field explicitly disabled is excluded", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
            "product.description": { entity: "product", defaultSource: "description" },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.name", isEnabled: true, selectedSource: null },
            { fieldKey: "product.description", isEnabled: false, selectedSource: null },
        ];

        const mappings = buildEffectiveFieldMappings(schema, configs);

        expect(isFieldEnabled(mappings, "product.name")).toBe(true);
        expect(isFieldEnabled(mappings, "product.description")).toBe(false);
    });

    test("field explicitly enabled is included with config source", () => {
        const schema = createTestSchema({
            "product.description": {
                entity: "product",
                defaultSource: "description",
                sources: [
                    { key: "description", path: "description", label: "Plain Text" },
                    { key: "descriptionHtml", path: "descriptionHtml", label: "HTML" },
                ],
            },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.description", isEnabled: true, selectedSource: "descriptionHtml" },
        ];

        const mappings = buildEffectiveFieldMappings(schema, configs);

        expect(mappings.length).toBe(1);
        expect(mappings[0]?.sourceKey).toBe("descriptionHtml");
    });

    test("custom source selected when config specifies selectedSource", () => {
        const schema = createTestSchema({
            "product.name": {
                entity: "product",
                defaultSource: "title",
                sources: [
                    { key: "title", path: "title", label: "Title" },
                    { key: "handle", path: "handle", label: "Handle" },
                ],
            },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.name", isEnabled: true, selectedSource: "handle" },
        ];

        const mappings = buildEffectiveFieldMappings(schema, configs);

        expect(mappings.length).toBe(1);
        expect(mappings[0]?.sourceKey).toBe("handle");
    });

    test("unconfigured field is excluded when other configs provided", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
            "variant.sku": { entity: "variant", defaultSource: "sku" },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.name", isEnabled: true, selectedSource: null },
            // No config for variant.sku
        ];

        const mappings = buildEffectiveFieldMappings(schema, configs);

        // When at least one config is provided, only configured fields are included
        const skuMapping = mappings.find((m) => m.fieldKey === "variant.sku");
        // variant.sku should NOT be included since there's a config array but no config for this field
        expect(skuMapping).toBeUndefined();
    });

    test("mixed configurations - some enabled, some disabled", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
            "product.description": { entity: "product", defaultSource: "description" },
            "product.imagePath": { entity: "product", defaultSource: "image" },
            "variant.sku": { entity: "variant", defaultSource: "sku" },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.name", isEnabled: true, selectedSource: null },
            { fieldKey: "product.description", isEnabled: false, selectedSource: null },
            { fieldKey: "product.imagePath", isEnabled: true, selectedSource: null },
            // No config for variant.sku
        ];

        const mappings = buildEffectiveFieldMappings(schema, configs);

        expect(isFieldEnabled(mappings, "product.name")).toBe(true);
        expect(isFieldEnabled(mappings, "product.description")).toBe(false);
        expect(isFieldEnabled(mappings, "product.imagePath")).toBe(true);
        expect(isFieldEnabled(mappings, "variant.sku")).toBe(false);
    });

    test("unknown field in config is ignored (no error)", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
        });

        const configs: FieldConfig[] = [
            { fieldKey: "product.name", isEnabled: true, selectedSource: null },
            { fieldKey: "product.unknownField", isEnabled: true, selectedSource: null },
        ];

        // Should not throw
        const mappings = buildEffectiveFieldMappings(schema, configs);

        expect(mappings.length).toBe(1);
        expect(mappings[0]?.fieldKey).toBe("product.name");
    });

    test("empty schema returns empty array", () => {
        const schema = createTestSchema({});
        const mappings = buildEffectiveFieldMappings(schema, []);

        expect(mappings).toEqual([]);
    });

    test("empty configs with schema returns all fields with defaults", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
            "variant.sku": { entity: "variant", defaultSource: "sku" },
        });

        const mappings = buildEffectiveFieldMappings(schema, []);

        expect(mappings.length).toBe(2);
        expect(mappings[0]?.sourceKey).toBe("title");
        expect(mappings[1]?.sourceKey).toBe("sku");
    });

    test("preserves field definition in mappings", () => {
        const schema = createTestSchema({
            "product.name": { entity: "product", defaultSource: "title" },
        });

        const mappings = buildEffectiveFieldMappings(schema, []);

        expect(mappings[0]?.definition.entity).toBe("product");
        expect(mappings[0]?.definition.targetField).toBe("product.name");
    });
});

// =============================================================================
// 2.2 isFieldEnabled() Tests
// =============================================================================

describe("isFieldEnabled()", () => {
    const createMapping = (fieldKey: string): EffectiveFieldMapping => ({
        fieldKey,
        sourceKey: "default",
        definition: {
            targetField: fieldKey,
            entity: "product",
            sourceOptions: [{ key: "default", label: "Default", path: "default" }],
            defaultSource: "default",
        },
    });

    test("returns true when field present", () => {
        const mappings = [createMapping("product.name"), createMapping("product.description")];
        expect(isFieldEnabled(mappings, "product.name")).toBe(true);
    });

    test("returns false when field absent", () => {
        const mappings = [createMapping("product.name")];
        expect(isFieldEnabled(mappings, "product.tags")).toBe(false);
    });

    test("returns false for empty mappings", () => {
        expect(isFieldEnabled([], "product.name")).toBe(false);
    });

    test("partial match returns false (exact match required)", () => {
        const mappings = [createMapping("product.name")];
        expect(isFieldEnabled(mappings, "product.n")).toBe(false);
        expect(isFieldEnabled(mappings, "product.nam")).toBe(false);
        expect(isFieldEnabled(mappings, "product.namex")).toBe(false);
    });

    test("case sensitive matching", () => {
        const mappings = [createMapping("product.name")];
        expect(isFieldEnabled(mappings, "product.name")).toBe(true);
        expect(isFieldEnabled(mappings, "Product.Name")).toBe(false);
        expect(isFieldEnabled(mappings, "PRODUCT.NAME")).toBe(false);
    });
});
