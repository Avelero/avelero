/**
 * Shared types for catalog entities.
 *
 * Catalog entities are brand-owned resources like materials, operators, etc.
 * These types are shared across catalog query modules and value mappings.
 *
 * Note: COLOR and SIZE types removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed as generic brand attributes via
 * brand_attributes and brand_attribute_values tables. Attributes and attribute
 * values have their own dedicated modules and are not included here due to
 * their different validation requirements (compound keys).
 */

/**
 * Entity types supported in the catalog validation system.
 * Used for validation, duplicate checking, and value mapping.
 *
 * Note: ATTRIBUTE and ATTRIBUTE_VALUE are handled separately via their
 * dedicated modules due to different validation requirements.
 */
export type CatalogEntityType =
  | "MATERIAL"
  | "OPERATOR"
  | "MANUFACTURER"
  | "CERTIFICATION"
  | "SEASON"
  | "TAG";

/**
 * Validation error structure.
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result structure.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
