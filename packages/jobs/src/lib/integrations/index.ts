/**
 * Integration System
 *
 * Main entry point for the integration sync system.
 *
 * @see plan-integration.md for architecture details
 */

// Export types
export * from "./types";

// Export connector types (not the duplicate functions)
export type {
  ConnectorSchema,
  ConnectorFieldDefinition,
  SourceOption,
  ConnectorEntityDefinition,
} from "./connectors/types";

// Export individual connectors
export {
  shopifySchema,
  SHOPIFY_PRODUCT_VARIANTS_QUERY,
  SHOPIFY_BATCH_SIZE,
  testConnection,
  fetchVariants,
  estimateVariantCount,
  extractNumericId,
} from "./connectors/shopify";

// Export registry (primary API for getting connectors)
export {
  getConnector,
  getAllConnectors,
  getConnectorSlugs,
  hasConnector,
  getConnectorSchema,
  type RegisteredConnector,
} from "./registry";

// Export sync engine
export { syncVariants, testIntegrationConnection } from "./sync-engine";
