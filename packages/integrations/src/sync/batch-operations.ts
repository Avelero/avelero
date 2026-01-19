/**
 * Batch Operations for Sync
 *
 * Handles batch extraction and creation of entities during sync.
 * Extracts unique entities from product batches and creates missing ones.
 */

import type { Database } from "@v1/db/client";
import {
  batchCreateBrandAttributeValues,
  batchCreateBrandAttributes,
  batchCreateTags,
  ensureBrandAttributeForTaxonomy,
} from "@v1/db/queries/catalog";
import {
  getTaxonomyAttributeByFriendlyId,
  listTaxonomyValuesByAttribute,
} from "@v1/db/queries/taxonomy";
import { parseSelectedOptions } from "../connectors/shopify/schema";
import type { FetchedProductBatch } from "../types";
import type { SyncCaches } from "./caches";
import {
  bulkCacheAttributeValues,
  bulkCacheAttributes,
  bulkCacheTags,
  getCachedAttributeId,
  getCachedAttributeValueId,
} from "./caches";
import type { EffectiveFieldMapping } from "./processor";
import { extractValues } from "./processor";

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
  /** Unique attribute names (e.g., "Color", "Size", "Age group") */
  attributeNames: Set<string>;
  /** Unique attribute values: Map<attributeName, Set<valueName>> */
  attributeValuesByName: Map<string, Set<string>>;
  /** Taxonomy hints for attributes: Map<attributeName, taxonomyFriendlyId | null> */
  attributeTaxonomyHints: Map<string, string | null>;
}

export interface BatchCreationStats {
  tagsCreated: number;
  attributesCreated: number;
  attributeValuesCreated: number;
}

// =============================================================================
// ENTITY EXTRACTION
// =============================================================================

/**
 * Extract unique entities from a batch of products.
 *
 * Iterates through all products and their variants, extracting
 * unique tags, attributes, and attribute values.
 *
 * @param batch - Batch of fetched products
 * @param mappings - Field mappings for value extraction
 * @returns ExtractedEntities with unique values
 */
export function extractUniqueEntitiesFromBatch(
  batch: FetchedProductBatch,
  mappings: EffectiveFieldMapping[],
): ExtractedEntities {
  const tags = new Set<string>();
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  const attributeNames = new Set<string>();
  const attributeValuesByName = new Map<string, Set<string>>();
  const attributeTaxonomyHints = new Map<string, string | null>();

  const variantAttributesEnabled = mappings.some(
    (m) => m.fieldKey === "variant.attributes",
  );

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

    // Track variant IDs and extract attributes
    for (const variant of product.variants) {
      variantIds.add(variant.externalId);

      // Extract variant attributes if enabled
      if (variantAttributesEnabled) {
        const mergedVariantData = { ...variant.data, product: product.data };
        const options = parseSelectedOptions(mergedVariantData);
        for (const opt of options) {
          attributeNames.add(opt.name);
          if (!attributeValuesByName.has(opt.name)) {
            attributeValuesByName.set(opt.name, new Set());
          }
          attributeValuesByName.get(opt.name)!.add(opt.value);
          // Store taxonomy hint (first one wins if multiple variants have same attr name)
          if (!attributeTaxonomyHints.has(opt.name)) {
            attributeTaxonomyHints.set(opt.name, opt.taxonomyFriendlyId);
          }
        }
      }
    }
  }

  return {
    tags,
    productIds,
    variantIds,
    attributeNames,
    attributeValuesByName,
    attributeTaxonomyHints,
  };
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
 * NOTE: Attributes and attribute values are ONLY created by PRIMARY integrations.
 * Secondary integrations can only enrich existing products, not define structure.
 *
 * @param db - Database connection
 * @param brandId - Brand ID
 * @param extracted - Extracted entities from batch
 * @param caches - Sync caches to check and update
 * @param isPrimary - Whether this is a primary integration sync (only primary can create attributes)
 * @returns Stats on how many entities were created
 */
export async function createMissingEntities(
  db: Database,
  brandId: string,
  extracted: ExtractedEntities,
  caches: SyncCaches,
  isPrimary = true,
): Promise<BatchCreationStats> {
  const stats: BatchCreationStats = {
    tagsCreated: 0,
    attributesCreated: 0,
    attributeValuesCreated: 0,
  };

  // Find missing tags (assign random hex color for new tags)
  const missingTags: Array<{ name: string; hex: string | null }> = [];
  for (const tagName of extracted.tags) {
    if (!caches.tags.has(tagName.toLowerCase())) {
      // Generate a random hex color for new tags
      missingTags.push({ name: tagName, hex: getRandomHex() });
    }
  }

  // Create missing tags (both primary and secondary can create tags)
  if (missingTags.length > 0) {
    const tagMap = await batchCreateTags(db, brandId, missingTags);
    const newTagNames = new Set(missingTags.map((t) => t.name.toLowerCase()));
    stats.tagsCreated = tagMap.size;
    bulkCacheTags(caches, tagMap, newTagNames);
  }

  // SECONDARY INTEGRATIONS: Skip attribute creation entirely
  // Per integration-refactor-plan.md, only PRIMARY can define product structure
  if (!isPrimary) {
    return stats;
  }

  // Find missing attributes
  const missingAttributeNames: string[] = [];
  for (const attrName of extracted.attributeNames) {
    if (!getCachedAttributeId(caches, attrName)) {
      missingAttributeNames.push(attrName);
    }
  }

  // Create/ensure missing attributes.
  //
  // Use taxonomy hints from linkedMetafield to link to taxonomy attributes.
  // If no taxonomy hint, create a plain brand attribute with the original name.
  if (missingAttributeNames.length > 0) {
    const plainAttributeNames: string[] = [];

    for (const rawName of missingAttributeNames) {
      if (!rawName.trim()) continue;

      // Check if we have a taxonomy hint for this attribute (from linkedMetafield)
      const taxonomyFriendlyId = extracted.attributeTaxonomyHints.get(rawName);

      if (taxonomyFriendlyId) {
        // We know this attribute should be linked to a taxonomy attribute
        const taxonomyAttr = await getTaxonomyAttributeByFriendlyId(
          db,
          taxonomyFriendlyId,
        );
        if (taxonomyAttr) {
          // Check if this attribute was already in the cache before calling ensureBrandAttributeForTaxonomy
          // to determine if we're creating vs retrieving
          const wasAlreadyCached =
            caches.attributes.has(rawName.toLowerCase()) ||
            caches.attributes.has(taxonomyFriendlyId);

          const id = await ensureBrandAttributeForTaxonomy(
            db,
            brandId,
            taxonomyAttr.id,
            rawName, // Use the original name (e.g. "kleur") as the display name
          );

          // Cache under the original attribute name so we can find it later
          caches.attributes.set(rawName.toLowerCase(), { id, created: false });
          // Also cache under taxonomy friendly_id for reference
          caches.attributes.set(taxonomyFriendlyId, { id, created: false });

          // Only count as created if it wasn't already cached
          if (!wasAlreadyCached) {
            stats.attributesCreated++;
          }
          continue;
        }
      }

      // No taxonomy link available - create plain brand attribute
      plainAttributeNames.push(rawName);
    }

    if (plainAttributeNames.length > 0) {
      const attrMap = await batchCreateBrandAttributes(
        db,
        brandId,
        plainAttributeNames,
      );
      const newAttrNames = new Set(
        plainAttributeNames.map((n) => n.toLowerCase()),
      );
      stats.attributesCreated += attrMap.size;
      bulkCacheAttributes(caches, attrMap, newAttrNames);
    }
  }

  // Find missing attribute values
  const missingValues: Array<{
    attributeId: string;
    name: string;
    taxonomyValueId?: string | null;
  }> = [];
  for (const [attrName, values] of extracted.attributeValuesByName) {
    const attrId = getCachedAttributeId(caches, attrName);
    if (!attrId) continue; // Should not happen after creating attributes

    // Use taxonomy hint to find the right taxonomy attribute for value linking
    const taxonomyFriendlyId = extracted.attributeTaxonomyHints.get(attrName);
    const taxonomyValuesByName = new Map<string, string>();

    if (taxonomyFriendlyId) {
      const rows = await listTaxonomyValuesByAttribute(db, taxonomyFriendlyId);
      for (const row of rows) {
        taxonomyValuesByName.set(row.name.toLowerCase(), row.id);
      }
    }

    for (const valueName of values) {
      if (!getCachedAttributeValueId(caches, attrId, valueName)) {
        const taxonomyValueId =
          taxonomyValuesByName.get(valueName.trim().toLowerCase()) ?? null;
        missingValues.push({
          attributeId: attrId,
          name: valueName,
          taxonomyValueId,
        });
      }
    }
  }

  // Create missing attribute values
  if (missingValues.length > 0) {
    const valueMap = await batchCreateBrandAttributeValues(
      db,
      brandId,
      missingValues,
    );
    stats.attributeValuesCreated = missingValues.length;
    bulkCacheAttributeValues(caches, valueMap);
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
    "FF6B6B",
    "4ECDC4",
    "45B7D1",
    "96CEB4",
    "FFEAA7",
    "DDA0DD",
    "98D8C8",
    "F7DC6F",
    "BB8FCE",
    "85C1E9",
    "F8B500",
    "00CED1",
    "FF69B4",
    "32CD32",
    "FFD700",
    "FF7F50",
    "87CEEB",
    "DA70D6",
    "8FBC8F",
    "E6E6FA",
  ] as const;
  return colors[Math.floor(Math.random() * colors.length)] ?? "FF6B6B";
}
