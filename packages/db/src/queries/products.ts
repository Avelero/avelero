import { and, asc, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
import { generateUniqueUpid } from "../utils/upid.js";
import {
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
} from "../schema";

/** Filter options for product list queries */
type ListFilters = {
  categoryId?: string;
  seasonId?: string;
  search?: string;
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

type CompletionEvalOptions = {
  skipCompletionEval?: boolean;
};

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
  facility_id: string;
  facility_name: string | null;
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

  const journeyRows = await db
    .select({
      id: productJourneySteps.id,
      product_id: productJourneySteps.productId,
      sort_index: productJourneySteps.sortIndex,
      step_type: productJourneySteps.stepType,
      facility_id: productJourneySteps.facilityId,
      facility_name: brandFacilities.displayName,
    })
    .from(productJourneySteps)
    .leftJoin(
      brandFacilities,
      eq(brandFacilities.id, productJourneySteps.facilityId),
    )
    .where(inArray(productJourneySteps.productId, [...productIds]))
    .orderBy(asc(productJourneySteps.sortIndex));

  for (const row of journeyRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.journey.push({
      id: row.id,
      sort_index: row.sort_index,
      step_type: row.step_type,
      facility_id: row.facility_id,
      facility_name: row.facility_name ?? null,
    });
  }

  // Ensure every product id has a bundle even if empty
  for (const id of productIds) {
    ensureBundle(id);
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
  const whereClauses = [eq(products.brandId, brandId)];
  if (filters.categoryId)
    whereClauses.push(eq(products.categoryId, filters.categoryId));
  if (filters.seasonId) whereClauses.push(eq(products.seasonId, filters.seasonId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    whereClauses.push(ilike(products.name, term));
  }

  // Build select object based on requested fields
  const selectFields =
    opts.fields && opts.fields.length > 0
      ? Object.fromEntries(
          opts.fields.map((field) => [field, PRODUCT_FIELD_MAP[field]]),
        )
      : PRODUCT_FIELD_MAP;

  const rows = await db
    .select(selectFields)
    .from(products)
    .where(and(...whereClauses))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  const result = await db
    .select({ value: count(products.id) })
    .from(products)
    .where(and(...whereClauses));
  const total = result[0]?.value ?? 0;

  const hasMore = total > rows.length;
  return {
    data: rows,
    meta: {
      total,
      cursor: null,
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
  });

  const products = base.data.map(mapProductRow);
  const productIds = products.map((product) => product.id);

  const variantsMap = opts.includeVariants
    ? await loadVariantsForProducts(db, productIds)
    : new Map<string, ProductVariantSummary[]>();

  const attributesMap = opts.includeAttributes
    ? await loadAttributesForProducts(db, productIds)
    : new Map<string, ProductAttributesBundle>();

  const data: ProductWithRelations[] = products.map((product) => {
    const enriched: ProductWithRelations = { ...product };
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
  options?: CompletionEvalOptions,
) {
  let created: { id: string; variantIds?: readonly string[] } | undefined;
  await db.transaction(async (tx) => {
    const productIdentifierValue =
      input.productIdentifier ??
      `PROD-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const upid = await generateUniqueUpid({
      isTaken: async (candidate) => {
        const [row] = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.upid, candidate), eq(products.brandId, brandId)))
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
      .returning({ id: products.id });

    if (!row?.id) {
      return;
    }

    created = { id: row.id };

    if (!options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        row.id,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }
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
  options?: CompletionEvalOptions,
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

    if (!options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        row.id,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }
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
  options?: CompletionEvalOptions,
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    await tx.delete(productMaterials).where(eq(productMaterials.productId, productId));
    if (!items.length) {
      countInserted = 0;
    } else {
      const rows = await tx
        .insert(productMaterials)
        .values(
          items.map((i) => ({
            productId,
            brandMaterialId: i.brandMaterialId,
            percentage: i.percentage !== undefined ? String(i.percentage) : null,
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
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["materials"] as ModuleKey[],
        },
      );
    }
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
  options?: CompletionEvalOptions,
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
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["environment"] as ModuleKey[],
        },
      );
    }
  });
  return result as { product_id: string };
}

export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; facilityId: string }[],
  options?: CompletionEvalOptions,
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    await tx
      .delete(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId));
    if (!steps.length) {
      countInserted = 0;
    } else {
      const rows = await tx
        .insert(productJourneySteps)
        .values(
          steps.map((s) => ({
            productId,
            sortIndex: s.sortIndex,
            stepType: s.stepType,
            facilityId: s.facilityId,
          })),
        )
        .returning({ id: productJourneySteps.id });
      countInserted = rows.length;
    }
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["journey"] as ModuleKey[],
        },
      );
    }
  });
  return { count: countInserted } as const;
}
