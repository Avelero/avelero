/**
 * Centralized barrel export for all API validation schemas.
 *
 * Import schemas from this file for cleaner, shorter import paths:
 * @example
 * ```typescript
 * // Before:
 * import { createBrandSchema } from "../../schemas/brand.js";
 * import { createProductSchema } from "../../schemas/products.js";
 *
 * // After:
 * import { createBrandSchema, createProductSchema } from "../../schemas/index.js";
 * ```
 *
 * Brand catalog schemas are namespaced to avoid conflicts:
 * @example
 * ```typescript
 * import { brandCatalog } from "../../schemas/index.js";
 * const colorSchema = brandCatalog.createColorSchema;
 * ```
 */
export * from "./brand.js";
export * from "./catalog.js";
export * from "./product-attributes.js";
export * from "./products.js";
export * from "./user.js";
export * from "./workflow.js";
export * as brandCatalog from "./brand-catalog/index.js";
export { byIdSchema as idParamSchema } from "./_shared/patterns.js";
