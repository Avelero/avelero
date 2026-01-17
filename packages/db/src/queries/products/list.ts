/**
 * Product list query functions.
 *
 * Provides functions for listing products with various filtering,
 * sorting, and pagination options.
 */

import { and, count, eq } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandSeasons,
  brandTags,
  taxonomyCategories,
  products,
  productTags,
} from "../../schema";
import {
  normalizeLimit,
  parseCursor,
  buildPaginationMeta,
} from "../_shared/pagination.js";
import { PRODUCT_FIELD_MAP, PRODUCT_FIELDS } from "./_shared/fields";
import { buildProductWhereClauses } from "./_shared/where";
import { buildProductOrderBy } from "./_shared/sort";
import {
  createEmptyAttributes,
  loadAttributesForProducts,
  loadCategoryPathsForProducts,
  loadPassportDataForProducts,
  loadVariantsForProducts,
  mapProductRow,
} from "./_shared/helpers";
import type {
  CarouselProductRow,
  ListFilters,
  ProductAttributesBundle,
  ProductField,
  ProductVariantWithAttributes,
  ProductWithRelations,
} from "./types";

/**
 * Lists products with optional field selection for performance optimization.
 *
 * Supports selective field querying to reduce data transfer and query overhead.
 * When fields are specified, only those columns are queried from the database.
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
  const limit = normalizeLimit(opts.limit, 1, 100);
  const offset = parseCursor(opts.cursor);

  const whereClauses = buildProductWhereClauses(db, brandId, filters);

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
    category_name: taxonomyCategories.name,
    season_name: brandSeasons.name,
  };

  // Build order by clause
  const orderBy = buildProductOrderBy(
    opts.sort?.field,
    opts.sort?.direction ?? "desc",
  );

  const rows = await db
    .select(selectWithJoins)
    .from(products)
    .leftJoin(
      taxonomyCategories,
      eq(products.categoryId, taxonomyCategories.id),
    )
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

  const meta = buildPaginationMeta(offset, limit, rows.length, total);

  return {
    data: rows,
    meta,
  } as const;
}

/**
 * Lists all product IDs matching the given filters without pagination.
 * Used for bulk operations when "select all" is active.
 */
export async function listProductIds(
  db: Database,
  brandId: string,
  filters: ListFilters = {},
  excludeIds: string[] = [],
): Promise<string[]> {
  const whereClauses = buildProductWhereClauses(
    db,
    brandId,
    filters,
    excludeIds,
  );

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(...whereClauses));

  return rows.map((row) => row.id);
}

/**
 * Lists products with optional variants and attributes included.
 *
 * This is a convenience function that combines listProducts with batch
 * loading of variants and attributes to avoid N+1 query problems.
 */
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
    includePassports?: boolean;
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
  const categoryIds = products
    .map((p) => p.category_id)
    .filter((id): id is string => id !== null);
  const categoryPathsMap = await loadCategoryPathsForProducts(db, categoryIds);

  const variantsMap = opts.includeVariants
    ? await loadVariantsForProducts(db, productIds)
    : new Map<string, ProductVariantWithAttributes[]>();

  const attributesMap = opts.includeAttributes
    ? await loadAttributesForProducts(db, productIds)
    : new Map<string, ProductAttributesBundle>();

  // Load passport data if requested (for lastPublishedAt and firstVariantUpid)
  const passportDataMap = opts.includePassports
    ? await loadPassportDataForProducts(db, productIds)
    : null;

  const data: ProductWithRelations[] = products.map((product) => {
    const enriched: ProductWithRelations = { ...product };

    // Enrich with category path
    if (product.category_id && !product.category_path) {
      enriched.category_path =
        categoryPathsMap.get(product.category_id) ?? null;
    }

    if (opts.includeVariants) {
      enriched.variants = variantsMap.get(product.id) ?? [];
    }
    if (opts.includeAttributes) {
      enriched.attributes =
        attributesMap.get(product.id) ?? createEmptyAttributes();
    }
    if (passportDataMap) {
      const passportData = passportDataMap.get(product.id);
      enriched.last_published_at = passportData?.lastPublishedAt ?? null;
      enriched.first_variant_upid = passportData?.firstVariantUpid ?? null;
    }
    return enriched;
  });

  return {
    data,
    meta: base.meta,
  };
}

/**
 * Lists products for carousel selection modal.
 *
 * Returns a simplified product list with only the fields needed
 * for display in the carousel selection UI.
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
  const limit = normalizeLimit(options.limit, 1, 100);
  const offset = parseCursor(options.cursor);

  // Build WHERE clauses using shared helper
  const filters: ListFilters = {
    search: options.search,
    filterState: options.filterState,
  };
  const whereClauses = buildProductWhereClauses(db, brandId, filters);

  // Build order by clause
  const orderBy = buildProductOrderBy(
    options.sort?.field ?? "createdAt",
    options.sort?.direction ?? "desc",
  );

  // Execute query with only needed fields
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      productHandle: products.productHandle,
      imagePath: products.imagePath,
      categoryName: taxonomyCategories.name,
      seasonName: brandSeasons.name,
    })
    .from(products)
    .leftJoin(
      taxonomyCategories,
      eq(products.categoryId, taxonomyCategories.id),
    )
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
  const meta = buildPaginationMeta(offset, limit, rows.length, total);

  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      productHandle: row.productHandle,
      imagePath: row.imagePath,
      categoryName: row.categoryName,
      seasonName: row.seasonName,
    })),
    meta,
  };
}
