/**
 * Integration System Types
 *
 * Core type definitions for the integration sync system.
 * Includes connector schemas, sync context, and extracted values.
 *
 * This file consolidates all types from:
 * - connectors/types.ts (connector schema definitions)
 * - sync/types.ts (sync context and results)
 */

// =============================================================================
// STORAGE CLIENT (re-exported from supabase)
// =============================================================================

export type { StorageClient } from "@v1/supabase/storage";

import type { StorageClient } from "@v1/supabase/storage";

// =============================================================================
// CREDENTIALS & CONFIG
// =============================================================================

/**
 * Decrypted integration credentials.
 * Structure varies by integration type.
 */
export interface IntegrationCredentials {
  /** Shopify OAuth access token */
  accessToken?: string;
  /** Shop domain for Shopify (e.g., "my-store.myshopify.com") */
  shopDomain?: string;
  /** Alternative shop domain field */
  storeDomain?: string;
  /** API key for API-key based integrations */
  apiKey?: string;
  /** API secret for API-key-secret based integrations */
  apiSecret?: string;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Integration-specific configuration (sync settings, etc.)
 */
export interface IntegrationConfig {
  /** How often to sync (in hours) */
  syncIntervalHours?: number;
  /** Whether to auto-sync on schedule */
  autoSyncEnabled?: boolean;
  /** Additional config per integration */
  [key: string]: unknown;
}

// =============================================================================
// FETCHED DATA (from external systems)
// =============================================================================

/**
 * A variant fetched from an external system.
 * This is the PRIMARY sync entity - variants contain identifiers like SKU/barcode.
 */
export interface FetchedVariant {
  /** External variant ID (e.g., "gid://shopify/ProductVariant/123") */
  externalId: string;
  /** External product ID for the parent product */
  externalProductId: string;
  /** Raw data from the external system */
  data: Record<string, unknown>;
}

/**
 * A product fetched from an external system with all its variants.
 * This is the PRIMARY sync entity in the product-centric flow.
 */
export interface FetchedProduct {
  /** External product ID (e.g., "gid://shopify/Product/123") */
  externalId: string;
  /** Raw product data from the external system */
  data: Record<string, unknown>;
  /** All variants belonging to this product */
  variants: FetchedVariant[];
}

/**
 * A batch of fetched products.
 * Connectors return async generators yielding batches for memory efficiency.
 */
export type FetchedProductBatch = FetchedProduct[];

// =============================================================================
// SYNC CONTEXT & RESULTS
// =============================================================================

/**
 * Progress update sent during sync.
 */
export interface SyncProgress {
  /** Products processed so far */
  productsProcessed: number;
  /** Total products to process (if known) */
  productsTotal?: number;
}

/**
 * Identifier type used for variant matching (secondary integrations only).
 * Primary integrations always use link-based matching.
 */
export type MatchIdentifier = "barcode" | "sku";

/**
 * Context passed to sync operations.
 * Contains everything needed to process synced data.
 */
export interface SyncContext {
  /** Database instance */
  db: unknown; // Will be properly typed when used
  /** Supabase client for storage operations (image uploads) */
  storageClient: StorageClient;
  /** Brand ID being synced */
  brandId: string;
  /** Brand integration ID */
  brandIntegrationId: string;
  /** Integration slug (e.g., "shopify") */
  integrationSlug: string;
  /** Decrypted credentials */
  credentials: IntegrationCredentials;
  /** Integration-specific config */
  config: IntegrationConfig;
  /** Field configurations from database */
  fieldConfigs: FieldConfig[];
  /**
   * Whether this is the primary integration for the brand.
   * Primary integrations create products/variants/attributes.
   * Secondary integrations can only enrich existing products.
   */
  isPrimary: boolean;
  /**
   * Identifier used for matching variants (secondary integrations only).
   * Primary integrations ignore this and use link-based matching.
   */
  matchIdentifier: MatchIdentifier;
  /** Total products to process (fetched before sync starts) */
  productsTotal?: number;
  /** Callback to report progress during sync */
  onProgress?: (progress: SyncProgress) => Promise<void>;
}

/**
 * Field configuration from database.
 * Determines which fields are owned by this integration and their source.
 */
export interface FieldConfig {
  fieldKey: string;
  isEnabled: boolean;
  selectedSource: string | null;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  // Variant-level stats (primary sync target)
  variantsProcessed: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
  variantsFailed: number;
  // Product-level stats (created/updated through variants)
  productsCreated: number;
  productsUpdated: number;
  // Entity stats
  entitiesCreated: number;
  // Secondary integration stats (enrich-only mode)
  /**
   * Products skipped because no existing match was found (secondary integrations only).
   * Primary integrations create new products instead of skipping.
   */
  productsSkippedNoMatch: number;
  /**
   * Variants skipped because no existing match was found (secondary integrations only).
   * Primary integrations create new variants instead of skipping.
   */
  variantsSkippedNoMatch: number;
  // Errors
  errors: SyncError[];
}

/**
 * Individual sync error.
 */
export interface SyncError {
  externalId: string;
  message: string;
  field?: string;
}

// =============================================================================
// EXTRACTED VALUES
// =============================================================================

/**
 * Values extracted from external data, ready for database insert/update.
 */
export interface ExtractedValues {
  /** Product fields */
  product: ExtractedProductValues;
  /** Variant fields */
  variant: ExtractedVariantValues;
  /** Reference entities to upsert */
  referenceEntities: ExtractedReferenceEntities;
  /** Relations (tags, etc.) */
  relations: ExtractedRelations;
}

export interface ExtractedProductValues {
  name?: string;
  productHandle?: string;
  description?: string;
  imagePath?: string;
  webshopUrl?: string;
  price?: number;
  currency?: string;
  status?: string;
  salesStatus?: string;
  categoryId?: string;
  [key: string]: unknown;
}

export interface ExtractedVariantValues {
  sku?: string;
  ean?: string;
  gtin?: string;
  barcode?: string;
  gender?: string;
  [key: string]: unknown;
}

export interface ExtractedReferenceEntities {
  /** Category UUID (resolved from Shopify taxonomy mapping) */
  categoryId?: string;
}

export interface ExtractedRelations {
  /** Tag names to sync */
  tags?: string[];
}

// =============================================================================
// SOURCE OPTIONS
// =============================================================================

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

  /**
   * If true, this field is always synced regardless of user configuration.
   * Used for structural fields that define product/variant identity:
   * - variant.sku: Used for matching
   * - variant.barcode: Used for matching
   * - variant.attributes: Defines variant structure (primary only)
   */
  alwaysEnabled?: boolean;
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
// REGISTERED CONNECTOR
// =============================================================================

/**
 * A registered connector with its implementation functions.
 */
export interface RegisteredConnector {
  slug: string;
  schema: ConnectorSchema;
  testConnection: (credentials: IntegrationCredentials) => Promise<unknown>;
  fetchProducts: (
    credentials: IntegrationCredentials,
    batchSize?: number,
  ) => AsyncGenerator<FetchedProductBatch, void, undefined>;
  /** Get total product count for progress tracking. Returns -1 if unknown. */
  getProductCount: (credentials: IntegrationCredentials) => Promise<number>;
}

