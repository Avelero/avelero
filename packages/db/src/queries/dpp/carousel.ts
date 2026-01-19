/**
 * Carousel Similar Products Query
 *
 * Fetches products for the DPP carousel based on ThemeConfig.carousel settings.
 * Prioritizes products based on category relevance:
 * 1. Same category as current product
 * 2. Sibling categories (same parent)
 * 3. Cousin categories (same grandparent)
 * 4. Random from remaining
 *
 * Only returns products that are complete (have webshop_url and price).
 */

import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import type { Database } from "../../client";
import { productCommercial, products, taxonomyCategories } from "../../schema";
import { convertFilterStateToWhereClauses } from "../../utils/filter-converter";

// ============================================================================
// Types
// ============================================================================

/**
 * Product data returned for carousel display.
 */
export interface CarouselProduct {
  id: string;
  name: string;
  imagePath: string | null;
  price: string;
  currency: string;
  webshopUrl: string;
}

/**
 * Carousel configuration from ThemeConfig.
 */
interface CarouselConfig {
  productCount?: number;
  filter?: Record<string, unknown>;
  includeIds?: string[];
  excludeIds?: string[];
}

/**
 * Parameters for fetching carousel products.
 */
interface FetchCarouselProductsParams {
  brandId: string;
  currentProductId: string;
  currentCategoryId: string | null;
  carouselConfig?: CarouselConfig | null;
}

/**
 * Category hierarchy info for relevance sorting.
 */
interface CategoryHierarchy {
  categoryId: string | null;
  parentId: string | null;
  grandparentId: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch the category hierarchy (parent and grandparent) for a given category.
 * Returns null values if category doesn't exist or has no parents.
 */
async function getCategoryHierarchy(
  db: Database,
  categoryId: string | null,
): Promise<CategoryHierarchy> {
  if (!categoryId) {
    return { categoryId: null, parentId: null, grandparentId: null };
  }

  // Single query to get category, parent, and grandparent
  const rows = await db
    .select({
      categoryId: taxonomyCategories.id,
      parentId: taxonomyCategories.parentId,
      grandparentId: sql<string | null>`
        (SELECT parent_id FROM taxonomy_categories WHERE id = ${taxonomyCategories.parentId})
      `.as("grandparent_id"),
    })
    .from(taxonomyCategories)
    .where(eq(taxonomyCategories.id, categoryId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { categoryId: null, parentId: null, grandparentId: null };
  }

  return {
    categoryId: row.categoryId,
    parentId: row.parentId,
    grandparentId: row.grandparentId,
  };
}

// ============================================================================
// Main Query Function
// ============================================================================

/**
 * Fetch similar products for carousel display.
 *
 * Selection logic:
 * 1. If includeIds is set → use explicit mode (only those IDs)
 * 2. Otherwise → use filter mode with excludeIds
 *
 * Relevance algorithm (within selected products):
 * - Priority 0: Same category as current product
 * - Priority 1: Sibling categories (same parent category)
 * - Priority 2: Cousin categories (same grandparent category)
 * - Priority 3: Random from remaining
 *
 * Only returns products that are "complete" (have webshop_url, price, and salesStatus = 'active').
 *
 * @param db - Database instance
 * @param params - Query parameters
 * @returns Array of carousel products (max productCount items)
 */
export async function fetchCarouselProducts(
  db: Database,
  params: FetchCarouselProductsParams,
): Promise<CarouselProduct[]> {
  const { brandId, currentProductId, currentCategoryId, carouselConfig } =
    params;

  // Get config values with defaults
  const productCount = Math.min(carouselConfig?.productCount ?? 6, 12);
  const includeIds = carouselConfig?.includeIds ?? [];
  const excludeIds = carouselConfig?.excludeIds ?? [];
  const filter = carouselConfig?.filter;

  // Get category hierarchy for relevance sorting
  const hierarchy = await getCategoryHierarchy(db, currentCategoryId);

  // Base WHERE conditions for "complete" products
  const baseConditions = [
    eq(products.brandId, brandId),
    ne(products.id, currentProductId),
    eq(productCommercial.salesStatus, "active"),
    // Only include products with required fields
    isNotNull(productCommercial.webshopUrl),
    isNotNull(productCommercial.price),
    // Also ensure they're not empty strings
    ne(productCommercial.webshopUrl, ""),
  ];

  // Build relevance ordering based on category hierarchy
  const relevanceOrder = buildRelevanceOrder(hierarchy);

  // Explicit mode: only fetch specific IDs
  if (includeIds.length > 0) {
    // Filter out the current product from includes
    const eligibleIds = includeIds.filter((id) => id !== currentProductId);
    if (eligibleIds.length === 0) return [];

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        imagePath: products.imagePath,
        price: productCommercial.price,
        currency: productCommercial.currency,
        webshopUrl: productCommercial.webshopUrl,
        categoryId: products.categoryId,
        categoryParentId: taxonomyCategories.parentId,
      })
      .from(products)
      .innerJoin(
        productCommercial,
        eq(productCommercial.productId, products.id),
      )
      .leftJoin(
        taxonomyCategories,
        eq(taxonomyCategories.id, products.categoryId),
      )
      .where(and(...baseConditions, inArray(products.id, eligibleIds)))
      .orderBy(asc(relevanceOrder), sql`RANDOM()`)
      .limit(productCount);

    return mapToCarouselProducts(rows);
  }

  // All mode: apply filter and exclusions
  const whereConditions = [...baseConditions];

  // Add exclude IDs (always exclude current product)
  const allExcludeIds = [...new Set([...excludeIds, currentProductId])];
  if (allExcludeIds.length > 0) {
    whereConditions.push(notInArray(products.id, allExcludeIds));
  }

  // Apply filter state if provided
  if (filter && typeof filter === "object" && "groups" in filter) {
    const filterClauses = convertFilterStateToWhereClauses(
      filter as {
        groups: Array<{
          id: string;
          conditions: Array<{
            id: string;
            fieldId: string;
            operator: string;
            value: unknown;
            nestedConditions?: Array<{
              id: string;
              fieldId: string;
              operator: string;
              value: unknown;
            }>;
          }>;
          asGroup?: boolean;
        }>;
      },
      db,
      brandId,
    );
    whereConditions.push(...filterClauses);
  }

  // Fetch with category-based relevance ordering
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      imagePath: products.imagePath,
      price: productCommercial.price,
      currency: productCommercial.currency,
      webshopUrl: productCommercial.webshopUrl,
      categoryId: products.categoryId,
      categoryParentId: taxonomyCategories.parentId,
    })
    .from(products)
    .innerJoin(productCommercial, eq(productCommercial.productId, products.id))
    .leftJoin(
      taxonomyCategories,
      eq(taxonomyCategories.id, products.categoryId),
    )
    .where(and(...whereConditions))
    .orderBy(asc(relevanceOrder), sql`RANDOM()`)
    .limit(productCount);

  return mapToCarouselProducts(rows);
}

/**
 * Build the relevance ORDER BY expression based on category hierarchy.
 * Returns a SQL CASE expression that prioritizes:
 * 0 - Same category
 * 1 - Sibling category (same parent)
 * 2 - Cousin category (same grandparent)
 * 3 - Everything else
 */
function buildRelevanceOrder(hierarchy: CategoryHierarchy) {
  const { categoryId, parentId, grandparentId } = hierarchy;

  // If no category info, just use random ordering (all get same priority)
  if (!categoryId) {
    return sql`3`;
  }

  // Build CASE expression with available hierarchy levels
  // We need to reference the joined categories table for parent lookups
  if (grandparentId) {
    // Full hierarchy available
    return sql`
      CASE
        WHEN ${products.categoryId} = ${categoryId} THEN 0
        WHEN ${taxonomyCategories.parentId} = ${parentId} THEN 1
        WHEN (SELECT parent_id FROM taxonomy_categories WHERE id = ${taxonomyCategories.parentId}) = ${grandparentId} THEN 2
        ELSE 3
      END
    `;
  }

  if (parentId) {
    // Only parent available (no grandparent)
    return sql`
      CASE
        WHEN ${products.categoryId} = ${categoryId} THEN 0
        WHEN ${taxonomyCategories.parentId} = ${parentId} THEN 1
        ELSE 3
      END
    `;
  }

  // Only category ID available (root category)
  return sql`
    CASE
      WHEN ${products.categoryId} = ${categoryId} THEN 0
      ELSE 3
    END
  `;
}

/**
 * Map database rows to CarouselProduct objects.
 * Filters out any rows with missing required fields (extra safety).
 */
function mapToCarouselProducts(
  rows: Array<{
    id: string;
    name: string;
    imagePath: string | null;
    price: string | null;
    currency: string | null;
    webshopUrl: string | null;
    categoryId: string | null;
    categoryParentId: string | null;
  }>,
): CarouselProduct[] {
  return rows
    .filter(
      (row): row is typeof row & { price: string; webshopUrl: string } =>
        row.price !== null &&
        row.price !== "" &&
        row.webshopUrl !== null &&
        row.webshopUrl !== "",
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      imagePath: row.imagePath,
      price: row.price,
      currency: row.currency ?? "EUR",
      webshopUrl: row.webshopUrl,
    }));
}
