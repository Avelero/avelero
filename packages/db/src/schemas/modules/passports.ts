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
import { entityStatusEnum, visibilityEnum } from "../enums";

// ================================
// Passports Module Schema Extensions
// ================================

/**
 * Passport-specific filter extensions
 * Extends base filter schema with passport-specific fields
 */
const passportFilterExtensions = {
  // Passport-specific identifiers
  passportIds: z.array(z.string().uuid()).optional(),
  templateIds: z.array(z.string().uuid()).optional(),
  productIds: z.array(z.string().uuid()).optional(),
  variantIds: z.array(z.string().uuid()).optional(),

  // Product-related filters
  categoryIds: z.array(z.string().uuid()).optional(),
  season: z.array(z.string()).optional(),

  // Variant-related filters
  colorIds: z.array(z.string().uuid()).optional(),
  sizeIds: z.array(z.string().uuid()).optional(),

  // Passport status and visibility
  passportStatus: z.array(entityStatusEnum).optional(),
  visibility: z.array(visibilityEnum).optional(),
  isPublic: z.boolean().optional(),
  isShareable: z.boolean().optional(),

  // Template-related filters
  templateNames: z.array(z.string()).optional(),
  templateVersions: z.array(z.string()).optional(),
  usesTemplate: z.boolean().optional(),

  // Content and data filters
  hasCustomData: z.boolean().optional(),
  dataCompleteness: z.object({
    min: z.number().min(0).max(100).optional(),
    max: z.number().min(0).max(100).optional(),
  }).optional(),

  // QR code and sharing
  hasQrCode: z.boolean().optional(),
  qrCodeFormat: z.enum(["png", "svg", "pdf"]).optional(),
  hasPublicUrl: z.boolean().optional(),

  // Validation and compliance
  validationStatus: z.enum(["valid", "invalid", "pending", "warning"]).optional(),
  complianceStatus: z.enum(["compliant", "non-compliant", "pending", "partial"]).optional(),
  hasValidationErrors: z.boolean().optional(),

  // Dates and activity
  publishedDateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  lastAccessedRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),

  // Module and field filters
  moduleIds: z.array(z.string().uuid()).optional(),
  moduleNames: z.array(z.string()).optional(),
  hasModules: z.boolean().optional(),
  moduleCount: z.object({
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
  }).optional(),

  // External system integration
  externalSystemIds: z.array(z.string()).optional(),
  syncStatus: z.enum(["synced", "pending", "failed", "never"]).optional(),
  hasSyncErrors: z.boolean().optional(),

  // Language and localization
  languages: z.array(z.string()).optional(),
  hasTranslations: z.boolean().optional(),
  primaryLanguage: z.string().optional(),
} as const;

/**
 * Passport-specific sortable fields
 */
const passportSortFields = [
  "passportStatus",
  "visibility",
  "dataCompleteness",
  "validationScore",
  "publishedAt",
  "lastAccessedAt",
  "moduleCount",
  "templateName",
  "templateVersion",
  "syncStatus",
  "shareCount",
] as const;

/**
 * Passport-specific include relations
 */
const passportIncludeExtensions = {
  // Core passport relations
  template: z.boolean().default(false),
  product: z.boolean().default(false),
  variant: z.boolean().default(false),

  // Passport content
  modules: z.boolean().default(false),
  moduleData: z.boolean().default(false),
  customFields: z.boolean().default(false),

  // Through template relations
  templateModules: z.boolean().default(false),
  templateFields: z.boolean().default(false),

  // Through product relations
  productCategory: z.boolean().default(false),
  productBrand: z.boolean().default(false),
  productCertifications: z.boolean().default(false),

  // Sharing and access
  shareLinks: z.boolean().default(false),
  accessLogs: z.boolean().default(false),
  qrCodeData: z.boolean().default(false),

  // Validation and compliance
  validationResults: z.boolean().default(false),
  complianceChecks: z.boolean().default(false),

  // Sync and external systems
  syncLogs: z.boolean().default(false),
  externalMappings: z.boolean().default(false),

  // Aggregated data
  statistics: z.boolean().default(false),
  completenessReport: z.boolean().default(false),
  usageMetrics: z.boolean().default(false),

  // Localization
  translations: z.boolean().default(false),
  languageData: z.boolean().default(false),

  // Full hierarchy
  fullHierarchy: z.boolean().default(false),
} as const;

/**
 * Passport-specific where conditions
 */
const passportWhereExtensions = {
  // Exact passport matches
  passportId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),

  // Status and visibility conditions
  exactPassportStatus: entityStatusEnum.optional(),
  exactVisibility: visibilityEnum.optional(),

  // Template conditions
  templateName: z.string().optional(),
  templateVersion: z.string().optional(),

  // Content conditions
  hasAllRequiredData: z.boolean().optional(),
  dataCompletenessExact: z.number().min(0).max(100).optional(),

  // Validation conditions
  isValidPassport: z.boolean().optional(),
  isCompliant: z.boolean().optional(),
  validationScoreMin: z.number().min(0).max(100).optional(),

  // Sharing conditions
  isPubliclyShared: z.boolean().optional(),
  hasActiveShares: z.boolean().optional(),
  qrCodeExists: z.boolean().optional(),

  // Sync conditions
  isSynced: z.boolean().optional(),
  lastSyncSuccessful: z.boolean().optional(),

  // Module conditions
  hasRequiredModules: z.boolean().optional(),
  moduleCountExact: z.number().int().min(0).optional(),

  // Date conditions
  publishedAfter: z.date().optional(),
  publishedBefore: z.date().optional(),
  accessedSince: z.date().optional(),

  // Language conditions
  primaryLanguageCode: z.string().optional(),
  hasLanguage: z.string().optional(),
} as const;

/**
 * Passport-specific data fields for mutations
 */
const passportDataExtensions = {
  // Core passport fields
  passportStatus: entityStatusEnum.optional(),
  visibility: visibilityEnum.optional(),

  // Template and content
  templateId: z.string().uuid().optional(),
  customData: z.record(z.any()).optional(),
  moduleData: z.record(z.any()).optional(),

  // Publishing and sharing
  publishedAt: z.date().optional().nullable(),
  isPublic: z.boolean().optional(),
  allowSharing: z.boolean().optional(),
  shareableUntil: z.date().optional().nullable(),

  // QR code configuration
  qrCodeFormat: z.enum(["png", "svg", "pdf"]).optional(),
  qrCodeSize: z.enum(["small", "medium", "large"]).optional(),
  includeQrCode: z.boolean().optional(),

  // Validation and compliance
  validationScore: z.number().min(0).max(100).optional(),
  complianceScore: z.number().min(0).max(100).optional(),
  validationNotes: z.string().max(2000).optional(),
  complianceNotes: z.string().max(2000).optional(),

  // Data completeness
  dataCompleteness: z.number().min(0).max(100).optional(),
  requiredFieldsComplete: z.boolean().optional(),
  optionalFieldsComplete: z.boolean().optional(),

  // External system integration
  externalSystemId: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  syncEnabled: z.boolean().optional(),
  lastSyncAt: z.date().optional(),
  syncStatus: z.enum(["synced", "pending", "failed", "never"]).optional(),

  // Localization
  primaryLanguage: z.string().optional(),
  availableLanguages: z.array(z.string()).optional(),
  translationComplete: z.boolean().optional(),

  // Metadata
  version: z.string().optional(),
  versionNotes: z.string().max(1000).optional(),
  changeReason: z.string().max(500).optional(),

  // Access control
  accessRestrictions: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
  passwordProtected: z.boolean().optional(),
} as const;

/**
 * Passport-specific metrics for aggregations
 */
const passportAdditionalMetrics = [
  "passportStatusDistribution",
  "visibilityDistribution",
  "templateUsage",
  "dataCompletenessStatistics",
  "validationStatistics",
  "complianceStatistics",
  "sharingStatistics",
  "accessStatistics",
  "qrCodeUsage",
  "moduleUtilization",
  "syncHealthMetrics",
  "languageDistribution",
  "versionStatistics",
  "performanceMetrics",
  "errorRateMetrics",
  "userEngagementMetrics",
] as const;

/**
 * Create and register the passports module schemas
 */
export const passportsSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "passports",
    filterExtensions: passportFilterExtensions,
    sortFields: passportSortFields,
    includeExtensions: passportIncludeExtensions,
    whereExtensions: passportWhereExtensions,
    dataExtensions: passportDataExtensions,
    additionalMetrics: passportAdditionalMetrics,
    strict: true,
  })
);

// ================================
// Type Exports for Passports Module
// ================================

export type PassportsFilter = InferModuleFilter<typeof passportsSchemas>;
export type PassportsSort = InferModuleSort<typeof passportsSchemas>;
export type PassportsInclude = InferModuleInclude<typeof passportsSchemas>;
export type PassportsWhere = InferModuleWhere<typeof passportsSchemas>;
export type PassportsData = InferModuleData<typeof passportsSchemas>;
export type PassportsMetrics = InferModuleMetrics<typeof passportsSchemas>;

// ================================
// Passport-Specific Validation Schemas
// ================================

/**
 * Passport creation schema with extended validation
 */
export const createPassportSchema = passportsSchemas.dataSchema.extend({
  // Required fields for creation
  templateId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),

  // Initial status and visibility
  passportStatus: entityStatusEnum.default("draft"),
  visibility: visibilityEnum.default("private"),

  // Optional initialization data
  customData: z.record(z.any()).optional(),
  moduleData: z.record(z.any()).optional(),
  primaryLanguage: z.string().default("en"),
}).strict();

/**
 * Passport update schema with extended validation
 */
export const updatePassportSchema = passportsSchemas.dataSchema.partial().extend({
  // Always require ID for updates
  id: z.string().uuid(),
}).strict();

/**
 * Passport publishing schema
 */
export const publishPassportSchema = z.object({
  id: z.string().uuid(),
  visibility: visibilityEnum.default("public"),
  publishedAt: z.date().optional(),
  allowSharing: z.boolean().default(true),
  shareableUntil: z.date().optional(),
  includeQrCode: z.boolean().default(true),
  qrCodeFormat: z.enum(["png", "svg", "pdf"]).default("png"),
}).strict();

/**
 * Passport bulk update schema
 */
export const bulkUpdatePassportSchema = z.object({
  selection: passportsSchemas.createSelectionSchema(),
  data: passportsSchemas.dataSchema.partial(),
  preview: z.boolean().default(false),
}).strict();

/**
 * Passport list input schema
 */
export const listPassportsSchema = z.object({
  filter: passportsSchemas.filterSchema.optional(),
  sort: passportsSchemas.sortSchema.optional(),
  pagination: passportsSchemas.paginationSchema.optional(),
  include: passportsSchemas.includeSchema.optional(),
}).strict();

/**
 * Passport get input schema
 */
export const getPassportSchema = z.object({
  where: passportsSchemas.whereSchema,
  include: passportsSchemas.includeSchema.optional(),
}).strict();

/**
 * Passport metrics input schema
 */
export const passportMetricsSchema = z.object({
  filter: passportsSchemas.filterSchema.optional(),
  metrics: passportsSchemas.metricsSchema,
}).strict();

// ================================
// Passport-Specific Helper Functions
// ================================

/**
 * Calculates passport data completeness score
 */
export const calculatePassportCompleteness = (passport: {
  templateId?: string;
  customData?: Record<string, any>;
  moduleData?: Record<string, any>;
  passportStatus?: string;
  visibility?: string;
}): number => {
  let score = 0;
  const maxScore = 5;

  if (passport.templateId) score += 1;
  if (passport.customData && Object.keys(passport.customData).length > 0) score += 1;
  if (passport.moduleData && Object.keys(passport.moduleData).length > 0) score += 1;
  if (passport.passportStatus && passport.passportStatus !== "draft") score += 1;
  if (passport.visibility) score += 1;

  return Math.round((score / maxScore) * 100);
};

/**
 * Validates passport data against template requirements
 */
export const validatePassportData = (
  passportData: Record<string, any>,
  templateRequirements: Record<string, { required: boolean; type: string }>
): { isValid: boolean; missingFields: string[]; invalidFields: string[] } => {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  for (const [fieldName, requirements] of Object.entries(templateRequirements)) {
    const value = passportData[fieldName];

    if (requirements.required && (value === undefined || value === null || value === "")) {
      missingFields.push(fieldName);
    } else if (value !== undefined && value !== null && value !== "") {
      // Basic type validation (extend as needed)
      if (requirements.type === "number" && typeof value !== "number") {
        invalidFields.push(fieldName);
      } else if (requirements.type === "string" && typeof value !== "string") {
        invalidFields.push(fieldName);
      } else if (requirements.type === "boolean" && typeof value !== "boolean") {
        invalidFields.push(fieldName);
      }
    }
  }

  return {
    isValid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
};

/**
 * Generates passport QR code data
 */
export const generatePassportQrCodeData = (passport: {
  id: string;
  visibility?: string;
  isPublic?: boolean;
  allowSharing?: boolean;
}): { url: string; isAccessible: boolean; requiresAuth: boolean } => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.avelero.com";
  const url = `${baseUrl}/passport/${passport.id}`;

  const isAccessible = passport.visibility === "public" || passport.isPublic === true;
  const requiresAuth = !isAccessible;

  return {
    url,
    isAccessible,
    requiresAuth,
  };
};

/**
 * Calculates passport compliance score based on business rules
 */
export const calculatePassportCompliance = (passport: {
  templateId?: string;
  customData?: Record<string, any>;
  moduleData?: Record<string, any>;
  validationScore?: number;
}): number => {
  let score = 0;
  const maxScore = 4;

  // Has template
  if (passport.templateId) score += 1;

  // Has sufficient data
  const dataFields = {
    ...passport.customData,
    ...passport.moduleData,
  };
  if (Object.keys(dataFields).length >= 5) score += 1;

  // Good validation score
  if (passport.validationScore && passport.validationScore >= 80) score += 1;

  // Additional compliance checks can be added here
  score += 1; // Placeholder for additional rules

  return Math.round((score / maxScore) * 100);
};

/**
 * Transforms passport data before validation
 */
export const transformPassportData = (data: any): any => {
  return {
    ...data,
    // Ensure customData and moduleData are objects
    customData: data.customData || {},
    moduleData: data.moduleData || {},
    // Normalize language codes
    primaryLanguage: data.primaryLanguage?.toLowerCase(),
    availableLanguages: data.availableLanguages?.map((lang: string) => lang.toLowerCase()),
  };
};

/**
 * Checks if passport can be published
 */
export const canPublishPassport = (passport: {
  templateId?: string;
  dataCompleteness?: number;
  validationScore?: number;
  passportStatus?: string;
}): { canPublish: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  if (!passport.templateId) {
    reasons.push("Template is required");
  }

  if (!passport.dataCompleteness || passport.dataCompleteness < 70) {
    reasons.push("Data completeness must be at least 70%");
  }

  if (!passport.validationScore || passport.validationScore < 80) {
    reasons.push("Validation score must be at least 80%");
  }

  if (passport.passportStatus === "blocked" || passport.passportStatus === "cancelled") {
    reasons.push("Passport status prevents publishing");
  }

  return {
    canPublish: reasons.length === 0,
    reasons,
  };
};

// ================================
// Re-export schemas for convenience
// ================================

export const {
  filterSchema: passportFilterSchema,
  sortSchema: passportSortSchema,
  includeSchema: passportIncludeSchema,
  whereSchema: passportWhereSchema,
  dataSchema: passportDataSchema,
  metricsSchema: passportMetricsSchemaBase,
  paginationSchema: passportPaginationSchema,
  createListResponse: createPassportListResponse,
  createGetResponse: createPassportGetResponse,
  createMutationResponse: createPassportMutationResponse,
  createAggregateResponse: createPassportAggregateResponse,
  createBulkResponse: createPassportBulkResponse,
  createPreviewResponse: createPassportPreviewResponse,
} = passportsSchemas;