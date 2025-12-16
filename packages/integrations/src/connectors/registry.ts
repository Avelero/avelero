/**
 * Integration Registry
 *
 * Central registry for all integration connectors.
 */

import {
  fetchProducts as shopifyFetchProducts,
  shopifySchema,
  testConnection as shopifyTestConnection,
} from "./shopify/index";
import type { ConnectorSchema } from "./types";
import type { FetchedProductBatch, IntegrationCredentials } from "../sync/types";

export interface RegisteredConnector {
  slug: string;
  schema: ConnectorSchema;
  testConnection: (credentials: IntegrationCredentials) => Promise<unknown>;
  fetchProducts: (
    credentials: IntegrationCredentials,
    batchSize?: number,
  ) => AsyncGenerator<FetchedProductBatch, void, undefined>;
}

const registry = new Map<string, RegisteredConnector>();

registry.set("shopify", {
  slug: "shopify",
  schema: shopifySchema,
  testConnection: shopifyTestConnection,
  fetchProducts: shopifyFetchProducts,
});

export function getConnector(slug: string): RegisteredConnector | undefined {
  return registry.get(slug);
}

export function listConnectors(): RegisteredConnector[] {
  return Array.from(registry.values());
}

export function getConnectorSlugs(): string[] {
  return Array.from(registry.keys());
}
