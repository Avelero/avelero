/**
 * Centralized error factory for consistent tRPC error handling.
 *
 * This module provides semantic error factories that enforce proper error codes,
 * consistent messaging, and type safety across all API endpoints.
 *
 * @example
 * ```ts
 * // Instead of:
 * throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
 *
 * // Use:
 * throw unauthorized();
 * ```
 */
import { TRPCError } from "@trpc/server";

/**
 * Base error factory for creating TRPCError instances.
 *
 * @param code - tRPC error code
 * @param message - Human-readable error message
 * @param cause - Optional underlying error cause
 * @returns Configured TRPCError instance
 */
function createError(
  code: TRPCError["code"],
  message: string,
  cause?: unknown,
): TRPCError {
  return new TRPCError({ code, message, cause });
}

// ============================================================================
// Authentication & Authorization Errors
// ============================================================================

/**
 * Throws when user is not authenticated.
 *
 * Use when endpoints require authentication but no valid session is found.
 *
 * @param message - Optional custom message
 * @returns TRPCError with UNAUTHORIZED code
 *
 * @example
 * ```ts
 * if (!user) throw unauthorized();
 * ```
 */
export function unauthorized(message = "Authentication required"): TRPCError {
  return createError("UNAUTHORIZED", message);
}

/**
 * Throws when user lacks required permissions.
 *
 * Use when user is authenticated but doesn't have necessary permissions.
 *
 * @param message - Optional custom message
 * @returns TRPCError with FORBIDDEN code
 *
 * @example
 * ```ts
 * if (user.role !== "owner") throw forbidden("Owner access required");
 * ```
 */
export function forbidden(
  message = "You do not have permission to perform this action",
): TRPCError {
  return createError("FORBIDDEN", message);
}

// ============================================================================
// Validation & Input Errors
// ============================================================================

/**
 * Throws when request data is invalid or malformed.
 *
 * Use for validation failures, missing required fields, or invalid input format.
 *
 * @param message - Specific validation error message
 * @returns TRPCError with BAD_REQUEST code
 *
 * @example
 * ```ts
 * if (!brandId) throw badRequest("No active brand");
 * if (email.length === 0) throw badRequest("Email is required");
 * ```
 */
export function badRequest(message: string): TRPCError {
  return createError("BAD_REQUEST", message);
}

/**
 * Throws when no active brand context is available.
 *
 * Specialized bad request error for brand-scoped operations.
 *
 * @returns TRPCError with BAD_REQUEST code
 *
 * @example
 * ```ts
 * if (!brandId) throw noBrandSelected();
 * ```
 */
export function noBrandSelected(): TRPCError {
  return badRequest("No active brand selected");
}

// ============================================================================
// Resource Errors
// ============================================================================

/**
 * Throws when a requested resource cannot be found.
 *
 * Use for GET/UPDATE/DELETE operations on non-existent resources.
 *
 * @param resource - Type of resource (e.g., "Product", "Brand", "User")
 * @param id - Optional resource identifier
 * @returns TRPCError with NOT_FOUND code
 *
 * @example
 * ```ts
 * const product = await getProduct(id);
 * if (!product) throw notFound("Product", id);
 * ```
 */
export function notFound(resource: string, id?: string): TRPCError {
  const message = id
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
  return createError("NOT_FOUND", message);
}

/**
 * Throws when attempting to create a resource that already exists.
 *
 * Use for CREATE operations with duplicate unique constraints.
 *
 * @param resource - Type of resource
 * @param identifier - Unique identifier (e.g., email, slug)
 * @returns TRPCError with CONFLICT code
 *
 * @example
 * ```ts
 * const existing = await findByEmail(email);
 * if (existing) throw alreadyExists("User", email);
 * ```
 */
export function alreadyExists(resource: string, identifier: string): TRPCError {
  return createError("CONFLICT", `${resource} '${identifier}' already exists`);
}

// ============================================================================
// Business Logic Errors
// ============================================================================

/**
 * Throws when operation violates business rules.
 *
 * Use for domain-specific constraints that aren't validation errors.
 *
 * @param message - Explanation of the business rule violation
 * @returns TRPCError with BAD_REQUEST code
 *
 * @example
 * ```ts
 * if (isSoleOwner) {
 *   throw businessRuleViolation(
 *     "Cannot leave brand as sole owner. Promote another owner or delete the brand."
 *   );
 * }
 * ```
 */
export function businessRuleViolation(message: string): TRPCError {
  return badRequest(message);
}

/**
 * Throws when user is the sole owner of a brand.
 *
 * Specialized business rule error for brand ownership constraints.
 *
 * @returns TRPCError with BAD_REQUEST code
 *
 * @example
 * ```ts
 * if (isSoleOwner) throw soleOwnerError();
 * ```
 */
export function soleOwnerError(): TRPCError {
  return businessRuleViolation(
    "You are the sole owner of this brand. Promote another owner or delete the brand.",
  );
}

// ============================================================================
// Rate Limiting & Quota Errors
// ============================================================================

// ============================================================================
// Server & External Errors
// ============================================================================

/**
 * Throws when an unexpected internal error occurs.
 *
 * Use for unhandled exceptions, database errors, or unexpected states.
 * Always log these errors for debugging.
 *
 * @param message - Internal error description
 * @param cause - Optional underlying error
 * @returns TRPCError with INTERNAL_SERVER_ERROR code
 *
 * @example
 * ```ts
 * try {
 *   await db.transaction();
 * } catch (error) {
 *   console.error("Transaction failed:", error);
 *   throw internalServerError("Failed to process transaction", error);
 * }
 * ```
 */
export function internalServerError(
  message = "An unexpected error occurred",
  cause?: unknown,
): TRPCError {
  return createError("INTERNAL_SERVER_ERROR", message, cause);
}

// ============================================================================
// Utility: Error Guards
// ============================================================================

/**
 * Type guard to check if error is a TRPCError.
 *
 * @param error - Error to check
 * @returns True if error is TRPCError
 *
 * @example
 * ```ts
 * try {
 *   await operation();
 * } catch (error) {
 *   if (isTRPCError(error)) {
 *     console.log("TRPC Error:", error.code);
 *   }
 * }
 * ```
 */
export function isTRPCError(error: unknown): error is TRPCError {
  return error instanceof TRPCError;
}

/**
 * Map of known database constraint names to user-friendly messages.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  products_brand_id_product_handle_unq:
    "A product with this handle already exists",
  brand_attribute_values_brand_attr_name_unq:
    "An attribute value with this name already exists for this attribute",
  brand_colors_brand_id_name_unq: "A color with this name already exists",
  brand_materials_brand_id_name_unq: "A material with this name already exists",
  brand_seasons_brand_id_name_unq: "A season with this name already exists",
  brand_tags_brand_id_name_unq: "A tag with this name already exists",
  brand_facilities_brand_id_display_name_unq:
    "A facility with this name already exists",
  brand_manufacturers_brand_id_name_unq:
    "A manufacturer with this name already exists",
  brand_eco_claims_brand_id_claim_unq:
    "An eco-claim with this text already exists",
  categories_brand_id_name_parent_id_unq:
    "A category with this name already exists at this level",
  idx_unique_barcode_per_brand:
    "This barcode was just claimed by another operation. Please try a different barcode.",
};

/**
 * Extracts constraint name from an error by checking the error and its cause chain.
 */
function findConstraintName(error: unknown): string | null {
  if (!error) return null;

  // Check if error object has constraint property directly (PostgreSQL/Drizzle)
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    // Direct constraint property
    if (typeof obj.constraint === "string") {
      return obj.constraint;
    }

    // Check in cause chain
    if (obj.cause) {
      const fromCause = findConstraintName(obj.cause);
      if (fromCause) return fromCause;
    }

    // Check error message for constraint name
    const message = obj.message;
    if (typeof message === "string") {
      const match = message.match(/constraint "([^"]+)"/i);
      if (match?.[1]) return match[1];
    }
  }

  return null;
}

/**
 * Gets user-friendly message for known constraint violations.
 * Returns null for unknown constraints.
 */
function getConstraintMessage(error: unknown): string | null {
  const constraintName = findConstraintName(error);
  if (constraintName && CONSTRAINT_MESSAGES[constraintName]) {
    return CONSTRAINT_MESSAGES[constraintName];
  }
  return null;
}

/**
 * Checks if an error is a unique constraint violation for a specific constraint.
 *
 * @param error - Error to check
 * @param constraintName - Name of the constraint to check for
 * @returns True if the error is a violation of the specified constraint
 *
 * @example
 * ```ts
 * try {
 *   await db.insert(productVariants).values({ ... });
 * } catch (error) {
 *   if (isUniqueConstraintViolation(error, 'idx_unique_barcode_per_brand')) {
 *     throw badRequest("This barcode was just claimed by another operation.");
 *   }
 *   throw error;
 * }
 * ```
 */
export function isUniqueConstraintViolation(
  error: unknown,
  constraintName: string,
): boolean {
  const foundConstraint = findConstraintName(error);
  return foundConstraint === constraintName;
}

/**
 * Wraps unknown errors as TRPCError with appropriate error code.
 *
 * Maps known database constraint errors to user-friendly messages.
 * For unknown errors, uses the provided context message.
 *
 * @param error - Caught error
 * @param context - User-friendly fallback message (e.g., "Failed to create product")
 * @returns TRPCError instance with user-friendly message
 */
export function wrapError(error: unknown, context: string): TRPCError {
  // If already a TRPCError, return it as-is (it should already have a safe message)
  if (isTRPCError(error)) {
    return error;
  }

  // Check for known constraint violations
  const constraintMessage = getConstraintMessage(error);
  if (constraintMessage) {
    return badRequest(constraintMessage);
  }

  // For all other unknown errors, return internal server error (HTTP 500)
  // Log the original error on the server for debugging, but don't expose it to the client
  console.error("Unexpected error:", error);
  return internalServerError(context, error);
}
