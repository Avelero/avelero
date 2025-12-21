/**
 * Batch Operations for Sync
 *
 * Handles batch extraction and creation of entities during sync.
 * Extracts unique entities from product batches and creates missing ones.
 * 
 * Note: Color and size entity creation removed in Phase 5 of variant attribute migration.
 * Variants no longer have colorId/sizeId - colors and sizes are now managed via
 * generic brand attributes which are not automatically created during sync.
 */

import type { Database } from "@v1/db/client";
import {
  batchCreateTags,
} from "@v1/db/queries/catalog";
import type { EffectiveFieldMapping } from "./extractor";
import { extractValues } from "./extractor";
import type { SyncCaches } from "./caches";
import { bulkCacheTags } from "./caches";
import type { FetchedProduct, FetchedProductBatch } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedEntities {
  /** Unique tag names from the batch */
  tags: Set<string>;
  /** External product IDs in this batch */
  productIds: Set<string>;
  /** External variant IDs in this batch */
  variantIds: Set<string>;
}

export interface BatchCreationStats {
  tagsCreated: number;
}

// =============================================================================
// ENTITY EXTRACTION
// =============================================================================

/**
 * Extract unique entities from a batch of products.
 *
 * Iterates through all products and their variants, extracting
 * unique tags and tracking external IDs.
 * 
 * Note: Color and size extraction removed - variants no longer have colorId/sizeId.
 *
 * @param batch - Batch of fetched products
 * @param mappings - Field mappings for value extraction
 * @returns ExtractedEntities with unique values
 */
export function extractUniqueEntitiesFromBatch(
  batch: FetchedProductBatch,
  mappings: EffectiveFieldMapping[]
): ExtractedEntities {
  const tags = new Set<string>();
  const productIds = new Set<string>();
  const variantIds = new Set<string>();

  for (const product of batch) {
    productIds.add(product.externalId);

    // Extract product-level entities (tags from product.data)
    const productExtracted = extractValues(product.data, mappings);
    if (productExtracted.relations.tags) {
      for (const tagName of productExtracted.relations.tags) {
        if (tagName?.trim()) {
          tags.add(tagName.trim());
        }
      }
    }

    // Track variant IDs
    for (const variant of product.variants) {
      variantIds.add(variant.externalId);
    }
  }

  return { tags, productIds, variantIds };
}

// =============================================================================
// BATCH CREATION
// =============================================================================

/**
 * Create missing entities in the database and update caches.
 *
 * Compares extracted entities against caches, creates only what's missing,
 * and updates caches with new IDs.
 * 
 * Note: Color and size creation removed - variants no longer have colorId/sizeId.
 *
 * @param db - Database connection
 * @param brandId - Brand ID
 * @param extracted - Extracted entities from batch
 * @param caches - Sync caches to check and update
 * @returns Stats on how many entities were created
 */
export async function createMissingEntities(
  db: Database,
  brandId: string,
  extracted: ExtractedEntities,
  caches: SyncCaches
): Promise<BatchCreationStats> {
  const stats: BatchCreationStats = {
    tagsCreated: 0,
  };

  // Find missing tags (assign random hex color for new tags)
  const missingTags: Array<{ name: string; hex: string | null }> = [];
  for (const tagName of extracted.tags) {
    if (!caches.tags.has(tagName.toLowerCase())) {
      // Generate a random hex color for new tags
      missingTags.push({ name: tagName, hex: getRandomHex() });
    }
  }

  // Create missing tags
  if (missingTags.length > 0) {
    const tagMap = await batchCreateTags(db, brandId, missingTags);
    const newTagNames = new Set(missingTags.map((t) => t.name.toLowerCase()));
    stats.tagsCreated = tagMap.size;
    bulkCacheTags(caches, tagMap, newTagNames);
  }

  return stats;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a random hex color.
 * Used for assigning colors to new tags.
 */
function getRandomHex(): string {
  const colors = [
    "FF6B6B", "4ECDC4", "45B7D1", "96CEB4", "FFEAA7",
    "DDA0DD", "98D8C8", "F7DC6F", "BB8FCE", "85C1E9",
    "F8B500", "00CED1", "FF69B4", "32CD32", "FFD700",
    "FF7F50", "87CEEB", "DA70D6", "8FBC8F", "E6E6FA",
  ] as const;
  return colors[Math.floor(Math.random() * colors.length)] ?? "FF6B6B";
}

/**
 * Prepare variant data for extraction.
 *
 * Merges variant data with its parent product data so the extractor
 * can access product-level fields (like product.options for color detection).
 */
export function prepareVariantData(
  product: FetchedProduct,
  variantIndex: number
): Record<string, unknown> {
  const variant = product.variants[variantIndex];
  if (!variant) {
    throw new Error(`Variant at index ${variantIndex} not found`);
  }

  return {
    ...variant.data,
    product: product.data,
  };
}

/**
 * Get all variant identifiers from a product.
 * Used for SKU/barcode matching.
 */
export function getProductVariantIdentifiers(
  product: FetchedProduct,
  mappings: EffectiveFieldMapping[]
): Array<{ sku?: string; barcode?: string }> {
  const identifiers: Array<{ sku?: string; barcode?: string }> = [];

  for (const variant of product.variants) {
    const mergedData = {
      ...variant.data,
      product: product.data,
    };

    const extracted = extractValues(mergedData, mappings);
    identifiers.push({
      sku: extracted.variant.sku as string | undefined,
      barcode: extracted.variant.barcode as string | undefined,
    });
  }

  return identifiers;
}

