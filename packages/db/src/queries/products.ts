import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
} from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
import {
  brandCertifications,
  brandColors,
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSizes,
  careCodes,
  categories,
  productCareCodes,
  productEcoClaims,
  productEnvironment,
  productIdentifiers,
  productJourneySteps,
  productMaterials,
  productVariantIdentifiers,
  productVariants,
  products,
  showcaseBrands,
} from "../schema";

/** Filter options for product list queries */
type ListFilters = {
  categoryId?: string;
  season?: string;
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
  season: products.season,
  brand_certification_id: products.brandCertificationId,
  showcase_brand_id: products.showcaseBrandId,
  primary_image_url: products.primaryImageUrl,
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
 * Represents the core product fields exposed by API queries.
 */
export interface ProductRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  season?: string | null;
  brand_certification_id?: string | null;
  showcase_brand_id?: string | null;
  primary_image_url?: string | null;
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
  sku: string | null;
  upid: string;
  product_image_url: string | null;
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
 * Care code association summary for a product.
 */
export interface ProductCareCodeSummary {
  id: string;
  care_code_id: string;
  code: string | null;
  name: string | null;
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
  careCodes: ProductCareCodeSummary[];
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
export interface VariantUpsertResult {
  readonly reference: string;
  readonly variant_id?: string;
  readonly status: "created" | "updated" | "error";
  readonly error?: string;
}

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
  if ("season" in row) product.season = (row.season as string | null) ?? null;
  if ("brand_certification_id" in row)
    product.brand_certification_id =
      (row.brand_certification_id as string | null) ?? null;
  if ("showcase_brand_id" in row)
    product.showcase_brand_id =
      (row.showcase_brand_id as string | null) ?? null;
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
    careCodes: [],
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
      sku: productVariants.sku,
      upid: productVariants.upid,
      product_image_url: productVariants.productImageUrl,
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
      sku: row.sku ?? null,
      upid: row.upid,
      product_image_url: row.product_image_url ?? null,
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

  const careRows = await db
    .select({
      id: productCareCodes.id,
      product_id: productCareCodes.productId,
      care_code_id: productCareCodes.careCodeId,
      code: careCodes.code,
      name: careCodes.name,
    })
    .from(productCareCodes)
    .leftJoin(careCodes, eq(careCodes.id, productCareCodes.careCodeId))
    .where(inArray(productCareCodes.productId, [...productIds]))
    .orderBy(asc(productCareCodes.createdAt));

  for (const row of careRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.careCodes.push({
      id: row.id,
      care_code_id: row.care_code_id,
      code: row.code ?? null,
      name: row.name ?? null,
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
  if (filters.season) whereClauses.push(eq(products.season, filters.season));
  if (filters.search)
    whereClauses.push(ilike(products.name, `%${filters.search}%`));

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
      season: products.season,
      brand_certification_id: products.brandCertificationId,
      showcase_brand_id: products.showcaseBrandId,
      primary_image_url: products.primaryImageUrl,
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
    description?: string;
    categoryId?: string;
    season?: string;
    brandCertificationId?: string;
    showcaseBrandId?: string;
    primaryImageUrl?: string;
  },
) {
  let created: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        brandId,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brandCertificationId ?? null,
        showcaseBrandId: input.showcaseBrandId ?? null,
        primaryImageUrl: input.primaryImageUrl ?? null,
      })
      .returning({ id: products.id });
    created = row;
    if (row?.id) {
      // Evaluate only core module for product basics
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
    description?: string | null;
    categoryId?: string | null;
    season?: string | null;
    brandCertificationId?: string | null;
    showcaseBrandId?: string | null;
    primaryImageUrl?: string | null;
  },
) {
  let updated: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(products)
      .set({
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brandCertificationId ?? null,
        showcaseBrandId: input.showcaseBrandId ?? null,
        primaryImageUrl: input.primaryImageUrl ?? null,
      })
      .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
      .returning({ id: products.id });
    updated = row;
    if (row?.id) {
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

export async function upsertProductIdentifier(
  db: Database,
  productId: string,
  idType: string,
  value: string,
) {
  // Rely on unique index (product_id, id_type, value); duplicate inserts will error; emulate upsert via delete+insert minimalism.
  // First ensure no exact duplicate exists; if exists, return quickly.
  const existing = await db
    .select({ id: productIdentifiers.id })
    .from(productIdentifiers)
    .where(
      and(
        eq(productIdentifiers.productId, productId),
        eq(productIdentifiers.idType, idType),
        eq(productIdentifiers.value, value),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(productIdentifiers)
    .values({ productId, idType, value })
    .returning({ id: productIdentifiers.id });
  return row;
}

// Variants
export async function listVariants(db: Database, productId: string) {
  return db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      sku: productVariants.sku,
      upid: productVariants.upid,
      product_image_url: productVariants.productImageUrl,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.createdAt));
}

export async function createVariant(
  db: Database,
  productId: string,
  input: {
    colorId?: string;
    sizeId?: string;
    sku?: string;
    upid: string;
    productImageUrl?: string;
  },
) {
  let created: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productVariants)
      .values({
        productId,
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        sku: input.sku ?? null,
        upid: input.upid,
        productImageUrl: input.productImageUrl ?? null,
      })
      .returning({ id: productVariants.id });
    created = row;
    if (row?.id) {
      // Need brandId for evaluator: read via product
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return created;
}

export async function updateVariant(
  db: Database,
  id: string,
  input: {
    colorId?: string | null;
    sizeId?: string | null;
    sku?: string | null;
    upid?: string;
    productImageUrl?: string | null;
  },
) {
  let updated: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(productVariants)
      .set({
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        sku: input.sku ?? null,
        upid: input.upid,
        productImageUrl: input.productImageUrl ?? null,
      })
      .where(eq(productVariants.id, id))
      .returning({
        id: productVariants.id,
        productId: productVariants.productId,
      });
    updated = row ? { id: row.id } : undefined;
    if (row?.productId) {
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, row.productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          row.productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return updated;
}

export async function deleteVariant(db: Database, id: string) {
  const [row] = await db
    .delete(productVariants)
    .where(eq(productVariants.id, id))
    .returning({ id: productVariants.id });
  return row;
}

export async function upsertVariantIdentifier(
  db: Database,
  variantId: string,
  idType: string,
  value: string,
) {
  const existing = await db
    .select({ id: productVariantIdentifiers.id })
    .from(productVariantIdentifiers)
    .where(
      and(
        eq(productVariantIdentifiers.variantId, variantId),
        eq(productVariantIdentifiers.idType, idType),
        eq(productVariantIdentifiers.value, value),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(productVariantIdentifiers)
    .values({ variantId, idType, value })
    .returning({ id: productVariantIdentifiers.id });
  return row;
}

export async function listProductVariantsForBrand(
  db: Database,
  brandId: string,
  productId: string,
): Promise<ProductVariantSummary[]> {
  await ensureProductBelongsToBrand(db, brandId, productId);
  const variantsMap = await loadVariantsForProducts(db, [productId]);
  return variantsMap.get(productId) ?? [];
}

export async function upsertProductVariantsForBrand(
  db: Database,
  brandId: string,
  productId: string,
  variants: ReadonlyArray<{
    id?: string;
    color_id?: string | null;
    size_id?: string | null;
    sku?: string | null;
    upid?: string;
    product_image_url?: string | null;
  }>,
): Promise<VariantUpsertResult[]> {
  if (variants.length === 0) return [];
  await ensureProductBelongsToBrand(db, brandId, productId);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: productVariants.id,
        product_id: productVariants.productId,
        upid: productVariants.upid,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    type VariantLookup = {
      id: string;
      product_id: string;
      upid: string;
    };

    const byId = new Map<string, VariantLookup>();
    const byUpid = new Map<string, VariantLookup>();

    for (const row of existing) {
      const lookup: VariantLookup = {
        id: row.id,
        product_id: row.product_id,
        upid: row.upid,
      };
      byId.set(row.id, lookup);
      byUpid.set(row.upid, lookup);
    }

    const results: VariantUpsertResult[] = [];
    let mutated = false;

    for (let index = 0; index < variants.length; index += 1) {
      const input = variants[index]!;
      const reference =
        input.id ?? input.upid ?? `index:${index.toString().padStart(2, "0")}`;
      try {
        let target: VariantLookup | undefined;
        if (input.id) {
          target = byId.get(input.id);
        }
        if (!target && input.upid) {
          target = byUpid.get(input.upid);
        }

        if (!target) {
          if (!input.upid) {
            throw new Error(
              "New variants require an `upid` to ensure stable identity.",
            );
          }

          const [created] = await tx
            .insert(productVariants)
            .values({
              productId,
              colorId: input.color_id ?? null,
              sizeId: input.size_id ?? null,
              sku: input.sku ?? null,
              upid: input.upid,
              productImageUrl: input.product_image_url ?? null,
            })
            .returning({ id: productVariants.id });

          if (!created?.id) {
            throw new Error("Failed to create product variant.");
          }

          const lookup: VariantLookup = {
            id: created.id,
            product_id: productId,
            upid: input.upid,
          };
          byId.set(created.id, lookup);
          byUpid.set(input.upid, lookup);

          results.push({
            reference,
            variant_id: created.id,
            status: "created",
          });
          mutated = true;
          continue;
        }

        const updateValues: Partial<typeof productVariants.$inferInsert> = {};
        const hasOwn = Object.prototype.hasOwnProperty;

        if (hasOwn.call(input, "color_id")) {
          updateValues.colorId = input.color_id ?? null;
        }
        if (hasOwn.call(input, "size_id")) {
          updateValues.sizeId = input.size_id ?? null;
        }
        if (hasOwn.call(input, "sku")) {
          updateValues.sku = input.sku ?? null;
        }
        if (hasOwn.call(input, "product_image_url")) {
          updateValues.productImageUrl = input.product_image_url ?? null;
        }
        if (hasOwn.call(input, "upid") && input.upid) {
          updateValues.upid = input.upid;
          byUpid.delete(target.upid);
          byUpid.set(input.upid, {
            id: target.id,
            product_id: target.product_id,
            upid: input.upid,
          });
        }

        if (Object.keys(updateValues).length > 0) {
          await tx
            .update(productVariants)
            .set(updateValues)
            .where(eq(productVariants.id, target.id));
          mutated = true;
        }

        results.push({
          reference,
          variant_id: target.id,
          status: "updated",
        });
      } catch (error) {
        results.push({
          reference,
          status: "error",
          error:
            error instanceof Error ? error.message : "Unknown variant error",
        });
      }
    }

    if (mutated) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }

    return results;
  });
}

export async function deleteProductVariantsForBrand(
  db: Database,
  brandId: string,
  input:
    | {
        variant_ids: readonly string[];
      }
    | {
        product_id: string;
        filter?: {
          color_id?: string;
          size_id?: string;
        };
      },
): Promise<number> {
  return db.transaction(async (tx) => {
    let affected = 0;
    const impactedProducts = new Set<string>();

    if ("variant_ids" in input) {
      if (input.variant_ids.length === 0) return 0;
      const rows = await tx
        .select({
          id: productVariants.id,
          product_id: productVariants.productId,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            inArray(productVariants.id, [...input.variant_ids]),
            eq(products.brandId, brandId),
          ),
        );

      const idsToDelete = rows.map((row) => row.id);
      for (const row of rows) {
        impactedProducts.add(row.product_id);
      }

      if (idsToDelete.length === 0) {
        return 0;
      }

      const deleted = await tx
        .delete(productVariants)
        .where(inArray(productVariants.id, idsToDelete))
        .returning({ id: productVariants.id });
      affected = deleted.length;
    } else {
      await ensureProductBelongsToBrand(
        tx as unknown as Database,
        brandId,
        input.product_id,
      );

      const conditions = [eq(productVariants.productId, input.product_id)];

      if (input.filter?.color_id) {
        conditions.push(eq(productVariants.colorId, input.filter.color_id));
      }
      if (input.filter?.size_id) {
        conditions.push(eq(productVariants.sizeId, input.filter.size_id));
      }

      const deleted = await tx
        .delete(productVariants)
        .where(and(...conditions))
        .returning({ id: productVariants.id });
      affected = deleted.length;
      if (affected > 0) {
        impactedProducts.add(input.product_id);
      }
    }

    if (affected > 0) {
      for (const productId of impactedProducts) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }

    return affected;
  });
}
