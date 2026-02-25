/**
 * Main queries barrel export.
 *
 * Re-exports all query functions from their organized domain folders.
 * For better tree-shaking, import directly from domain folders:
 * - @v1/db/queries/products
 * - @v1/db/queries/catalog
 * - @v1/db/queries/brand
 * - @v1/db/queries/bulk
 * - @v1/db/queries/integrations
 * - @v1/db/queries/dpp
 * - @v1/db/queries/user
 * - @v1/db/queries/taxonomy
 * - @v1/db/queries/admin
 */

// =============================================================================
// Organized domain exports
// =============================================================================
export * from "./products/index";
export * from "./catalog/index";
export * from "./brand/index";
export * from "./user/index";
export * from "./taxonomy/index";
export * from "./dpp/index";
export * from "./integrations/index";
export * from "./bulk/index";
export * from "./notifications/index";
export * from "./admin/index";

// =============================================================================
// Drizzle-ORM utilities
// =============================================================================
export {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  SQL,
  type SQLWrapper,
} from "drizzle-orm";
