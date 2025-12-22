/**
 * Batch Operations for Sync
 *
 * Handles batch extraction and creation of entities during sync.
 * Extracts unique entities from product batches and creates missing ones.
 */

import type { Database } from "@v1/db/client";
import {
  batchCreateTags,
  batchCreateBrandAttributes,
  batchCreateBrandAttributeValues,
  ensureBrandAttributeForTaxonomy,
} from "@v1/db/queries/catalog";
import { getTaxonomyAttributeByFriendlyId, listTaxonomyValuesByAttribute } from "@v1/db/queries/taxonomy";
import type { EffectiveFieldMapping } from "./extractor";
import { extractValues, getValueByPath } from "./extractor";
import type { SyncCaches } from "./caches";
import {
  bulkCacheTags,
  bulkCacheAttributes,
  bulkCacheAttributeValues,
  getCachedAttributeId,
  getCachedAttributeValueId,
} from "./caches";
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

/**
 * Parsed variant option from Shopify selectedOptions.
 */
export interface ParsedVariantOption {
  name: string;
  value: string;
}

/**
 * Shopify standard metafield keys and their corresponding taxonomy friendly_ids.
 * Used to determine taxonomy linking for brand attributes.
 *
 * From Shopify docs: linkedMetafield { namespace: "shopify", key: "color-pattern" }
 * maps to our taxonomy attribute "color".
 */
const SHOPIFY_METAFIELD_TO_TAXONOMY: Record<string, string> = {
  "color-pattern": "color",
  "target-gender": "target_gender",
  "age-group": "age_group",
  // Add more as needed from Shopify's standard category metafields
};

/**
 * Resolves the taxonomy attribute friendly_id from a Shopify option.
 * Uses linkedMetafield.key if present, otherwise tries common name mappings.
 *
 * @returns taxonomy friendly_id (e.g. "color", "size") or null if no mapping found
 */
export function resolveTaxonomyFriendlyId(
  optionName: string,
  variantData: Record<string, unknown>,
): string | null {
  const name = optionName.trim();
  if (!name) return null;

  // First, check if this option has a linkedMetafield that tells us the semantic type
  const productOptions = getValueByPath(variantData, "product.options");
  if (Array.isArray(productOptions)) {
    const match = productOptions.find((opt) => {
      if (typeof opt !== "object" || opt === null) return false;
      const optName = (opt as Record<string, unknown>).name;
      return typeof optName === "string" && optName.trim().toLowerCase() === name.toLowerCase();
    }) as Record<string, unknown> | undefined;

    const linked = match?.linkedMetafield;
    if (linked && typeof linked === "object") {
      const ns = (linked as Record<string, unknown>).namespace;
      const key = (linked as Record<string, unknown>).key;
      if (ns === "shopify" && typeof key === "string" && key.trim().length > 0) {
        const metafieldKey = key.trim().toLowerCase();
        const taxonomyId = SHOPIFY_METAFIELD_TO_TAXONOMY[metafieldKey];
        if (taxonomyId) return taxonomyId;
      }
    }
  }

  // Fallback: try common name mappings (for stores without linkedMetafield)
  const nameLower = name.toLowerCase();
  const nameMap: Record<string, string> = {
    color: "color",
    colour: "color",
    kleur: "color",
    farbe: "color",
    couleur: "color",
    size: "size",
    maat: "size",
    größe: "size",
    taille: "size",
    "age group": "age_group",
    leeftijdsgroep: "age_group",
  };

  return nameMap[nameLower] ?? null;
}

/**
 * Normalizes an option name for display.
 * Keeps the original name but trims whitespace.
 * We preserve the merchant's chosen name (e.g. "kleur" stays "kleur").
 */
function normalizeOptionName(name: string): string {
  return name.trim();
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
  mappings: EffectiveFieldMapping[]
): ExtractedEntities {
  const tags = new Set<string>();
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  const attributeNames = new Set<string>();
  const attributeValuesByName = new Map<string, Set<string>>();
  const attributeTaxonomyHints = new Map<string, string | null>();

  const variantAttributesEnabled = mappings.some(
    (m) => m.fieldKey === "variant.attributes"
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

  return { tags, productIds, variantIds, attributeNames, attributeValuesByName, attributeTaxonomyHints };
}

/**
 * Parsed variant option with optional taxonomy hint.
 */
export interface ParsedVariantOptionWithTaxonomy extends ParsedVariantOption {
  /** Taxonomy friendly_id if resolvable (e.g. "color", "size") */
  taxonomyFriendlyId: string | null;
}

/**
 * Parse Shopify selectedOptions from variant data.
 * Normalizes, filters empty values, and drops "Title=Default Title".
 * Also resolves taxonomy hints for each option.
 */
export function parseSelectedOptions(
  variantData: Record<string, unknown>
): ParsedVariantOptionWithTaxonomy[] {
  const selectedOptions = getValueByPath(variantData, "selectedOptions");
  if (!Array.isArray(selectedOptions)) return [];

  const result: ParsedVariantOptionWithTaxonomy[] = [];

  for (const opt of selectedOptions) {
    if (
      typeof opt !== "object" ||
      opt === null ||
      typeof (opt as Record<string, unknown>).name !== "string" ||
      typeof (opt as Record<string, unknown>).value !== "string"
    ) {
      continue;
    }

    const name = ((opt as Record<string, unknown>).name as string).trim();
    const value = ((opt as Record<string, unknown>).value as string).trim();

    // Skip empty values
    if (!name || !value) continue;

    // Skip "Title = Default Title" (Shopify's placeholder for single-variant products)
    if (name === "Title" && value === "Default Title") continue;

    const normalizedName = normalizeOptionName(name);
    const taxonomyFriendlyId = resolveTaxonomyFriendlyId(name, variantData);
    result.push({ name: normalizedName, value, taxonomyFriendlyId });
  }

  return result;
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

  // Create missing tags
  if (missingTags.length > 0) {
    const tagMap = await batchCreateTags(db, brandId, missingTags);
    const newTagNames = new Set(missingTags.map((t) => t.name.toLowerCase()));
    stats.tagsCreated = tagMap.size;
    bulkCacheTags(caches, tagMap, newTagNames);
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
        const taxonomyAttr = await getTaxonomyAttributeByFriendlyId(db, taxonomyFriendlyId);
        if (taxonomyAttr) {
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
          stats.attributesCreated++;
          continue;
        }
      }

      // No taxonomy link available - create plain brand attribute
      plainAttributeNames.push(rawName);
    }

    if (plainAttributeNames.length > 0) {
      const attrMap = await batchCreateBrandAttributes(db, brandId, plainAttributeNames);
      const newAttrNames = new Set(plainAttributeNames.map((n) => n.toLowerCase()));
      stats.attributesCreated += attrMap.size;
      bulkCacheAttributes(caches, attrMap, newAttrNames);
    }
  }

  // Find missing attribute values
  const missingValues: Array<{ attributeId: string; name: string; taxonomyValueId?: string | null }> = [];
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
        const taxonomyValueId = taxonomyValuesByName.get(valueName.trim().toLowerCase()) ?? null;
        missingValues.push({ attributeId: attrId, name: valueName, taxonomyValueId });
      }
    }
  }

  // Create missing attribute values
  if (missingValues.length > 0) {
    const valueMap = await batchCreateBrandAttributeValues(
      db,
      brandId,
      missingValues
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

/**
 * Resolve variant attribute value IDs from selected options.
 * Uses caches to look up IDs without database queries.
 *
 * @param options - Parsed selected options from variant
 * @param caches - Sync caches with attribute/value IDs
 * @returns Array of attribute value IDs in option order
 */
export function resolveAttributeValueIds(
  options: ParsedVariantOption[],
  caches: SyncCaches
): string[] {
  const valueIds: string[] = [];

  for (const opt of options) {
    const attrId = getCachedAttributeId(caches, opt.name);
    if (!attrId) continue;

    const valueId = getCachedAttributeValueId(caches, attrId, opt.value);
    if (valueId) {
      valueIds.push(valueId);
    }
  }

  return valueIds;
}
