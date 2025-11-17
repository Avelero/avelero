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
  percentageSchema,
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
  "category_id",
  "season_id",
  "template_id",
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
      season_id: uuidSchema.optional(),
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
  /** Optional product identifier - server generates if not provided */
  product_identifier: shortStringSchema.optional(),
  description: longStringSchema.optional(),
  category_id: uuidSchema.optional(),
  season_id: uuidSchema.optional(), // FK to brand_seasons.id
  template_id: uuidSchema.optional(), // FK to passport_templates.id
  showcase_brand_id: uuidSchema.optional(),
  primary_image_url: urlSchema.optional(),
  /** Optional: Array of color IDs to auto-generate variants */
  color_ids: uuidArraySchema.optional(),
  /** Optional: Array of size IDs to auto-generate variants */
  size_ids: uuidArraySchema.optional(),
});

/**
 * Permitted updates for an existing product.
 */
export const updateProductSchema = updateWithNullable(createProductSchema, [
  "description",
  "category_id",
  "season_id",
  "template_id",
  "showcase_brand_id",
  "primary_image_url",
  "product_identifier",
  "color_ids",
  "size_ids",
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
 *
 * Note: SKU is now optional. Variants are tracked by UUID.
 * UPID is also optional when using auto-generated variants.
 */
export const createVariantSchema = z.object({
  product_id: uuidSchema,
  color_id: uuidSchema.optional(),
  size_id: uuidSchema.optional(),
  /** UPID is optional - required only for manual variant creation */
  upid: shortStringSchema.optional(),
});

/**
 * Permitted updates to a variant record.
 */
export const updateVariantSchema = updateWithNullable(
  createVariantSchema.omit({ product_id: true }),
  ["color_id", "size_id", "upid"],
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
 * Input payload for `products.create` in the v2 API.
 *
 * Requires the caller to explicitly state the brand identifier to avoid
 * accidental cross-tenant inserts.
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
 *
 * **Extended with product attributes** - all attribute fields are optional.
 * Attributes are properties of the product and should be updated via this
 * endpoint rather than separate attribute endpoints.
 */
export const productsDomainUpdateSchema = updateProductSchema.extend({
  brand_id: uuidSchema.optional(),
  // Product attribute fields (all optional)
  materials: z
    .array(
      z.object({
        brand_material_id: uuidSchema,
        percentage: percentageSchema.optional(),
      }),
    )
    .optional(),
  ecoClaims: uuidArraySchema.optional(),
  environment: z
    .object({
      carbon_kg_co2e: z.string().optional(),
      water_liters: z.string().optional(),
    })
    .optional(),
  journeySteps: z
    .array(
      z.object({
        sort_index: nonNegativeIntSchema,
        step_type: shortStringSchema,
        facility_id: uuidSchema,
      }),
    )
    .optional(),
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
 * Accepts a batch of variants that should be created or updated in place.
 * Omits destructive operations so clients must call the delete endpoint for
 * intentional removals.
 */
export const productVariantsUpsertSchema = z.object({
  product_id: uuidSchema,
  variants: z
    .array(
      z
        .object({
          id: uuidSchema.optional(),
          color_id: uuidSchema.optional().nullable(),
          size_id: uuidSchema.optional().nullable(),
          upid: shortStringSchema.optional().nullable(),
        })
        .refine((value) => value.id || value.upid, {
          message:
            "Each variant must include an id or upid to ensure stable updates.",
        }),
    )
    .min(1),
});

export type ProductVariantsUpsertInput = z.infer<
  typeof productVariantsUpsertSchema
>;

/**
 * Input payload for `products.variants.delete`.
 *
 * Supports deleting by explicit variant identifiers or by product-level
 * filters that can remove multiple rows at once.
 */
export const productVariantsDeleteSchema = z.union([
  z.object({
    variant_ids: uuidArraySchema.min(1),
  }),
  z.object({
    product_id: uuidSchema,
    filter: z
      .object({
        color_id: uuidSchema.optional(),
        size_id: uuidSchema.optional(),
      })
      .optional(),
  }),
]);

export type ProductVariantsDeleteInput = z.infer<
  typeof productVariantsDeleteSchema
>;
