/**
 * Default fixed product image styling helpers.
 */

import type { Passport, Styles } from "../types/passport";

export const DEFAULT_PRODUCT_IMAGE_STYLES: Styles = {
  frame: {
    borderColor: "$border",
    borderWidth: 0,
    borderRadius: 4,
  },
};

export function createDefaultProductImage(): NonNullable<
  Passport["productImage"]
> {
  // Build a fresh fixed product image config so callers never share mutable style defaults.
  return {
    styles: structuredClone(DEFAULT_PRODUCT_IMAGE_STYLES),
  };
}
