/**
 * Centralized barrel export for all API validation schemas.
 *
 * Import schemas from this file for cleaner, shorter import paths:
 * @example
 * ```typescript
 * // Before:
 * import { brandCreateSchema } from "../../schemas/brand.js";
 * import { createProductSchema } from "../../schemas/products.js";
 *
 * // After:
 * import { brandCreateSchema, createProductSchema } from "../../schemas/index.js";
 * ```
 *
 * Catalog schemas are namespaced to avoid conflicts:
 * @example
 * ```typescript
 * import { catalog } from "../../schemas/index.js";
 * const colorSchema = catalog.createColorSchema;
 * ```
 */
export * from "./products.js";
export * from "./bulk.js";
export * from "./user.js";
export * from "./brand.js";
export * from "./brand-theme.js";
export * from "./brand-collections.js";
export * from "./dpp-public.js";
export * as catalog from "./catalog/index.js";
// Legacy alias for backward compatibility during migration
export * as brandCatalog from "./catalog/index.js";
export { byIdSchema as idParamSchema } from "./_shared/patterns.js";
