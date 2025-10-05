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
import { entityStatusEnum } from "../enums";

// ================================
// Products Module Schema Extensions
// ================================

/**
 * Product-specific filter extensions
 * Extends base filter schema with product-specific fields
 */
const productFilterExtensions = {
  // Product-specific identifiers
  productIds: z.array(z.string().uuid()).optional(),
  skus: z.array(z.string()).optional(),
  upids: z.array(z.string()).optional(),

  // Product attributes
  seasonIds: z.array(z.string().uuid()).optional(),
  seasons: z.array(z.string()).optional(),
  certificationIds: z.array(z.string().uuid()).optional(),
  showcaseBrandIds: z.array(z.string().uuid()).optional(),

  // Image filtering
  hasImages: z.boolean().optional(),
  imageUrlPattern: z.string().optional(),

  // Variant-related filters
  hasVariants: z.boolean().optional(),
  variantCount: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),

  // Content filtering
  namePattern: z.string().optional(),
  descriptionPattern: z.string().optional(),
  hasDescription: z.boolean().optional(),

  // Advanced filters
  materialIds: z.array(z.string().uuid()).optional(),
  careCodeIds: z.array(z.string().uuid()).optional(),
  ecoClaimIds: z.array(z.string().uuid()).optional(),
  journeyStepIds: z.array(z.string().uuid()).optional(),

  // Size and color filters (through variants)
  availableSizeIds: z.array(z.string().uuid()).optional(),
  availableColorIds: z.array(z.string().uuid()).optional(),

  // Collection filtering
  collectionIds: z.array(z.string().uuid()).optional(),

  // Validation status
  validationStatus: z
    .enum(["valid", "invalid", "pending", "warning"])
    .optional(),
  hasValidationIssues: z.boolean().optional(),
} as const;

/**
 * Product-specific sortable fields
 */
const productSortFields = [
  "season",
  "variantCount",
  "imageCount",
  "validationScore",
  "lastSyncAt",
  "publishedAt",
] as const;

/**
 * Product-specific include relations
 */
const productIncludeExtensions = {
  // Product relations
  variants: z.boolean().default(false),
  showcaseBrand: z.boolean().default(false),
  certification: z.boolean().default(false),

  // Product attributes
  materials: z.boolean().default(false),
  careCodes: z.boolean().default(false),
  ecoClaims: z.boolean().default(false),
  journeySteps: z.boolean().default(false),
  identifiers: z.boolean().default(false),

  // Aggregated data
  variantCounts: z.boolean().default(false),
  imageCounts: z.boolean().default(false),
  validationSummary: z.boolean().default(false),

  // Environmental data
  environment: z.boolean().default(false),

  // Related collections
  collections: z.boolean().default(false),
} as const;

/**
 * Product-specific where conditions
 */
const productWhereExtensions = {
  // Exact product matches
  productId: z.string().uuid().optional(),
  sku: z.string().optional(),
  upid: z.string().optional(),

  // Product attributes
  seasonId: z.string().uuid().optional(),
  season: z.string().optional(),
  certificationId: z.string().uuid().optional(),
  showcaseBrandId: z.string().uuid().optional(),

  // Content conditions
  nameExact: z.string().optional(),
  descriptionExact: z.string().optional(),

  // Validation conditions
  isValid: z.boolean().optional(),
  hasWarnings: z.boolean().optional(),
  validationScoreMin: z.number().min(0).max(100).optional(),

  // Image conditions
  hasImageUrl: z.boolean().optional(),
  primaryImageExists: z.boolean().optional(),

  // Variant conditions
  hasAnyVariants: z.boolean().optional(),
  variantCountExact: z.number().int().min(0).optional(),
} as const;

/**
 * Product-specific data fields for mutations
 */
const productDataExtensions = {
  // Product-specific fields
  season: z.string().max(50).optional(),
  primaryImageUrl: validationPatterns.url.optional().nullable(),

  // Relationship updates
  showcaseBrandId: z.string().uuid().optional().nullable(),
  certificationId: z.string().uuid().optional().nullable(),

  // Validation fields
  validationScore: z.number().min(0).max(100).optional(),
  validationNotes: z.string().max(1000).optional(),

  // Sync tracking
  lastSyncAt: z.date().optional(),
  syncSource: z.enum(["manual", "api", "import", "batch"]).optional(),

  // Content fields
  nameUpdated: z.boolean().optional(),
  descriptionUpdated: z.boolean().optional(),

  // Image management
  imageUrls: z.array(validationPatterns.url).optional(),
  removeImages: z.array(z.string()).optional(),
} as const;

/**
 * Product-specific metrics for aggregations
 */
const productAdditionalMetrics = [
  "variantStatistics",
  "imageStatistics",
  "seasonDistribution",
  "certificationDistribution",
  "validationMetrics",
  "materialUsage",
  "careCodeUsage",
  "ecoClaimUsage",
  "collectionMembership",
  "syncHealth",
  "imageQuality",
  "contentCompleteness",
] as const;

/**
 * Create and register the products module schemas
 */
export const productsSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "products",
    filterExtensions: productFilterExtensions,
    sortFields: productSortFields,
    includeExtensions: productIncludeExtensions,
    whereExtensions: productWhereExtensions,
    dataExtensions: productDataExtensions,
    additionalMetrics: productAdditionalMetrics,
    strict: true,
  }),
);

// ================================
// Type Exports for Products Module
// ================================

export type ProductsFilter = InferModuleFilter<typeof productsSchemas>;
export type ProductsSort = InferModuleSort<typeof productsSchemas>;
export type ProductsInclude = InferModuleInclude<typeof productsSchemas>;
export type ProductsWhere = InferModuleWhere<typeof productsSchemas>;
export type ProductsData = InferModuleData<typeof productsSchemas>;
export type ProductsMetrics = InferModuleMetrics<typeof productsSchemas>;

// ================================
// Product-Specific Validation Schemas
// ================================

/**
 * Product creation schema with extended validation
 */
export const createProductSchema = productsSchemas.dataSchema
  .extend({
    // Required fields for creation
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),

    // Required relationships
    categoryId: z.string().uuid(),

    // Optional but validated fields
    season: z.string().max(50).optional(),
    primaryImageUrl: validationPatterns.url.optional(),
    showcaseBrandId: z.string().uuid().optional(),
    certificationId: z.string().uuid().optional(),
  })
  .strict();

/**
 * Product update schema with extended validation
 */
export const updateProductSchema = productsSchemas.dataSchema
  .partial()
  .extend({
    // Always require ID for updates
    id: z.string().uuid(),
  })
  .strict();

/**
 * Product bulk update schema
 */
export const bulkUpdateProductSchema = z
  .object({
    selection: productsSchemas.createSelectionSchema(),
    data: productsSchemas.dataSchema.partial(),
    preview: z.boolean().default(false),
  })
  .strict();

/**
 * Product list input schema
 */
export const listProductsSchema = z
  .object({
    filter: productsSchemas.filterSchema.optional(),
    sort: productsSchemas.sortSchema.optional(),
    pagination: productsSchemas.paginationSchema.optional(),
    include: productsSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Product get input schema
 */
export const getProductSchema = z
  .object({
    where: productsSchemas.whereSchema,
    include: productsSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Product metrics input schema
 */
export const productMetricsSchema = z
  .object({
    filter: productsSchemas.filterSchema.optional(),
    metrics: productsSchemas.metricsSchema,
  })
  .strict();

// ================================
// Product-Specific Helper Functions
// ================================

/**
 * Validates product SKU format (example business rule)
 */
export const validateProductSku = (sku: string): boolean => {
  // Example: SKU should be 8-12 characters, alphanumeric with dashes
  const skuPattern = /^[A-Z0-9-]{8,12}$/;
  return skuPattern.test(sku);
};

/**
 * Validates product UPID format (example business rule)
 */
export const validateProductUpid = (upid: string): boolean => {
  // Example: UPID should be exactly 10 characters, alphanumeric
  const upidPattern = /^[A-Z0-9]{10}$/;
  return upidPattern.test(upid);
};

/**
 * Calculates product completeness score
 */
export const calculateProductCompleteness = (product: {
  name?: string;
  description?: string;
  categoryId?: string;
  primaryImageUrl?: string;
  season?: string;
}): number => {
  let score = 0;
  const maxScore = 5;

  if (product.name) score += 1;
  if (product.description && product.description.length > 10) score += 1;
  if (product.categoryId) score += 1;
  if (product.primaryImageUrl) score += 1;
  if (product.season) score += 1;

  return Math.round((score / maxScore) * 100);
};

/**
 * Transforms product data before validation (example)
 */
export const transformProductData = (data: any): any => {
  return {
    ...data,
    // Normalize season to uppercase
    season: data.season?.toUpperCase(),
    // Trim and clean name
    name: data.name?.trim(),
    // Clean description
    description: data.description?.trim() || undefined,
  };
};

// ================================
// Re-export schemas for convenience
// ================================

export const {
  filterSchema: productFilterSchema,
  sortSchema: productSortSchema,
  includeSchema: productIncludeSchema,
  whereSchema: productWhereSchema,
  dataSchema: productDataSchema,
  metricsSchema: productMetricsSchemaBase,
  paginationSchema: productPaginationSchema,
  createListResponse: createProductListResponse,
  createGetResponse: createProductGetResponse,
  createMutationResponse: createProductMutationResponse,
  createAggregateResponse: createProductAggregateResponse,
  createBulkResponse: createProductBulkResponse,
  createPreviewResponse: createProductPreviewResponse,
} = productsSchemas;
