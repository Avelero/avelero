/**
 * Shopify Fixture Factories
 *
 * Convenience functions for creating common Shopify product configurations.
 *
 * @module @v1/testing/fixtures/shopify
 */

import { createMockVariant, type ShopifyVariantNode } from "../mocks/shopify";

/**
 * Create variants for a simple size range.
 *
 * @example
 * ```ts
 * const variants = createSizeVariants("TSHIRT", ["S", "M", "L", "XL"]);
 * // Creates 4 variants with SKUs: TSHIRT-S, TSHIRT-M, TSHIRT-L, TSHIRT-XL
 * ```
 */
export function createSizeVariants(
  skuPrefix: string,
  sizes: string[] = ["S", "M", "L"],
): ShopifyVariantNode[] {
  return sizes.map((size) =>
    createMockVariant({
      sku: `${skuPrefix}-${size}`,
      selectedOptions: [{ name: "Size", value: size }],
    }),
  );
}

/**
 * Create variants for color × size combinations.
 *
 * @example
 * ```ts
 * const variants = createColorSizeVariants("POLO", ["Red", "Blue"], ["S", "M"]);
 * // Creates 4 variants: POLO-RED-S, POLO-RED-M, POLO-BLUE-S, POLO-BLUE-M
 * ```
 */
export function createColorSizeVariants(
  skuPrefix: string,
  colors: string[],
  sizes: string[],
): ShopifyVariantNode[] {
  const variants: ShopifyVariantNode[] = [];

  for (const color of colors) {
    for (const size of sizes) {
      variants.push(
        createMockVariant({
          sku: `${skuPrefix}-${color.toUpperCase()}-${size}`,
          selectedOptions: [
            { name: "Color", value: color },
            { name: "Size", value: size },
          ],
        }),
      );
    }
  }

  return variants;
}

/**
 * Create variants for color × size × material combinations (3 attributes).
 *
 * @example
 * ```ts
 * const variants = createThreeAttributeVariants(
 *   "JACKET",
 *   ["Black", "Navy"],
 *   ["S", "M"],
 *   ["Cotton", "Wool"]
 * );
 * // Creates 8 variants
 * ```
 */
export function createThreeAttributeVariants(
  skuPrefix: string,
  colors: string[],
  sizes: string[],
  materials: string[],
): ShopifyVariantNode[] {
  const variants: ShopifyVariantNode[] = [];

  for (const color of colors) {
    for (const size of sizes) {
      for (const material of materials) {
        variants.push(
          createMockVariant({
            sku: `${skuPrefix}-${color.substring(0, 3).toUpperCase()}-${size}-${material.substring(0, 3).toUpperCase()}`,
            selectedOptions: [
              { name: "Color", value: color },
              { name: "Size", value: size },
              { name: "Material", value: material },
            ],
          }),
        );
      }
    }
  }

  return variants;
}
