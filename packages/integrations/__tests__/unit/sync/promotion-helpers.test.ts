/**
 * Unit Tests: Promotion Helper Functions
 *
 * Tests for the pure helper functions used in the promotion engine.
 * These functions extract data from external API responses and handle
 * string transformations for product/variant creation.
 */

import { describe, expect, test } from "bun:test";
import { _testHelpers } from "../../../src/sync/promotion";

const {
  extractBarcode,
  extractProductData,
  extractVariantData,
  extractImagePath,
  generateHandle,
  createEmptyProgress,
} = _testHelpers;

// =============================================================================
// extractBarcode() Tests
// =============================================================================

describe("extractBarcode()", () => {
  test("extracts barcode when present", () => {
    const data = { barcode: "1234567890123" };
    expect(extractBarcode(data)).toBe("1234567890123");
  });

  test("extracts ean when barcode not present", () => {
    const data = { ean: "1234567890123" };
    expect(extractBarcode(data)).toBe("1234567890123");
  });

  test("extracts gtin when barcode and ean not present", () => {
    const data = { gtin: "1234567890123" };
    expect(extractBarcode(data)).toBe("1234567890123");
  });

  test("prefers barcode over ean and gtin", () => {
    const data = {
      barcode: "barcode-value",
      ean: "ean-value",
      gtin: "gtin-value",
    };
    expect(extractBarcode(data)).toBe("barcode-value");
  });

  test("returns null when no barcode field present", () => {
    const data = { sku: "SKU-001" };
    expect(extractBarcode(data)).toBeNull();
  });

  test("returns null for empty string barcode", () => {
    const data = { barcode: "" };
    expect(extractBarcode(data)).toBeNull();
  });

  test("returns null for non-string barcode", () => {
    const data = { barcode: 12345 };
    expect(extractBarcode(data)).toBeNull();
  });

  test("returns null for empty object", () => {
    expect(extractBarcode({})).toBeNull();
  });
});

// =============================================================================
// extractProductData() Tests
// =============================================================================

describe("extractProductData()", () => {
  test("extracts name from title field", () => {
    const data = { title: "Test Product" };
    const result = extractProductData(data);
    expect(result.name).toBe("Test Product");
  });

  test("extracts description field", () => {
    const data = { description: "Product description text" };
    const result = extractProductData(data);
    expect(result.description).toBe("Product description text");
  });

  test("extracts all fields when present", () => {
    const data = {
      title: "Product Name",
      description: "Product description",
      imagePath: "https://example.com/image.jpg",
    };
    const result = extractProductData(data);
    expect(result.name).toBe("Product Name");
    expect(result.description).toBe("Product description");
    expect(result.imagePath).toBe("https://example.com/image.jpg");
  });

  test("returns undefined for missing fields", () => {
    const result = extractProductData({});
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.imagePath).toBeUndefined();
  });

  test("ignores non-string title", () => {
    const data = { title: 12345 };
    const result = extractProductData(data);
    expect(result.name).toBeUndefined();
  });

  test("extracts imagePath from featuredImage.url", () => {
    const data = {
      title: "Test",
      featuredImage: { url: "https://cdn.shopify.com/image.jpg" },
    };
    const result = extractProductData(data);
    expect(result.imagePath).toBe("https://cdn.shopify.com/image.jpg");
  });
});

// =============================================================================
// extractVariantData() Tests
// =============================================================================

describe("extractVariantData()", () => {
  test("extracts sku when present", () => {
    const data = { sku: "SKU-001" };
    const result = extractVariantData(data);
    expect(result.sku).toBe("SKU-001");
  });

  test("extracts barcode using extractBarcode", () => {
    const data = { barcode: "1234567890123" };
    const result = extractVariantData(data);
    expect(result.barcode).toBe("1234567890123");
  });

  test("extracts selectedOptions when present", () => {
    const data = {
      selectedOptions: [
        { name: "Size", value: "M" },
        { name: "Color", value: "Blue" },
      ],
    };
    const result = extractVariantData(data);
    expect(result.selectedOptions).toHaveLength(2);
    expect(result.selectedOptions?.[0]).toEqual({ name: "Size", value: "M" });
    expect(result.selectedOptions?.[1]).toEqual({
      name: "Color",
      value: "Blue",
    });
  });

  test("returns undefined for missing fields", () => {
    const result = extractVariantData({});
    expect(result.sku).toBeUndefined();
    expect(result.barcode).toBeUndefined();
    expect(result.selectedOptions).toBeUndefined();
  });

  test("ignores non-string sku", () => {
    const data = { sku: 12345 };
    const result = extractVariantData(data);
    expect(result.sku).toBeUndefined();
  });

  test("ignores non-array selectedOptions", () => {
    const data = { selectedOptions: "not an array" };
    const result = extractVariantData(data);
    expect(result.selectedOptions).toBeUndefined();
  });
});

// =============================================================================
// extractImagePath() Tests
// =============================================================================

describe("extractImagePath()", () => {
  test("extracts from featuredImage.url", () => {
    const data = {
      featuredImage: { url: "https://cdn.example.com/product.jpg" },
    };
    expect(extractImagePath(data)).toBe("https://cdn.example.com/product.jpg");
  });

  test("extracts from direct imagePath field", () => {
    const data = { imagePath: "https://example.com/image.jpg" };
    expect(extractImagePath(data)).toBe("https://example.com/image.jpg");
  });

  test("extracts from image field", () => {
    const data = { image: "https://example.com/pic.jpg" };
    expect(extractImagePath(data)).toBe("https://example.com/pic.jpg");
  });

  test("prefers featuredImage.url over other fields", () => {
    const data = {
      featuredImage: { url: "https://featured.jpg" },
      imagePath: "https://path.jpg",
      image: "https://image.jpg",
    };
    expect(extractImagePath(data)).toBe("https://featured.jpg");
  });

  test("falls back to imagePath when featuredImage has no url", () => {
    const data = {
      featuredImage: { alt: "Alt text" },
      imagePath: "https://fallback.jpg",
    };
    expect(extractImagePath(data)).toBe("https://fallback.jpg");
  });

  test("returns undefined when no image field present", () => {
    const data = { title: "Product" };
    expect(extractImagePath(data)).toBeUndefined();
  });

  test("returns undefined for non-string image values", () => {
    const data = { imagePath: 12345 };
    expect(extractImagePath(data)).toBeUndefined();
  });

  test("returns undefined for null featuredImage", () => {
    const data = { featuredImage: null };
    expect(extractImagePath(data)).toBeUndefined();
  });
});

// =============================================================================
// generateHandle() Tests
// =============================================================================

describe("generateHandle()", () => {
  test("converts to lowercase", () => {
    expect(generateHandle("Test Product")).toBe("test-product");
  });

  test("replaces spaces with hyphens", () => {
    expect(generateHandle("my product name")).toBe("my-product-name");
  });

  test("removes special characters", () => {
    expect(generateHandle("Product!@#$%Name")).toBe("product-name");
  });

  test("removes leading and trailing hyphens", () => {
    expect(generateHandle("!!!Product!!!")).toBe("product");
  });

  test("collapses multiple hyphens", () => {
    expect(generateHandle("A   B   C")).toBe("a-b-c");
  });

  test("truncates to 100 characters", () => {
    const longName = "A".repeat(150);
    expect(generateHandle(longName).length).toBe(100);
  });

  test("handles unicode characters", () => {
    expect(generateHandle("Café Latté")).toBe("caf-latt");
  });

  test("handles empty string", () => {
    expect(generateHandle("")).toBe("");
  });

  test("handles string with only special characters", () => {
    expect(generateHandle("!@#$%")).toBe("");
  });
});

// =============================================================================
// createEmptyProgress() Tests
// =============================================================================

describe("createEmptyProgress()", () => {
  test("creates progress with operationId", () => {
    const progress = createEmptyProgress("op-123");
    expect(progress.operationId).toBe("op-123");
  });

  test("has failed phase", () => {
    const progress = createEmptyProgress("op-123");
    expect(progress.phase).toBe("failed");
  });

  test("initializes all counters to zero", () => {
    const progress = createEmptyProgress("op-123");
    expect(progress.phaseNumber).toBe(0);
    expect(progress.variantsProcessed).toBe(0);
    expect(progress.totalVariants).toBe(0);
    expect(progress.productsCreated).toBe(0);
    expect(progress.productsArchived).toBe(0);
    expect(progress.variantsMoved).toBe(0);
    expect(progress.variantsOrphaned).toBe(0);
    expect(progress.attributesCreated).toBe(0);
  });
});
