import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../client";
import { generateUniqueUpid } from "../utils/upid.js";
import { convertFilterStateToWhereClauses } from "../utils/filter-converter.js";
import {
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSeasons,
  brandTags,
  categories,
  productEcoClaims,
  productEnvironment,
  productJourneyStepFacilities,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
  tagsOnProduct,
} from "../schema";

/**
 * Filter options for product list queries
 *
 * Uses FilterState structure (groups with AND/OR logic).
 * Full FilterState → SQL conversion will be implemented in Phase 5.
 */
type ListFilters = {
  search?: string; // Top-level search (separate from FilterState)
  // FilterState structure (groups with AND/OR logic)
  // Will be converted to SQL WHERE clauses in Phase 5
  filterState?: {
    groups: Array<{
      id: string;
      conditions: Array<{
        id: string;
        fieldId: string;
        operator: string;
        value: any;
        nestedConditions?: Array<any>;
      }>;
      asGroup?: boolean;
    }>;
  };
};

/**
 * Maps API field names to database column references.
 *
 * Used for selective field queries to only fetch requested columns,
 * reducing payload size and improving query performance.
 */
const PRODUCT_FIELD_MAP = {
  id: products.id,
  name: products.name,
  description: products.description,
  category_id: products.categoryId,
  season_id: products.seasonId,
  showcase_brand_id: products.showcaseBrandId,
  primary_image_url: products.primaryImageUrl,
  product_identifier: products.productIdentifier,
  upid: products.upid,
  template_id: products.templateId,
  status: products.status,
  created_at: products.createdAt,
  updated_at: products.updatedAt,
} as const;

/**
 * Type-safe product field names.
 */
export type ProductField = keyof typeof PRODUCT_FIELD_MAP;

const PRODUCT_FIELDS = Object.keys(
  PRODUCT_FIELD_MAP,
) as readonly ProductField[];

/**
 * Maps sort field names to database column references.
 *
 * Used for sorting product queries by different fields.
 * Note: Some fields require joins (category, season).
 */
const SORT_FIELD_MAP: Record<string, any> = {
  name: products.name,
  status: products.status,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  category: categories.name, // Requires join
  season: null, // Special handling required - see buildSeasonOrderBy
  productIdentifier: products.productIdentifier,
} as const;

/**
 * Represents the core product fields exposed by API queries.
 */
export interface ProductRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  season_id?: string | null; // FK to brand_seasons.id
  showcase_brand_id?: string | null;
  primary_image_url?: string | null;
  product_identifier?: string | null;
  upid?: string | null;
  template_id?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched fields from joins
  category_name?: string | null;
  category_path?: string[] | null;
  season_name?: string | null;
}

/**
 * Variant summary returned alongside products.
 */
export interface ProductVariantSummary {
  id: string;
  product_id: string;
  color_id: string | null;
  size_id: string | null;
  upid: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Material composition entry for a product.
 */
export interface ProductMaterialSummary {
  id: string;
  brand_material_id: string;
  material_name: string | null;
  percentage: string | null;
}

/**
 * Eco claim association summary for a product.
 */
export interface ProductEcoClaimSummary {
  id: string;
  eco_claim_id: string;
  claim: string | null;
}

/**
 * Journey step entry for a product passport.
 */
export interface ProductJourneyStepSummary {
  id: string;
  sort_index: number;
  step_type: string;
  facility_ids: string[]; // Changed from facility_id to support multiple operators
  facility_names: (string | null)[]; // Changed from facility_name to support multiple operators
}

/**
 * Environmental impact metrics for a product when available.
 */
export interface ProductEnvironmentSummary {
  product_id: string;
  carbon_kg_co2e: string | null;
  water_liters: string | null;
}

/**
 * Aggregated attributes bundle returned when includeAttributes is enabled.
 */
export interface ProductAttributesBundle {
  materials: ProductMaterialSummary[];
  ecoClaims: ProductEcoClaimSummary[];
  environment: ProductEnvironmentSummary | null;
  journey: ProductJourneyStepSummary[];
  tags: Array<{
    id: string;
    tag_id: string;
    name: string | null;
    hex: string | null;
  }>;
}

/**
 * Product payload enriched with optional relations requested by callers.
 */
export interface ProductWithRelations extends ProductRecord {
  variants?: ProductVariantSummary[];
  attributes?: ProductAttributesBundle;
}

/**
 * Result payload for variant upsert operations.
 */
/**
 * Maps database row to ProductRecord, handling selective field queries.
 *
 * Only includes fields that were actually selected in the query, allowing
 * for efficient partial queries when full product data isn't needed.
 *
 * @param row - Database row with varying fields
 * @returns ProductRecord with only populated fields
 */
function mapProductRow(row: Record<string, unknown>): ProductRecord {
  const product: ProductRecord = {
    id: String(row.id),
  };

  if ("name" in row) product.name = (row.name as string | null) ?? null;
  if ("description" in row)
    product.description = (row.description as string | null) ?? null;
  if ("category_id" in row)
    product.category_id = (row.category_id as string | null) ?? null;
  if ("season_id" in row)
    product.season_id = (row.season_id as string | null) ?? null;
  if ("showcase_brand_id" in row)
    product.showcase_brand_id =
      (row.showcase_brand_id as string | null) ?? null;
  if ("product_identifier" in row)
    product.product_identifier =
      (row.product_identifier as string | null) ?? null;
  if ("upid" in row) product.upid = (row.upid as string | null) ?? null;
  if ("template_id" in row)
    product.template_id = (row.template_id as string | null) ?? null;
  if ("status" in row) product.status = (row.status as string | null) ?? null;
  if ("primary_image_url" in row)
    product.primary_image_url =
      (row.primary_image_url as string | null) ?? null;
  if ("created_at" in row)
    product.created_at = (row.created_at as string | null) ?? undefined;
  if ("updated_at" in row)
    product.updated_at = (row.updated_at as string | null) ?? undefined;
  if ("category_name" in row)
    product.category_name = (row.category_name as string | null) ?? null;
  if ("category_path" in row)
    product.category_path = (row.category_path as string[] | null) ?? null;
  if ("season_name" in row)
    product.season_name = (row.season_name as string | null) ?? null;

  return product;
}

/**
 * Creates an empty product attributes bundle.
 *
 * Used as default when attributes are not requested or don't exist.
 *
 * @returns Empty attributes bundle with empty arrays and null environment
 */
function createEmptyAttributes(): ProductAttributesBundle {
  return {
    materials: [],
    ecoClaims: [],
    environment: null,
    journey: [],
    tags: [],
  };
}

/**
 * Validates that a product belongs to a specific brand.
 *
 * Security check to prevent cross-brand product access. Throws an error
 * if the product doesn't exist or belongs to a different brand.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @param productId - Product identifier to validate
 * @returns Product ID if validation passes
 * @throws {Error} If product doesn't belong to brand
 */
async function ensureProductBelongsToBrand(
  db: Database,
  brandId: string,
  productId: string,
): Promise<{ id: string }> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  const product = rows[0];
  if (!product) {
    throw new Error("Product does not belong to the specified brand");
  }
  return product;
}

/**
 * Batch loads variants for multiple products.
 *
 * Performs a single database query to fetch all variants for the given
 * product IDs, then groups them by product ID for efficient lookups.
 * Optimizes N+1 query problems when loading product lists.
 *
 * @param db - Database instance
 * @param productIds - Array of product IDs to load variants for
 * @returns Map of product ID to array of variants
 */
async function loadVariantsForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductVariantSummary[]>> {
  const map = new Map<string, ProductVariantSummary[]>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, [...productIds]))
    .orderBy(asc(productVariants.createdAt));

  for (const row of rows) {
    const collection = map.get(row.product_id) ?? [];
    collection.push({
      id: row.id,
      product_id: row.product_id,
      color_id: row.color_id ?? null,
      size_id: row.size_id ?? null,
      upid: row.upid ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    map.set(row.product_id, collection);
  }

  return map;
}

async function loadAttributesForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductAttributesBundle>> {
  const map = new Map<string, ProductAttributesBundle>();
  if (productIds.length === 0) return map;

  const ensureBundle = (productId: string): ProductAttributesBundle => {
    if (!map.has(productId)) {
      map.set(productId, createEmptyAttributes());
    }
    return map.get(productId)!;
  };

  const materialRows = await db
    .select({
      id: productMaterials.id,
      product_id: productMaterials.productId,
      brand_material_id: productMaterials.brandMaterialId,
      percentage: productMaterials.percentage,
      material_name: brandMaterials.name,
    })
    .from(productMaterials)
    .leftJoin(
      brandMaterials,
      eq(brandMaterials.id, productMaterials.brandMaterialId),
    )
    .where(inArray(productMaterials.productId, [...productIds]))
    .orderBy(asc(productMaterials.createdAt));

  for (const row of materialRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.materials.push({
      id: row.id,
      brand_material_id: row.brand_material_id,
      material_name: row.material_name ?? null,
      percentage: row.percentage ? String(row.percentage) : null,
    });
  }

  const ecoRows = await db
    .select({
      id: productEcoClaims.id,
      product_id: productEcoClaims.productId,
      eco_claim_id: productEcoClaims.ecoClaimId,
      claim: brandEcoClaims.claim,
    })
    .from(productEcoClaims)
    .leftJoin(
      brandEcoClaims,
      eq(brandEcoClaims.id, productEcoClaims.ecoClaimId),
    )
    .where(inArray(productEcoClaims.productId, [...productIds]))
    .orderBy(asc(productEcoClaims.createdAt));

  for (const row of ecoRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.ecoClaims.push({
      id: row.id,
      eco_claim_id: row.eco_claim_id,
      claim: row.claim ?? null,
    });
  }

  const environmentRows = await db
    .select({
      product_id: productEnvironment.productId,
      carbon_kg_co2e: productEnvironment.carbonKgCo2e,
      water_liters: productEnvironment.waterLiters,
    })
    .from(productEnvironment)
    .where(inArray(productEnvironment.productId, [...productIds]));

  for (const row of environmentRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.environment = {
      product_id: row.product_id,
      carbon_kg_co2e: row.carbon_kg_co2e ? String(row.carbon_kg_co2e) : null,
      water_liters: row.water_liters ? String(row.water_liters) : null,
    };
  }

  // Load journey steps with all their facilities via junction table
  // We need to aggregate facilities for each step since there's a many-to-many relationship
  const journeyRows = await db
    .select({
      id: productJourneySteps.id,
      product_id: productJourneySteps.productId,
      sort_index: productJourneySteps.sortIndex,
      step_type: productJourneySteps.stepType,
      facility_id: productJourneyStepFacilities.facilityId,
      facility_name: brandFacilities.displayName,
    })
    .from(productJourneySteps)
    .leftJoin(
      productJourneyStepFacilities,
      eq(productJourneySteps.id, productJourneyStepFacilities.journeyStepId),
    )
    .leftJoin(
      brandFacilities,
      eq(brandFacilities.id, productJourneyStepFacilities.facilityId),
    )
    .where(inArray(productJourneySteps.productId, [...productIds]))
    .orderBy(asc(productJourneySteps.sortIndex));

  // Group facilities by journey step
  const journeyStepsMap = new Map<
    string,
    {
      id: string;
      product_id: string;
      sort_index: number;
      step_type: string;
      facilities: Array<{ id: string; name: string | null }>;
    }
  >();

  for (const row of journeyRows) {
    const stepId = row.id;
    if (!journeyStepsMap.has(stepId)) {
      journeyStepsMap.set(stepId, {
        id: row.id,
        product_id: row.product_id,
        sort_index: row.sort_index,
        step_type: row.step_type,
        facilities: [],
      });
    }

    const step = journeyStepsMap.get(stepId)!;
    if (row.facility_id) {
      step.facilities.push({
        id: row.facility_id,
        name: row.facility_name ?? null,
      });
    }
  }

  // Add aggregated journey steps to bundles
  for (const step of journeyStepsMap.values()) {
    const bundle = ensureBundle(step.product_id);
    bundle.journey.push({
      id: step.id,
      sort_index: step.sort_index,
      step_type: step.step_type,
      facility_ids: step.facilities.map((f) => f.id),
      facility_names: step.facilities.map((f) => f.name),
    });
  }

  const tagRows = await db
    .select({
      id: tagsOnProduct.id,
      product_id: tagsOnProduct.productId,
      tag_id: tagsOnProduct.tagId,
      name: brandTags.name,
      hex: brandTags.hex,
    })
    .from(tagsOnProduct)
    .leftJoin(brandTags, eq(brandTags.id, tagsOnProduct.tagId))
    .where(inArray(tagsOnProduct.productId, [...productIds]));

  for (const row of tagRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.tags.push({
      id: row.id,
      tag_id: row.tag_id,
      name: row.name ?? null,
      hex: row.hex ?? null,
    });
  }

  // Ensure every product id has a bundle even if empty
  for (const id of productIds) {
    ensureBundle(id);
  }

  return map;
}

/**
 * Batch loads category paths for multiple products.
 *
 * Performs a single database query to fetch all categories, then builds
 * hierarchical paths in memory for efficient lookups. Optimizes N+1 query
 * problems when loading product lists with category information.
 *
 * @param db - Database instance
 * @param categoryIds - Array of category IDs to build paths for
 * @returns Map of category ID to array of category names (path from root to leaf)
 */
async function loadCategoryPathsForProducts(
  db: Database,
  categoryIds: readonly (string | null)[],
): Promise<Map<string | null, string[]>> {
  const map = new Map<string | null, string[]>();
  const uniqueIds = Array.from(
    new Set(categoryIds.filter((id): id is string => id !== null)),
  );

  if (uniqueIds.length === 0) return map;

  // Load all categories in one query
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories);

  // Build in-memory lookup map for O(1) access
  const categoryMap = new Map(
    allCategories.map((c) => [
      c.id,
      { name: c.name, parentId: c.parentId ?? null },
    ]),
  );

  // Build paths for each unique category ID by traversing parent chain
  function buildPath(categoryId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = categoryMap.get(currentId);
      if (!category) break;

      path.unshift(category.name); // Add to front of array
      currentId = category.parentId; // Move to parent
    }

    return path;
  }

  // Build paths for all unique category IDs
  for (const id of uniqueIds) {
    map.set(id, buildPath(id));
  }

  return map;
}

/**
 * Lists products with optional field selection for performance optimization.
 *
 * Supports selective field querying to reduce data transfer and query overhead.
 * When fields are specified, only those columns are queried from the database.
 *
 * @param db - Database instance.
 * @param brandId - Brand identifier for scoping.
 * @param filters - Optional filters for category, season, and search.
 * @param opts - Pagination and field selection options.
 * @returns Product list with metadata.
 */
export async function listProducts(
  db: Database,
  brandId: string,
  filters: ListFilters = {},
  opts: {
    cursor?: string;
    limit?: number;
    fields?: readonly ProductField[];
    sort?: { field: string; direction: "asc" | "desc" };
  } = {},
): Promise<{
  readonly data: ReadonlyArray<Record<string, unknown>>;
  readonly meta: {
    readonly total: number;
    readonly cursor: string | null;
    readonly hasMore: boolean;
  };
}> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Number.isFinite(Number(opts.cursor))
    ? Math.max(0, Number(opts.cursor))
    : 0;

  const whereClauses = [eq(products.brandId, brandId)];

  // Convert FilterState to SQL WHERE clauses
  if (filters.filterState) {
    const filterClauses = convertFilterStateToWhereClauses(
      filters.filterState,
      db,
      brandId,
    );
    whereClauses.push(...filterClauses);
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    // Search across: name, productIdentifier, season name, category name, status, and tags
    const searchConditions = [
      ilike(products.name, term),
      ilike(products.productIdentifier, term),
      // Status search (exact match or contains)
      ilike(products.status, term),
    ];

    // Add season search (requires join, handled in subquery)
    // Add category search (requires join, handled in subquery)
    // Add tag search (requires EXISTS subquery for many-to-many)

    whereClauses.push(
      or(
        ...searchConditions,
        // Season name search via EXISTS
        sql`EXISTS (
          SELECT 1 FROM ${brandSeasons}
          WHERE ${brandSeasons.id} = ${products.seasonId}
          AND ${brandSeasons.name} ILIKE ${term}
        )`,
        // Category name search via EXISTS (including parent categories)
        // Uses recursive CTE to traverse up the category hierarchy
        sql`EXISTS (
          WITH RECURSIVE category_hierarchy AS (
            -- Base case: the product's direct category
            SELECT id, name, parent_id FROM ${categories}
            WHERE ${categories.id} = ${products.categoryId}
            
            UNION
            
            -- Recursive case: parent categories
            SELECT c.id, c.name, c.parent_id FROM ${categories} c
            INNER JOIN category_hierarchy ch ON c.id = ch.parent_id
          )
          SELECT 1 FROM category_hierarchy
          WHERE name ILIKE ${term}
        )`,
        // Tag search via EXISTS
        sql`EXISTS (
          SELECT 1 FROM ${tagsOnProduct}
          INNER JOIN ${brandTags} ON ${brandTags.id} = ${tagsOnProduct.tagId}
          WHERE ${tagsOnProduct.productId} = ${products.id}
          AND ${brandTags.name} ILIKE ${term}
        )`,
      )!,
    );
  }

  // Build select object based on requested fields
  const selectFields =
    opts.fields && opts.fields.length > 0
      ? Object.fromEntries(
        opts.fields.map((field) => [field, PRODUCT_FIELD_MAP[field]]),
      )
      : PRODUCT_FIELD_MAP;

  // Add joined fields for category and season names
  const selectWithJoins = {
    ...selectFields,
    category_name: categories.name,
    season_name: brandSeasons.name,
  };

  // Determine sort field and direction
  // Special handling for season and category sorting: empty records always appear last
  let orderBy:
    | ReturnType<typeof asc>
    | ReturnType<typeof desc>
    | ReturnType<typeof sql>
    | Array<
      | ReturnType<typeof asc>
      | ReturnType<typeof desc>
      | ReturnType<typeof sql>
    >;
  if (opts.sort?.field === "season") {
    if (opts.sort.direction === "asc") {
      // Ascending: oldest end dates first, ongoing seasons last (treated as most recent)
      // Products without seasons (NULL) always appear last
      // Secondary sort by season name alphabetically for same end dates/ongoing status
      orderBy = [
        sql`CASE 
          WHEN ${products.seasonId} IS NULL THEN NULL
          WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
          WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
          ELSE ${brandSeasons.endDate} 
        END ASC NULLS LAST`,
        sql`${brandSeasons.name} ASC NULLS LAST`,
        asc(products.id), // Stable tie-breaker for deterministic pagination
      ];
    } else {
      // Descending: most recent end dates first, ongoing seasons at top (treated as most recent)
      // Products without seasons (NULL) always appear last
      // Secondary sort by season name alphabetically for same end dates/ongoing status
      orderBy = [
        sql`CASE 
          WHEN ${products.seasonId} IS NULL THEN NULL
          WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
          WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
          ELSE ${brandSeasons.endDate} 
        END DESC NULLS LAST`,
        sql`${brandSeasons.name} ASC NULLS LAST`,
        desc(products.id), // Stable tie-breaker for deterministic pagination
      ];
    }
  } else if (opts.sort?.field === "category") {
    // Category sorting: products without category always appear last
    const categorySortField = categories.name;
    if (opts.sort.direction === "asc") {
      orderBy = [sql`${categorySortField} ASC NULLS LAST`, asc(products.id)];
    } else {
      orderBy = [sql`${categorySortField} DESC NULLS LAST`, desc(products.id)];
    }
  } else {
    const sortField = opts.sort?.field
      ? SORT_FIELD_MAP[opts.sort.field] ?? products.createdAt
      : products.createdAt;

    // Add product ID as a stable tie-breaker for deterministic pagination
    orderBy =
      opts.sort?.direction === "asc"
        ? [asc(sortField), asc(products.id)]
        : [desc(sortField), desc(products.id)];
  }

  const rows = await db
    .select(selectWithJoins)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brandSeasons, eq(products.seasonId, brandSeasons.id))
    .where(and(...whereClauses))
    .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
    .limit(limit)
    .offset(offset);

  const result = await db
    .select({ value: count(products.id) })
    .from(products)
    .where(and(...whereClauses));
  const total = result[0]?.value ?? 0;

  const nextOffset = offset + rows.length;
  const hasMore = total > nextOffset;
  return {
    data: rows,
    meta: {
      total,
      cursor: hasMore ? String(nextOffset) : null,
      hasMore,
    },
  } as const;
}

export async function listProductsWithIncludes(
  db: Database,
  brandId: string,
  filters: ListFilters = {},
  opts: {
    cursor?: string;
    limit?: number;
    fields?: readonly ProductField[];
    includeVariants?: boolean;
    includeAttributes?: boolean;
    sort?: { field: string; direction: "asc" | "desc" };
  } = {},
): Promise<{
  readonly data: ProductWithRelations[];
  readonly meta: {
    readonly total: number;
    readonly cursor: string | null;
    readonly hasMore: boolean;
  };
}> {
  const requestedFields = opts.fields ?? PRODUCT_FIELDS;
  const fieldsWithId = Array.from(
    new Set([...requestedFields, "id"]),
  ) as readonly ProductField[];

  const base = await listProducts(db, brandId, filters, {
    cursor: opts.cursor,
    limit: opts.limit,
    fields: fieldsWithId,
    sort: opts.sort,
  });

  const products = base.data.map(mapProductRow);
  const productIds = products.map((product) => product.id);

  // Load category paths for all products (batch operation)
  // Note: category_name is already available from the join in listProducts,
  // but we need to build the full hierarchical path
  const categoryIds = products
    .map((p) => p.category_id)
    .filter((id): id is string => id !== null);
  const categoryPathsMap = await loadCategoryPathsForProducts(db, categoryIds);

  // Note: season_name is already available from the join in listProducts,
  // so we don't need to load seasons again

  const variantsMap = opts.includeVariants
    ? await loadVariantsForProducts(db, productIds)
    : new Map<string, ProductVariantSummary[]>();

  const attributesMap = opts.includeAttributes
    ? await loadAttributesForProducts(db, productIds)
    : new Map<string, ProductAttributesBundle>();

  const data: ProductWithRelations[] = products.map((product) => {
    const enriched: ProductWithRelations = { ...product };

    // Enrich with category path (category_name is already set from join)
    if (product.category_id && !product.category_path) {
      enriched.category_path =
        categoryPathsMap.get(product.category_id) ?? null;
    }

    // season_name is already set from the join in listProducts, no need to enrich

    if (opts.includeVariants) {
      enriched.variants = variantsMap.get(product.id) ?? [];
    }
    if (opts.includeAttributes) {
      enriched.attributes =
        attributesMap.get(product.id) ?? createEmptyAttributes();
    }
    return enriched;
  });

  return {
    data,
    meta: base.meta,
  };
}

export async function getProductWithIncludes(
  db: Database,
  brandId: string,
  productId: string,
  opts: { includeVariants?: boolean; includeAttributes?: boolean } = {},
): Promise<ProductWithRelations | null> {
  const base = await getProduct(db, brandId, productId);
  if (!base) return null;

  const product: ProductWithRelations = { ...base };
  const productIds = [product.id];

  if (opts.includeVariants) {
    const variantsMap = await loadVariantsForProducts(db, productIds);
    product.variants = variantsMap.get(product.id) ?? [];
  }

  if (opts.includeAttributes) {
    const attributesMap = await loadAttributesForProducts(db, productIds);
    product.attributes =
      attributesMap.get(product.id) ?? createEmptyAttributes();
  }

  return product;
}

export async function getProductWithIncludesByUpid(
  db: Database,
  brandId: string,
  productUpid: string,
  opts: { includeVariants?: boolean; includeAttributes?: boolean } = {},
): Promise<ProductWithRelations | null> {
  const base = await getProductByUpid(db, brandId, productUpid);
  if (!base) return null;

  const product: ProductWithRelations = { ...base };
  const productIds = [product.id];

  if (opts.includeVariants) {
    const variantsMap = await loadVariantsForProducts(db, productIds);
    product.variants = variantsMap.get(product.id) ?? [];
  }

  if (opts.includeAttributes) {
    const attributesMap = await loadAttributesForProducts(db, productIds);
    product.attributes =
      attributesMap.get(product.id) ?? createEmptyAttributes();
  }

  return product;
}

export async function getProduct(db: Database, brandId: string, id: string) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season_id: products.seasonId,
      showcase_brand_id: products.showcaseBrandId,
      primary_image_url: products.primaryImageUrl,
      product_identifier: products.productIdentifier,
      upid: products.upid,
      template_id: products.templateId,
      status: products.status,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProductByUpid(
  db: Database,
  brandId: string,
  upid: string,
) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season_id: products.seasonId,
      showcase_brand_id: products.showcaseBrandId,
      primary_image_url: products.primaryImageUrl,
      product_identifier: products.productIdentifier,
      upid: products.upid,
      template_id: products.templateId,
      status: products.status,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.upid, upid), eq(products.brandId, brandId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProduct(
  db: Database,
  brandId: string,
  input: {
    name: string;
    productIdentifier?: string;
    description?: string;
    categoryId?: string;
    seasonId?: string;
    templateId?: string | null;
    showcaseBrandId?: string;
    primaryImageUrl?: string;
    status?: string;
  },
) {
  let created:
    | { id: string; upid: string | null; variantIds?: readonly string[] }
    | undefined;
  await db.transaction(async (tx) => {
    const productIdentifierValue =
      input.productIdentifier ??
      `PROD-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const upid = await generateUniqueUpid({
      isTaken: async (candidate) => {
        const [row] = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(eq(products.upid, candidate), eq(products.brandId, brandId)),
          )
          .limit(1);
        return Boolean(row);
      },
    });

    const [row] = await tx
      .insert(products)
      .values({
        brandId,
        name: input.name,
        productIdentifier: productIdentifierValue,
        upid,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        seasonId: input.seasonId ?? null,
        templateId: input.templateId ?? null,
        showcaseBrandId: input.showcaseBrandId ?? null,
        primaryImageUrl: input.primaryImageUrl ?? null,
        status: input.status ?? "unpublished",
      })
      .returning({ id: products.id, upid: products.upid });

    if (!row?.id) {
      return;
    }

    created = { id: row.id, upid: row.upid ?? null };
  });
  return created;
}

export async function updateProduct(
  db: Database,
  brandId: string,
  input: {
    id: string;
    name?: string;
    productIdentifier?: string | null;
    description?: string | null;
    categoryId?: string | null;
    seasonId?: string | null;
    templateId?: string | null;
    showcaseBrandId?: string | null;
    primaryImageUrl?: string | null;
    status?: string | null;
  },
) {
  let updated: { id: string; variantIds?: readonly string[] } | undefined;
  await db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      seasonId: input.seasonId ?? null,
      productIdentifier: input.productIdentifier ?? null,
      templateId: input.templateId ?? null,
      showcaseBrandId: input.showcaseBrandId ?? null,
      primaryImageUrl: input.primaryImageUrl ?? null,
    };

    // Only update status if provided (status cannot be null)
    if (input.status !== undefined && input.status !== null) {
      updateData.status = input.status;
    }

    const [row] = await tx
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
      .returning({ id: products.id });

    if (!row?.id) {
      return;
    }

    updated = { id: row.id };
  });
  return updated;
}

export async function deleteProduct(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .returning({ id: products.id });
  return row;
}

// ---------------------------------------------------------------------------
// Attribute upserts (materials, eco-claims, environment, journey)

export async function upsertProductMaterials(
  db: Database,
  productId: string,
  items: { brandMaterialId: string; percentage?: string | number }[],
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    await tx
      .delete(productMaterials)
      .where(eq(productMaterials.productId, productId));
    if (!items.length) {
      countInserted = 0;
    } else {
      const rows = await tx
        .insert(productMaterials)
        .values(
          items.map((i) => ({
            productId,
            brandMaterialId: i.brandMaterialId,
            percentage:
              i.percentage !== undefined ? String(i.percentage) : null,
          })),
        )
        .returning({ id: productMaterials.id });
      countInserted = rows.length;
    }
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: countInserted } as const;
}

export async function setProductEcoClaims(
  db: Database,
  productId: string,
  ecoClaimIds: string[],
) {
  const existing = await db
    .select({
      id: productEcoClaims.id,
      ecoClaimId: productEcoClaims.ecoClaimId,
    })
    .from(productEcoClaims)
    .where(eq(productEcoClaims.productId, productId));
  const existingIds = new Set(existing.map((r) => r.ecoClaimId));
  const toInsert = ecoClaimIds.filter((id) => !existingIds.has(id));
  const toDelete = existing.filter((r) => !ecoClaimIds.includes(r.ecoClaimId));
  if (toDelete.length) {
    await db.delete(productEcoClaims).where(
      inArray(
        productEcoClaims.id,
        toDelete.map((r) => r.id),
      ),
    );
  }
  if (toInsert.length) {
    await db
      .insert(productEcoClaims)
      .values(toInsert.map((id) => ({ productId, ecoClaimId: id })));
  }
  return { count: ecoClaimIds.length } as const;
}

export async function upsertProductEnvironment(
  db: Database,
  productId: string,
  input: { carbonKgCo2e?: string; waterLiters?: string },
) {
  let result: { product_id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productEnvironment)
      .values({
        productId,
        carbonKgCo2e: input.carbonKgCo2e ?? null,
        waterLiters: input.waterLiters ?? null,
      })
      .onConflictDoUpdate({
        target: productEnvironment.productId,
        set: {
          carbonKgCo2e: input.carbonKgCo2e ?? null,
          waterLiters: input.waterLiters ?? null,
        },
      })
      .returning({ product_id: productEnvironment.productId });
    result = row;
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return result as { product_id: string };
}

export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; facilityIds: string[] }[],
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    // Delete existing journey steps (cascade will delete junction table entries)
    await tx
      .delete(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId));

    if (!steps.length) {
      countInserted = 0;
    } else {
      // Insert journey steps first
      const rows = await tx
        .insert(productJourneySteps)
        .values(
          steps.map((s) => ({
            productId,
            sortIndex: s.sortIndex,
            stepType: s.stepType,
          })),
        )
        .returning({ id: productJourneySteps.id });

      countInserted = rows.length;

      // Insert facility associations in junction table
      const facilityAssociations: Array<{
        journeyStepId: string;
        facilityId: string;
      }> = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepRow = rows[i];
        if (!stepRow || !step) continue;

        for (let j = 0; j < step.facilityIds.length; j++) {
          facilityAssociations.push({
            journeyStepId: stepRow.id,
            facilityId: step.facilityIds[j]!,
          });
        }
      }

      if (facilityAssociations.length > 0) {
        await tx
          .insert(productJourneyStepFacilities)
          .values(facilityAssociations);
      }
    }

    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: countInserted } as const;
}

export async function setProductTags(
  db: Database,
  productId: string,
  tagIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(tagsOnProduct)
      .where(eq(tagsOnProduct.productId, productId));
    if (tagIds.length === 0) {
      return;
    }
    await tx
      .insert(tagsOnProduct)
      .values(
        tagIds.map((tagId) => ({
          productId,
          tagId,
        })),
      )
      .returning({ id: tagsOnProduct.id });
  });
  return { count: tagIds.length } as const;
}

// =============================================================================
// Carousel Product Selection
// =============================================================================

/**
 * Product row for carousel selection modal.
 * Contains only the fields needed for display in the selection UI.
 */
export interface CarouselProductRow {
  id: string;
  name: string;
  productIdentifier: string;
  primaryImageUrl: string | null;
  categoryName: string | null;
  seasonName: string | null;
}

/**
 * List products for carousel selection modal.
 *
 * A simplified version of listProducts that only fetches fields needed
 * for the selection UI. Supports search, filtering, sorting, and pagination.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier for scoping
 * @param options - Query options
 * @returns Paginated list of products for selection
 */
export async function listProductsForCarouselSelection(
  db: Database,
  brandId: string,
  options: {
    search?: string;
    filterState?: ListFilters["filterState"];
    sort?: { field: string; direction: "asc" | "desc" };
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{
  data: CarouselProductRow[];
  meta: { total: number; cursor: string | null; hasMore: boolean };
}> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Number.isFinite(Number(options.cursor))
    ? Math.max(0, Number(options.cursor))
    : 0;

  // Build WHERE clauses
  const whereClauses = [eq(products.brandId, brandId)];

  // Apply FilterState if provided
  if (options.filterState) {
    const filterClauses = convertFilterStateToWhereClauses(
      options.filterState,
      db,
      brandId,
    );
    whereClauses.push(...filterClauses);
  }

  // Apply search across name and productIdentifier
  if (options.search) {
    const term = `%${options.search}%`;
    whereClauses.push(
      or(
        ilike(products.name, term),
        ilike(products.productIdentifier, term),
        // Also search category and season names
        sql`EXISTS (
          SELECT 1 FROM ${brandSeasons}
          WHERE ${brandSeasons.id} = ${products.seasonId}
          AND ${brandSeasons.name} ILIKE ${term}
        )`,
        sql`EXISTS (
          SELECT 1 FROM ${categories}
          WHERE ${categories.id} = ${products.categoryId}
          AND ${categories.name} ILIKE ${term}
        )`,
      )!,
    );
  }

  // Determine sort order
  let orderBy:
    | ReturnType<typeof asc>
    | ReturnType<typeof desc>
    | ReturnType<typeof sql>
    | Array<
      | ReturnType<typeof asc>
      | ReturnType<typeof desc>
      | ReturnType<typeof sql>
    >;

  const sortField = options.sort?.field ?? "createdAt";
  const sortDir = options.sort?.direction ?? "desc";

  if (sortField === "category") {
    orderBy =
      sortDir === "asc"
        ? [sql`${categories.name} ASC NULLS LAST`, asc(products.id)]
        : [sql`${categories.name} DESC NULLS LAST`, desc(products.id)];
  } else if (sortField === "season") {
    // Sort by season end date (ongoing = most recent, null = last)
    if (sortDir === "asc") {
      orderBy = [
        sql`CASE 
          WHEN ${products.seasonId} IS NULL THEN NULL
          WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
          WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
          ELSE ${brandSeasons.endDate} 
        END ASC NULLS LAST`,
        asc(products.id),
      ];
    } else {
      orderBy = [
        sql`CASE 
          WHEN ${products.seasonId} IS NULL THEN NULL
          WHEN ${brandSeasons.ongoing} = true THEN '9999-12-31'::date 
          WHEN ${brandSeasons.endDate} IS NULL THEN '9999-12-31'::date
          ELSE ${brandSeasons.endDate} 
        END DESC NULLS LAST`,
        desc(products.id),
      ];
    }
  } else if (sortField === "createdAt") {
    // Sort by created date
    orderBy =
      sortDir === "asc"
        ? [asc(products.createdAt), asc(products.id)]
        : [desc(products.createdAt), desc(products.id)];
  } else {
    // Default: sort by name
    orderBy =
      sortDir === "asc"
        ? [asc(products.name), asc(products.id)]
        : [desc(products.name), desc(products.id)];
  }

  // Execute query with only needed fields
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      productIdentifier: products.productIdentifier,
      primaryImageUrl: products.primaryImageUrl,
      categoryName: categories.name,
      seasonName: brandSeasons.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brandSeasons, eq(products.seasonId, brandSeasons.id))
    .where(and(...whereClauses))
    .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ value: count(products.id) })
    .from(products)
    .where(and(...whereClauses));

  const total = countResult?.value ?? 0;
  const nextOffset = offset + rows.length;
  const hasMore = total > nextOffset;

  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      productIdentifier: row.productIdentifier,
      primaryImageUrl: row.primaryImageUrl,
      categoryName: row.categoryName,
      seasonName: row.seasonName,
    })),
    meta: {
      total,
      cursor: hasMore ? String(nextOffset) : null,
      hasMore,
    },
  };
}
