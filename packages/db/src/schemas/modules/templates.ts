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
// Templates Module Schema Extensions
// ================================

/**
 * Template-specific filter extensions
 * Extends base filter schema with template-specific fields
 */
const templateFilterExtensions = {
  // Template-specific identifiers
  templateIds: z.array(z.string().uuid()).optional(),
  templateTypes: z.array(z.enum(["passport", "product", "custom"])).optional(),
  templateStatus: z.array(entityStatusEnum).optional(),

  // Template behavior filters
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  allowCustomization: z.boolean().optional(),

  // Module relationship filters
  moduleIds: z.array(z.string().uuid()).optional(),
  hasModules: z.boolean().optional(),
  moduleCount: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),

  // Usage filters
  usageCount: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  hasBeenUsed: z.boolean().optional(),
  lastUsedRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),

  // Content filters
  namePattern: z.string().optional(),
  descriptionPattern: z.string().optional(),
  hasDescription: z.boolean().optional(),

  // Validation filters
  validationScore: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    })
    .optional(),

  // Language filters
  languages: z.array(z.string()).optional(),
  primaryLanguage: z.string().optional(),
  hasTranslations: z.boolean().optional(),

  // Version filters
  version: z.string().optional(),
  hasParentTemplate: z.boolean().optional(),
  parentTemplateIds: z.array(z.string().uuid()).optional(),
} as const;

/**
 * Template-specific sortable fields
 */
const templateSortFields = [
  "templateType",
  "templateStatus",
  "usageCount",
  "lastUsedAt",
  "validationScore",
  "version",
  "moduleCount",
] as const;

/**
 * Template-specific include relations
 */
const templateIncludeExtensions = {
  // Template relations
  modules: z.boolean().default(false),
  parentTemplate: z.boolean().default(false),
  childTemplates: z.boolean().default(false),

  // Usage statistics
  usageStats: z.boolean().default(false),
  passportCounts: z.boolean().default(false),

  // Configuration details
  fieldDefinitions: z.boolean().default(false),
  validationRules: z.boolean().default(false),

  // Localization
  translations: z.boolean().default(false),
  languageData: z.boolean().default(false),
} as const;

/**
 * Template-specific where conditions
 */
const templateWhereExtensions = {
  // Exact template matches
  templateId: z.string().uuid().optional(),
  templateType: z.enum(["passport", "product", "custom"]).optional(),
  exactStatus: entityStatusEnum.optional(),

  // Template behavior conditions
  isEnabled: z.boolean().optional(),
  isDefaultTemplate: z.boolean().optional(),
  allowsCustomization: z.boolean().optional(),

  // Module conditions
  moduleId: z.string().uuid().optional(),
  hasSpecificModules: z.array(z.string().uuid()).optional(),
  moduleCountExact: z.number().int().min(0).optional(),

  // Usage conditions
  usageCountExact: z.number().int().min(0).optional(),
  usedAfter: z.date().optional(),
  usedBefore: z.date().optional(),
  neverUsed: z.boolean().optional(),

  // Version conditions
  exactVersion: z.string().optional(),
  parentTemplateId: z.string().uuid().optional(),
  isParentTemplate: z.boolean().optional(),

  // Language conditions
  primaryLanguageCode: z.string().optional(),
  hasLanguage: z.string().optional(),
} as const;

/**
 * Template-specific data fields for mutations
 */
const templateDataExtensions = {
  // Core template fields
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  templateType: z.enum(["passport", "product", "custom"]).optional(),
  templateStatus: entityStatusEnum.optional(),

  // Template configuration
  config: z.record(z.any()).optional(),
  moduleIds: z.array(z.string().uuid()).optional(),
  requiredFields: z.array(z.string()).optional(),
  optionalFields: z.array(z.string()).optional(),

  // Template behavior (enable/disable functionality)
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  allowCustomization: z.boolean().optional(),

  // Versioning
  version: z.string().optional(),
  versionNotes: z.string().max(1000).optional(),
  parentTemplateId: z.string().uuid().optional(),

  // Validation
  validationRules: z.record(z.any()).optional(),
  validationScore: z.number().min(0).max(100).optional(),

  // Localization
  primaryLanguage: z.string().optional(),
  availableLanguages: z.array(z.string()).optional(),
} as const;

/**
 * Template-specific metrics for aggregations
 */
const templateAdditionalMetrics = [
  "templateTypeDistribution",
  "templateStatusDistribution",
  "templateUsageStatistics",
  "moduleUtilization",
  "passportLinkageStats",
  "completionRatesByTemplate",
  "templateEffectiveness",
  "versionDistribution",
  "languageDistribution",
  "validationMetrics",
  "enablementStatus",
  "customizationUsage",
] as const;

/**
 * Create and register the templates module schemas
 */
export const templatesSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "templates",
    filterExtensions: templateFilterExtensions,
    sortFields: templateSortFields,
    includeExtensions: templateIncludeExtensions,
    whereExtensions: templateWhereExtensions,
    dataExtensions: templateDataExtensions,
    additionalMetrics: templateAdditionalMetrics,
    strict: true,
  }),
);

// ================================
// Type Exports for Templates Module
// ================================

export type TemplatesFilter = InferModuleFilter<typeof templatesSchemas>;
export type TemplatesSort = InferModuleSort<typeof templatesSchemas>;
export type TemplatesInclude = InferModuleInclude<typeof templatesSchemas>;
export type TemplatesWhere = InferModuleWhere<typeof templatesSchemas>;
export type TemplatesData = InferModuleData<typeof templatesSchemas>;
export type TemplatesMetrics = InferModuleMetrics<typeof templatesSchemas>;

// ================================
// Template-Specific Validation Schemas
// ================================

/**
 * Template creation schema with extended validation
 */
export const createTemplateSchema = templatesSchemas.dataSchema
  .extend({
    // Required fields for creation
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    templateType: z.enum(["passport", "product", "custom"]).default("passport"),

    // Initial configuration
    config: z.record(z.any()).default({}),
    moduleIds: z.array(z.string().uuid()).default([]),
    requiredFields: z.array(z.string()).default([]),
    optionalFields: z.array(z.string()).default([]),

    // Initial state (enabled by default)
    enabled: z.boolean().default(true),
    allowCustomization: z.boolean().default(true),
  })
  .strict();

/**
 * Template update schema with extended validation
 */
export const updateTemplateSchema = templatesSchemas.dataSchema
  .partial()
  .extend({
    // Always require ID for updates
    id: z.string().uuid(),
  })
  .strict();

/**
 * Template bulk update schema
 */
export const bulkUpdateTemplateSchema = z
  .object({
    selection: templatesSchemas.createSelectionSchema(),
    data: templatesSchemas.dataSchema.partial(),
    preview: z.boolean().default(false),
  })
  .strict();

/**
 * Template list input schema
 */
export const listTemplatesSchema = z
  .object({
    filter: templatesSchemas.filterSchema.optional(),
    sort: templatesSchemas.sortSchema.optional(),
    pagination: templatesSchemas.paginationSchema.optional(),
    include: templatesSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Template get input schema
 */
export const getTemplateSchema = z
  .object({
    where: templatesSchemas.whereSchema,
    include: templatesSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Template metrics input schema
 */
export const templateMetricsSchema = z
  .object({
    filter: templatesSchemas.filterSchema.optional(),
    metrics: templatesSchemas.metricsSchema.shape.metrics,
  })
  .strict();

// ================================
// Template-Specific Helper Functions
// ================================

/**
 * Calculates template completeness score
 */
export const calculateTemplateCompleteness = (template: {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  moduleIds?: string[];
  requiredFields?: string[];
  validationRules?: Record<string, any>;
}): number => {
  let score = 0;
  const maxScore = 6;

  if (template.name) score += 1;
  if (template.description && template.description.length > 10) score += 1;
  if (template.config && Object.keys(template.config).length > 0) score += 1;
  if (template.moduleIds && template.moduleIds.length > 0) score += 1;
  if (template.requiredFields && template.requiredFields.length > 0) score += 1;
  if (
    template.validationRules &&
    Object.keys(template.validationRules).length > 0
  )
    score += 1;

  return Math.round((score / maxScore) * 100);
};

/**
 * Validates template configuration
 */
export const validateTemplateConfig = (
  config: Record<string, any>,
): boolean => {
  // Add template-specific configuration validation logic
  return config && typeof config === "object";
};

/**
 * Transforms template data before validation
 */
export const transformTemplateData = (data: any): any => {
  return {
    ...data,
    // Normalize template type
    templateType: data.templateType?.toLowerCase(),
    // Trim and clean name
    name: data.name?.trim(),
    // Clean description
    description: data.description?.trim() || undefined,
    // Ensure arrays are defined
    moduleIds: Array.isArray(data.moduleIds) ? data.moduleIds : [],
    requiredFields: Array.isArray(data.requiredFields)
      ? data.requiredFields
      : [],
    optionalFields: Array.isArray(data.optionalFields)
      ? data.optionalFields
      : [],
    availableLanguages: Array.isArray(data.availableLanguages)
      ? data.availableLanguages
      : ["en"],
  };
};

// ================================
// Re-export schemas for convenience
// ================================

export const {
  filterSchema: templateFilterSchema,
  sortSchema: templateSortSchema,
  includeSchema: templateIncludeSchema,
  whereSchema: templateWhereSchema,
  dataSchema: templateDataSchema,
  metricsSchema: templateMetricsSchemaBase,
  paginationSchema: templatePaginationSchema,
  createListResponse: createTemplateListResponse,
  createGetResponse: createTemplateGetResponse,
  createMutationResponse: createTemplateMutationResponse,
  createAggregateResponse: createTemplateAggregateResponse,
  createBulkResponse: createTemplateBulkResponse,
  createPreviewResponse: createTemplatePreviewResponse,
} = templatesSchemas;
