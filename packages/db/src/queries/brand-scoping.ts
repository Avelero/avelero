import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { userRoleEnum, permissionTypeEnum } from "../extensions/enums";
import {
  type BrandContext,
  type BrandAccessResult,
  type BrandMembership,
  type UserContext,
  validateBrandAccess,
  createBrandContext,
  createUserContext,
  canPerformOperation,
  createBrandErrors,
  brandValidationConstraints,
  hasPermission,
} from "../extensions/shared";

// ================================
// Brand Scoping Query Utilities
// ================================

/**
 * Brand-scoped query builder that automatically adds brand filtering
 * Prevents accidental cross-brand data access in database queries
 */
export class BrandScopedQueryBuilder {
  private brandId: string;
  private userRole: string | null;
  private conditions: SQL[] = [];

  constructor(brandId: string, userRole?: string | null) {
    this.brandId = brandId;
    this.userRole = userRole || null;
  }

  /**
   * Add brand scoping condition to any table with brandId column
   */
  withBrandScope<T extends PgTable>(table: T & { brandId: any }): SQL {
    return eq(table.brandId, this.brandId);
  }

  /**
   * Add multiple brand scoping (for cross-brand operations with proper permissions)
   */
  withMultiBrandScope<T extends PgTable>(
    table: T & { brandId: any },
    additionalBrandIds: string[],
  ): SQL {
    const allBrandIds = [this.brandId, ...additionalBrandIds];
    return inArray(table.brandId, allBrandIds);
  }

  /**
   * Build complete where conditions with brand scoping and additional filters
   */
  buildWhereConditions<T extends PgTable>(
    table: T & { brandId: any },
    additionalConditions?: SQL[],
  ): SQL {
    const conditions = [this.withBrandScope(table)];

    if (additionalConditions) {
      conditions.push(...additionalConditions);
    }

    return and(...conditions)!;
  }

  /**
   * Validate permission for operation within this brand context
   */
  validateOperation(operation: string): boolean {
    return canPerformOperation(this.userRole as any, operation);
  }

  /**
   * Get the brand ID for this scoped query
   */
  getBrandId(): string {
    return this.brandId;
  }

  /**
   * Get the user role for this scoped query
   */
  getUserRole(): string | null {
    return this.userRole;
  }
}

/**
 * Create a brand-scoped query builder instance
 */
export const createBrandScopedQuery = (
  brandId: string,
  userRole?: string | null,
): BrandScopedQueryBuilder => {
  return new BrandScopedQueryBuilder(brandId, userRole);
};

// ================================
// Brand Access Control Utilities
// ================================

/**
 * Brand access manager for handling multi-tenant operations
 */
export class BrandAccessManager {
  private userMemberships: BrandMembership[];
  private currentBrandId: string | null;

  constructor(
    userMemberships: BrandMembership[],
    currentBrandId?: string | null,
  ) {
    this.userMemberships = userMemberships;
    this.currentBrandId = currentBrandId || null;
  }

  /**
   * Validate access to a specific brand
   */
  validateAccess(brandId: string): BrandAccessResult {
    return validateBrandAccess(this.userMemberships, brandId);
  }

  /**
   * Check if user can access multiple brands (for cross-brand operations)
   */
  validateMultiBrandAccess(
    brandIds: string[],
  ): Record<string, BrandAccessResult> {
    const results: Record<string, BrandAccessResult> = {};

    for (const brandId of brandIds) {
      results[brandId] = this.validateAccess(brandId);
    }

    return results;
  }

  /**
   * Get all accessible brands for the user
   */
  getAccessibleBrands(): BrandContext[] {
    return this.userMemberships
      .filter((membership) => membership.isActive)
      .map(createBrandContext);
  }

  /**
   * Get the current brand context
   */
  getCurrentBrandContext(): BrandContext | null {
    if (!this.currentBrandId) return null;

    const membership = this.userMemberships.find(
      (m) => m.brandId === this.currentBrandId && m.isActive,
    );

    return membership ? createBrandContext(membership) : null;
  }

  /**
   * Switch to a different brand (with validation)
   */
  switchBrand(newBrandId: string): {
    success: boolean;
    context?: BrandContext;
    error?: string;
  } {
    const access = this.validateAccess(newBrandId);

    if (!access.hasAccess) {
      return {
        success: false,
        error: access.reason || "Access denied to brand",
      };
    }

    const membership = this.userMemberships.find(
      (m) => m.brandId === newBrandId && m.isActive,
    );

    if (!membership) {
      return {
        success: false,
        error: "Brand membership not found",
      };
    }

    this.currentBrandId = newBrandId;

    return {
      success: true,
      context: createBrandContext(membership),
    };
  }

  /**
   * Check if user is owner of any brand
   */
  isOwnerOfAnyBrand(): boolean {
    return this.userMemberships.some((m) => m.role === "owner" && m.isActive);
  }

  /**
   * Check if user is owner of specific brand
   */
  isOwnerOfBrand(brandId: string): boolean {
    const membership = this.userMemberships.find(
      (m) => m.brandId === brandId && m.isActive,
    );
    return membership?.role === "owner" || false;
  }

  /**
   * Get user's role in a specific brand
   */
  getRoleInBrand(brandId: string): string | null {
    const membership = this.userMemberships.find(
      (m) => m.brandId === brandId && m.isActive,
    );
    return membership?.role || null;
  }

  /**
   * Validate operation permission in specific brand
   */
  canPerformOperationInBrand(brandId: string, operation: string): boolean {
    const role = this.getRoleInBrand(brandId);
    return canPerformOperation(role as any, operation);
  }
}

/**
 * Create a brand access manager instance
 */
export const createBrandAccessManager = (
  userMemberships: BrandMembership[],
  currentBrandId?: string | null,
): BrandAccessManager => {
  return new BrandAccessManager(userMemberships, currentBrandId);
};

// ================================
// Brand Context Factory Functions
// ================================

/**
 * Factory for creating comprehensive user context with brand information
 */
export const createEnhancedUserContext = async (
  userId: string,
  email: string,
  fullName: string | null,
  primaryBrandId: string | null,
  getMemberships: () => Promise<BrandMembership[]>,
  currentBrandId?: string,
): Promise<UserContext> => {
  const memberships = await getMemberships();

  return createUserContext(
    userId,
    email,
    fullName,
    primaryBrandId,
    memberships,
    currentBrandId,
  );
};

/**
 * Factory for creating brand-scoped operation context
 */
export const createBrandOperationContext = (
  brandId: string,
  userMemberships: BrandMembership[],
  operation: string,
): {
  isAllowed: boolean;
  context?: BrandContext;
  queryBuilder?: BrandScopedQueryBuilder;
  error?: string;
} => {
  const access = validateBrandAccess(userMemberships, brandId);

  if (!access.hasAccess) {
    return {
      isAllowed: false,
      error: access.reason || "Access denied to brand",
    };
  }

  const canPerform = canPerformOperation(access.role as any, operation);

  if (!canPerform) {
    return {
      isAllowed: false,
      error: `Insufficient permissions for operation: ${operation}`,
    };
  }

  const membership = userMemberships.find(
    (m) => m.brandId === brandId && m.isActive,
  );

  if (!membership) {
    return {
      isAllowed: false,
      error: "Brand membership not found",
    };
  }

  const context = createBrandContext(membership);
  const queryBuilder = createBrandScopedQuery(brandId, access.role);

  return {
    isAllowed: true,
    context,
    queryBuilder,
  };
};

// ================================
// Brand Validation Utilities
// ================================

/**
 * Validate brand membership constraints
 */
export const validateBrandMembershipConstraints = (
  currentMemberCount: number,
  operation: "add" | "remove",
  count = 1,
): { isValid: boolean; error?: string } => {
  if (operation === "add") {
    const newTotal = currentMemberCount + count;
    if (newTotal > brandValidationConstraints.maxMembersPerBrand) {
      return {
        isValid: false,
        error: `Brand membership limit of ${brandValidationConstraints.maxMembersPerBrand} would be exceeded`,
      };
    }
  }

  return { isValid: true };
};

/**
 * Validate user brand limit constraints
 */
export const validateUserBrandConstraints = (
  currentBrandCount: number,
  operation: "add" | "remove",
  count = 1,
): { isValid: boolean; error?: string } => {
  if (operation === "add") {
    const newTotal = currentBrandCount + count;
    if (newTotal > brandValidationConstraints.maxBrandsPerUser) {
      return {
        isValid: false,
        error: `User brand limit of ${brandValidationConstraints.maxBrandsPerUser} would be exceeded`,
      };
    }
  }

  return { isValid: true };
};

/**
 * Validate bulk operation within brand context
 */
export const validateBrandBulkOperation = (
  affectedCount: number,
  operation: string,
  userRole: string | null,
  brandId: string,
  skipPreview = false,
): {
  isValid: boolean;
  requiresPreview: boolean;
  error?: string;
  errorResponse?: any;
} => {
  // Check basic permission
  if (!canPerformOperation(userRole as any, operation)) {
    return {
      isValid: false,
      requiresPreview: false,
      error: `Insufficient permissions for ${operation} operation`,
      errorResponse: createBrandErrors.insufficientBrandPermissions(
        operation,
        "admin", // Most bulk operations require admin
        userRole || "none",
      ),
    };
  }

  // Check if preview is required for large operations
  if (affectedCount > 1000 && userRole !== "owner" && !skipPreview) {
    return {
      isValid: false,
      requiresPreview: true,
      error: `Bulk ${operation} affecting ${affectedCount} records requires preview`,
    };
  }

  return { isValid: true, requiresPreview: false };
};

// ================================
// Common Brand Query Patterns
// ================================

/**
 * Common query patterns for brand-scoped operations
 */
export const brandQueryPatterns = {
  /**
   * Standard list query with brand scoping
   */
  buildListQuery: <T extends PgTable>(
    table: T & { brandId: any },
    brandId: string,
    additionalConditions?: SQL[],
  ) => {
    const builder = createBrandScopedQuery(brandId);
    return builder.buildWhereConditions(table, additionalConditions);
  },

  /**
   * Standard get query with brand scoping and ID
   */
  buildGetQuery: <T extends PgTable>(
    table: T & { brandId: any; id: any },
    brandId: string,
    recordId: string,
  ) => {
    const builder = createBrandScopedQuery(brandId);
    return builder.buildWhereConditions(table, [eq(table.id, recordId)]);
  },

  /**
   * Standard update query with brand scoping
   */
  buildUpdateQuery: <T extends PgTable>(
    table: T & { brandId: any; id: any },
    brandId: string,
    recordIds: string[],
  ) => {
    const builder = createBrandScopedQuery(brandId);
    return builder.buildWhereConditions(table, [inArray(table.id, recordIds)]);
  },

  /**
   * Standard delete query with brand scoping
   */
  buildDeleteQuery: <T extends PgTable>(
    table: T & { brandId: any; id: any },
    brandId: string,
    recordIds: string[],
  ) => {
    const builder = createBrandScopedQuery(brandId);
    return builder.buildWhereConditions(table, [inArray(table.id, recordIds)]);
  },
};

// ================================
// Export Types and Utilities
// ================================

export type {
  BrandContext,
  UserContext,
  BrandMembership,
  BrandAccessResult,
} from "../schemas/shared";

export {
  createBrandErrors,
  hasPermission,
  canPerformOperation,
  validateBrandAccess,
  createBrandContext,
  createUserContext,
} from "../schemas/shared";
