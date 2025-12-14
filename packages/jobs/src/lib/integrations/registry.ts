/**
 * Integration Registry
 *
 * Central registry for all integration connectors.
 * Provides lookup functions for connector schemas and clients.
 *
 * Usage:
 *   const connector = getConnector('shopify');
 *   const schema = connector.schema;
 *   const variants = connector.fetchVariants(credentials);
 *
 * @see plan-integration.md Section 4 for architecture details
 */

import {
  fetchVariants as shopifyFetchVariants,
  shopifySchema,
  testConnection as shopifyTestConnection,
} from "./connectors/shopify";
import type { ConnectorSchema } from "./connectors/types";
import type { FetchedVariantBatch, IntegrationCredentials } from "./types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Interface for a registered connector.
 * Combines schema with client functions.
 */
export interface RegisteredConnector {
  /** Unique connector slug (e.g., "shopify") */
  slug: string;
  /** Connector schema with field definitions */
  schema: ConnectorSchema;
  /** Test connection to the external system */
  testConnection: (credentials: IntegrationCredentials) => Promise<unknown>;
  /** Fetch variants from the external system */
  fetchVariants: (
    credentials: IntegrationCredentials,
    batchSize?: number,
  ) => AsyncGenerator<FetchedVariantBatch, void, undefined>;
}

/**
 * Registry of all available connectors.
 */
type ConnectorRegistry = Map<string, RegisteredConnector>;

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * The connector registry.
 * Add new connectors here as they are implemented.
 */
const registry: ConnectorRegistry = new Map();

// Register Shopify connector
registry.set("shopify", {
  slug: "shopify",
  schema: shopifySchema,
  testConnection: shopifyTestConnection,
  fetchVariants: shopifyFetchVariants,
});

// Future connectors will be added here:
// registry.set("its-perfect", {
//   slug: "its-perfect",
//   schema: itsPerfectSchema,
//   testConnection: itsPerfectTestConnection,
//   fetchVariants: itsPerfectFetchVariants,
// });

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get a connector by its slug.
 *
 * @param slug - The connector slug (e.g., "shopify")
 * @returns The registered connector or undefined if not found
 */
export function getConnector(slug: string): RegisteredConnector | undefined {
  return registry.get(slug);
}

/**
 * Get all registered connectors.
 *
 * @returns Array of all registered connectors
 */
export function getAllConnectors(): RegisteredConnector[] {
  return Array.from(registry.values());
}

/**
 * Get all connector slugs.
 *
 * @returns Array of all connector slugs
 */
export function getConnectorSlugs(): string[] {
  return Array.from(registry.keys());
}

/**
 * Check if a connector exists.
 *
 * @param slug - The connector slug to check
 * @returns true if the connector exists
 */
export function hasConnector(slug: string): boolean {
  return registry.has(slug);
}

/**
 * Get a connector's schema by slug.
 *
 * @param slug - The connector slug
 * @returns The connector schema or undefined if not found
 */
export function getConnectorSchema(slug: string): ConnectorSchema | undefined {
  return registry.get(slug)?.schema;
}
