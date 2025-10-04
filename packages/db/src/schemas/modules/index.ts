// ================================
// Module Schema Extensions Index
// ================================

/**
 * This module exports all the pre-configured module schema extensions
 * that demonstrate and validate the Module Extension Framework.
 *
 * Each module extension provides:
 * - Extended filter, sort, include, where, data, and metrics schemas
 * - Type-safe interfaces for module-specific operations
 * - Validation helpers and business logic functions
 * - Response envelope creators
 * - Registry integration for centralized management
 */

// Core extension framework exports
export {
  // Extension framework functions
  createModuleSchemas,
  createExtendedFilterSchema,
  createExtendedSortSchema,
  createExtendedIncludeSchema,
  createExtendedWhereSchema,
  createExtendedDataSchema,
  createExtendedMetricsSchema,

  // Registry functions
  registerModuleSchemas,
  getModuleSchemas,
  getRegisteredModuleIds,
  clearModuleSchemaRegistry,

  // Type helpers
  type ModuleSchemas,
  type ModuleExtensionConfig,
  type InferModuleFilter,
  type InferModuleSort,
  type InferModuleInclude,
  type InferModuleWhere,
  type InferModuleData,
  type InferModuleMetrics,

  // Validation utilities
  createModuleValidator,
} from "../shared";

// ================================
// Module-Specific Exports
// ================================

// Products Module
export {
  productsSchemas,
  type ProductsFilter,
  type ProductsSort,
  type ProductsInclude,
  type ProductsWhere,
  type ProductsData,
  type ProductsMetrics,

  // Products validation schemas
  createProductSchema,
  updateProductSchema,
  bulkUpdateProductSchema,
  listProductsSchema,
  getProductSchema,

  // Products helper functions
  validateProductSku,
  validateProductUpid,
  calculateProductCompleteness,
  transformProductData,

  // Products schema re-exports
  productFilterSchema,
  productSortSchema,
  productIncludeSchema,
  productWhereSchema,
  productDataSchema,
  productMetricsSchema,
  productPaginationSchema,
  createProductListResponse,
  createProductGetResponse,
  createProductMutationResponse,
  createProductAggregateResponse,
  createProductBulkResponse,
  createProductPreviewResponse,
} from "./products";

// Variants Module
export {
  variantsSchemas,
  type VariantsFilter,
  type VariantsSort,
  type VariantsInclude,
  type VariantsWhere,
  type VariantsData,
  type VariantsMetrics,

  // Variants validation schemas
  createVariantSchema,
  updateVariantSchema,
  bulkUpdateVariantSchema,
  listVariantsSchema,
  getVariantSchema,

  // Variants helper functions
  validateVariantSku,
  validateVariantUpid,
  calculateVariantCompleteness,
  transformVariantData,
  checkVariantIdentifierDuplicates,
  generateVariantDisplayName,

  // Variants schema re-exports
  variantFilterSchema,
  variantSortSchema,
  variantIncludeSchema,
  variantWhereSchema,
  variantDataSchema,
  variantMetricsSchema,
  variantPaginationSchema,
  createVariantListResponse,
  createVariantGetResponse,
  createVariantMutationResponse,
  createVariantAggregateResponse,
  createVariantBulkResponse,
  createVariantPreviewResponse,
} from "./variants";

// Passports Module
export {
  passportsSchemas,
  type PassportsFilter,
  type PassportsSort,
  type PassportsInclude,
  type PassportsWhere,
  type PassportsData,
  type PassportsMetrics,

  // Passports validation schemas
  createPassportSchema,
  updatePassportSchema,
  publishPassportSchema,
  bulkUpdatePassportSchema,
  listPassportsSchema,
  getPassportSchema,

  // Passports helper functions
  calculatePassportCompleteness,
  validatePassportData,
  generatePassportQrCodeData,
  calculatePassportCompliance,
  transformPassportData,
  canPublishPassport,

  // Passports schema re-exports
  passportFilterSchema,
  passportSortSchema,
  passportIncludeSchema,
  passportWhereSchema,
  passportDataSchema,
  passportMetricsSchema,
  passportPaginationSchema,
  createPassportListResponse,
  createPassportGetResponse,
  createPassportMutationResponse,
  createPassportAggregateResponse,
  createPassportBulkResponse,
  createPassportPreviewResponse,
} from "./passports";

// ================================
// Utility Functions
// ================================

/**
 * Get all registered module schemas for inspection
 */
export const getAllModuleSchemas = () => {
  const moduleIds = getRegisteredModuleIds();
  return moduleIds.map(id => ({
    moduleId: id,
    schemas: getModuleSchemas(id),
  }));
};

/**
 * Validate that a module is properly registered
 */
export const validateModuleRegistration = (moduleId: string): {
  isRegistered: boolean;
  hasAllSchemas: boolean;
  missingSchemas: string[];
} => {
  const schemas = getModuleSchemas(moduleId);

  if (!schemas) {
    return {
      isRegistered: false,
      hasAllSchemas: false,
      missingSchemas: [],
    };
  }

  const requiredSchemas = [
    'filterSchema',
    'sortSchema',
    'includeSchema',
    'whereSchema',
    'dataSchema',
    'metricsSchema',
    'paginationSchema'
  ];

  const missingSchemas = requiredSchemas.filter(schema => !schemas[schema]);

  return {
    isRegistered: true,
    hasAllSchemas: missingSchemas.length === 0,
    missingSchemas,
  };
};

/**
 * Get module schema statistics for monitoring
 */
export const getModuleSchemaStats = () => {
  const moduleIds = getRegisteredModuleIds();

  return {
    totalModules: moduleIds.length,
    modules: moduleIds.map(id => {
      const validation = validateModuleRegistration(id);
      return {
        moduleId: id,
        isValid: validation.hasAllSchemas,
        missingSchemas: validation.missingSchemas,
      };
    }),
    validModules: moduleIds.filter(id => validateModuleRegistration(id).hasAllSchemas).length,
    invalidModules: moduleIds.filter(id => !validateModuleRegistration(id).hasAllSchemas).length,
  };
};

// ================================
// Development Helpers
// ================================

/**
 * Create a new module schema template for development
 * Use this as a starting point for new modules
 */
export const createModuleTemplate = (moduleId: string) => {
  return {
    moduleId,
    template: `
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
// ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module Schema Extensions
// ================================

const ${moduleId}FilterExtensions = {
  // Add module-specific filter fields here
  ${moduleId}Ids: z.array(z.string().uuid()).optional(),
} as const;

const ${moduleId}SortFields = [
  // Add module-specific sortable fields here
  "customField",
] as const;

const ${moduleId}IncludeExtensions = {
  // Add module-specific include relations here
  customRelation: z.boolean().default(false),
} as const;

const ${moduleId}WhereExtensions = {
  // Add module-specific where conditions here
  ${moduleId}Id: z.string().uuid().optional(),
} as const;

const ${moduleId}DataExtensions = {
  // Add module-specific data fields here
  customData: z.string().optional(),
} as const;

const ${moduleId}AdditionalMetrics = [
  // Add module-specific metrics here
  "customMetrics",
] as const;

export const ${moduleId}Schemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "${moduleId}",
    filterExtensions: ${moduleId}FilterExtensions,
    sortFields: ${moduleId}SortFields,
    includeExtensions: ${moduleId}IncludeExtensions,
    whereExtensions: ${moduleId}WhereExtensions,
    dataExtensions: ${moduleId}DataExtensions,
    additionalMetrics: ${moduleId}AdditionalMetrics,
    strict: true,
  })
);

// Type exports
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Filter = InferModuleFilter<typeof ${moduleId}Schemas>;
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Sort = InferModuleSort<typeof ${moduleId}Schemas>;
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Include = InferModuleInclude<typeof ${moduleId}Schemas>;
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Where = InferModuleWhere<typeof ${moduleId}Schemas>;
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Data = InferModuleData<typeof ${moduleId}Schemas>;
export type ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Metrics = InferModuleMetrics<typeof ${moduleId}Schemas>;
`,
    usage: `
// Import the module schemas
import { ${moduleId}Schemas } from "./path/to/${moduleId}";

// Use in tRPC router
export const ${moduleId}Router = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      filter: ${moduleId}Schemas.filterSchema.optional(),
      sort: ${moduleId}Schemas.sortSchema.optional(),
      pagination: ${moduleId}Schemas.paginationSchema.optional(),
      include: ${moduleId}Schemas.includeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Implementation here
    }),
});
`,
  };
};

// ================================
// Module Framework Documentation
// ================================

/**
 * Framework Documentation and Usage Guide
 *
 * The Module Extension Framework provides a standardized way to extend
 * base schemas with module-specific fields while maintaining type safety
 * and consistency across the application.
 *
 * Key Features:
 * 1. Type-safe schema extension
 * 2. Automatic merge of base and module schemas
 * 3. Centralized registry for schema management
 * 4. Consistent response envelope patterns
 * 5. Validation utilities and helpers
 * 6. Support for custom business logic
 *
 * Usage Pattern:
 * 1. Define module-specific extensions
 * 2. Create module schemas using createModuleSchemas
 * 3. Register schemas with registerModuleSchemas
 * 4. Use schemas in tRPC routers and validation
 * 5. Leverage type inference for TypeScript safety
 *
 * Best Practices:
 * - Follow camelCase naming conventions
 * - Use descriptive field names with module prefixes
 * - Include comprehensive JSDoc documentation
 * - Add validation helpers for business rules
 * - Test schema extensions thoroughly
 * - Use the registry for centralized management
 */
export const FRAMEWORK_DOCUMENTATION = {
  version: "1.0.0",
  description: "Module Schema Extension Framework for type-safe API development",
  features: [
    "Type-safe schema extension",
    "Automatic base schema merging",
    "Centralized schema registry",
    "Response envelope patterns",
    "Validation utilities",
    "Business logic integration",
  ],
  examples: {
    products: "Product catalog with variants, images, and attributes",
    variants: "Product variants with SKUs, colors, and sizes",
    passports: "Digital product passports with templates and modules",
  },
} as const;