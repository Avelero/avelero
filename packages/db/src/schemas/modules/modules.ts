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
// Modules Module Schema Extensions
// ================================

/**
 * Module-specific filter extensions
 * Extends base filter schema with module-specific fields
 */
const moduleFilterExtensions = {
  // Module-specific identifiers
  moduleIds: z.array(z.string().uuid()).optional(),
  moduleTypes: z
    .array(
      z.enum([
        "data_collection",
        "validation",
        "compliance",
        "reporting",
        "custom",
      ]),
    )
    .optional(),
  moduleStatus: z.array(entityStatusEnum).optional(),

  // Module behavior filters
  enabled: z.boolean().optional(),
  required: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
  isSystem: z.boolean().optional(),

  // Template relationship filters
  templateIds: z.array(z.string().uuid()).optional(),
  hasTemplates: z.boolean().optional(),
  templateCount: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),

  // Dependency filters
  dependsOnModules: z.array(z.string().uuid()).optional(),
  hasDependencies: z.boolean().optional(),
  dependencyCount: z
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

  // Validation and compliance filters
  validationScore: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    })
    .optional(),
  complianceImpact: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  completionWeight: z
    .object({
      min: z.number().int().min(1).optional(),
      max: z.number().int().min(1).optional(),
    })
    .optional(),

  // Language filters
  languages: z.array(z.string()).optional(),
  primaryLanguage: z.string().optional(),
  hasTranslations: z.boolean().optional(),

  // Version filters
  version: z.string().optional(),
  hasParentModule: z.boolean().optional(),
  parentModuleIds: z.array(z.string().uuid()).optional(),

  // Compatibility filters
  compatibleWith: z.array(z.string()).optional(),
  hasCompatibilityConstraints: z.boolean().optional(),
} as const;

/**
 * Module-specific sortable fields
 */
const moduleSortFields = [
  "moduleType",
  "moduleStatus",
  "usageCount",
  "lastUsedAt",
  "validationScore",
  "complianceImpact",
  "completionWeight",
  "version",
  "dependencyCount",
] as const;

/**
 * Module-specific include relations
 */
const moduleIncludeExtensions = {
  // Module relations
  templates: z.boolean().default(false),
  parentModule: z.boolean().default(false),
  childModules: z.boolean().default(false),
  dependencies: z.boolean().default(false),

  // Usage statistics
  usageStats: z.boolean().default(false),
  passportCounts: z.boolean().default(false),

  // Configuration details
  fieldDefinitions: z.boolean().default(false),
  validationRules: z.boolean().default(false),
  displaySettings: z.boolean().default(false),

  // Compliance data
  complianceHistory: z.boolean().default(false),

  // Localization
  translations: z.boolean().default(false),
  languageData: z.boolean().default(false),
} as const;

/**
 * Module-specific where conditions
 */
const moduleWhereExtensions = {
  // Exact module matches
  moduleId: z.string().uuid().optional(),
  moduleType: z
    .enum([
      "data_collection",
      "validation",
      "compliance",
      "reporting",
      "custom",
    ])
    .optional(),
  exactStatus: entityStatusEnum.optional(),

  // Module behavior conditions
  isEnabled: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  allowsMultiple: z.boolean().optional(),
  isSystemModule: z.boolean().optional(),

  // Template conditions
  templateId: z.string().uuid().optional(),
  hasSpecificTemplates: z.array(z.string().uuid()).optional(),
  templateCountExact: z.number().int().min(0).optional(),

  // Dependency conditions
  dependsOnModule: z.string().uuid().optional(),
  hasSpecificDependencies: z.array(z.string().uuid()).optional(),
  dependencyCountExact: z.number().int().min(0).optional(),

  // Usage conditions
  usageCountExact: z.number().int().min(0).optional(),
  usedAfter: z.date().optional(),
  usedBefore: z.date().optional(),
  neverUsed: z.boolean().optional(),

  // Version conditions
  exactVersion: z.string().optional(),
  parentModuleId: z.string().uuid().optional(),
  isParentModule: z.boolean().optional(),

  // Compliance conditions
  complianceImpactExact: z.number().int().min(0).optional(),
  completionWeightExact: z.number().int().min(1).optional(),

  // Language conditions
  primaryLanguageCode: z.string().optional(),
  hasLanguage: z.string().optional(),

  // Compatibility conditions
  isCompatibleWith: z.string().optional(),
} as const;

/**
 * Module-specific data fields for mutations
 */
const moduleDataExtensions = {
  // Core module fields
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  moduleType: z
    .enum([
      "data_collection",
      "validation",
      "compliance",
      "reporting",
      "custom",
    ])
    .optional(),
  moduleStatus: entityStatusEnum.optional(),

  // Module configuration
  config: z.record(z.any()).optional(),
  fieldDefinitions: z.array(z.record(z.any())).optional(),
  validationRules: z.record(z.any()).optional(),
  displaySettings: z.record(z.any()).optional(),

  // Module behavior
  enabled: z.boolean().optional(),
  required: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
  isSystem: z.boolean().optional(),

  // Dependencies and compatibility
  dependsOnModules: z.array(z.string().uuid()).optional(),
  compatibleWith: z.array(z.string()).optional(),

  // Versioning
  version: z.string().optional(),
  versionNotes: z.string().max(1000).optional(),
  parentModuleId: z.string().uuid().optional(),

  // Scoring and weights
  completionWeight: z.number().int().min(1).optional(),
  validationScore: z.number().min(0).max(100).optional(),
  complianceImpact: z.number().int().min(0).optional(),

  // Localization
  primaryLanguage: z.string().optional(),
  availableLanguages: z.array(z.string()).optional(),
} as const;

/**
 * Module-specific metrics for aggregations
 */
const moduleAdditionalMetrics = [
  "moduleTypeDistribution",
  "moduleStatusDistribution",
  "moduleUsageStatistics",
  "templateUtilization",
  "passportLinkageStats",
  "dependencyAnalysis",
  "complianceImpactMetrics",
  "validationEffectiveness",
  "completionWeightDistribution",
  "versionDistribution",
  "languageDistribution",
  "enablementStatus",
  "systemModuleStats",
  "compatibilityMatrix",
  "fieldDefinitionStats",
] as const;

/**
 * Create and register the modules module schemas
 */
export const modulesSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "modules",
    filterExtensions: moduleFilterExtensions,
    sortFields: moduleSortFields,
    includeExtensions: moduleIncludeExtensions,
    whereExtensions: moduleWhereExtensions,
    dataExtensions: moduleDataExtensions,
    additionalMetrics: moduleAdditionalMetrics,
    strict: true,
  }),
);

// ================================
// Type Exports for Modules Module
// ================================

export type ModulesFilter = InferModuleFilter<typeof modulesSchemas>;
export type ModulesSort = InferModuleSort<typeof modulesSchemas>;
export type ModulesInclude = InferModuleInclude<typeof modulesSchemas>;
export type ModulesWhere = InferModuleWhere<typeof modulesSchemas>;
export type ModulesData = InferModuleData<typeof modulesSchemas>;
export type ModulesMetrics = InferModuleMetrics<typeof modulesSchemas>;

// ================================
// Module-Specific Validation Schemas
// ================================

/**
 * Module creation schema with extended validation
 */
export const createModuleSchema = modulesSchemas.dataSchema
  .extend({
    // Required fields for creation
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    moduleType: z
      .enum([
        "data_collection",
        "validation",
        "compliance",
        "reporting",
        "custom",
      ])
      .default("data_collection"),

    // Initial configuration
    config: z.record(z.any()).default({}),
    fieldDefinitions: z.array(z.record(z.any())).default([]),
    validationRules: z.record(z.any()).default({}),
    displaySettings: z.record(z.any()).default({}),

    // Initial behavior settings
    enabled: z.boolean().default(true),
    required: z.boolean().default(false),
    allowMultiple: z.boolean().default(false),

    // Dependencies (empty by default)
    dependsOnModules: z.array(z.string().uuid()).default([]),
    compatibleWith: z.array(z.string()).default([]),

    // Initial scoring
    completionWeight: z.number().int().min(1).default(1),
  })
  .strict();

/**
 * Module update schema with extended validation
 */
export const updateModuleSchema = modulesSchemas.dataSchema
  .partial()
  .extend({
    // Always require ID for updates
    id: z.string().uuid(),
  })
  .strict();

/**
 * Module bulk update schema
 */
export const bulkUpdateModuleSchema = z
  .object({
    selection: modulesSchemas.createSelectionSchema(),
    data: modulesSchemas.dataSchema.partial(),
    preview: z.boolean().default(false),
  })
  .strict();

/**
 * Module list input schema
 */
export const listModulesSchema = z
  .object({
    filter: modulesSchemas.filterSchema.optional(),
    sort: modulesSchemas.sortSchema.optional(),
    pagination: modulesSchemas.paginationSchema.optional(),
    include: modulesSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Module get input schema
 */
export const getModuleSchema = z
  .object({
    where: modulesSchemas.whereSchema,
    include: modulesSchemas.includeSchema.optional(),
  })
  .strict();

/**
 * Module metrics input schema
 */
export const moduleMetricsSchema = z
  .object({
    filter: modulesSchemas.filterSchema.optional(),
    metrics: modulesSchemas.metricsSchema.shape.metrics,
  })
  .strict();

// ================================
// Module-Specific Helper Functions
// ================================

/**
 * Calculates module completeness score
 */
export const calculateModuleCompleteness = (module: {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  fieldDefinitions?: any[];
  validationRules?: Record<string, any>;
  displaySettings?: Record<string, any>;
}): number => {
  let score = 0;
  const maxScore = 6;

  if (module.name) score += 1;
  if (module.description && module.description.length > 10) score += 1;
  if (module.config && Object.keys(module.config).length > 0) score += 1;
  if (module.fieldDefinitions && module.fieldDefinitions.length > 0) score += 1;
  if (module.validationRules && Object.keys(module.validationRules).length > 0)
    score += 1;
  if (module.displaySettings && Object.keys(module.displaySettings).length > 0)
    score += 1;

  return Math.round((score / maxScore) * 100);
};

/**
 * Validates module configuration
 */
export const validateModuleConfig = (config: Record<string, any>): boolean => {
  // Add module-specific configuration validation logic
  return config && typeof config === "object";
};

/**
 * Validates module field definitions
 */
export const validateFieldDefinitions = (fieldDefs: any[]): boolean => {
  if (!Array.isArray(fieldDefs)) return false;
  return fieldDefs.every((def) => def && typeof def === "object" && def.name);
};

/**
 * Transforms module data before validation
 */
export const transformModuleData = (data: any): any => {
  return {
    ...data,
    // Normalize module type
    moduleType: data.moduleType?.toLowerCase(),
    // Trim and clean name
    name: data.name?.trim(),
    // Clean description
    description: data.description?.trim() || undefined,
    // Ensure arrays are defined
    dependsOnModules: Array.isArray(data.dependsOnModules)
      ? data.dependsOnModules
      : [],
    compatibleWith: Array.isArray(data.compatibleWith)
      ? data.compatibleWith
      : [],
    fieldDefinitions: Array.isArray(data.fieldDefinitions)
      ? data.fieldDefinitions
      : [],
    availableLanguages: Array.isArray(data.availableLanguages)
      ? data.availableLanguages
      : ["en"],
    // Ensure objects are defined
    config: data.config && typeof data.config === "object" ? data.config : {},
    validationRules:
      data.validationRules && typeof data.validationRules === "object"
        ? data.validationRules
        : {},
    displaySettings:
      data.displaySettings && typeof data.displaySettings === "object"
        ? data.displaySettings
        : {},
  };
};

// ================================
// Re-export schemas for convenience
// ================================

export const {
  filterSchema: moduleFilterSchema,
  sortSchema: moduleSortSchema,
  includeSchema: moduleIncludeSchema,
  whereSchema: moduleWhereSchema,
  dataSchema: moduleDataSchema,
  metricsSchema: moduleMetricsSchemaBase,
  paginationSchema: modulePaginationSchema,
  createListResponse: createModuleListResponse,
  createGetResponse: createModuleGetResponse,
  createMutationResponse: createModuleMutationResponse,
  createAggregateResponse: createModuleAggregateResponse,
  createBulkResponse: createModuleBulkResponse,
  createPreviewResponse: createModulePreviewResponse,
} = modulesSchemas;
