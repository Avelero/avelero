/**
 * Integration Package
 *
 * Public API for the integration system.
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Credentials & Config
  IntegrationCredentials,
  IntegrationConfig,
  // Fetched data
  FetchedVariant,
  FetchedProduct,
  FetchedProductBatch,
  // Sync context & results
  SyncProgress,
  SyncContext,
  FieldConfig,
  SyncResult,
  SyncError,
  // Extracted values
  ExtractedValues,
  ExtractedProductValues,
  ExtractedVariantValues,
  ExtractedReferenceEntities,
  ExtractedRelations,
  // Source options
  ExtractContext,
  SourceOption,
  // Field definitions
  ConnectorFieldDefinition,
  ReferenceEntityType,
  // Entity definitions
  ConnectorEntityDefinition,
  // Schema
  ConnectorSchema,
  // Registry
  RegisteredConnector,
  // Storage
  StorageClient,
} from "./types";

// =============================================================================
// REGISTRY
// =============================================================================

export {
  getConnector,
  listConnectors,
  getConnectorSlugs,
} from "./connectors/registry";

// =============================================================================
// SYNC ENGINE
// =============================================================================

export {
  syncProducts,
  testIntegrationConnection,
} from "./sync/engine";

// =============================================================================
// UI UTILITIES
// =============================================================================

export {
  type ConnectorFieldMeta,
  type FieldCategory,
  FIELD_CATEGORY_LABELS,
  SHOPIFY_FIELDS,
  getConnectorFields,
} from "./ui/fields";

// =============================================================================
// SHOPIFY-SPECIFIC EXPORTS
// =============================================================================

export { shopifySchema } from "./connectors/shopify/schema";
export {
  validateShopifyHmac,
  exchangeCodeForToken,
  buildAuthorizationUrl,
} from "./connectors/shopify/oauth";
export {
  SHOPIFY_API_VERSION,
  SHOPIFY_BATCH_SIZE,
  SHOPIFY_DEFAULT_SCOPES,
  buildShopifyEndpoint,
  isValidShopDomain,
} from "./connectors/shopify/client";
