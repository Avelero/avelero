/**
 * Integration Registry
 *
 * Central registry for all integration connectors.
 */

import {
  fetchProducts as shopifyFetchProducts,
  getProductCount as shopifyGetProductCount,
  testConnection as shopifyTestConnection,
} from "./shopify/client";
import { shopifySchema } from "./shopify/schema";
import type { RegisteredConnector } from "../types";

const registry = new Map<string, RegisteredConnector>();

registry.set("shopify", {
  slug: "shopify",
  schema: shopifySchema,
  testConnection: shopifyTestConnection,
  fetchProducts: shopifyFetchProducts,
  getProductCount: shopifyGetProductCount,
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
