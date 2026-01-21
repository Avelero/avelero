/**
 * Unit Tests: Option Parsing (P1)
 *
 * Tests for parseSelectedOptions(), resolveTaxonomyFriendlyId(), and normalizeOptionName().
 * These handle Shopify variant options parsing and taxonomy resolution.
 */

import { describe, expect, test } from "bun:test";
import {
  type ParsedVariantOption,
  parseSelectedOptions,
  resolveTaxonomyFriendlyId,
} from "../../../src/connectors/shopify/schema";

// =============================================================================
// 7.1 normalizeOptionName() Tests (tested via parseSelectedOptions)
// =============================================================================

describe("normalizeOptionName() (via parseSelectedOptions)", () => {
  test("standard name preserved", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Color", value: "Red" }],
    });
    expect(result[0]?.name).toBe("Color");
  });

  test("whitespace trimmed", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "  Size  ", value: "M" }],
    });
    expect(result[0]?.name).toBe("Size");
  });

  test("non-English names preserved", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "kleur", value: "rood" }],
    });
    expect(result[0]?.name).toBe("kleur");
  });

  test("mixed case preserved", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "COLOR", value: "Blue" }],
    });
    expect(result[0]?.name).toBe("COLOR");
  });

  test("special characters preserved", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Size/Fit", value: "Regular" }],
    });
    expect(result[0]?.name).toBe("Size/Fit");
  });
});

// =============================================================================
// 7.2 parseSelectedOptions() Tests
// =============================================================================

describe("parseSelectedOptions()", () => {
  test("standard options parsed correctly", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Size", value: "M" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Size");
    expect(result[0]?.value).toBe("M");
  });

  test("Default Title filtered out", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Title", value: "Default Title" }],
    });

    expect(result).toHaveLength(0);
  });

  test("empty value filtered out", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Size", value: "" }],
    });

    expect(result).toHaveLength(0);
  });

  test("multiple options parsed", () => {
    const result = parseSelectedOptions({
      selectedOptions: [
        { name: "Color", value: "Red" },
        { name: "Size", value: "M" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Color");
    expect(result[1]?.name).toBe("Size");
  });

  test("options with taxonomy hint have taxonomyFriendlyId populated", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Color", value: "Red" }],
      product: {
        options: [
          {
            name: "Color",
            linkedMetafield: { namespace: "shopify", key: "color-pattern" },
          },
        ],
      },
    });

    expect(result[0]?.taxonomyFriendlyId).toBe("color");
  });

  test("options without taxonomy have taxonomyFriendlyId as null", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Custom Option", value: "Value" }],
    });

    expect(result[0]?.taxonomyFriendlyId).toBeNull();
  });

  test("empty options array returns empty array", () => {
    const result = parseSelectedOptions({
      selectedOptions: [],
    });

    expect(result).toEqual([]);
  });

  test("null input returns empty array", () => {
    const result = parseSelectedOptions({
      selectedOptions: null,
    });

    expect(result).toEqual([]);
  });

  test("missing selectedOptions returns empty array", () => {
    const result = parseSelectedOptions({});

    expect(result).toEqual([]);
  });

  test("invalid option structure skipped", () => {
    const result = parseSelectedOptions({
      selectedOptions: [
        { name: "Valid", value: "OK" },
        { name: 123, value: "Invalid name" }, // Invalid
        { name: "Also Invalid" }, // Missing value
        { value: "Missing name" }, // Missing name
        null, // null entry
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Valid");
  });

  test("empty name filtered", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "", value: "SomeValue" }],
    });

    expect(result).toHaveLength(0);
  });

  test("whitespace-only value filtered", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Size", value: "   " }],
    });

    expect(result).toHaveLength(0);
  });

  test("value whitespace trimmed", () => {
    const result = parseSelectedOptions({
      selectedOptions: [{ name: "Size", value: "  Medium  " }],
    });

    expect(result[0]?.value).toBe("Medium");
  });
});

// =============================================================================
// 7.3 resolveTaxonomyFriendlyId() Tests
// =============================================================================

describe("resolveTaxonomyFriendlyId()", () => {
  test("color-pattern metafield resolves to 'color'", () => {
    const result = resolveTaxonomyFriendlyId("Color", {
      product: {
        options: [
          {
            name: "Color",
            linkedMetafield: { namespace: "shopify", key: "color-pattern" },
          },
        ],
      },
    });

    expect(result).toBe("color");
  });

  test("size metafield resolves to 'size'", () => {
    const result = resolveTaxonomyFriendlyId("Size", {
      product: {
        options: [
          {
            name: "Size",
            linkedMetafield: { namespace: "shopify", key: "size" },
          },
        ],
      },
    });

    expect(result).toBe("size");
  });

  test("target-gender metafield resolves to 'target_gender'", () => {
    const result = resolveTaxonomyFriendlyId("Gender", {
      product: {
        options: [
          {
            name: "Gender",
            linkedMetafield: { namespace: "shopify", key: "target-gender" },
          },
        ],
      },
    });

    expect(result).toBe("target_gender");
  });

  test("no metafield returns null", () => {
    const result = resolveTaxonomyFriendlyId("CustomOption", {
      product: {
        options: [{ name: "CustomOption" }],
      },
    });

    expect(result).toBeNull();
  });

  test("unknown metafield returns null", () => {
    const result = resolveTaxonomyFriendlyId("Custom", {
      product: {
        options: [
          {
            name: "Custom",
            linkedMetafield: { namespace: "shopify", key: "unknown-field" },
          },
        ],
      },
    });

    expect(result).toBeNull();
  });

  test("name without metafield returns null (no name-based fallback)", () => {
    // Even though the name is "Color", without linkedMetafield we don't guess
    const result = resolveTaxonomyFriendlyId("Color", {
      product: {
        options: [{ name: "Color" }], // No linkedMetafield
      },
    });

    expect(result).toBeNull();
  });

  test("non-shopify namespace returns null", () => {
    const result = resolveTaxonomyFriendlyId("Color", {
      product: {
        options: [
          {
            name: "Color",
            linkedMetafield: { namespace: "custom", key: "color-pattern" },
          },
        ],
      },
    });

    expect(result).toBeNull();
  });

  test("empty option name returns null", () => {
    const result = resolveTaxonomyFriendlyId("", {});
    expect(result).toBeNull();
  });

  test("whitespace-only option name returns null", () => {
    const result = resolveTaxonomyFriendlyId("   ", {});
    expect(result).toBeNull();
  });

  test("missing product.options returns null", () => {
    const result = resolveTaxonomyFriendlyId("Color", {});
    expect(result).toBeNull();
  });

  test("null product.options returns null", () => {
    const result = resolveTaxonomyFriendlyId("Color", {
      product: { options: null },
    });
    expect(result).toBeNull();
  });

  test("case-insensitive option name matching", () => {
    const result = resolveTaxonomyFriendlyId("color", {
      product: {
        options: [
          {
            name: "Color",
            linkedMetafield: { namespace: "shopify", key: "color-pattern" },
          },
        ],
      },
    });

    expect(result).toBe("color");
  });

  test("metafield key case-insensitive", () => {
    const result = resolveTaxonomyFriendlyId("Color", {
      product: {
        options: [
          {
            name: "Color",
            linkedMetafield: { namespace: "shopify", key: "COLOR-PATTERN" },
          },
        ],
      },
    });

    expect(result).toBe("color");
  });

  test("age-group metafield resolves", () => {
    const result = resolveTaxonomyFriendlyId("Age Group", {
      product: {
        options: [
          {
            name: "Age Group",
            linkedMetafield: { namespace: "shopify", key: "age-group" },
          },
        ],
      },
    });

    expect(result).toBe("age_group");
  });

  test("fabric metafield resolves", () => {
    const result = resolveTaxonomyFriendlyId("Material", {
      product: {
        options: [
          {
            name: "Material",
            linkedMetafield: { namespace: "shopify", key: "fabric" },
          },
        ],
      },
    });

    expect(result).toBe("fabric");
  });
});
