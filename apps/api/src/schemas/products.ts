/**
 * Validation schemas for product and variant operations.
 *
 * These shapes mirror the API surface so both the server and client agree on
 * the required fields when creating, updating, or filtering products.
 */
import { z } from "zod";
import {
  longStringSchema,
  paginationLimitSchema,
  shortStringSchema,
  urlSchema,
  uuidSchema,
} from "./_shared/primitives.js";
import {
  byIdSchema,
  byParentId,
  createFieldSelection,
  updateWithNullable,
} from "./_shared/patterns.js";

// Products core
/**
 * Available fields for product queries.
 *
 * Defines which product fields can be selectively queried by clients.
 * Restricts selection to prevent accidental exposure of internal fields.
 */
export const PRODUCT_FIELDS = [
  "id",
  "name",
  "description",
  "category_id",
  "season",
  "brand_certification_id",
  "showcase_brand_id",
  "primary_image_url",
  "created_at",
  "updated_at",
] as const;

/**
 * Type representing all available product field names.
 */
export type ProductField = (typeof PRODUCT_FIELDS)[number];

/**
 * Cursor-based listing parameters for product tables.
 */
export const listProductsSchema = z.object({
  cursor: z.string().optional(),
  limit: paginationLimitSchema.optional(),
  fields: createFieldSelection(PRODUCT_FIELDS),
  filters: z
    .object({
      category_id: uuidSchema.optional(),
      season: shortStringSchema.optional(),
      search: shortStringSchema.optional(),
    })
    .optional(),
});

/**
 * Identifies a specific product by UUID.
 */
export const getProductSchema = byIdSchema;

/**
 * Required fields when creating a product.
 */
export const createProductSchema = z.object({
  name: shortStringSchema,
  description: longStringSchema.optional(),
  category_id: uuidSchema.optional(),
  season: shortStringSchema.optional(),
  brand_certification_id: uuidSchema.optional(),
  showcase_brand_id: uuidSchema.optional(),
  primary_image_url: urlSchema.optional(),
});

/**
 * Permitted updates for an existing product.
 */
export const updateProductSchema = updateWithNullable(createProductSchema, [
  "description",
  "category_id",
  "season",
  "brand_certification_id",
  "showcase_brand_id",
  "primary_image_url",
]);

/**
 * Payload for deleting a product.
 */
export const deleteProductSchema = byIdSchema;

/**
 * Upsert payload used for product-level identifiers.
 */
export const upsertProductIdentifierSchema = z.object({
  product_id: uuidSchema,
  id_type: shortStringSchema,
  value: shortStringSchema,
});

// Variants (consolidated under products)
/**
 * Identifies the parent product whose variants should be listed.
 */
export const listVariantsSchema = byParentId("product_id");

/**
 * Required fields for creating a product variant.
 */
export const createVariantSchema = z.object({
  product_id: uuidSchema,
  color_id: uuidSchema.optional(),
  size_id: uuidSchema.optional(),
  sku: shortStringSchema.optional(),
  upid: shortStringSchema,
  product_image_url: urlSchema.optional(),
});

/**
 * Permitted updates to a variant record.
 */
export const updateVariantSchema = updateWithNullable(
  createVariantSchema.omit({ product_id: true }),
  ["color_id", "size_id", "sku", "product_image_url"]
);

/**
 * Payload for deleting a variant.
 */
export const deleteVariantSchema = byIdSchema;

/**
 * Upsert payload used for variant-level identifiers.
 */
export const upsertVariantIdentifierSchema = z.object({
  variant_id: uuidSchema,
  id_type: shortStringSchema,
  value: shortStringSchema,
});
