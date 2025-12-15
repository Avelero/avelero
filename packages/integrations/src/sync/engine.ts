/**
 * Integration Sync Engine
 *
 * Core sync logic for processing data from external systems.
 * Handles variant-level syncing with automatic product creation.
 *
 * Sync Flow:
 * 1. Fetch variants from external system (via connector)
 * 2. For each variant:
 *    a. Extract values using field mappings
 *    b. Find/create reference entities (colors, sizes, tags)
 *    c. Find/create parent product
 *    d. Find/create or update variant
 *    e. Update variant link
 *
 * @see plan-integration.md Section 6.4 for architecture details
 */

import type { Database } from "@v1/db/client";
import { getConnector } from "../connectors/registry";
import { buildEffectiveFieldMappings } from "./extractor";
import { processVariant, type SyncCaches } from "./processor";
import type { SyncContext, SyncResult } from "./types";

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Sync variants from an external system.
 *
 * @param ctx - Sync context with credentials and configuration
 * @returns Sync result with stats and errors
 */
export async function syncVariants(ctx: SyncContext): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    variantsProcessed: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    variantsSkipped: 0,
    variantsFailed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    entitiesCreated: 0,
    errors: [],
  };

  try {
    // Get connector
    const connector = getConnector(ctx.integrationSlug);
    if (!connector) {
      throw new Error(`Unknown integration: ${ctx.integrationSlug}`);
    }

    // Build field mappings
    const mappings = buildEffectiveFieldMappings(
      connector.schema,
      ctx.fieldConfigs
    );

    // Initialize in-memory caches to avoid redundant database lookups
    // These are shared across all variant processing in this sync session
    const caches: SyncCaches = {
      colors: new Map(),
      sizes: new Map(),
      products: new Map(),
      tags: new Map(),
      updatedProductIds: new Set(),
    };

    // Track unique product IDs for accurate counting
    // (productCreated/productUpdated should count unique products, not variants)
    const createdProductIds = new Set<string>();
    const updatedProductIds = new Set<string>();

    // Fetch and process variants
    const db = ctx.db as Database;
    const variantGenerator = connector.fetchVariants(ctx.credentials);

    for await (const batch of variantGenerator) {
      for (const variant of batch) {
        result.variantsProcessed++;

        const processed = await processVariant(db, ctx, variant, mappings, caches);

        if (processed.success) {
          if (processed.variantCreated) {
            result.variantsCreated++;
          } else if (processed.variantUpdated) {
            result.variantsUpdated++;
          } else {
            result.variantsSkipped++;
          }

          // Track unique products created/updated
          if (processed.productId) {
            if (processed.productCreated && !createdProductIds.has(processed.productId)) {
              createdProductIds.add(processed.productId);
            } else if (processed.productUpdated && !updatedProductIds.has(processed.productId)) {
              updatedProductIds.add(processed.productId);
            }
          }

          result.entitiesCreated += processed.entitiesCreated;
        } else {
          result.variantsFailed++;
          result.errors.push({
            externalId: variant.externalId,
            message: processed.error || "Unknown error",
          });
        }
      }
    }

    // Set final counts from unique product sets
    result.productsCreated = createdProductIds.size;
    result.productsUpdated = updatedProductIds.size;

    result.success = result.variantsFailed === 0;
  } catch (error) {
    result.errors.push({
      externalId: "SYSTEM",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Test a connection to an external system.
 *
 * @param integrationSlug - The integration type (e.g., "shopify")
 * @param credentials - The decrypted credentials
 * @returns Connection test result
 */
export async function testIntegrationConnection(
  integrationSlug: string,
  credentials: SyncContext["credentials"]
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const connector = getConnector(integrationSlug);
  if (!connector) {
    return {
      success: false,
      message: `Unknown integration: ${integrationSlug}`,
    };
  }

  try {
    const result = await connector.testConnection(credentials);
    return { success: true, message: "Connection successful", data: result };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
