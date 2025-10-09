import { z } from "zod";

// Import standardized enums from the centralized enums file
import {
  entityStatusEnum,
  priorityEnum,
  sortDirectionEnum,
  userRoleEnum,
  permissionTypeEnum,
  environmentEnum,
} from "./enums";

// Import cross-module relationship system
import {
  crossModuleRegistry,
  createCrossModuleIncludeSchema,
  createCrossModuleQueryBuilder,
  analyzeQueryPerformance,
} from "./cross-module-includes";

// ================================
// Legacy Enum Aliases (for backward compatibility)
// ================================

/**
 * @deprecated Use entityStatusEnum from ./enums instead
 * Legacy alias maintained for backward compatibility
 */
export const statusEnum = entityStatusEnum;

// ================================
// Base Filter Schema
// ================================

/**
 * Base filter schema with common fields that all modules can extend.
 * Uses camelCase naming convention throughout.
 */
export const baseFilterSchema = z
  .object({
    // Common ID filters
    ids: z.array(z.string().uuid()).optional(),

    // Status and state filters
    status: z.array(statusEnum).optional(),
    enabled: z.boolean().optional(),

    // Search functionality
    search: z.string().optional(),

    // Date range filtering
    dateRange: z
      .object({
        from: z.date().optional(),
        to: z.date().optional(),
      })
      .optional(),

    // Common relationship filters
    brandIds: z.array(z.string().uuid()).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),

    // Metadata filtering
    tags: z.array(z.string()).optional(),

    // Soft delete consideration
    includeDeleted: z.boolean().default(false),
  })
  .strict();

type BaseFilter = z.infer<typeof baseFilterSchema>;

// ================================
// Base Sort Schema
// ================================

/**
 * Standardized sort schema with field/direction pattern.
 * Base fields can be extended by modules with their specific sortable fields.
 */
export const baseSortSchema = z
  .object({
    field: z.enum(["createdAt", "updatedAt", "name"]),
    direction: sortDirectionEnum.default("desc"),
  })
  .strict();

type BaseSort = z.infer<typeof baseSortSchema>;

// ================================
// Base Pagination Schema
// ================================

/**
 * Unified pagination schema supporting both cursor and offset pagination.
 * Cursor is preferred for performance with large datasets.
 */
export const basePaginationSchema = z
  .object({
    // Cursor-based pagination (preferred)
    cursor: z.string().nullable().optional(),

    // Offset-based pagination (fallback)
    page: z.number().int().min(1).optional(),

    // Common limit field (increased to support larger page sizes)
    limit: z.number().int().min(1).max(1000).default(20),

    // Include total count (expensive for large datasets)
    includeTotalCount: z.boolean().default(false),
  })
  .strict();

type BasePagination = z.infer<typeof basePaginationSchema>;

// ================================
// Base Include Schema
// ================================

/**
 * Base schema for optional relation loading.
 * Modules extend this with their specific relations.
 */
export const baseIncludeSchema = z
  .object({
    // Common relations that most entities might have
    brand: z.boolean().default(false),
    category: z.boolean().default(false),

    // Metadata includes
    metadata: z.boolean().default(false),
    counts: z.boolean().default(false),
  })
  .strict();

type BaseInclude = z.infer<typeof baseIncludeSchema>;

// ================================
// Base Where Schema
// ================================

/**
 * Base where schema for exact matching conditions.
 * Extends filter schema with exact match fields.
 */
export const baseWhereSchema = baseFilterSchema
  .extend({
    // Exact ID matches
    id: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),

    // Exact status match
    exactStatus: statusEnum.optional(),

    // Exact boolean matches
    isEnabled: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
  })
  .strict();

type BaseWhere = z.infer<typeof baseWhereSchema>;

// ================================
// Base Data Schema
// ================================

/**
 * Base schema for partial updates.
 * Contains common mutable fields that most entities share.
 */
export const baseDataSchema = z
  .object({
    // Common updatable fields
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    status: statusEnum.optional(),
    enabled: z.boolean().optional(),

    // Metadata
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),

    // Relationships
    categoryId: z.string().uuid().nullable().optional(),
  })
  .strict();

type BaseData = z.infer<typeof baseDataSchema>;

// ================================
// Base Metrics Schema
// ================================

/**
 * Base metrics schema for aggregation operations.
 * Modules extend this with their specific metric types.
 */
export const baseMetricsSchema = z
  .object({
    metrics: z.array(
      z.enum([
        "countByStatus",
        "countByCategory",
        "countByDate",
        "totalCount",
        "activeCount",
        "recentActivity",
      ]),
    ),
  })
  .strict();

type BaseMetrics = z.infer<typeof baseMetricsSchema>;

// ================================
// Error Handling Schemas
// ================================

/**
 * HTTP status code enum for consistent error reporting
 */
export const httpStatusEnum = z.enum([
  "200",
  "201",
  "202",
  "204",
  "400",
  "401",
  "403",
  "404",
  "409",
  "422",
  "429",
  "500",
  "502",
  "503",
  "504",
]);

/**
 * Error type enum for categorizing errors
 */
export const errorTypeEnum = z.enum([
  "VALIDATION_ERROR",
  "AUTHENTICATION_ERROR",
  "AUTHORIZATION_ERROR",
  "NOT_FOUND_ERROR",
  "CONFLICT_ERROR",
  "RATE_LIMIT_ERROR",
  "INTERNAL_SERVER_ERROR",
  "SERVICE_UNAVAILABLE_ERROR",
  "TIMEOUT_ERROR",
  "BUSINESS_LOGIC_ERROR",
]);

/**
 * Validation error detail schema
 */
export const validationErrorSchema = z
  .object({
    field: z.string(),
    message: z.string(),
    code: z.string().optional(),
    receivedValue: z.any().optional(),
  })
  .strict();

/**
 * Comprehensive error schema
 */
export const errorSchema = z
  .object({
    type: errorTypeEnum,
    message: z.string(),
    code: z.string().optional(),
    statusCode: httpStatusEnum.optional(),
    details: z.array(validationErrorSchema).optional(),
    requestId: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
    path: z.string().optional(),
    retryable: z.boolean().default(false),
  })
  .strict();

type ErrorResponse = z.infer<typeof errorSchema>;
type ValidationError = z.infer<typeof validationErrorSchema>;

// ================================
// Enhanced Metadata Schemas
// ================================

/**
 * Performance metrics for response tracking
 */
export const performanceMetricsSchema = z
  .object({
    queryTimeMs: z.number().optional(),
    processingTimeMs: z.number().optional(),
    cacheHit: z.boolean().optional(),
    cacheTtlSeconds: z.number().optional(),
    databaseQueries: z.number().int().optional(),
    memoryUsageMb: z.number().optional(),
  })
  .strict();

/**
 * Request tracking information
 */
export const requestTrackingSchema = z
  .object({
    requestId: z.string(),
    correlationId: z.string().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    brandId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    sessionId: z.string().optional(),
  })
  .strict();

/**
 * Debug information schema
 */
export const debugInfoSchema = z
  .object({
    sqlQueries: z.array(z.string()).optional(),
    cacheKeys: z.array(z.string()).optional(),
    featureFlags: z.record(z.boolean()).optional(),
    environment: z.enum(["development", "staging", "production"]).optional(),
    version: z.string().optional(),
  })
  .strict();

/**
 * Cursor information for pagination responses
 */
export const cursorInfoSchema = z
  .object({
    nextCursor: z.string().nullable(),
    previousCursor: z.string().nullable().optional(),
    hasMore: z.boolean(),
    hasPrevious: z.boolean().optional(),
    totalPages: z.number().int().optional(),
    currentPage: z.number().int().optional(),
  })
  .strict();

type CursorInfo = z.infer<typeof cursorInfoSchema>;

/**
 * Enhanced metadata for responses with performance and debugging info
 */
export const responseMetaSchema = z
  .object({
    // Basic pagination metadata
    total: z.number().int().optional(),
    page: z.number().int().optional(),
    pageSize: z.number().int().optional(),
    asOf: z.date().optional(),

    // Performance metrics
    performance: performanceMetricsSchema.optional(),

    // Request tracking
    tracking: requestTrackingSchema.optional(),

    // Debug information (only in development/staging)
    debug: debugInfoSchema.optional(),

    // Response metadata
    version: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  })
  .strict();

type ResponseMeta = z.infer<typeof responseMetaSchema>;

// ================================
// Response Success/Error Union Types
// ================================

/**
 * Base success response envelope
 */
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
      meta: responseMetaSchema.optional(),
    })
    .strict();

/**
 * Base error response envelope
 */
export const createErrorResponseSchema = () =>
  z
    .object({
      success: z.literal(false),
      error: errorSchema,
      meta: responseMetaSchema.optional(),
    })
    .strict();

/**
 * Union of success and error responses
 */
export const createResponseUnionSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z.union([
    createSuccessResponseSchema(dataSchema),
    createErrorResponseSchema(),
  ]);

// ================================
// Standardized Output Envelopes
// ================================

/**
 * Enhanced list response envelope with comprehensive metadata
 */
export const createListResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      data: z.array(dataSchema),
      cursorInfo: cursorInfoSchema,
      meta: responseMetaSchema.optional(),
    })
    .strict();

/**
 * Enhanced get response envelope - supports single item, array, or null
 */
export const createGetResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      data: z.union([dataSchema, z.array(dataSchema), z.null()]),
      meta: responseMetaSchema.optional(),
    })
    .strict();

/**
 * Enhanced mutation response envelope with detailed results
 */
export const createMutationResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      data: z.array(dataSchema),
      affectedCount: z.number().int(),
      meta: responseMetaSchema.optional(),
      warnings: z.array(z.string()).optional(),
      partial: z.boolean().default(false), // Indicates partial success
    })
    .strict();

/**
 * Enhanced aggregate response envelope with computation metadata
 */
export const createAggregateResponseSchema = <T extends z.ZodTypeAny>(
  metricsSchema: T,
) =>
  z
    .object({
      metrics: metricsSchema,
      meta: responseMetaSchema.extend({
        asOf: z.date(),
        computation: z
          .object({
            cached: z.boolean().optional(),
            approximation: z.boolean().default(false),
            sampleSize: z.number().int().optional(),
            confidence: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
    })
    .strict();

/**
 * Bulk operation response envelope with detailed results
 */
export const createBulkResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      successful: z.array(dataSchema),
      failed: z.array(
        z.object({
          item: z.any(),
          error: errorSchema,
        }),
      ),
      totalProcessed: z.number().int(),
      successCount: z.number().int(),
      failureCount: z.number().int(),
      meta: responseMetaSchema.optional(),
    })
    .strict();

/**
 * Preview response envelope for bulk operations
 */
export const createPreviewResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z
    .object({
      preview: z.literal(true),
      affectedCount: z.number().int(),
      sampleData: z.array(dataSchema).optional(),
      warnings: z.array(z.string()).optional(),
      meta: responseMetaSchema.optional(),
    })
    .strict();

// ================================
// Selection Schema for Bulk Operations
// ================================

/**
 * Selection criteria for bulk operations with safety guards
 */
export const createSelectionSchema = <FilterType extends z.ZodTypeAny>(
  filterSchema: FilterType,
) =>
  z
    .union([
      z.object({ ids: z.array(z.string().uuid()) }),
      z.object({ filter: filterSchema }),
      z.literal("all"),
    ])
    .describe(
      "Selection criteria: specific IDs, filter conditions, or all records",
    );

// ================================
// Brand Scoping and Multi-Tenancy
// ================================

/**
 * Available roles within a brand context
 * Uses standardized user roles but with subset appropriate for brand context
 */
export const brandRoleEnum = z.enum(["owner", "member"]);

/**
 * Permission levels for operations within a brand
 * Extended from standardized permission types with brand-specific levels
 */
export const permissionLevelEnum = z.enum(["read", "write", "admin", "owner"]);

/**
 * Brand context schema for multi-tenant operations
 * Contains all necessary information for brand-scoped operations
 */
export const brandContextSchema = z
  .object({
    brandId: z.string().uuid(),
    role: brandRoleEnum.optional(),
    permissions: z.array(permissionLevelEnum).optional(),
    isBrandOwner: z.boolean().default(false),
    canAccessBrand: z.boolean().default(false),
  })
  .strict();

type BrandContext = z.infer<typeof brandContextSchema>;

/**
 * Enhanced user context that includes brand information
 * Used in tRPC context to provide comprehensive user state
 */
export const userContextSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().optional(),
    primaryBrandId: z.string().uuid().nullable(),
    currentBrand: brandContextSchema.optional(),
    accessibleBrands: z.array(brandContextSchema).optional(),
    globalRole: z.enum(["owner", "member"]).optional(),
  })
  .strict();

type UserContext = z.infer<typeof userContextSchema>;

/**
 * Brand membership information schema
 */
export const brandMembershipSchema = z
  .object({
    userId: z.string().uuid(),
    brandId: z.string().uuid(),
    role: brandRoleEnum,
    joinedAt: z.date(),
    isActive: z.boolean().default(true),
  })
  .strict();

type BrandMembership = z.infer<typeof brandMembershipSchema>;

/**
 * Brand access validation result
 */
export const brandAccessResultSchema = z
  .object({
    hasAccess: z.boolean(),
    role: brandRoleEnum.nullable(),
    permissions: z.array(permissionLevelEnum),
    reason: z.string().optional(), // Reason for denial if hasAccess is false
  })
  .strict();

type BrandAccessResult = z.infer<typeof brandAccessResultSchema>;

/**
 * Brand switching context for users with access to multiple brands
 */
export const brandSwitchSchema = z
  .object({
    fromBrandId: z.string().uuid().optional(),
    toBrandId: z.string().uuid(),
    userId: z.string().uuid(),
    validatedAccess: brandAccessResultSchema,
  })
  .strict();

type BrandSwitch = z.infer<typeof brandSwitchSchema>;

/**
 * Utility to add brand scoping to any object schema
 * Ensures all data operations are automatically scoped to a brand
 */
export const withBrandScoping = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
) =>
  schema.extend({
    brandId: z.string().uuid(),
  });

/**
 * Utility to add optional brand scoping (for cross-brand operations)
 */
export const withOptionalBrandScoping = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
) =>
  schema.extend({
    brandId: z.string().uuid().optional(),
  });

/**
 * Brand-scoped filter that automatically includes brandId filtering
 */
export const brandScopedFilterSchema = baseFilterSchema
  .extend({
    // Brand context is required for brand-scoped operations
    brandId: z.string().uuid(),

    // Optional multi-brand operations (requires elevated permissions)
    includeCrossBrandData: z.boolean().default(false),
    additionalBrandIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

type BrandScopedFilter = z.infer<typeof brandScopedFilterSchema>;

/**
 * Permission checking schema for specific operations
 */
export const operationPermissionSchema = z
  .object({
    operation: z.enum([
      "read",
      "create",
      "update",
      "delete",
      "bulk_update",
      "bulk_delete",
      "export",
      "import",
      "manage_members",
      "manage_settings",
      "manage_billing",
    ]),
    resource: z.string(), // e.g., "products", "categories", "users"
    brandId: z.string().uuid(),
    requiredPermission: permissionLevelEnum,
  })
  .strict();

type OperationPermission = z.infer<typeof operationPermissionSchema>;

/**
 * Brand validation constraints for different operations
 */
export const brandValidationConstraints = {
  maxMembersPerBrand: 100,
  maxBrandsPerUser: 10,
  ownerTransferCooldownDays: 7,
  memberInviteExpirationDays: 30,
} as const;

// ================================
// Validation Utilities
// ================================

/**
 * Common validation patterns
 */
export const validationPatterns = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  hex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
} as const;

/**
 * Common validation constraints
 */
export const validationConstraints = {
  shortText: { min: 1, max: 100 },
  mediumText: { min: 1, max: 255 },
  longText: { min: 1, max: 2000 },
  identifier: { min: 1, max: 50 },
  pagination: { minLimit: 1, maxLimit: 100, defaultLimit: 20 },
  bulkOperation: { maxWithoutPreview: 1000 },
} as const;

// ================================
// Type Exports
// ================================

// ================================
// Brand Utility Functions
// ================================

/**
 * Permission mapping from roles to permission levels
 * Defines what permissions each role has within a brand
 */
export const rolePermissionMap: Record<
  z.infer<typeof brandRoleEnum>,
  z.infer<typeof permissionLevelEnum>[]
> = {
  owner: ["read", "write", "admin", "owner"],
  member: ["read", "write"],
};

/**
 * Operation permission requirements
 * Maps operations to minimum required permission level
 */
export const operationPermissionMap: Record<
  string,
  z.infer<typeof permissionLevelEnum>
> = {
  read: "read",
  create: "write",
  update: "write",
  delete: "write",
  bulk_update: "admin",
  bulk_delete: "admin",
  export: "admin",
  import: "admin",
  manage_members: "owner",
  manage_settings: "owner",
  manage_billing: "owner",
};

/**
 * Check if a user has the required permission for an operation
 */
export const hasPermission = (
  userRole: z.infer<typeof brandRoleEnum> | null,
  requiredPermission: z.infer<typeof permissionLevelEnum>,
): boolean => {
  if (!userRole) return false;

  const userPermissions = rolePermissionMap[userRole];
  return userPermissions.includes(requiredPermission);
};

/**
 * Check if a user can perform a specific operation
 */
export const canPerformOperation = (
  userRole: z.infer<typeof brandRoleEnum> | null,
  operation: string,
): boolean => {
  const requiredPermission = operationPermissionMap[operation];
  if (!requiredPermission) return false;

  return hasPermission(userRole, requiredPermission);
};

/**
 * Get all permissions for a given role
 */
export const getPermissionsForRole = (
  role: z.infer<typeof brandRoleEnum>,
): z.infer<typeof permissionLevelEnum>[] => {
  return rolePermissionMap[role] || [];
};

/**
 * Validate brand access for a user
 */
export const validateBrandAccess = (
  userBrandMemberships: BrandMembership[],
  targetBrandId: string,
): BrandAccessResult => {
  const membership = userBrandMemberships.find(
    (m) => m.brandId === targetBrandId && m.isActive,
  );

  if (!membership) {
    return {
      hasAccess: false,
      role: null,
      permissions: [],
      reason: "User is not a member of this brand",
    };
  }

  return {
    hasAccess: true,
    role: membership.role,
    permissions: getPermissionsForRole(membership.role),
  };
};

/**
 * Create a brand context from membership information
 */
export const createBrandContext = (
  membership: BrandMembership,
): BrandContext => {
  return {
    brandId: membership.brandId,
    role: membership.role,
    permissions: getPermissionsForRole(membership.role),
    isBrandOwner: membership.role === "owner",
    canAccessBrand: membership.isActive,
  };
};

/**
 * Create enhanced user context with brand information
 */
export const createUserContext = (
  userId: string,
  email: string,
  fullName: string | null,
  primaryBrandId: string | null,
  memberships: BrandMembership[],
  currentBrandId?: string,
): UserContext => {
  const accessibleBrands = memberships
    .filter((m) => m.isActive)
    .map(createBrandContext);

  const currentBrand = currentBrandId
    ? accessibleBrands.find((b) => b.brandId === currentBrandId)
    : accessibleBrands.find((b) => b.brandId === primaryBrandId) ||
      accessibleBrands[0];

  return {
    userId,
    email,
    fullName: fullName || undefined,
    primaryBrandId,
    currentBrand,
    accessibleBrands,
    globalRole: memberships.find((m) => m.role === "owner")
      ? "owner"
      : "member",
  };
};

/**
 * Build brand-scoped where conditions for database queries
 * Automatically adds brandId filtering to prevent cross-brand data access
 */
export const buildBrandScopedConditions = (
  brandId: string,
  additionalConditions?: any[],
): any[] => {
  const conditions = [
    /* eq(table.brandId, brandId) */
  ]; // Placeholder for actual Drizzle condition

  if (additionalConditions) {
    conditions.push(...additionalConditions);
  }

  return conditions;
};

/**
 * Validate bulk operation scope within brand context
 * Ensures bulk operations don't exceed brand limits
 */
export const validateBulkOperationScope = (
  affectedCount: number,
  operation: string,
  userRole: z.infer<typeof brandRoleEnum> | null,
  skipPreview = false,
): { isValid: boolean; requiresPreview: boolean; error?: string } => {
  if (!canPerformOperation(userRole, operation)) {
    return {
      isValid: false,
      requiresPreview: false,
      error: `Insufficient permissions for ${operation} operation`,
    };
  }

  // Large operations require preview for non-owners
  if (affectedCount > validationConstraints.bulkOperation.maxWithoutPreview) {
    if (userRole !== "owner" && !skipPreview) {
      return {
        isValid: false,
        requiresPreview: true,
        error: `Bulk ${operation} affecting ${affectedCount} records requires preview`,
      };
    }
  }

  return { isValid: true, requiresPreview: false };
};

/**
 * Create brand-specific error responses
 */
export const createBrandErrors = {
  /**
   * Error for when user doesn't have access to the brand
   */
  brandAccessDenied: (brandId: string, requestId?: string): ErrorResponse =>
    createErrorResponse(
      "AUTHORIZATION_ERROR",
      `Access denied to brand ${brandId}`,
      {
        statusCode: "403",
        code: "BRAND_ACCESS_DENIED",
        requestId,
      },
    ),

  /**
   * Error for when brand doesn't exist
   */
  brandNotFound: (brandId: string, requestId?: string): ErrorResponse =>
    createErrorResponse("NOT_FOUND_ERROR", `Brand ${brandId} not found`, {
      statusCode: "404",
      code: "BRAND_NOT_FOUND",
      requestId,
    }),

  /**
   * Error for insufficient permissions within brand
   */
  insufficientBrandPermissions: (
    operation: string,
    requiredPermission: string,
    userRole?: string,
    requestId?: string,
  ): ErrorResponse =>
    createErrorResponse(
      "AUTHORIZATION_ERROR",
      `Insufficient permissions for ${operation}. Required: ${requiredPermission}, User role: ${userRole || "none"}`,
      {
        statusCode: "403",
        code: "INSUFFICIENT_BRAND_PERMISSIONS",
        requestId,
      },
    ),

  /**
   * Error for brand membership limit exceeded
   */
  brandMembershipLimit: (limit: number, requestId?: string): ErrorResponse =>
    createErrorResponse(
      "BUSINESS_LOGIC_ERROR",
      `Brand membership limit of ${limit} members exceeded`,
      {
        statusCode: "409",
        code: "BRAND_MEMBERSHIP_LIMIT",
        requestId,
      },
    ),

  /**
   * Error for user brand limit exceeded
   */
  userBrandLimit: (limit: number, requestId?: string): ErrorResponse =>
    createErrorResponse(
      "BUSINESS_LOGIC_ERROR",
      `User brand limit of ${limit} brands exceeded`,
      {
        statusCode: "409",
        code: "USER_BRAND_LIMIT",
        requestId,
      },
    ),
};

export type {
  BaseFilter,
  BaseSort,
  BasePagination,
  BaseInclude,
  BaseWhere,
  BaseData,
  BaseMetrics,
  CursorInfo,
  ResponseMeta,
  BrandContext,
  UserContext,
  BrandMembership,
  BrandAccessResult,
  BrandSwitch,
  BrandScopedFilter,
  OperationPermission,
  ErrorResponse,
  ValidationError,
};

// ================================
// Utility Functions for Envelope Creation
// ================================

/**
 * Create a success list response
 */
export const createSuccessListResponse = <T>(
  data: T[],
  cursorInfo: CursorInfo,
  meta?: Partial<ResponseMeta>,
) => ({
  data,
  cursorInfo,
  meta,
});

/**
 * Create a success get response
 */
export const createSuccessGetResponse = <T>(
  data: T | T[] | null,
  meta?: Partial<ResponseMeta>,
) => ({
  data,
  meta,
});

/**
 * Create a success mutation response
 */
export const createSuccessMutationResponse = <T>(
  data: T[],
  affectedCount: number,
  meta?: Partial<ResponseMeta>,
  warnings?: string[],
  partial = false,
) => ({
  data,
  affectedCount,
  meta,
  warnings,
  partial,
});

/**
 * Create a success aggregate response
 */
export const createSuccessAggregateResponse = <T>(
  metrics: T,
  meta: ResponseMeta & { asOf: Date },
) => ({
  metrics,
  meta,
});

/**
 * Create a bulk operation response
 */
export const createBulkOperationResponse = <T>(
  successful: T[],
  failed: Array<{ item: any; error: ErrorResponse }>,
  totalProcessed: number,
  meta?: Partial<ResponseMeta>,
) => ({
  successful,
  failed,
  totalProcessed,
  successCount: successful.length,
  failureCount: failed.length,
  meta,
});

/**
 * Create a preview response
 */
export const createPreviewResponse = <T>(
  affectedCount: number,
  sampleData?: T[],
  warnings?: string[],
  meta?: Partial<ResponseMeta>,
) => ({
  preview: true as const,
  affectedCount,
  sampleData,
  warnings,
  meta,
});

// ================================
// Error Helper Functions
// ================================

/**
 * Create a validation error
 */
export const createValidationError = (
  field: string,
  message: string,
  code?: string,
  receivedValue?: any,
): ValidationError => ({
  field,
  message,
  code,
  receivedValue,
});

/**
 * Create a comprehensive error response
 */
export const createErrorResponse = (
  type: z.infer<typeof errorTypeEnum>,
  message: string,
  options?: {
    code?: string;
    statusCode?: z.infer<typeof httpStatusEnum>;
    details?: ValidationError[];
    requestId?: string;
    path?: string;
    retryable?: boolean;
  },
): ErrorResponse => ({
  type,
  message,
  timestamp: new Date(),
  retryable: false,
  ...options,
});

/**
 * Common error creators for frequent use cases
 */
export const createCommonErrors = {
  notFound: (
    resource: string,
    id?: string,
    requestId?: string,
  ): ErrorResponse =>
    createErrorResponse("NOT_FOUND_ERROR", `${resource} not found`, {
      statusCode: "404",
      requestId,
      path: id ? `/${resource}/${id}` : `/${resource}`,
    }),

  validation: (details: ValidationError[], requestId?: string): ErrorResponse =>
    createErrorResponse("VALIDATION_ERROR", "Validation failed", {
      statusCode: "422",
      details,
      requestId,
    }),

  unauthorized: (
    message = "Authentication required",
    requestId?: string,
  ): ErrorResponse =>
    createErrorResponse("AUTHENTICATION_ERROR", message, {
      statusCode: "401",
      requestId,
    }),

  forbidden: (message = "Access denied", requestId?: string): ErrorResponse =>
    createErrorResponse("AUTHORIZATION_ERROR", message, {
      statusCode: "403",
      requestId,
    }),

  conflict: (
    resource: string,
    details?: string,
    requestId?: string,
  ): ErrorResponse =>
    createErrorResponse(
      "CONFLICT_ERROR",
      `${resource} conflict: ${details || "Resource already exists"}`,
      {
        statusCode: "409",
        requestId,
      },
    ),

  rateLimit: (retryAfter?: number, requestId?: string): ErrorResponse =>
    createErrorResponse("RATE_LIMIT_ERROR", "Rate limit exceeded", {
      statusCode: "429",
      retryable: true,
      requestId,
    }),

  internal: (
    message = "Internal server error",
    requestId?: string,
  ): ErrorResponse =>
    createErrorResponse("INTERNAL_SERVER_ERROR", message, {
      statusCode: "500",
      retryable: true,
      requestId,
    }),
};

// ================================
// Metadata Helper Functions
// ================================

/**
 * Create performance metrics
 */
export const createPerformanceMetrics = (options: {
  queryTimeMs?: number;
  processingTimeMs?: number;
  cacheHit?: boolean;
  cacheTtlSeconds?: number;
  databaseQueries?: number;
  memoryUsageMb?: number;
}) => options;

/**
 * Create request tracking info
 */
export const createRequestTracking = (
  requestId: string,
  options?: {
    correlationId?: string;
    userAgent?: string;
    ipAddress?: string;
    brandId?: string;
    userId?: string;
    sessionId?: string;
  },
) => ({
  requestId,
  ...options,
});

/**
 * Create debug information
 */
export const createDebugInfo = (options: {
  sqlQueries?: string[];
  cacheKeys?: string[];
  featureFlags?: Record<string, boolean>;
  environment?: "development" | "staging" | "production";
  version?: string;
}) => options;

/**
 * Create cursor info for pagination
 */
export const createCursorInfo = (
  nextCursor: string | null,
  hasMore: boolean,
  options?: {
    previousCursor?: string | null;
    hasPrevious?: boolean;
    totalPages?: number;
    currentPage?: number;
  },
): CursorInfo => ({
  nextCursor,
  hasMore,
  ...options,
});

// ================================
// Module Extension Framework
// ================================

/**
 * Generic schema extension framework allowing modules to extend base schemas
 * with module-specific fields while maintaining type safety.
 *
 * This framework provides:
 * - Type-safe schema extension utilities
 * - Merging of base and extended schemas
 * - Module-specific validation rules
 * - Consistent naming conventions (camelCase)
 * - Integration with existing envelope patterns
 */

/**
 * Extension configuration for a module
 */
export interface ModuleExtensionConfig<
  TFilter extends z.ZodRawShape = z.ZodRawShape,
  TSort extends z.ZodRawShape = z.ZodRawShape,
  TInclude extends z.ZodRawShape = z.ZodRawShape,
  TWhere extends z.ZodRawShape = z.ZodRawShape,
  TData extends z.ZodRawShape = z.ZodRawShape,
  TMetrics extends z.ZodRawShape = z.ZodRawShape,
> {
  /** Module identifier for debugging and documentation */
  moduleId: string;

  /** Additional filter fields specific to this module */
  filterExtensions?: TFilter;

  /** Additional sortable fields specific to this module */
  sortExtensions?: TSort;

  /** Additional includable relations specific to this module */
  includeExtensions?: TInclude;

  /** Additional where conditions specific to this module */
  whereExtensions?: TWhere;

  /** Additional data fields for mutations specific to this module */
  dataExtensions?: TData;

  /** Additional metrics for aggregations specific to this module */
  metricsExtensions?: TMetrics;

  /** Custom validation rules for this module */
  customValidations?: Record<string, z.ZodSchema>;

  /** Module-specific transformation functions */
  transformers?: {
    beforeValidation?: (data: any) => any;
    afterValidation?: (data: any) => any;
  };
}

/**
 * Creates an extended filter schema by merging base schema with module extensions
 */
export const createExtendedFilterSchema = <T extends z.ZodRawShape>(
  extensions: T,
  options?: {
    strict?: boolean;
    description?: string;
  },
): z.ZodObject<z.ZodRawShape & T> => {
  const extended = baseFilterSchema.extend(extensions);

  if (options?.strict !== false) {
    return extended.strict() as z.ZodObject<z.ZodRawShape & T>;
  }

  return extended as z.ZodObject<z.ZodRawShape & T>;
};

/**
 * Creates an extended sort schema by merging base sort fields with module extensions
 */
export const createExtendedSortSchema = <T extends readonly string[]>(
  additionalFields: T,
  options?: {
    strict?: boolean;
    defaultField?: string;
    description?: string;
  },
) => {
  const baseFields = ["createdAt", "updatedAt", "name"] as const;
  const allFields = [...baseFields, ...additionalFields] as const;

  const extendedSchema = z.object({
    field: z.enum(allFields as any),
    direction: sortDirectionEnum.default("desc"),
  });

  if (options?.strict !== false) {
    return extendedSchema.strict();
  }

  return extendedSchema;
};

/**
 * Creates an extended include schema by merging base includes, module extensions,
 * and cross-module relationships
 */
export const createExtendedIncludeSchema = <T extends z.ZodRawShape>(
  extensions: T,
  options?: {
    strict?: boolean;
    description?: string;
    moduleId?: string;
  },
): z.ZodObject<z.ZodRawShape & T> => {
  let extended = baseIncludeSchema.extend(extensions);

  // If moduleId is provided, add cross-module includes
  if (options?.moduleId) {
    const crossModuleSchema = createCrossModuleIncludeSchema(options.moduleId);
    extended = extended.extend(crossModuleSchema.shape) as any;
  }

  if (options?.strict !== false) {
    return extended.strict() as z.ZodObject<z.ZodRawShape & T>;
  }

  return extended as z.ZodObject<z.ZodRawShape & T>;
};

/**
 * Creates an extended where schema by merging base where conditions with module extensions
 */
export const createExtendedWhereSchema = <T extends z.ZodRawShape>(
  extensions: T,
  options?: {
    strict?: boolean;
    description?: string;
  },
): z.ZodObject<z.ZodRawShape & T> => {
  const extended = baseWhereSchema.extend(extensions);

  if (options?.strict !== false) {
    return extended.strict() as z.ZodObject<z.ZodRawShape & T>;
  }

  return extended as z.ZodObject<z.ZodRawShape & T>;
};

/**
 * Creates an extended data schema by merging base data fields with module extensions
 */
export const createExtendedDataSchema = <T extends z.ZodRawShape>(
  extensions: T,
  options?: {
    strict?: boolean;
    description?: string;
  },
): z.ZodObject<z.ZodRawShape & T> => {
  const extended = baseDataSchema.extend(extensions);

  if (options?.strict !== false) {
    return extended.strict() as z.ZodObject<z.ZodRawShape & T>;
  }

  return extended as z.ZodObject<z.ZodRawShape & T>;
};

/**
 * Creates an extended metrics schema by merging base metrics with module extensions
 */
export const createExtendedMetricsSchema = <T extends readonly string[]>(
  additionalMetrics: T,
  options?: {
    strict?: boolean;
    description?: string;
  },
) => {
  const baseMetrics = [
    "countByStatus",
    "countByCategory",
    "countByDate",
    "totalCount",
    "activeCount",
    "recentActivity",
  ] as const;

  const allMetrics = [...baseMetrics, ...additionalMetrics] as const;

  const extendedSchema = z.object({
    metrics: z.array(z.enum(allMetrics as any)),
  });

  if (options?.strict !== false) {
    return extendedSchema.strict();
  }

  return extendedSchema;
};

/**
 * Creates a complete module schema extension bundle
 */
export const createModuleSchemas = <
  TFilter extends z.ZodRawShape,
  TSort extends readonly [string, ...string[]],
  TInclude extends z.ZodRawShape,
  TWhere extends z.ZodRawShape,
  TData extends z.ZodRawShape,
  TMetrics extends readonly [string, ...string[]],
>(config: {
  moduleId: string;
  filterExtensions?: TFilter;
  sortFields?: TSort;
  includeExtensions?: TInclude;
  whereExtensions?: TWhere;
  dataExtensions?: TData;
  additionalMetrics?: TMetrics;
  strict?: boolean;
}) => {
  const {
    moduleId,
    filterExtensions = {} as TFilter,
    sortFields = [] as unknown as TSort,
    includeExtensions = {} as TInclude,
    whereExtensions = {} as TWhere,
    dataExtensions = {} as TData,
    additionalMetrics = [] as unknown as TMetrics,
    strict = true,
  } = config;

  return {
    moduleId,

    // Extended schemas
    filterSchema: createExtendedFilterSchema(filterExtensions, {
      strict,
      description: `${moduleId} filter schema`,
    }),

    sortSchema:
      sortFields.length > 0
        ? createExtendedSortSchema(sortFields, {
            strict,
            description: `${moduleId} sort schema`,
          })
        : baseSortSchema,

    includeSchema: createExtendedIncludeSchema(includeExtensions, {
      strict,
      description: `${moduleId} include schema`,
      moduleId, // Automatically adds cross-module relationships
    }),

    whereSchema: createExtendedWhereSchema(whereExtensions, {
      strict,
      description: `${moduleId} where schema`,
    }),

    dataSchema: createExtendedDataSchema(dataExtensions, {
      strict,
      description: `${moduleId} data schema`,
    }),

    metricsSchema:
      additionalMetrics.length > 0
        ? createExtendedMetricsSchema(additionalMetrics, {
            strict,
            description: `${moduleId} metrics schema`,
          })
        : baseMetricsSchema,

    // Standard schemas (unchanged)
    paginationSchema: basePaginationSchema,

    // Response envelope creators for this module
    createListResponse: <T extends z.ZodTypeAny>(dataSchema: T) =>
      createListResponseSchema(dataSchema),

    createGetResponse: <T extends z.ZodTypeAny>(dataSchema: T) =>
      createGetResponseSchema(dataSchema),

    createMutationResponse: <T extends z.ZodTypeAny>(dataSchema: T) =>
      createMutationResponseSchema(dataSchema),

    createAggregateResponse: <T extends z.ZodTypeAny>(metricsSchema: T) =>
      createAggregateResponseSchema(metricsSchema),

    createBulkResponse: <T extends z.ZodTypeAny>(dataSchema: T) =>
      createBulkResponseSchema(dataSchema),

    createPreviewResponse: <T extends z.ZodTypeAny>(dataSchema: T) =>
      createPreviewResponseSchema(dataSchema),

    // Selection schema for bulk operations
    createSelectionSchema: () =>
      createSelectionSchema(
        createExtendedFilterSchema(filterExtensions, { strict }),
      ),
  };
};

/**
 * Type helpers for module schema inference
 */
export type ModuleSchemas<T extends ReturnType<typeof createModuleSchemas>> = T;

export type InferModuleFilter<T extends { filterSchema: z.ZodTypeAny }> =
  z.infer<T["filterSchema"]>;

export type InferModuleSort<T extends { sortSchema: z.ZodTypeAny }> = z.infer<
  T["sortSchema"]
>;

export type InferModuleInclude<T extends { includeSchema: z.ZodTypeAny }> =
  z.infer<T["includeSchema"]>;

export type InferModuleWhere<T extends { whereSchema: z.ZodTypeAny }> = z.infer<
  T["whereSchema"]
>;

export type InferModuleData<T extends { dataSchema: z.ZodTypeAny }> = z.infer<
  T["dataSchema"]
>;

export type InferModuleMetrics<T extends { metricsSchema: z.ZodTypeAny }> =
  z.infer<T["metricsSchema"]>;

/**
 * Validation utilities for modules
 */
export const createModuleValidator = <T extends z.ZodSchema>(
  schema: T,
  options?: {
    onError?: (error: z.ZodError) => void;
    transform?: (data: z.infer<T>) => z.infer<T>;
  },
) => {
  return (data: unknown): z.infer<T> => {
    try {
      const validated = schema.parse(data);
      return options?.transform ? options.transform(validated) : validated;
    } catch (error) {
      if (error instanceof z.ZodError && options?.onError) {
        options.onError(error);
      }
      throw error;
    }
  };
};

/**
 * Module schema registry for centralized management
 */
const moduleSchemaRegistry = new Map<string, ModuleSchemas<any>>();

/**
 * Register a module's schemas for reuse across the application
 */
export const registerModuleSchemas = <
  T extends ReturnType<typeof createModuleSchemas>,
>(
  schemas: T,
): T => {
  moduleSchemaRegistry.set(schemas.moduleId, schemas);
  return schemas;
};

/**
 * Get registered module schemas by module ID
 */
export const getModuleSchemas = <T extends ModuleSchemas<any>>(
  moduleId: string,
): T | undefined => {
  return moduleSchemaRegistry.get(moduleId) as T | undefined;
};

/**
 * List all registered module IDs
 */
export const getRegisteredModuleIds = (): string[] => {
  return Array.from(moduleSchemaRegistry.keys());
};

/**
 * Clear module schema registry (useful for testing)
 */
export const clearModuleSchemaRegistry = (): void => {
  moduleSchemaRegistry.clear();
};

// ================================
// Cross-Module Query Utilities
// ================================

/**
 * Enhanced module schemas with cross-module query capabilities
 */
export const createCrossModuleQueryCapabilities = <T extends z.ZodTypeAny>(
  moduleId: string,
  sourceTable: any, // AnyPgTable type from drizzle
  dataSchema: T,
) => {
  const queryBuilder = createCrossModuleQueryBuilder(moduleId, sourceTable);

  return {
    queryBuilder,

    /**
     * Analyze performance implications of requested includes
     */
    analyzeIncludes: (includes: Record<string, boolean>) => {
      return analyzeQueryPerformance(moduleId, includes);
    },

    /**
     * Get available cross-module includes for this module
     */
    getAvailableIncludes: () => {
      return crossModuleRegistry.getAvailableIncludes(moduleId);
    },

    /**
     * Validate include permissions and performance
     */
    validateIncludes: (
      includes: Record<string, boolean>,
      userRole?: string,
    ) => {
      const performance = analyzeQueryPerformance(moduleId, includes);

      // Basic validation rules
      const warnings: string[] = [];

      if (performance.joinCount > 5) {
        warnings.push("High join count may impact performance");
      }

      if (performance.hasExpensiveRelationships && userRole !== "owner") {
        warnings.push("Expensive relationships require owner permissions");
      }

      return {
        isValid: warnings.length === 0,
        warnings,
        performance,
        recommendedStrategy: performance.recommendedStrategy,
      };
    },
  };
};

/**
 * Utility to safely apply cross-module includes to a query
 */
export const applyCrossModuleIncludes = <T extends any>(
  query: T,
  includes: Record<string, boolean>,
  moduleId: string,
  sourceTable: any,
): T => {
  if (!includes || Object.keys(includes).length === 0) {
    return query;
  }

  const queryBuilder = createCrossModuleQueryBuilder(moduleId, sourceTable);
  return queryBuilder.buildJoins(query, includes);
};

/**
 * Transform query results to include cross-module data
 */
export const transformCrossModuleResults = <T extends any[]>(
  results: T,
  includes: Record<string, boolean>,
  moduleId: string,
): T => {
  if (!includes || Object.keys(includes).length === 0 || !results.length) {
    return results;
  }

  const queryBuilder = createCrossModuleQueryBuilder(moduleId, {} as any);
  return queryBuilder.transformResults(results, includes) as T;
};

/**
 * Create performance monitoring for cross-module queries
 */
export const createCrossModulePerformanceTracker = (moduleId: string) => {
  return {
    trackQuery: (includes: Record<string, boolean>, startTime: number) => {
      const performance = analyzeQueryPerformance(moduleId, includes);
      const duration = Date.now() - startTime;

      return {
        queryTimeMs: duration,
        joinCount: performance.joinCount,
        hasExpensiveRelationships: performance.hasExpensiveRelationships,
        estimatedCardinality: performance.estimatedCardinality,
        recommendedStrategy: performance.recommendedStrategy,
      };
    },
  };
};

// Note: All schemas, utilities, and module extension framework are exported inline above
// This comment replaces the duplicate export block
