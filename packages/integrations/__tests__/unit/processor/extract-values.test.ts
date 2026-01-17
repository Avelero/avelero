/**
 * Unit Tests: Value Extraction (P0)
 *
 * Tests for getValueByPath() and extractValues() functions.
 * These are pure functions that can be tested without database dependencies.
 */

import { describe, expect, test } from "bun:test";
import {
  getValueByPath,
  extractValues,
  buildEffectiveFieldMappings,
  type EffectiveFieldMapping,
} from "../../../src/sync/processor";
import type { ConnectorSchema, FieldConfig } from "../../../src/types";

// =============================================================================
// 1.1 getValueByPath() Tests
// =============================================================================

describe("getValueByPath()", () => {
  test("simple path returns value", () => {
    const result = getValueByPath({ foo: "bar" }, "foo");
    expect(result).toBe("bar");
  });

  test("nested path returns deep value", () => {
    const obj = { a: { b: { c: 1 } } };
    expect(getValueByPath(obj, "a.b.c")).toBe(1);
  });

  test("root object access with '.' path", () => {
    const obj = { foo: "bar" };
    expect(getValueByPath(obj, ".")).toEqual({ foo: "bar" });
  });

  test("missing property returns undefined", () => {
    const result = getValueByPath({ foo: "bar" }, "baz");
    expect(result).toBeUndefined();
  });

  test("null in path returns undefined", () => {
    const obj = { a: null } as Record<string, unknown>;
    expect(getValueByPath(obj, "a.b")).toBeUndefined();
  });

  test("undefined in path returns undefined", () => {
    const obj = { a: undefined } as Record<string, unknown>;
    expect(getValueByPath(obj, "a.b")).toBeUndefined();
  });

  test("array access returns array", () => {
    const obj = { items: [1, 2, 3] };
    expect(getValueByPath(obj, "items")).toEqual([1, 2, 3]);
  });

  test("empty path returns undefined", () => {
    const result = getValueByPath({ foo: "bar" }, "");
    expect(result).toBeUndefined();
  });

  test("cannot traverse into primitives", () => {
    const obj = { a: "string" };
    expect(getValueByPath(obj, "a.b")).toBeUndefined();
  });

  test("handles boolean values correctly", () => {
    const obj = { active: true, inactive: false };
    expect(getValueByPath(obj, "active")).toBe(true);
    expect(getValueByPath(obj, "inactive")).toBe(false);
  });

  test("handles numeric zero correctly", () => {
    const obj = { price: 0, count: 0 };
    expect(getValueByPath(obj, "price")).toBe(0);
  });

  test("handles empty string correctly", () => {
    const obj = { name: "" };
    expect(getValueByPath(obj, "name")).toBe("");
  });
});

// =============================================================================
// 1.2 extractValues() Tests
// =============================================================================

describe("extractValues()", () => {
  // Create minimal field mappings for tests
  const createMappings = (
    fields: Array<{
      fieldKey: string;
      path: string;
      entity: "product" | "variant";
      transform?: (v: unknown) => unknown;
      sourceTransform?: (v: unknown) => unknown;
      referenceEntity?: "category";
      isRelation?: boolean;
      relationType?: "tags";
    }>,
  ): EffectiveFieldMapping[] => {
    return fields.map((f) => ({
      fieldKey: f.fieldKey,
      sourceKey: "default",
      definition: {
        targetField: f.fieldKey,
        entity: f.entity,
        sourceOptions: [
          {
            key: "default",
            label: "Default",
            path: f.path,
            transform: f.sourceTransform,
          },
        ],
        defaultSource: "default",
        transform: f.transform,
        referenceEntity: f.referenceEntity,
        isRelation: f.isRelation,
        relationType: f.relationType,
      },
    }));
  };

  test("basic product extraction", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
      {
        fieldKey: "product.description",
        path: "description",
        entity: "product",
      },
    ]);

    const data = {
      title: "Blue T-Shirt",
      description: "A nice blue t-shirt",
    };

    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Blue T-Shirt");
    expect(result.product.description).toBe("A nice blue t-shirt");
  });

  test("basic variant extraction", () => {
    const mappings = createMappings([
      { fieldKey: "variant.sku", path: "sku", entity: "variant" },
      { fieldKey: "variant.barcode", path: "barcode", entity: "variant" },
    ]);

    const data = {
      sku: "SKU-001",
      barcode: "1234567890",
    };

    const result = extractValues(data, mappings);

    expect(result.variant.sku).toBe("SKU-001");
    expect(result.variant.barcode).toBe("1234567890");
  });

  test("nested variant in product (product.* path)", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "product.title", entity: "product" },
      { fieldKey: "variant.sku", path: "sku", entity: "variant" },
    ]);

    const data = {
      sku: "SKU-001",
      product: {
        title: "Parent Product",
      },
    };

    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Parent Product");
    expect(result.variant.sku).toBe("SKU-001");
  });

  test("transform applied to value", () => {
    const mappings = createMappings([
      {
        fieldKey: "product.price",
        path: "price",
        entity: "product",
        transform: (v) => (typeof v === "string" ? Number.parseFloat(v) : v),
      },
    ]);

    const data = { price: "100.50" };
    const result = extractValues(data, mappings);

    expect(result.product.price).toBe(100.5);
  });

  test("source-specific transform applied before global transform", () => {
    const mappings = createMappings([
      {
        fieldKey: "product.status",
        path: "status",
        entity: "product",
        sourceTransform: (v) => String(v).toUpperCase(),
        transform: (v) => (v === "ACTIVE" ? "active" : "inactive"),
      },
    ]);

    const data = { status: "active" };
    const result = extractValues(data, mappings);

    expect(result.product.status).toBe("active");
  });

  test("null value skipped", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
      {
        fieldKey: "product.description",
        path: "description",
        entity: "product",
      },
    ]);

    const data = {
      title: "Product",
      description: null,
    };

    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Product");
    expect(result.product.description).toBeUndefined();
  });

  test("undefined value skipped", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
      { fieldKey: "product.description", path: "missing", entity: "product" },
    ]);

    const data = { title: "Product" };
    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Product");
    expect(result.product.description).toBeUndefined();
  });

  test("reference entity extraction (categoryId)", () => {
    const mappings = createMappings([
      {
        fieldKey: "product.categoryId",
        path: "category",
        entity: "product",
        referenceEntity: "category",
        transform: () => "uuid-category-123", // Simulates resolveShopifyCategoryId
      },
    ]);

    const data = {
      category: {
        id: "gid://shopify/TaxonomyCategory/aa-1-2",
        name: "T-Shirts",
      },
    };

    const result = extractValues(data, mappings);

    expect(result.referenceEntities.categoryId).toBe("uuid-category-123");
    // Should NOT be in product object
    expect(result.product.categoryId).toBeUndefined();
  });

  test("tag relation extraction", () => {
    const mappings = createMappings([
      {
        fieldKey: "product.tags",
        path: "tags",
        entity: "product",
        isRelation: true,
        relationType: "tags",
        transform: (v) =>
          Array.isArray(v)
            ? v.map((t) => String(t).trim()).filter(Boolean)
            : [],
      },
    ]);

    const data = { tags: ["summer", "sports", "new"] };
    const result = extractValues(data, mappings);

    expect(result.relations.tags).toEqual(["summer", "sports", "new"]);
  });

  test("empty input returns empty objects", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
      { fieldKey: "variant.sku", path: "sku", entity: "variant" },
    ]);

    const result = extractValues({}, mappings);

    expect(result.product).toEqual({});
    expect(result.variant).toEqual({});
    expect(result.referenceEntities).toEqual({});
    expect(result.relations).toEqual({});
  });

  test("partial data extracts only present fields", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
      {
        fieldKey: "product.description",
        path: "description",
        entity: "product",
      },
      { fieldKey: "variant.sku", path: "sku", entity: "variant" },
    ]);

    const data = { title: "Product Name" };
    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Product Name");
    expect(result.product.description).toBeUndefined();
    expect(result.variant.sku).toBeUndefined();
  });

  test("extra fields in input are ignored", () => {
    const mappings = createMappings([
      { fieldKey: "product.name", path: "title", entity: "product" },
    ]);

    const data = {
      title: "Product",
      extraField: "ignored",
      anotherExtra: { nested: "also ignored" },
    };

    const result = extractValues(data, mappings);

    expect(result.product.name).toBe("Product");
    expect(Object.keys(result.product)).toEqual(["name"]);
  });

  test("invalid fieldKey format is handled gracefully", () => {
    // Manually create a mapping with an invalid fieldKey (no dot)
    const invalidMapping: EffectiveFieldMapping = {
      fieldKey: "invalidNoPrefix",
      sourceKey: "default",
      definition: {
        targetField: "invalidNoPrefix",
        entity: "product",
        sourceOptions: [{ key: "default", label: "Default", path: "value" }],
        defaultSource: "default",
      },
    };

    const result = extractValues({ value: "test" }, [invalidMapping]);

    // Should not crash, and should return empty objects since fieldKey is malformed
    expect(result.product).toEqual({});
    expect(result.variant).toEqual({});
  });
});

// =============================================================================
// 1.3 extractValues() - Entity Separation Tests
// =============================================================================

describe("extractValues() - entity separation", () => {
  const createMapping = (
    fieldKey: string,
    path: string,
    opts: {
      referenceEntity?: "category";
      isRelation?: boolean;
      relationType?: "tags";
    } = {},
  ): EffectiveFieldMapping => ({
    fieldKey,
    sourceKey: "default",
    definition: {
      targetField: fieldKey,
      entity: fieldKey.startsWith("product.") ? "product" : "variant",
      sourceOptions: [{ key: "default", label: "Default", path }],
      defaultSource: "default",
      referenceEntity: opts.referenceEntity,
      isRelation: opts.isRelation,
      relationType: opts.relationType,
    },
  });

  test("product.name goes to result.product.name", () => {
    const result = extractValues({ title: "Product Title" }, [
      createMapping("product.name", "title"),
    ]);
    expect(result.product.name).toBe("Product Title");
  });

  test("product.description goes to result.product.description", () => {
    const result = extractValues({ desc: "Description" }, [
      createMapping("product.description", "desc"),
    ]);
    expect(result.product.description).toBe("Description");
  });

  test("product.imagePath goes to result.product.imagePath", () => {
    const result = extractValues({ image: "https://example.com/image.jpg" }, [
      createMapping("product.imagePath", "image"),
    ]);
    expect(result.product.imagePath).toBe("https://example.com/image.jpg");
  });

  test("variant.sku goes to result.variant.sku", () => {
    const result = extractValues({ sku: "ABC-123" }, [
      createMapping("variant.sku", "sku"),
    ]);
    expect(result.variant.sku).toBe("ABC-123");
  });

  test("variant.barcode goes to result.variant.barcode", () => {
    const result = extractValues({ barcode: "1234567890" }, [
      createMapping("variant.barcode", "barcode"),
    ]);
    expect(result.variant.barcode).toBe("1234567890");
  });

  test("product.categoryId goes to result.referenceEntities.categoryId", () => {
    const mapping: EffectiveFieldMapping = {
      fieldKey: "product.categoryId",
      sourceKey: "default",
      definition: {
        targetField: "product.categoryId",
        entity: "product",
        sourceOptions: [
          {
            key: "default",
            label: "Default",
            path: "category",
            transform: () => "uuid-123", // Mock resolver
          },
        ],
        defaultSource: "default",
        referenceEntity: "category",
      },
    };

    const result = extractValues({ category: { id: "test" } }, [mapping]);
    expect(result.referenceEntities.categoryId).toBe("uuid-123");
    expect(result.product.categoryId).toBeUndefined();
  });

  test("product.tags goes to result.relations.tags", () => {
    const mapping: EffectiveFieldMapping = {
      fieldKey: "product.tags",
      sourceKey: "default",
      definition: {
        targetField: "product.tags",
        entity: "product",
        sourceOptions: [{ key: "default", label: "Default", path: "tags" }],
        defaultSource: "default",
        isRelation: true,
        relationType: "tags",
      },
    };

    const result = extractValues({ tags: ["a", "b"] }, [mapping]);
    expect(result.relations.tags).toEqual(["a", "b"]);
  });
});
