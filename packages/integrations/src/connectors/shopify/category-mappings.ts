/**
 * Shopify Category Mappings
 *
 * Resolves Shopify Standard Product Taxonomy to Avelero category UUIDs.
 * Uses a DB-backed mapping configuration that is:
 * 1. Loaded once per sync run (1 query)
 * 2. Used for all products in the batch (0 queries per product)
 *
 * Resolution order:
 * 1. Check if category is outside root_filter (e.g., not "aa" branch) → null
 * 2. Check if category is in excluded_category_ids → null
 * 3. Check for direct rule match → UUID
 * 4. Walk up ancestors looking for rule match → UUID
 * 5. Fall back to branch-level mapping → UUID
 * 6. No match → null
 */

import type { Database } from "@v1/db/client";
import { getTaxonomyExternalMappingBySlug } from "@v1/db/queries/taxonomy";

// =============================================================================
// TYPES
// =============================================================================

/** Resolved target with publicId and UUID */
type ResolvedTarget = { publicId: string; id: string } | null;

/** Resolved mapping config loaded from DB */
interface ShopifyToAveleroResolvedConfig {
  version: string;
  input_taxonomy: string;
  output_taxonomy: string;
  branch_config: {
    root_filter: string;
    branches: Record<string, ResolvedTarget>;
  };
  excluded_category_ids: string[];
  rules: Record<string, ResolvedTarget>;
}

// =============================================================================
// MODULE STATE
// =============================================================================

/** Cached mapping configuration (loaded once per sync run) */
let mapping: ShopifyToAveleroResolvedConfig | null = null;

/** Pre-sorted branch keys for efficient fallback matching (longest first) */
let branchKeys: string[] = [];

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the Shopify → Avelero category mapping from the database.
 *
 * Call this once at the start of a sync run. The mapping is then cached
 * in memory for the duration of the process.
 *
 * @param db - Database connection
 * @throws Error if the mapping is not found in the database
 */
export async function initShopifyToAveleroCategoryMapping(
  db: Database
): Promise<void> {
  // Already initialized
  if (mapping) return;

  const row = await getTaxonomyExternalMappingBySlug(db, "shopify-to-avelero");

  if (!row) {
    throw new Error(
      "Missing taxonomy external mapping 'shopify-to-avelero'. " +
        "Run `bun run sync` in @v1/taxonomy after running db migrations."
    );
  }

  mapping = row.data as ShopifyToAveleroResolvedConfig;

  // Pre-sort branch keys by length descending for efficient prefix matching
  branchKeys = Object.keys(mapping.branch_config.branches).sort(
    (a, b) => b.length - a.length
  );
}

/**
 * Reset the cached mapping (useful for testing).
 */
export function resetShopifyToAveleroCategoryMapping(): void {
  mapping = null;
  branchKeys = [];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the mapping config, throwing if not initialized.
 */
function requireMapping(): ShopifyToAveleroResolvedConfig {
  if (!mapping) {
    throw new Error(
      "Shopify category mapping not initialized. " +
        "Call initShopifyToAveleroCategoryMapping(db) before syncing."
    );
  }
  return mapping;
}

/**
 * Extract the short category ID from a Shopify GID.
 * Example: "gid://shopify/TaxonomyCategory/aa-1-13-8" → "aa-1-13-8"
 */
function extractShortId(shopifyCategoryId: string): string {
  return shopifyCategoryId.replace(
    /^gid:\/\/shopify\/TaxonomyCategory\//,
    ""
  );
}

/**
 * Get the parent category ID by removing the last segment.
 * Example: "aa-1-2-3" → "aa-1-2"
 */
function getParentId(categoryId: string): string | null {
  const parts = categoryId.split("-");
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join("-");
}

/**
 * Check if a category ID is in the excluded list or is a child of an excluded category.
 */
function isExcluded(categoryId: string, excludedIds: string[]): boolean {
  return excludedIds.some(
    (excludedId) =>
      categoryId === excludedId || categoryId.startsWith(`${excludedId}-`)
  );
}

// =============================================================================
// MAIN RESOLVER
// =============================================================================

/**
 * Resolve a Shopify category to an Avelero category UUID.
 *
 * @param shopifyCategory - The category object from Shopify GraphQL response
 * @returns Avelero category UUID (string) or null if no mapping exists
 */
export function resolveShopifyCategoryId(
  shopifyCategory: { id: string; name: string; fullName: string } | null | undefined
): string | null {
  if (!shopifyCategory?.id) return null;

  const cfg = requireMapping();
  const shortId = extractShortId(shopifyCategory.id);

  // Step 1: Check if outside root filter (e.g., not Apparel & Accessories)
  if (!shortId.startsWith(cfg.branch_config.root_filter)) {
    return null;
  }

  // Step 2: Check if in excluded categories (e.g., Jewelry, Costumes)
  if (isExcluded(shortId, cfg.excluded_category_ids)) {
    return null;
  }

  // Step 3: Check for direct rule match
  const directRule = cfg.rules[shortId];
  if (directRule !== undefined) {
    return directRule?.id ?? null;
  }

  // Step 4: Walk up ancestors looking for a rule match
  let current: string | null = shortId;
  while (true) {
    current = getParentId(current);
    if (!current) break;

    const ancestorRule = cfg.rules[current];
    if (ancestorRule !== undefined) {
      return ancestorRule?.id ?? null;
    }
  }

  // Step 5: Fall back to branch-level mapping
  for (const branch of branchKeys) {
    if (shortId === branch || shortId.startsWith(`${branch}-`)) {
      return cfg.branch_config.branches[branch]?.id ?? null;
    }
  }

  // No mapping found
  return null;
}
