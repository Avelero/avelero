import { z } from "zod";
import {
  createModuleSchemas,
  registerModuleSchemas,
  type InferModuleFilter,
  type InferModuleSort,
  type InferModuleInclude,
  type InferModuleWhere,
  type InferModuleData,
  type InferModuleMetrics,
  validationPatterns,
} from "../shared";

// ================================
// Variants Module Schema Extensions
// ================================

/**
 * Variant-specific filter extensions
 * Extends base filter schema with variant-specific fields
 */
const variantFilterExtensions = {
  // Variant-specific identifiers
  variantIds: z.array(z.string().uuid()).optional(),
  productIds: z.array(z.string().uuid()).optional(),
  skus: z.array(z.string()).optional(),
  upids: z.array(z.string()).optional(),

  // Variant attributes
  colorIds: z.array(z.string().uuid()).optional(),
  sizeIds: z.array(z.string().uuid()).optional(),
  colorNames: z.array(z.string()).optional(),
  sizeNames: z.array(z.string()).optional(),

  // Image filtering
  hasProductImage: z.boolean().optional(),
  imageUrlPattern: z.string().optional(),

  // SKU/UPID patterns
  skuPattern: z.string().optional(),
  upidPattern: z.string().optional(),

  // Identifier validation
  hasValidSku: z.boolean().optional(),
  hasValidUpid: z.boolean().optional(),
  identifierValidationStatus: z
    .enum(["valid", "invalid", "missing", "duplicate"])
    .optional(),

  // Variant completion status
  isComplete: z.boolean().optional(),
  completenessScore: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    })
    .optional(),

  // Product relationship filters
  productSeasons: z.array(z.string()).optional(),
  productCategoryIds: z.array(z.string().uuid()).optional(),
  productShowcaseBrandIds: z.array(z.string().uuid()).optional(),

  // Identifier duplication detection
  hasDuplicateIdentifiers: z.boolean().optional(),
  identifierType: z.enum(["sku", "upid", "both"]).optional(),
} as const;

/**
 * Variant-specific sortable fields
 */
const variantSortFields = [
  "sku",
  "upid",
  "colorName",
  "sizeName",
  "completenessScore",
  "validationScore",
  "productName",
  "productSeason",
] as const;

/**
 * Variant-specific include relations
 */
const variantIncludeExtensions = {
  // Variant relations
  product: z.boolean().default(false),
  color: z.boolean().default(false),
  size: z.boolean().default(false),

  // Through product relations
  productCategory: z.boolean().default(false),
  productShowcaseBrand: z.boolean().default(false),
  productCertification: z.boolean().default(false),

  // Variant attributes
  identifiers: z.boolean().default(false),
  validationResults: z.boolean().default(false),

  // Aggregated data
  completenessData: z.boolean().default(false),
  duplicateCheck: z.boolean().default(false),

  // Full product hierarchy
  fullProductHierarchy: z.boolean().default(false),
} as const;

/**
 * Variant-specific where conditions
 */
const variantWhereExtensions = {
  // Exact variant matches
  variantId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  sku: z.string().optional(),
  upid: z.string().optional(),

  // Variant attributes
  colorId: z.string().uuid().optional(),
  sizeId: z.string().uuid().optional(),
  colorName: z.string().optional(),
  sizeName: z.string().optional(),

  // Validation conditions
  isValidVariant: z.boolean().optional(),
  hasValidationErrors: z.boolean().optional(),
  completenessScoreExact: z.number().min(0).max(100).optional(),

  // Image conditions
  hasProductImageUrl: z.boolean().optional(),

  // Identifier conditions
  skuExists: z.boolean().optional(),
  upidExists: z.boolean().optional(),
  hasDuplicateSku: z.boolean().optional(),
  hasDuplicateUpid: z.boolean().optional(),

  // Product relationship conditions
  productSeason: z.string().optional(),
  productCategoryId: z.string().uuid().optional(),
} as const;

/**
 * Variant-specific data fields for mutations
 */
const variantDataExtensions = {
  // Core variant fields
  sku: z.string().max(50).optional().nullable(),
  upid: z.string().max(50),
  productImageUrl: validationPatterns.url.optional().nullable(),

  // Attribute relationships
  colorId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid().optional().nullable(),

  // Validation fields
  completenessScore: z.number().min(0).max(100).optional(),
  validationScore: z.number().min(0).max(100).optional(),
  validationNotes: z.string().max(1000).optional(),

  // Identifier management
  skipSkuValidation: z.boolean().optional(),
  skipUpidValidation: z.boolean().optional(),
  forceSkuUpdate: z.boolean().optional(),
  forceUpidUpdate: z.boolean().optional(),

  // Image management
  productImageUpdated: z.boolean().optional(),
  removeProductImage: z.boolean().optional(),

  // Sync tracking
  lastSyncAt: z.date().optional(),
  syncSource: z.enum(["manual", "api", "import", "batch"]).optional(),
} as const;

/**
 * Variant-specific metrics for aggregations
 */
const variantAdditionalMetrics = [
  "skuStatistics",
  "upidStatistics",
  "colorDistribution",
  "sizeDistribution",
  "completenessStatistics",
  "imageStatistics",
  "validationStatistics",
  "productVariantCounts",
  "identifierDuplication",
  "attributeCombinations",
  "syncHealth",
  "orphanedVariants",
  "passportLinkageStats",
  "categoryDistribution",
] as const;

/**
 * Create and register the variants module schemas
 */
export const variantsSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "variants",
    filterExtensions: variantFilterExtensions,
    sortFields: variantSortFields,
    includeExtensions: variantIncludeExtensions,
    whereExtensions: variantWhereExtensions,
    dataExtensions: variantDataExtensions,
    additionalMetrics: variantAdditionalMetrics,
    strict: true,
  }),
);

// ================================
// Type Exports for Variants Module
// ================================

export type VariantsFilter = InferModuleFilter<typeof variantsSchemas>;
export type VariantsSort = InferModuleSort<typeof variantsSchemas>;
export type VariantsInclude = InferModuleInclude<typeof variantsSchemas>;
export type VariantsWhere = InferModuleWhere<typeof variantsSchemas>;
export type VariantsData = InferModuleData<typeof variantsSchemas>;
export type VariantsMetrics = InferModuleMetrics<typeof variantsSchemas>;

// ================================
// Variant-Specific Validation Schemas
// ================================

/**
 * Variant creation schema with extended validation
 */
export const createVariantSchema = variantsSchemas.dataSchema
  .extend({
    // Required fields for creation
    productId: z.string().uuid(),
    upid: z.string().min(1).max(50),

    // Optional but validated fields
    sku: z.string().max(50).optional(),
    colorId: z.string().uuid().optional(),
    sizeId: z.string().uuid().optional(),
    productImageUrl: validationPatterns.url.optional(),
  })
  .strict();

/**
 * Variant update schema with extended validation
 */
export const updateVariantSchema = variantsSchemas.dataSchema
  .partial()
  .extend({
    // Always require ID for updates
    id: z.string().uuid(),
  })
  .strict();

/**
 * Variant bulk update schema
 */
export const bulkUpdateVariantSchema = z
  .object({
    selection: variantsSchemas.createSelectionSchema(),
    data: variantsSchemas.dataSchema.partial(),
    preview: z.boolean().default(false),
  })
  .strict();

/**
 * Variant list input schema
 */
export const listVariantsSchema = z
  .object({
    filter: variantsSchemas.filterSchema.optional(),
    sort: variantsSchemas.sortSchema.optional(),
    pagination: variantsSchemas.paginationSchema.optional(),
    include: variantsSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Variant get input schema
 */
export const getVariantSchema = z
  .object({
    where: variantsSchemas.whereSchema,
    include: variantsSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Variant metrics input schema
 */
export const variantMetricsSchema = z
  .object({
    filter: variantsSchemas.filterSchema.optional(),
    metrics: variantsSchemas.metricsSchema,
  })
  .strict();

// ================================
// Variant-Specific Helper Functions
// ================================

/**
 * Validates variant SKU format (example business rule)
 */
export const validateVariantSku = (sku: string): boolean => {
  // Example: Variant SKU should be 6-15 characters, alphanumeric with dashes
  const skuPattern = /^[A-Z0-9-]{6,15}$/;
  return skuPattern.test(sku);
};

/**
 * Validates variant UPID format (example business rule)
 */
export const validateVariantUpid = (upid: string): boolean => {
  // Example: Variant UPID should be 8-12 characters, alphanumeric
  const upidPattern = /^[A-Z0-9]{8,12}$/;
  return upidPattern.test(upid);
};

/**
 * Calculates variant completeness score
 */
export const calculateVariantCompleteness = (variant: {
  sku?: string;
  upid?: string;
  colorId?: string;
  sizeId?: string;
  productImageUrl?: string;
}): number => {
  let score = 0;
  const maxScore = 5;

  if (variant.upid) score += 1; // UPID is required
  if (variant.sku) score += 1;
  if (variant.colorId) score += 1;
  if (variant.sizeId) score += 1;
  if (variant.productImageUrl) score += 1;

  return Math.round((score / maxScore) * 100);
};

/**
 * Transforms variant data before validation (example)
 */
export const transformVariantData = (data: any): any => {
  return {
    ...data,
    // Normalize SKU to uppercase
    sku: data.sku?.trim().toUpperCase(),
    // Normalize UPID to uppercase
    upid: data.upid?.trim().toUpperCase(),
    // Clean URLs
    productImageUrl: data.productImageUrl?.trim() || undefined,
  };
};

/**
 * Checks for duplicate identifiers within a dataset
 */
export const checkVariantIdentifierDuplicates = (
  variants: Array<{
    id?: string;
    sku?: string;
    upid?: string;
  }>,
): {
  duplicateSkus: Array<{ sku: string; variantIds: string[] }>;
  duplicateUpids: Array<{ upid: string; variantIds: string[] }>;
} => {
  const skuGroups = new Map<string, string[]>();
  const upidGroups = new Map<string, string[]>();

  variants.forEach((variant) => {
    if (!variant.id) return;

    if (variant.sku) {
      const existing = skuGroups.get(variant.sku) || [];
      existing.push(variant.id);
      skuGroups.set(variant.sku, existing);
    }

    if (variant.upid) {
      const existing = upidGroups.get(variant.upid) || [];
      existing.push(variant.id);
      upidGroups.set(variant.upid, existing);
    }
  });

  const duplicateSkus = Array.from(skuGroups.entries())
    .filter(([_, ids]) => ids.length > 1)
    .map(([sku, variantIds]) => ({ sku, variantIds }));

  const duplicateUpids = Array.from(upidGroups.entries())
    .filter(([_, ids]) => ids.length > 1)
    .map(([upid, variantIds]) => ({ upid, variantIds }));

  return { duplicateSkus, duplicateUpids };
};

/**
 * Generates variant display name from attributes
 */
export const generateVariantDisplayName = (variant: {
  product?: { name?: string };
  color?: { name?: string };
  size?: { name?: string };
  sku?: string;
}): string => {
  const parts: string[] = [];

  if (variant.product?.name) {
    parts.push(variant.product.name);
  }

  if (variant.color?.name) {
    parts.push(variant.color.name);
  }

  if (variant.size?.name) {
    parts.push(variant.size.name);
  }

  if (parts.length === 0 && variant.sku) {
    return `Variant ${variant.sku}`;
  }

  return parts.join(" - ") || "Unnamed Variant";
};

// ================================
// Re-export schemas for convenience
// ================================

export const {
  filterSchema: variantFilterSchema,
  sortSchema: variantSortSchema,
  includeSchema: variantIncludeSchema,
  whereSchema: variantWhereSchema,
  dataSchema: variantDataSchema,
  metricsSchema: variantMetricsSchemaBase,
  paginationSchema: variantPaginationSchema,
  createListResponse: createVariantListResponse,
  createGetResponse: createVariantGetResponse,
  createMutationResponse: createVariantMutationResponse,
  createAggregateResponse: createVariantAggregateResponse,
  createBulkResponse: createVariantBulkResponse,
  createPreviewResponse: createVariantPreviewResponse,
} = variantsSchemas;
