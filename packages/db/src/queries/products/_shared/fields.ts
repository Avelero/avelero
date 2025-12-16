/**
 * Product field maps and constants.
 */

import { products, categories } from "../../../schema";

/**
 * Maps API field names to database column references.
 */
export const PRODUCT_FIELD_MAP = {
  id: products.id,
  name: products.name,
  description: products.description,
  category_id: products.categoryId,
  season_id: products.seasonId,
  manufacturer_id: products.manufacturerId,
  primary_image_path: products.primaryImagePath,
  product_handle: products.productHandle,
  status: products.status,
  created_at: products.createdAt,
  updated_at: products.updatedAt,
} as const;

/**
 * Type-safe product field names.
 */
export type ProductField = keyof typeof PRODUCT_FIELD_MAP;

export const PRODUCT_FIELDS = Object.keys(
  PRODUCT_FIELD_MAP,
) as readonly ProductField[];

