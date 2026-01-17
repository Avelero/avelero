/**
 * Brand catalog validation schemas.
 *
 * Centralized barrel export for all brand-owned catalog schemas including
 * attributes, attribute values, materials, certifications,
 * operators, and manufacturers.
 *
 * Note: Legacy color/size schemas removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed as generic brand attributes.
 */
export * from "./attributes";
export * from "./attribute-values";
export * from "./certifications";
export * from "./operators";
export * from "./manufacturers";
export * from "./materials";
export * from "./seasons";
export * from "./tags";
