/**
 * Connector Registry
 *
 * Exports all available connectors and provides lookup functions.
 *
 * @see plan-integration.md Section 8 for architecture details
 */

// Export connector types
export * from "./types";

// Export individual connectors
export * from "./shopify";

// Import schemas for registry
import { shopifySchema } from "./shopify";
import type { ConnectorSchema } from "./types";

/**
 * Registry of all available connectors.
 * Add new connectors here when implementing them.
 */
export const connectorRegistry: Record<string, ConnectorSchema> = {
  shopify: shopifySchema,
  // Add future connectors:
  // 'its-perfect': itsPerfectSchema,
};

/**
 * Get a connector schema by slug.
 * @throws Error if connector not found
 */
export function getConnectorSchema(slug: string): ConnectorSchema {
  const schema = connectorRegistry[slug];
  if (!schema) {
    throw new Error(`Unknown connector: ${slug}`);
  }
  return schema;
}

/**
 * Get all available connector slugs.
 */
export function getAvailableConnectors(): string[] {
  return Object.keys(connectorRegistry);
}

/**
 * Check if a connector exists.
 */
export function hasConnector(slug: string): boolean {
  return slug in connectorRegistry;
}
