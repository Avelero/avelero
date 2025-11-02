/**
 * Shared domain schemas.
 *
 * Application-level business domain schemas that represent core concepts
 * used across multiple features. These are not primitive validation types,
 * but rather semantic domain models.
 *
 * Primitives (uuidSchema, emailSchema) belong in primitives.ts
 * Domain concepts (roleSchema, statusSchema) belong here
 *
 * @module schemas/_shared/domain
 */
import { z } from "zod";

// ============================================================================
// Access Control & Permissions
// ============================================================================

/**
 * User roles within a brand organization.
 *
 * This is application-wide domain logic that defines the permission hierarchy
 * across all brand-related features (catalogs, products, members, etc.).
 *
 * @property owner - Full administrative access to brand and all resources
 * @property member - Standard member access with limited permissions
 */
export const roleSchema = z.enum(["owner", "member"]);

/**
 * TypeScript type derived from roleSchema.
 * Use this for type-safe role checks in business logic.
 *
 * @example
 * ```typescript
 * const userRole: Role = "owner";
 * if (userRole === "owner") {
 *   // Grant admin access
 * }
 * ```
 */
export type Role = z.infer<typeof roleSchema>;
