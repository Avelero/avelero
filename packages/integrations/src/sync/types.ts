/**
 * Integration System Types
 *
 * Core type definitions for the integration sync system.
 * These types are used across all connectors and the sync engine.
 *
 * @see plan-integration.md for architecture details
 */

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
 * Supabase storage client type for image uploads.
 * Re-exported from @v1/supabase/storage for consistency.
 */
export type { StorageClient } from "@v1/supabase/storage";

// Import the type for use in SyncContext
import type { StorageClient } from "@v1/supabase/storage";

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


