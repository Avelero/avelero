/**
 * Validation schemas for product and variant operations.
 *
 * These shapes mirror the API surface so both the server and client agree on
 * the required fields when creating, updating, or filtering products.
 */
import { z } from "zod";
import {
  byIdSchema,
  byParentId,
  createFieldSelection,
  updateWithNullable,
} from "./_shared/patterns.js";
import {
  longStringSchema,
  nonNegativeIntSchema,
  paginationLimitSchema,
  shortStringSchema,
  urlSchema,
  uuidArraySchema,
  uuidSchema,
} from "./_shared/primitives.js";

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
  "brand_id",
  "category_id",
  "season_id",
  "showcase_brand_id",
  "primary_image_url",
  "product_identifier",
  "upid",
  "template_id",
  "status",
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
      season_id: uuidSchema.optional(),
      search: shortStringSchema.optional(),
    })
    .optional(),
  sort: z
    .object({
      field: z.enum([
        "name",
        "status",
        "createdAt",
        "updatedAt",
        "category",
        "season",
        "productIdentifier",
      ]),
      direction: z.enum(["asc", "desc"]).default("desc"),
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
  /**
   * Human-friendly article number that uniquely identifies the product within
   * a brand. Required alongside the product name when creating products.
   */
  product_identifier: shortStringSchema,
  description: longStringSchema.optional(),
  category_id: uuidSchema.optional(),
  season_id: uuidSchema.optional(), // FK to brand_seasons.id
  showcase_brand_id: uuidSchema.optional(),
  primary_image_url: urlSchema.optional(),
  template_id: uuidSchema.optional(),
  status: shortStringSchema.optional(),
  color_ids: uuidArraySchema.max(12).optional(),
  size_ids: uuidArraySchema.max(12).optional(),
  tag_ids: uuidArraySchema.optional(),
  materials: z
    .array(
      z.object({
        brand_material_id: uuidSchema,
        percentage: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
  eco_claim_ids: uuidArraySchema.optional(),
  journey_steps: z
    .array(
      z.object({
        sort_index: nonNegativeIntSchema,
        step_type: shortStringSchema,
        facility_ids: uuidArraySchema, // Changed from facility_id to support multiple operators
      }),
    )
    .optional(),
  environment: z
    .object({
      carbon_kg_co2e: z.union([z.string(), z.number()]).optional(),
      water_liters: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

/**
 * Permitted updates for an existing product.
 */
export const updateProductSchema = updateWithNullable(createProductSchema, [
  "description",
  "category_id",
  "season_id",
  "showcase_brand_id",
  "primary_image_url",
  "template_id",
  "status",
  "product_identifier",
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
export const listVariantsSchema = z.object({
  product_id: uuidSchema,
  cursor: z.string().optional(),
  limit: paginationLimitSchema.optional(),
});

/**
 * Retrieves all variants for a given product_id.
 */
export const getVariantsSchema = byParentId("product_id");

/**
 * Upsert/replace variants for a product by providing colors and sizes.
 */
export const productVariantsUpsertSchema = z.object({
  product_id: uuidSchema,
  color_ids: uuidArraySchema.max(12).optional(),
  size_ids: uuidArraySchema.max(12).optional(),
});

/**
 * Deletes variants by id or by parent product.
 */
export const productVariantsDeleteSchema = z.union([
  z.object({ variant_id: uuidSchema }),
  z.object({ product_id: uuidSchema }),
]);

/**
 * Input payload for `products.list` in the reorganized API.
 *
 * Extends the legacy cursor schema with optional brand scoping and include
 * flags that drive eager loading of related resources.
 */
export const productsDomainListSchema = listProductsSchema.extend({
  brand_id: uuidSchema.optional(),
  includeVariants: z.boolean().optional().default(false),
  includeAttributes: z.boolean().optional().default(false),
});

export type ProductsDomainListInput = z.infer<typeof productsDomainListSchema>;

/**
 * Input payload for `products.get`.
 *
 * Supports optional include flags that match the corresponding list payload.
 */
export const productsDomainGetSchema = getProductSchema.extend({
  includeVariants: z.boolean().optional().default(false),
  includeAttributes: z.boolean().optional().default(false),
});

export type ProductsDomainGetInput = z.infer<typeof productsDomainGetSchema>;

/**
 * Input payload for fetching a product by UPID.
 */
export const productsDomainGetByUpidSchema = z.object({
  upid: shortStringSchema,
  includeVariants: z.boolean().optional().default(false),
  includeAttributes: z.boolean().optional().default(false),
});

export type ProductsDomainGetByUpidInput = z.infer<
  typeof productsDomainGetByUpidSchema
>;

/**
 * Input payload for `products.create` in the v2 API.
 *
 * Requires the caller to explicitly state the brand identifier to avoid
 * accidental cross-tenant inserts. Supports the same optional attribute payload
 * used by the update route so that products can be fully defined in a single
 * mutation.
 */
export const productsDomainCreateSchema = createProductSchema.extend({
  brand_id: uuidSchema,
});

export type ProductsDomainCreateInput = z.infer<
  typeof productsDomainCreateSchema
>;

/**
 * Input payload for `products.update`.
 *
 * Allows optional brand scoping so the server can validate the caller is
 * operating within the active tenant context.
 * Shares the same attribute payload shape as `products.create`, enabling both
 * routes to remain feature-parity.
 */
export const productsDomainUpdateSchema = updateProductSchema.extend({
  brand_id: uuidSchema.optional(),
});

export type ProductsDomainUpdateInput = z.infer<
  typeof productsDomainUpdateSchema
>;

/**
 * Input payload for `products.delete`.
 *
 * Accepts an optional brand identifier for defensive verification.
 */
export const productsDomainDeleteSchema = deleteProductSchema.extend({
  brand_id: uuidSchema.optional(),
});

export type ProductsDomainDeleteInput = z.infer<
  typeof productsDomainDeleteSchema
>;

/**
 * Input payload for `products.variants.upsert`.
 *
 * Accepts color and size selections; the cartesian product becomes the final
 * variant set, replacing any existing variants for the product.
 */
export type ProductVariantsUpsertInput = z.infer<
  typeof productVariantsUpsertSchema
>;

/**
 * Input payload for `products.variants.delete`.
 */
export type ProductVariantsDeleteInput = z.infer<
  typeof productVariantsDeleteSchema
>;
