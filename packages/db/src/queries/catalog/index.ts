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
export * from "./types";
export * from "./attributes";
export * from "./attribute-values";
export * from "./tags";
export * from "./materials";
export * from "./operators";
export * from "./manufacturers";
export * from "./certifications";
export * from "./seasons";
export * from "./settings-lists";
export * from "./validation";
