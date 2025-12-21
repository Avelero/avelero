/**
 * Catalog query functions barrel export.
 * 
 * Exports all brand-owned catalog entity queries (attributes, materials, etc.)
 * organized by entity type for better maintainability.
 * 
 * Note: Legacy color/size modules removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed as generic brand attributes via:
 * - ./attributes.ts (brand dimensions)
 * - ./attribute-values.ts (dimension options)
 */
export * from "./types.js";
export * from "./attributes.js";
export * from "./attribute-values.js";
export * from "./tags.js";
export * from "./materials.js";
export * from "./eco-claims.js";
export * from "./facilities.js";
export * from "./manufacturers.js";
export * from "./certifications.js";
export * from "./seasons.js";
export * from "./validation.js";








