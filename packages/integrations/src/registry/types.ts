/**
 * Registry Type Definitions
 *
 * Core types for the field registry system.
 */

/**
 * Supported data types for field values
 */
export type FieldType =
  | "string" // Short text (max ~255 chars)
  | "text" // Long text (unlimited)
  | "number" // Integer
  | "decimal" // Decimal/numeric with precision
  | "boolean" // True/false
  | "date" // Date only (YYYY-MM-DD)
  | "datetime" // Full timestamp
  | "enum" // One of a fixed set of values
  | "reference" // Foreign key to a lookup table
  | "relation"; // Many-to-many or one-to-many relationship

/**
 * Categories for grouping fields in UI
 */
export type FieldCategory =
  | "identifiers" // Product codes, IDs, barcodes
  | "basic" // Name, description, basic info
  | "commercial" // Price, currency, sales status, URLs
  | "organization" // Category, season, manufacturer, tags
  | "physical" // Weight, dimensions
  | "environment" // Carbon, water usage
  | "materials" // Material composition
  | "supply-chain" // Journey steps, facilities
  | "certifications" // Certificates, claims
  | "media" // Images, documents
  | "variants"; // Color, size variants

/**
 * Definition of a single syncable field
 */
export interface FieldDefinition {
  /** Database table this field belongs to */
  table: string;

  /** Column name in the table (optional for virtual/computed fields) */
  column?: string;

  /** Data type */
  type: FieldType;

  /** For enum types: list of valid values */
  enumValues?: readonly string[];

  /** For reference types: the table this references */
  referencesTable?: string;

  /** For reference types: the column used to match (default: 'name') */
  referencesColumn?: string;

  /** For relation types: one-to-many or many-to-many */
  relationType?: "one-to-many" | "many-to-many";

  /** For relation types: the junction table (for many-to-many) */
  throughTable?: string;

  /** For relation types: the target entity type */
  targetEntity?: string;

  /** Is this field required? */
  required?: boolean;

  /** Maximum length for string/text fields */
  maxLength?: number;

  /** Decimal precision (total digits, digits after decimal) */
  precision?: [number, number];

  /** Human-readable label for UI */
  label: string;

  /** Detailed description */
  description: string;

  /** UI category for grouping */
  category: FieldCategory;

  /** Is this field commonly synced from external systems? */
  commonlyIntegrated?: boolean;

  /** Example value for documentation */
  example?: string | number | boolean;

  /** JSON-LD path in DPP output (for reference) */
  dppPath?: string;
}

/**
 * Entity definition for grouping related fields
 */
export interface EntityDefinition {
  /** Database table name */
  table: string;

  /** Human-readable name */
  label: string;

  /** Description */
  description: string;

  /** How records are identified (for matching during sync) */
  identifiedBy: string;

  /** Parent entity (for child tables) */
  parentEntity?: string;

  /** Is this brand-scoped? */
  brandScoped: boolean;
}

