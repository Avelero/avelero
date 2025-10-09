import { z } from "zod";
import {
  type EntityStatus,
  type Priority,
  type UserRole,
  type PermissionType,
  type JobStatus,
  type DataSourceType,
  type ValidationSeverity,
  type Environment,
  type SortDirection,
  type Visibility,
  entityStatusEnum,
  priorityEnum,
  userRoleEnum,
  permissionTypeEnum,
  jobStatusEnum,
  dataSourceTypeEnum,
  validationSeverityEnum,
  environmentEnum,
  sortDirectionEnum,
  visibilityEnum,
  entityStatusLabels,
  priorityLabels,
  userRoleLabels,
  permissionTypeLabels,
  jobStatusLabels,
  dataSourceTypeLabels,
  validationSeverityLabels,
  environmentLabels,
  sortDirectionLabels,
  visibilityLabels,
  entityStatusOrder,
  priorityOrder,
  userRoleOrder,
  validationSeverityOrder,
} from "./enums";
import {
  type ValidationError,
  type ErrorResponse,
  createValidationError,
  createErrorResponse,
  createCommonErrors,
} from "./shared";

// ================================
// Validation Context Types
// ================================

/**
 * Context information for validation operations
 */
export interface ValidationContext {
  /**
   * Current user context for permission-based validation
   */
  user?: {
    id: string;
    role: UserRole;
    brandId?: string;
    permissions?: PermissionType[];
  };

  /**
   * Brand context for multi-tenant validation
   */
  brand?: {
    id: string;
    ownerId: string;
    memberIds: string[];
  };

  /**
   * Request context for tracking and debugging
   */
  request?: {
    id: string;
    path: string;
    method: string;
    userAgent?: string;
  };

  /**
   * Environment context for feature flags and constraints
   */
  environment?: Environment;

  /**
   * Feature flags for conditional validation
   */
  features?: Record<string, boolean>;
}

/**
 * Validation result with detailed error information
 */
export interface ValidationResult<T = any> {
  /**
   * Whether validation passed
   */
  success: boolean;

  /**
   * Validated and potentially transformed data (only present if success = true)
   */
  data?: T;

  /**
   * Validation errors (only present if success = false)
   */
  errors?: ValidationError[];

  /**
   * Warnings that don't prevent validation success
   */
  warnings?: string[];

  /**
   * Comprehensive error response for API usage
   */
  errorResponse?: ErrorResponse;
}

/**
 * Batch validation result for multiple items
 */
export interface BatchValidationResult<T = any> {
  /**
   * Overall batch success (true if all items passed)
   */
  success: boolean;

  /**
   * Successfully validated items
   */
  validItems: T[];

  /**
   * Items that failed validation with their errors
   */
  invalidItems: Array<{
    item: any;
    errors: ValidationError[];
  }>;

  /**
   * Summary statistics
   */
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warningCount: number;
  };

  /**
   * Aggregated warnings from all items
   */
  warnings: string[];
}

// ================================
// Core Validation Functions
// ================================

/**
 * Validates an enum value with enhanced error reporting
 */
export function validateEnum<T extends string>(
  value: unknown,
  enumSchema: z.ZodEnum<[T, ...T[]]>,
  fieldName: string,
  customMessage?: string,
): ValidationResult<T> {
  try {
    const validatedValue = enumSchema.parse(value);
    return {
      success: true,
      data: validatedValue,
    };
  } catch (error) {
    const validValues = enumSchema.options;
    const message =
      customMessage ||
      `Invalid ${fieldName}. Expected one of: ${validValues.join(", ")}. Received: ${String(value)}`;

    const validationError = createValidationError(
      fieldName,
      message,
      "INVALID_ENUM_VALUE",
      value,
    );

    const errorResponse = createCommonErrors.validation([validationError]);

    return {
      success: false,
      errors: [validationError],
      errorResponse,
    };
  }
}

/**
 * Validates entity status with state transition rules
 */
export function validateEntityStatus(
  value: unknown,
  currentStatus?: EntityStatus,
  context?: ValidationContext,
): ValidationResult<EntityStatus> {
  // First validate the enum value
  const baseResult = validateEnum(value, entityStatusEnum, "status");
  if (!baseResult.success) {
    return baseResult;
  }

  const newStatus = baseResult.data!;
  const warnings: string[] = [];

  // Validate state transitions if current status is provided
  if (currentStatus && !isValidStatusTransition(currentStatus, newStatus)) {
    const validationError = createValidationError(
      "status",
      `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
      "INVALID_STATUS_TRANSITION",
      { from: currentStatus, to: newStatus },
    );

    return {
      success: false,
      errors: [validationError],
      errorResponse: createCommonErrors.validation([validationError]),
    };
  }

  // Add warnings for potentially risky transitions
  if (currentStatus === "published" && newStatus === "draft") {
    warnings.push(
      "Moving from published to draft may affect public visibility",
    );
  }

  if (currentStatus === "active" && newStatus === "archived") {
    warnings.push("Archiving active items may impact user experience");
  }

  return {
    success: true,
    data: newStatus,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates priority with role-based constraints
 */
export function validatePriority(
  value: unknown,
  context?: ValidationContext,
): ValidationResult<Priority> {
  const baseResult = validateEnum(value, priorityEnum, "priority");
  if (!baseResult.success) {
    return baseResult;
  }

  const priority = baseResult.data!;
  const warnings: string[] = [];

  // Role-based validation
  if (context?.user) {
    const { role } = context.user;

    // Only admins and owners can set critical priority
    if (priority === "critical" && !["admin", "owner"].includes(role)) {
      const validationError = createValidationError(
        "priority",
        "Insufficient permissions to set critical priority",
        "INSUFFICIENT_PERMISSIONS",
        { userRole: role, requiredRole: "admin" },
      );

      return {
        success: false,
        errors: [validationError],
        errorResponse: createCommonErrors.forbidden(
          "Cannot set critical priority",
          context.request?.id,
        ),
      };
    }

    // Warn when members set high priority
    if (priority === "high" && role === "member") {
      warnings.push("High priority items may require admin approval");
    }
  }

  return {
    success: true,
    data: priority,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates user role with brand context
 */
export function validateUserRole(
  value: unknown,
  context?: ValidationContext,
): ValidationResult<UserRole> {
  const baseResult = validateEnum(value, userRoleEnum, "role");
  if (!baseResult.success) {
    return baseResult;
  }

  const role = baseResult.data!;

  // Brand ownership validation
  if (context?.user && context?.brand) {
    const { user, brand } = context;

    // Only brand owners can assign owner role
    if (role === "owner" && user.id !== brand.ownerId) {
      const validationError = createValidationError(
        "role",
        "Only brand owners can assign owner role",
        "INSUFFICIENT_PERMISSIONS",
        { currentUserId: user.id, brandOwnerId: brand.ownerId },
      );

      return {
        success: false,
        errors: [validationError],
        errorResponse: createCommonErrors.forbidden(
          "Cannot assign owner role",
          context.request?.id,
        ),
      };
    }

    // Only owners and admins can assign admin role
    if (role === "admin" && !["owner", "admin"].includes(user.role)) {
      const validationError = createValidationError(
        "role",
        "Insufficient permissions to assign admin role",
        "INSUFFICIENT_PERMISSIONS",
        { userRole: user.role, requiredRole: "admin" },
      );

      return {
        success: false,
        errors: [validationError],
        errorResponse: createCommonErrors.forbidden(
          "Cannot assign admin role",
          context.request?.id,
        ),
      };
    }
  }

  return {
    success: true,
    data: role,
  };
}

/**
 * Validates job status with workflow constraints
 */
export function validateJobStatus(
  value: unknown,
  currentStatus?: JobStatus,
  context?: ValidationContext,
): ValidationResult<JobStatus> {
  const baseResult = validateEnum(value, jobStatusEnum, "status");
  if (!baseResult.success) {
    return baseResult;
  }

  const newStatus = baseResult.data!;

  // Validate job status transitions
  if (currentStatus && !isValidJobStatusTransition(currentStatus, newStatus)) {
    const validationError = createValidationError(
      "status",
      `Invalid job status transition from "${currentStatus}" to "${newStatus}"`,
      "INVALID_STATUS_TRANSITION",
      { from: currentStatus, to: newStatus },
    );

    return {
      success: false,
      errors: [validationError],
      errorResponse: createCommonErrors.validation([validationError]),
    };
  }

  return {
    success: true,
    data: newStatus,
  };
}

// ================================
// Batch Validation Functions
// ================================

/**
 * Validates multiple enum values in batch
 */
export function validateEnumBatch<T extends string>(
  values: unknown[],
  enumSchema: z.ZodEnum<[T, ...T[]]>,
  fieldName: string,
  context?: ValidationContext,
): BatchValidationResult<T> {
  const validItems: T[] = [];
  const invalidItems: Array<{ item: any; errors: ValidationError[] }> = [];
  const warnings: string[] = [];

  values.forEach((value, index) => {
    const result = validateEnum(value, enumSchema, `${fieldName}[${index}]`);

    if (result.success) {
      validItems.push(result.data!);
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    } else {
      invalidItems.push({
        item: value,
        errors: result.errors || [],
      });
    }
  });

  return {
    success: invalidItems.length === 0,
    validItems,
    invalidItems,
    summary: {
      total: values.length,
      valid: validItems.length,
      invalid: invalidItems.length,
      warningCount: warnings.length,
    },
    warnings,
  };
}

/**
 * Validates entity statuses in batch with transition checking
 */
export function validateEntityStatusBatch(
  statusUpdates: Array<{
    id: string;
    status: unknown;
    currentStatus?: EntityStatus;
  }>,
  context?: ValidationContext,
): BatchValidationResult<{ id: string; status: EntityStatus }> {
  const validItems: Array<{ id: string; status: EntityStatus }> = [];
  const invalidItems: Array<{ item: any; errors: ValidationError[] }> = [];
  const warnings: string[] = [];

  statusUpdates.forEach((update) => {
    const result = validateEntityStatus(
      update.status,
      update.currentStatus,
      context,
    );

    if (result.success) {
      validItems.push({
        id: update.id,
        status: result.data!,
      });
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    } else {
      invalidItems.push({
        item: update,
        errors: result.errors || [],
      });
    }
  });

  return {
    success: invalidItems.length === 0,
    validItems,
    invalidItems,
    summary: {
      total: statusUpdates.length,
      valid: validItems.length,
      invalid: invalidItems.length,
      warningCount: warnings.length,
    },
    warnings,
  };
}

// ================================
// State Transition Logic
// ================================

/**
 * Defines valid entity status transitions
 */
const validStatusTransitions: Record<EntityStatus, EntityStatus[]> = {
  draft: ["pending", "active", "published", "cancelled"],
  pending: ["active", "published", "cancelled", "blocked"],
  active: ["inactive", "published", "archived", "cancelled"],
  published: ["inactive", "archived", "cancelled"],
  inactive: ["active", "archived", "cancelled"],
  blocked: ["pending", "cancelled"],
  deferred: ["pending", "cancelled"],
  cancelled: [], // Terminal state
  archived: [], // Terminal state
  scheduled: ["active", "published", "cancelled"], // Scheduled can transition to active/published
  unpublished: ["draft", "pending", "published"], // Unpublished can be re-drafted or published
};

/**
 * Checks if a status transition is valid
 */
function isValidStatusTransition(
  from: EntityStatus,
  to: EntityStatus,
): boolean {
  return validStatusTransitions[from]?.includes(to) ?? false;
}

/**
 * Defines valid job status transitions
 */
const validJobStatusTransitions: Record<JobStatus, JobStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["completed", "failed", "timeout", "cancelled"],
  retrying: ["running", "failed", "cancelled"],
  completed: [], // Terminal state
  failed: ["retrying", "cancelled"],
  timeout: ["retrying", "cancelled"],
  cancelled: [], // Terminal state
};

/**
 * Checks if a job status transition is valid
 */
function isValidJobStatusTransition(from: JobStatus, to: JobStatus): boolean {
  return validJobStatusTransitions[from]?.includes(to) ?? false;
}

// ================================
// Utility Functions
// ================================

/**
 * Gets the display label for any enum value
 */
export function getEnumLabel(value: string, enumType: string): string {
  switch (enumType) {
    case "entityStatus":
      return entityStatusLabels[value as EntityStatus] || value;
    case "priority":
      return priorityLabels[value as Priority] || value;
    case "userRole":
      return userRoleLabels[value as UserRole] || value;
    case "permissionType":
      return permissionTypeLabels[value as PermissionType] || value;
    case "jobStatus":
      return jobStatusLabels[value as JobStatus] || value;
    case "dataSourceType":
      return dataSourceTypeLabels[value as DataSourceType] || value;
    case "validationSeverity":
      return validationSeverityLabels[value as ValidationSeverity] || value;
    case "environment":
      return environmentLabels[value as Environment] || value;
    case "sortDirection":
      return sortDirectionLabels[value as SortDirection] || value;
    case "visibility":
      return visibilityLabels[value as Visibility] || value;
    default:
      return value;
  }
}

/**
 * Gets the sort order for any enum value
 */
export function getEnumSortOrder(value: string, enumType: string): number {
  switch (enumType) {
    case "entityStatus":
      return entityStatusOrder[value as EntityStatus] || 999;
    case "priority":
      return priorityOrder[value as Priority] || 999;
    case "userRole":
      return userRoleOrder[value as UserRole] || 999;
    case "validationSeverity":
      return validationSeverityOrder[value as ValidationSeverity] || 999;
    default:
      return 999;
  }
}

/**
 * Sorts enum values by their defined order
 */
export function sortEnumValues<T extends string>(
  values: T[],
  enumType: string,
): T[] {
  return [...values].sort((a, b) => {
    const orderA = getEnumSortOrder(a, enumType);
    const orderB = getEnumSortOrder(b, enumType);
    return orderA - orderB;
  });
}

/**
 * Filters enum values based on user permissions
 */
export function filterEnumByPermissions<T extends string>(
  values: T[],
  enumType: string,
  context?: ValidationContext,
): T[] {
  if (!context?.user) {
    return values;
  }

  // Filter entity statuses based on role
  if (enumType === "entityStatus") {
    const { role } = context.user;
    if (role === "viewer") {
      // Viewers can only see non-draft statuses
      return values.filter((v) => v !== "draft");
    }
  }

  // Filter priorities based on role
  if (enumType === "priority") {
    const { role } = context.user;
    if (!["admin", "owner"].includes(role)) {
      // Non-admins cannot see critical priority
      return values.filter((v) => v !== "critical");
    }
  }

  return values;
}

/**
 * Creates a validation context from common request information
 */
export function createValidationContext(options: {
  userId?: string;
  userRole?: UserRole;
  brandId?: string;
  brandOwnerId?: string;
  requestId?: string;
  requestPath?: string;
  environment?: Environment;
  features?: Record<string, boolean>;
}): ValidationContext {
  const context: ValidationContext = {};

  if (options.userId) {
    context.user = {
      id: options.userId,
      role: options.userRole || "member",
      brandId: options.brandId,
    };
  }

  if (options.brandId && options.brandOwnerId) {
    context.brand = {
      id: options.brandId,
      ownerId: options.brandOwnerId,
      memberIds: [], // Would be populated from database
    };
  }

  if (options.requestId) {
    context.request = {
      id: options.requestId,
      path: options.requestPath || "",
      method: "POST", // Default, would be set from actual request
    };
  }

  if (options.environment) {
    context.environment = options.environment;
  }

  if (options.features) {
    context.features = options.features;
  }

  return context;
}

// ================================
// All validation functions are exported above with their declarations
// ================================
