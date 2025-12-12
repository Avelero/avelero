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
  "manufacturer_id",
  "primary_image_path",
  "product_identifier",
  "upid",
  "status",
  "created_at",
  "updated_at",
] as const;

/**
 * Type representing all available product field names.
 */
export type ProductField = (typeof PRODUCT_FIELDS)[number];

// ============================================================================
// FilterState Schema Definitions
// ============================================================================

/**
 * Filter value types matching FilterValue from filter-types.ts
 */
// Date range object - must be checked early in union to match correctly
// Requires at least one of 'after' or 'before' to be present and non-empty
const dateRangeValueSchema = z
  .object({
    after: z.string().optional(), // ISO date string (empty string is valid)
    before: z.string().optional(), // ISO date string (empty string is valid)
  })
  .passthrough() // Allow additional properties to pass through
  .refine(
    (val) => {
      // At least one of after or before must be present and non-empty
      const hasAfter = val.after != null && val.after !== "";
      const hasBefore = val.before != null && val.before !== "";
      return hasAfter || hasBefore;
    },
    {
      message: "Date range must have at least 'after' or 'before' with a value",
    },
  )
  .refine(
    (val) => {
      // Cannot have min/max properties (those belong to number range)
      return !("min" in val) && !("max" in val);
    },
    { message: "Date range cannot have min/max properties" },
  );

// Number range object - requires at least one of min or max
const numberRangeValueSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .passthrough() // Allow additional properties to pass through
  .refine(
    (val) => {
      // At least one of min or max must be present
      return val.min != null || val.max != null;
    },
    { message: "Number range must have at least 'min' or 'max'" },
  )
  .refine(
    (val) => {
      // Cannot have after/before properties (those belong to date range)
      return !("after" in val) && !("before" in val);
    },
    { message: "Number range cannot have after/before properties" },
  );

const filterValueSchema: z.ZodType<any> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  // Date range - check early since it's a common case
  dateRangeValueSchema,
  z.object({
    date: z.string(), // ISO date string
  }),
  z.object({
    type: z.literal("relative"),
    option: z.enum([
      "today",
      "yesterday",
      "last 7 days",
      "last 30 days",
      "this month",
      "last month",
      "this quarter",
      "this year",
      "more than X days ago",
    ]),
    customDays: z.number().optional(),
  }),
  // Number range - after date range to avoid conflicts
  numberRangeValueSchema,
  z.null(),
  z.undefined(),
]);

/**
 * Filter condition schema matching FilterCondition
 * Uses z.lazy for recursive nested conditions support
 */
const filterConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    fieldId: z.string(),
    operator: z.string(), // All operators from FilterOperator type
    value: filterValueSchema,
    nestedConditions: z.array(filterConditionSchema).optional(),
  }),
);

/**
 * Filter group schema matching FilterGroup
 */
const filterGroupSchema = z.object({
  id: z.string(),
  conditions: z.array(filterConditionSchema), // OR logic within group
  asGroup: z.boolean().optional(),
});

/**
 * Filter state schema matching FilterState
 * Groups are ANDed together, conditions within groups are ORed
 */
const filterStateSchema = z.object({
  groups: z.array(filterGroupSchema), // AND logic between groups
});

/**
 * Cursor-based listing parameters for product tables.
 *
 * Updated to use FilterState for advanced filtering and search as top-level parameter.
 */
export const listProductsSchema = z.object({
  cursor: z.string().optional(),
  limit: paginationLimitSchema.optional(),
  fields: createFieldSelection(PRODUCT_FIELDS),
  // Advanced filters using FilterState structure (groups with AND/OR logic)
  filters: filterStateSchema.optional(),
  // Search is now top-level, separate from advanced filters
  search: shortStringSchema.optional(),
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
  manufacturer_id: uuidSchema.optional(),
  /** Storage path for the product image (not full URL) */
  primary_image_path: z.string().max(500).optional(),
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
  "manufacturer_id",
  "primary_image_path",
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

// ============================================================================
// FilterState Type Exports
// ============================================================================

/**
 * Type exports for FilterState structures (matching client-side filter-types.ts)
 */
export type FilterValue = z.infer<typeof filterValueSchema>;
export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type FilterGroup = z.infer<typeof filterGroupSchema>;
export type FilterState = z.infer<typeof filterStateSchema>;
