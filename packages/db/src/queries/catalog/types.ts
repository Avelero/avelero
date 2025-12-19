/**
 * Shared types for catalog entities.
 * 
 * Catalog entities are brand-owned resources like colors, sizes, materials, etc.
 * These types are shared across catalog query modules and value mappings.
 */

/**
 * Entity types supported in the catalog system.
 * Used for validation, duplicate checking, and value mapping.
 */
export type CatalogEntityType =
  | "COLOR"
  | "SIZE"
  | "MATERIAL"
  | "ECO_CLAIM"
  | "FACILITY"
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





