/**
 * Connector Type Definitions
 *
 * These types define the structure of connector schemas and field mappings.
 * Each connector (Shopify, It's Perfect, etc.) implements these interfaces.
 *
 * @see plan-integration.md Section 5 for architecture details
 */

import type {
  FetchedVariant,
  IntegrationConfig,
  IntegrationCredentials,
} from "../sync/types";

// =============================================================================
// SOURCE OPTIONS
// =============================================================================

/**
 * A source option for a field.
 * Users can choose which external field maps to an Avelero field.
 *
 * Example: For "product.name", options might be:
 * - { key: 'title', label: 'Product Title', path: 'product.title' }
 * - { key: 'handle', label: 'URL Handle', path: 'product.handle' }
 */
export interface SourceOption {
  /** Unique key for this source (e.g., 'title', 'sku') */
  key: string;
  /** Human-readable label for UI */
  label: string;
  /**
   * Path to extract value from external data.
   * Uses dot notation: 'product.title', 'selectedOptions'
   * For variant-level sync, paths are relative to the variant object.
   */
  path: string;
  /** Is this computed from other fields? */
  computed?: boolean;
  /** Optional transform for this specific source */
  transform?: (value: unknown, context?: ExtractContext) => unknown;
}

/**
 * Context available during value extraction/transformation.
 */
export interface ExtractContext {
  /** Full variant data from external system */
  variantData: Record<string, unknown>;
  /** Brand ID (for reference entity lookups) */
  brandId: string;
  /** Integration slug */
  integrationSlug: string;
}

// =============================================================================
// FIELD DEFINITIONS
// =============================================================================

/**
 * Definition of a field that can be synced from an external system.
 */
export interface ConnectorFieldDefinition {
  /**
   * Target field in Avelero (e.g., 'product.name', 'variant.sku')
   * Must match a key in the field registry.
   */
  targetField: string;

  /**
   * Entity this field belongs to.
   * - 'variant': Field on product_variants table (primary sync target)
   * - 'product': Field on products table (synced via variant's parent)
   * - Reference entities are handled separately via referenceEntity
   */
  entity: "variant" | "product";

  /** Human-readable description */
  description?: string;

  /** Available source options (user chooses one) */
  sourceOptions: SourceOption[];

  /** Default source key if user doesn't specify */
  defaultSource: string;

  /**
   * Global transform applied after source-specific transform.
   * Use for normalization, truncation, type conversion, etc.
   */
  transform?: (value: unknown, context?: ExtractContext) => unknown;

  /**
   * For reference fields that link to lookup entities.
   * The value extracted will be matched by name in the reference entity table.
   * If not found, a new entity will be created.
   *
   * Supported: 'color', 'size', 'category', 'season', 'manufacturer', etc.
   */
  referenceEntity?: ReferenceEntityType;

  /**
   * For relation fields (many-to-many).
   * Supported: 'tags'
   */
  isRelation?: boolean;
  relationType?: "tags";
}

/**
 * Types of reference entities that can be auto-created during sync.
 */
export type ReferenceEntityType =
  | "color"
  | "size"
  | "category"
  | "season"
  | "manufacturer"
  | "facility"
  | "material"
  | "tag"
  | "eco_claim"
  | "certification";

// =============================================================================
// ENTITY DEFINITIONS
// =============================================================================

/**
 * Definition of an entity that can be synced.
 */
export interface ConnectorEntityDefinition {
  /** Database table name */
  table: string;

  /**
   * Fields used to identify/match records.
   * Can be a single field or array (will try each in order).
   *
   * For variants: ['sku', 'barcode', 'gtin', 'ean']
   * For products: 'productHandle'
   */
  identifiedBy: string | string[];

  /** Preferred identifier (used when creating links) */
  primaryIdentifier?: string;

  /**
   * How this entity relates to the primary sync entity.
   * - 'variant': This IS the primary entity
   * - 'linkedThrough: variant': Products are found via variants
   */
  linkedThrough?: "variant";

  /**
   * Sync mode for reference entities.
   * - 'upsert-on-reference': Create if referenced and doesn't exist
   */
  syncMode?: "full" | "upsert-on-reference";
}

// =============================================================================
// CONNECTOR SCHEMA
// =============================================================================

/**
 * Complete schema for a connector.
 * Defines everything needed to sync data from an external system.
 */
export interface ConnectorSchema {
  /** Unique slug (e.g., 'shopify', 'its-perfect') */
  slug: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Authentication type */
  authType: "oauth" | "api_key" | "api_key_secret";

  /**
   * Entities this connector can provide.
   * Variant should be the primary entity for most connectors.
   */
  entities: {
    variant: ConnectorEntityDefinition;
    product: ConnectorEntityDefinition;
    [entityName: string]: ConnectorEntityDefinition;
  };

  /**
   * Field definitions.
   * Keys should follow pattern: 'entity.field' (e.g., 'variant.sku', 'product.name')
   */
  fields: Record<string, ConnectorFieldDefinition>;
}

// =============================================================================
// CONNECTOR INTERFACE
// =============================================================================

/**
 * Interface that all connectors must implement.
 */
export interface IntegrationConnector {
  /** The connector's schema */
  schema: ConnectorSchema;

  /**
   * Test connection with given credentials.
   * @returns true if connection successful, throws on error
   */
  testConnection(credentials: IntegrationCredentials): Promise<boolean>;

  /**
   * Fetch variants from the external system.
   * Returns an async generator yielding batches for memory efficiency.
   *
   * Each yielded batch contains variants with their parent product data.
   */
  fetchVariants(
    credentials: IntegrationCredentials,
    config: IntegrationConfig,
  ): AsyncGenerator<FetchedVariant[], void, unknown>;
}

