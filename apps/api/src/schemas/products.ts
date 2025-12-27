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
  productHandleSchema,
  shortStringSchema,
  urlSchema,
  uuidArraySchema,
  uuidSchema,
} from "./_shared/primitives.js";

// ============================================================================
// UPID Schema
// ============================================================================

/**
 * UPID (Unique Product Identifier) schema.
 * 16-character alphanumeric string used for URL-friendly product identification.
 */
export const upidSchema = z
  .string()
  .length(16, "UPID must be 16 characters")
  .regex(/^[a-zA-Z0-9]+$/, "UPID must be alphanumeric");

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
  "image_path",
  "product_handle",
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
        "productHandle",
        "variantCount",
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
   * URL-friendly identifier that uniquely identifies the product within a brand.
   * Used in DPP URLs: /[brandSlug]/[productHandle]/
   * Must be lowercase letters, numbers, and dashes only.
   * If not provided, will be auto-generated from the product name.
   */
  product_handle: productHandleSchema.optional(),
  description: longStringSchema.optional(),
  category_id: uuidSchema.optional(),
  season_id: uuidSchema.optional(), // FK to brand_seasons.id
  manufacturer_id: uuidSchema.optional(),
  /** Storage path for the product image (not full URL) */
  image_path: z.string().max(500).optional(),
  status: shortStringSchema.optional(),
  // NOTE: color_ids and size_ids removed as part of variant attribute migration.
  // Variants are now created via products.variants.upsert with the generic attribute system.
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
        facility_id: uuidSchema, // 1:1 relationship with facility
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
  "image_path",
  "status",
  "product_handle",
]);

/**
 * Payload for deleting a product (single).
 */
export const deleteProductSchema = byIdSchema;

// ============================================================================
// Unified Selection Schema for Bulk Operations
// ============================================================================

/**
 * Selection schema for bulk operations.
 * Supports two modes:
 * - 'explicit': Operate on specific products by ID (manual selection)
 * - 'all': Operate on all products matching filters, optionally excluding some IDs
 */
export const bulkSelectionSchema = z.discriminatedUnion("mode", [
  // Explicit mode: specific IDs (manual selection)
  z.object({
    mode: z.literal("explicit"),
    ids: uuidArraySchema.min(1, "At least one product ID is required"),
  }),
  // All mode: all matching filters except excluded IDs
  z.object({
    mode: z.literal("all"),
    filters: filterStateSchema.optional(),
    search: shortStringSchema.optional(),
    excludeIds: uuidArraySchema.optional(),
  }),
]);

export type BulkSelection = z.infer<typeof bulkSelectionSchema>;

/**
 * Unified delete schema supporting both single and bulk operations.
 * 
 * Single mode: { id: string }
 * Bulk mode: { selection: BulkSelection }
 */
export const unifiedDeleteSchema = z.union([
  // Single product delete
  z.object({
    id: uuidSchema,
    brand_id: uuidSchema.optional(),
  }),
  // Bulk delete
  z.object({
    selection: bulkSelectionSchema,
    brand_id: uuidSchema.optional(),
  }),
]);

export type UnifiedDeleteInput = z.infer<typeof unifiedDeleteSchema>;

/**
 * Fields that can be bulk updated across multiple products.
 * Limited to fields where mass updates make sense (e.g., status, category).
 */
export const bulkUpdateFieldsSchema = z.object({
  status: shortStringSchema.optional(),
  category_id: uuidSchema.nullable().optional(),
  season_id: uuidSchema.nullable().optional(),
});

export type BulkUpdateFields = z.infer<typeof bulkUpdateFieldsSchema>;

/**
 * Unified update schema supporting both single and bulk operations.
 * 
 * Single mode: { id: string, ...allUpdateFields }
 * Bulk mode: { selection: BulkSelection, ...bulkUpdateFields }
 */
export const unifiedUpdateSchema = z.union([
  // Single product update (all fields available)
  updateProductSchema.extend({
    brand_id: uuidSchema.optional(),
  }),
  // Bulk update (limited fields)
  z.object({
    selection: bulkSelectionSchema,
    brand_id: uuidSchema.optional(),
  }).merge(bulkUpdateFieldsSchema),
]);

export type UnifiedUpdateInput = z.infer<typeof unifiedUpdateSchema>;

/**
 * @deprecated Use unifiedDeleteSchema instead
 * Payload for bulk deleting products (legacy).
 */
export const bulkDeleteProductsSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("explicit"),
    ids: uuidArraySchema.min(1, "At least one product ID is required"),
    brand_id: uuidSchema.optional(),
  }),
  z.object({
    mode: z.literal("all"),
    filters: filterStateSchema.optional(),
    search: shortStringSchema.optional(),
    exclude_ids: uuidArraySchema.optional(),
    brand_id: uuidSchema.optional(),
  }),
]);

/**
 * Payload for fetching all product IDs matching filters.
 * Used for bulk operations when "select all" is active.
 * Returns all matching IDs without pagination.
 */
export const listProductIdsSchema = z.object({
  brand_id: uuidSchema.optional(),
  // Advanced filters using FilterState structure
  filters: filterStateSchema.optional(),
  // Search term
  search: shortStringSchema.optional(),
  // Optional list of IDs to exclude from results
  excludeIds: uuidArraySchema.optional(),
});

export type ListProductIdsInput = z.infer<typeof listProductIdsSchema>;

/**
 * Upsert payload used for product-level identifiers.
 */
export const upsertProductHandleSchema = z.object({
  product_id: uuidSchema,
  handle: productHandleSchema,
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
 * Schema for individual variant metadata (SKU and barcode).
 */
export const variantMetadataSchema = z.object({
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
});

/**
 * Schema for explicit variant input (includes attribute assignments).
 */
export const explicitVariantSchema = z.object({
  /** Optional SKU */
  sku: z.string().max(100).optional(),
  /** Optional barcode */
  barcode: z.string().max(100).optional(),
  /** Optional UPID - auto-generated if not provided */
  upid: upidSchema.optional(),
  /** Ordered list of attribute value IDs (can be empty for variants without attributes) */
  attribute_value_ids: uuidArraySchema.optional().default([]),
});

/**
 * Schema for a matrix dimension (one attribute with multiple values).
 */
export const matrixDimensionSchema = z.object({
  /** The brand attribute ID */
  attribute_id: uuidSchema,
  /** The brand attribute value IDs for this dimension (max 50 values) */
  value_ids: uuidArraySchema.min(1, "At least one value is required per dimension").max(50, "Maximum 50 values allowed per dimension"),
});

/**
 * Upsert/replace variants for a product using the generic attribute system.
 * 
 * Supports two modes:
 * - **explicit**: Provide explicit variant definitions with attribute assignments
 * - **matrix**: Provide dimensions and auto-generate cartesian product of variants
 */
export const productVariantsUpsertSchema = z.discriminatedUnion("mode", [
  // Explicit mode: caller provides complete variant definitions
  z.object({
    product_id: uuidSchema,
    mode: z.literal("explicit"),
    /** Explicit variant definitions with attribute assignments */
    variants: z.array(explicitVariantSchema).max(500, "Maximum 500 variants allowed"),
  }),
  // Matrix mode: server generates cartesian product from dimensions
  z.object({
    product_id: uuidSchema,
    mode: z.literal("matrix"),
    /** 
     * Ordered dimensions for cartesian product generation.
     * Max 3 dimensions, each with max 50 values.
     * Example: [{ attribute_id: "color", value_ids: ["red", "blue"] }, { attribute_id: "size", value_ids: ["S", "M"] }]
     */
    dimensions: z.array(matrixDimensionSchema).max(3, "Maximum 3 dimensions allowed"),
    /** 
     * Optional metadata for specific combinations, keyed by pipe-separated value IDs.
     * Example: { "red-value-id|S-value-id": { sku: "SKU001" } }
     */
    variant_metadata: z.record(z.string(), variantMetadataSchema).optional(),
  }),
]);

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
 * Input payload for bulk product deletion.
 */
export type BulkDeleteProductsInput = z.infer<typeof bulkDeleteProductsSchema>;

/**
 * Input payload for `products.variants.upsert`.
 *
 * Supports two modes:
 * - explicit: Provide complete variant definitions with attribute assignments
 * - matrix: Provide dimensions for cartesian product generation
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
// Unified Schemas (API Redesign)
// ============================================================================

/**
 * Unified product get schema accepting either ID or handle.
 * Replaces separate `productsDomainGetSchema` and `productsDomainGetByUpidSchema`.
 */
export const productUnifiedGetSchema = z.intersection(
  z.union([
    z.object({ id: uuidSchema }),
    z.object({ handle: shortStringSchema }),
  ]),
  z.object({
    includeVariants: z.boolean().optional().default(false),
    includeAttributes: z.boolean().optional().default(false),
  }),
);

export type ProductUnifiedGetInput = z.infer<typeof productUnifiedGetSchema>;

/**
 * Unified variant list schema accepting either product_id or product_handle.
 * Supports listing variants by product ID or handle.
 */
export const variantUnifiedListSchema = z.intersection(
  z.union([
    z.object({ product_id: uuidSchema }),
    z.object({ product_handle: shortStringSchema }),
  ]),
  z.object({
    cursor: z.string().optional(),
    limit: paginationLimitSchema.optional(),
  }),
);

export type VariantUnifiedListInput = z.infer<typeof variantUnifiedListSchema>;

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
