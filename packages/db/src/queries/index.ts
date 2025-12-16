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
 */

// =============================================================================
// Organized domain exports
// =============================================================================
export * from "./products/index.js";
export * from "./catalog/index.js";
export * from "./brand/index.js";
export * from "./user/index.js";
export * from "./taxonomy/index.js";
export * from "./dpp/index.js";
export * from "./integrations/index.js";
export * from "./bulk/index.js";

// =============================================================================
// Drizzle-ORM utilities
// =============================================================================
export {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  SQL,
  type SQLWrapper,
} from "drizzle-orm";
