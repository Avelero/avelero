import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  stagingProducts,
  stagingProductVariants,
  stagingProductMaterials,
  stagingProductCareCodes,
  stagingProductEcoClaims,
  stagingProductJourneySteps,
  stagingProductEnvironment,
  stagingProductIdentifiers,
  stagingProductVariantIdentifiers,
} from "../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/**
 * Staging product insertion parameters
 */
export interface InsertStagingProductParams {
  jobId: string;
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP";
  existingProductId?: string | null;
  id: string;
  brandId: string;
  name: string;
  description?: string | null;
  showcaseBrandId?: string | null;
  primaryImageUrl?: string | null;
  additionalImageUrls?: string | null;
  categoryId?: string | null;
  season?: string | null; // Legacy: will be deprecated after migration
  seasonId?: string | null; // FK to brand_seasons.id
  tags?: string | null;
  brandCertificationId?: string | null;
}

/**
 * Staging product variant insertion parameters
 */
export interface InsertStagingVariantParams {
  stagingProductId: string;
  jobId: string;
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP";
  existingVariantId?: string | null;
  id: string;
  productId: string;
  colorId?: string | null;
  sizeId?: string | null;
  sku?: string | null;
  ean?: string | null;
  upid: string;
  productImageUrl?: string | null;
  status?: string | null;
}

/**
 * Staging product material insertion parameters
 */
export interface InsertStagingMaterialParams {
  stagingProductId: string;
  jobId: string;
  brandMaterialId: string;
  percentage?: string | null;
}

/**
 * Staging product care code insertion parameters
 */
export interface InsertStagingCareCodeParams {
  stagingProductId: string;
  jobId: string;
  careCodeId: string;
}

/**
 * Staging product eco claim insertion parameters
 */
export interface InsertStagingEcoClaimParams {
  stagingProductId: string;
  jobId: string;
  ecoClaimId: string;
}

/**
 * Staging product journey step insertion parameters
 */
export interface InsertStagingJourneyStepParams {
  stagingProductId: string;
  jobId: string;
  sortIndex: number;
  stepType: string;
  facilityId: string;
}

/**
 * Staging product environment insertion parameters
 */
export interface InsertStagingEnvironmentParams {
  stagingProductId: string;
  jobId: string;
  carbonKgCo2e?: string | null;
  waterLiters?: string | null;
}

/**
 * Staging product identifier insertion parameters
 */
export interface InsertStagingIdentifierParams {
  stagingProductId: string;
  jobId: string;
  idType: string;
  value: string;
}

/**
 * Staging product variant identifier insertion parameters
 */
export interface InsertStagingVariantIdentifierParams {
  stagingVariantId: string;
  jobId: string;
  idType: string;
  value: string;
}

/**
 * Staging product preview data
 */
export interface StagingProductPreview {
  stagingId: string;
  jobId: string;
  rowNumber: number;
  action: string;
  existingProductId: string | null;
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  showcaseBrandId: string | null;
  primaryImageUrl: string | null;
  additionalImageUrls: string | null;
  tags: string | null;
  categoryId: string | null;
  season: string | null; // Legacy: will be deprecated after migration
  seasonId: string | null; // FK to brand_seasons.id
  brandCertificationId: string | null;
  createdAt: string;
  variant?: StagingVariantPreview | null;
}

/**
 * Staging variant preview data
 */
export interface StagingVariantPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  rowNumber: number;
  action: string;
  existingVariantId: string | null;
  id: string;
  productId: string;
  colorId: string | null;
  sizeId: string | null;
  sku: string | null;
  ean: string | null;
  upid: string;
  status: string | null;
  productImageUrl: string | null;
  createdAt: string;
}

/**
 * Action count summary
 */
export interface ActionCounts {
  create: number;
  update: number;
  total: number;
}

/**
 * Inserts a staging product record
 *
 * @param db - Database instance or transaction
 * @param params - Staging product parameters
 * @returns Created staging product ID
 */
export async function insertStagingProduct(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  params: InsertStagingProductParams,
): Promise<string> {
  const results = await db
    .insert(stagingProducts)
    .values({
      jobId: params.jobId,
      rowNumber: params.rowNumber,
      action: params.action,
      existingProductId: params.existingProductId ?? null,
      id: params.id,
      brandId: params.brandId,
      name: params.name,
      description: params.description ?? null,
      showcaseBrandId: params.showcaseBrandId ?? null,
      primaryImageUrl: params.primaryImageUrl ?? null,
      additionalImageUrls: params.additionalImageUrls ?? null,
      categoryId: params.categoryId ?? null,
      season: params.season ?? null, // Legacy: kept for backward compatibility
      seasonId: params.seasonId ?? null,
      tags: params.tags ?? null,
      brandCertificationId: params.brandCertificationId ?? null,
    })
    .returning({ stagingId: stagingProducts.stagingId });

  const result = results[0];

  if (!result) {
    throw new Error("Failed to insert staging product");
  }

  return result.stagingId;
}

/**
 * Inserts multiple staging products in batch
 *
 * @param db - Database instance or transaction
 * @param products - Array of staging product parameters
 * @returns Array of created staging product IDs
 */
export async function batchInsertStagingProducts(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  products: InsertStagingProductParams[],
): Promise<string[]> {
  if (products.length === 0) {
    return [];
  }

  const values = products.map((p) => ({
    jobId: p.jobId,
    rowNumber: p.rowNumber,
    action: p.action,
    existingProductId: p.existingProductId ?? null,
    id: p.id,
    brandId: p.brandId,
    name: p.name,
    description: p.description ?? null,
    showcaseBrandId: p.showcaseBrandId ?? null,
    primaryImageUrl: p.primaryImageUrl ?? null,
    additionalImageUrls: p.additionalImageUrls ?? null,
    categoryId: p.categoryId ?? null,
    season: p.season ?? null, // Legacy: kept for backward compatibility
    seasonId: p.seasonId ?? null,
    tags: p.tags ?? null,
    brandCertificationId: p.brandCertificationId ?? null,
  }));

  const results = await db
    .insert(stagingProducts)
    .values(values)
    .returning({ stagingId: stagingProducts.stagingId });

  return results.map((r) => r.stagingId);
}

/**
 * Inserts a staging product variant record
 *
 * @param db - Database instance or transaction
 * @param params - Staging variant parameters
 * @returns Created staging variant ID
 */
export async function insertStagingVariant(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  params: InsertStagingVariantParams,
): Promise<string> {
  const results = await db
    .insert(stagingProductVariants)
    .values({
      stagingProductId: params.stagingProductId,
      jobId: params.jobId,
      rowNumber: params.rowNumber,
      action: params.action,
      existingVariantId: params.existingVariantId ?? null,
      id: params.id,
      productId: params.productId,
      colorId: params.colorId ?? null,
      sizeId: params.sizeId ?? null,
      sku: params.sku ?? null,
      ean: params.ean ?? null,
      upid: params.upid,
      productImageUrl: params.productImageUrl ?? null,
      status: params.status ?? null,
    })
    .returning({ stagingId: stagingProductVariants.stagingId });

  const result = results[0];

  if (!result) {
    throw new Error("Failed to insert staging variant");
  }

  return result.stagingId;
}

/**
 * Inserts multiple staging variants in batch
 *
 * @param db - Database instance or transaction
 * @param variants - Array of staging variant parameters
 * @returns Array of created staging variant IDs
 */
export async function batchInsertStagingVariants(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  variants: InsertStagingVariantParams[],
): Promise<string[]> {
  if (variants.length === 0) {
    return [];
  }

  const values = variants.map((v) => ({
    stagingProductId: v.stagingProductId,
    jobId: v.jobId,
    rowNumber: v.rowNumber,
    action: v.action,
    existingVariantId: v.existingVariantId ?? null,
    id: v.id,
    productId: v.productId,
    colorId: v.colorId ?? null,
    sizeId: v.sizeId ?? null,
    sku: v.sku ?? null,
    ean: v.ean ?? null,
    upid: v.upid,
    productImageUrl: v.productImageUrl ?? null,
    status: v.status ?? null,
  }));

  const results = await db
    .insert(stagingProductVariants)
    .values(values)
    .returning({ stagingId: stagingProductVariants.stagingId });

  return results.map((r) => r.stagingId);
}

/**
 * Inserts staging product materials
 *
 * @param db - Database instance or transaction
 * @param materials - Array of material parameters
 * @returns Number of inserted records
 */
export async function insertStagingMaterials(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  materials: InsertStagingMaterialParams[],
): Promise<number> {
  if (materials.length === 0) {
    return 0;
  }

  const values = materials.map((m) => ({
    stagingProductId: m.stagingProductId,
    jobId: m.jobId,
    brandMaterialId: m.brandMaterialId,
    percentage: m.percentage ?? null,
  }));

  const results = await db
    .insert(stagingProductMaterials)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Inserts staging product care codes
 *
 * @param db - Database instance or transaction
 * @param careCodes - Array of care code parameters
 * @returns Number of inserted records
 */
export async function insertStagingCareCodes(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  careCodes: InsertStagingCareCodeParams[],
): Promise<number> {
  if (careCodes.length === 0) {
    return 0;
  }

  const values = careCodes.map((c) => ({
    stagingProductId: c.stagingProductId,
    jobId: c.jobId,
    careCodeId: c.careCodeId,
  }));

  const results = await db
    .insert(stagingProductCareCodes)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Inserts staging product eco claims
 *
 * @param db - Database instance or transaction
 * @param ecoClaims - Array of eco claim parameters
 * @returns Number of inserted records
 */
export async function insertStagingEcoClaims(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  ecoClaims: InsertStagingEcoClaimParams[],
): Promise<number> {
  if (ecoClaims.length === 0) {
    return 0;
  }

  const values = ecoClaims.map((e) => ({
    stagingProductId: e.stagingProductId,
    jobId: e.jobId,
    ecoClaimId: e.ecoClaimId,
  }));

  const results = await db
    .insert(stagingProductEcoClaims)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Inserts staging product journey steps
 *
 * @param db - Database instance or transaction
 * @param steps - Array of journey step parameters
 * @returns Number of inserted records
 */
export async function insertStagingJourneySteps(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  steps: InsertStagingJourneyStepParams[],
): Promise<number> {
  if (steps.length === 0) {
    return 0;
  }

  const values = steps.map((s) => ({
    stagingProductId: s.stagingProductId,
    jobId: s.jobId,
    sortIndex: s.sortIndex,
    stepType: s.stepType,
    facilityId: s.facilityId,
  }));

  const results = await db
    .insert(stagingProductJourneySteps)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Inserts staging product environment data
 *
 * @param db - Database instance or transaction
 * @param environment - Environment data parameters
 * @returns Staging ID
 */
export async function insertStagingEnvironment(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  environment: InsertStagingEnvironmentParams,
): Promise<string> {
  const results = await db
    .insert(stagingProductEnvironment)
    .values({
      stagingProductId: environment.stagingProductId,
      jobId: environment.jobId,
      carbonKgCo2e: environment.carbonKgCo2e ?? null,
      waterLiters: environment.waterLiters ?? null,
    })
    .returning({ stagingId: stagingProductEnvironment.stagingId });

  const result = results[0];

  if (!result) {
    throw new Error("Failed to insert staging environment");
  }

  return result.stagingId;
}

/**
 * Inserts staging product identifiers
 *
 * @param db - Database instance or transaction
 * @param identifiers - Array of identifier parameters
 * @returns Number of inserted records
 */
export async function insertStagingIdentifiers(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  identifiers: InsertStagingIdentifierParams[],
): Promise<number> {
  if (identifiers.length === 0) {
    return 0;
  }

  const values = identifiers.map((i) => ({
    stagingProductId: i.stagingProductId,
    jobId: i.jobId,
    idType: i.idType,
    value: i.value,
  }));

  const results = await db
    .insert(stagingProductIdentifiers)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Inserts staging product variant identifiers
 *
 * @param db - Database instance or transaction
 * @param identifiers - Array of variant identifier parameters
 * @returns Number of inserted records
 */
export async function insertStagingVariantIdentifiers(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  identifiers: InsertStagingVariantIdentifierParams[],
): Promise<number> {
  if (identifiers.length === 0) {
    return 0;
  }

  const values = identifiers.map((i) => ({
    stagingVariantId: i.stagingVariantId,
    jobId: i.jobId,
    idType: i.idType,
    value: i.value,
  }));

  const results = await db
    .insert(stagingProductVariantIdentifiers)
    .values(values)
    .returning();
  return results.length;
}

/**
 * Retrieves staging product preview with pagination
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @param limit - Maximum number of products to return
 * @param offset - Number of products to skip
 * @returns Paginated staging products with variants
 */
export async function getStagingPreview(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
  limit = 100,
  offset = 0,
): Promise<{ products: StagingProductPreview[]; total: number }> {
  // Get total count
  const countResult = await db
    .select({ value: count() })
    .from(stagingProducts)
    .where(eq(stagingProducts.jobId, jobId));

  const total = countResult[0]?.value ?? 0;

  // Get paginated products
  const products = await db
    .select()
    .from(stagingProducts)
    .where(eq(stagingProducts.jobId, jobId))
    .orderBy(asc(stagingProducts.rowNumber))
    .limit(limit)
    .offset(offset);

  // Get variants for these products
  const stagingIds = products.map((p) => p.stagingId);
  const variants =
    stagingIds.length > 0
      ? await db
          .select()
          .from(stagingProductVariants)
          .where(
            and(
              eq(stagingProductVariants.jobId, jobId),
              inArray(stagingProductVariants.stagingProductId, stagingIds),
            ),
          )
      : [];

  // Map variants to products
  const variantMap = new Map<string, StagingVariantPreview>();
  for (const v of variants) {
    variantMap.set(v.stagingProductId, {
      stagingId: v.stagingId,
      stagingProductId: v.stagingProductId,
      jobId: v.jobId,
      rowNumber: v.rowNumber,
      action: v.action,
      existingVariantId: v.existingVariantId,
      id: v.id,
      productId: v.productId,
      colorId: v.colorId,
      sizeId: v.sizeId,
      sku: v.sku,
      ean: v.ean,
      upid: v.upid,
      status: v.status,
      productImageUrl: v.productImageUrl,
      createdAt: v.createdAt,
    });
  }

  return {
    products: products.map((p) => ({
      stagingId: p.stagingId,
      jobId: p.jobId,
      rowNumber: p.rowNumber,
      action: p.action,
      existingProductId: p.existingProductId,
      id: p.id,
      brandId: p.brandId,
      name: p.name,
      description: p.description,
      showcaseBrandId: p.showcaseBrandId,
      additionalImageUrls: p.additionalImageUrls,
      tags: p.tags,
      primaryImageUrl: p.primaryImageUrl,
      categoryId: p.categoryId,
      season: p.season, // Legacy: kept for backward compatibility
      seasonId: p.seasonId,
      brandCertificationId: p.brandCertificationId,
      createdAt: p.createdAt,
      variant: variantMap.get(p.stagingId) ?? null,
    })),
    total,
  };
}

/**
 * Deletes all staging data for a specific import job
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Number of deleted staging products
 */
export async function deleteStagingDataForJob(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
): Promise<number> {
  // Delete from all staging tables
  // Due to CASCADE constraints, deleting staging_products will cascade to all related tables
  const deleted = await db
    .delete(stagingProducts)
    .where(eq(stagingProducts.jobId, jobId))
    .returning({ stagingId: stagingProducts.stagingId });

  return deleted.length;
}

/**
 * Counts staging products by action type (CREATE/UPDATE)
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Action counts
 */
export async function countStagingProductsByAction(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
): Promise<ActionCounts> {
  const results = await db
    .select({
      action: stagingProducts.action,
      count: count(),
    })
    .from(stagingProducts)
    .where(eq(stagingProducts.jobId, jobId))
    .groupBy(stagingProducts.action);

  const counts = {
    create: 0,
    update: 0,
    total: 0,
  };

  for (const row of results) {
    const actionCount = row.count;
    if (row.action === "CREATE") {
      counts.create = actionCount;
    } else if (row.action === "UPDATE") {
      counts.update = actionCount;
    }
    counts.total += actionCount;
  }

  return counts;
}

/**
 * Gets all staging products for a job (for commit phase)
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @param limit - Batch size
 * @param offset - Batch offset
 * @returns Array of staging products
 */
export async function getStagingProductsForCommit(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
  limit = 100,
  offset = 0,
): Promise<StagingProductPreview[]> {
  const products = await db
    .select()
    .from(stagingProducts)
    .where(eq(stagingProducts.jobId, jobId))
    .orderBy(asc(stagingProducts.rowNumber))
    .limit(limit)
    .offset(offset);

  // Get variants for these products
  const stagingIds = products.map((p) => p.stagingId);
  const variants =
    stagingIds.length > 0
      ? await db
          .select()
          .from(stagingProductVariants)
          .where(
            and(
              eq(stagingProductVariants.jobId, jobId),
              inArray(stagingProductVariants.stagingProductId, stagingIds),
            ),
          )
      : [];

  // Map variants to products
  const variantMap = new Map<string, StagingVariantPreview>();
  for (const v of variants) {
    variantMap.set(v.stagingProductId, {
      stagingId: v.stagingId,
      stagingProductId: v.stagingProductId,
      jobId: v.jobId,
      rowNumber: v.rowNumber,
      action: v.action,
      existingVariantId: v.existingVariantId,
      id: v.id,
      productId: v.productId,
      colorId: v.colorId,
      sizeId: v.sizeId,
      sku: v.sku,
      ean: v.ean,
      upid: v.upid,
      status: v.status,
      productImageUrl: v.productImageUrl,
      createdAt: v.createdAt,
    });
  }

  return products.map((p) => ({
    stagingId: p.stagingId,
    jobId: p.jobId,
    rowNumber: p.rowNumber,
    action: p.action,
    existingProductId: p.existingProductId,
    id: p.id,
    brandId: p.brandId,
    name: p.name,
    description: p.description,
    showcaseBrandId: p.showcaseBrandId,
    primaryImageUrl: p.primaryImageUrl,
    additionalImageUrls: p.additionalImageUrls,
    tags: p.tags,
    categoryId: p.categoryId,
    season: p.season, // Legacy: kept for backward compatibility
    seasonId: p.seasonId,
    brandCertificationId: p.brandCertificationId,
    createdAt: p.createdAt,
    variant: variantMap.get(p.stagingId) ?? null,
  }));
}

/**
 * Get staging materials for a specific staging product
 *
 * @param db - Database instance or transaction
 * @param stagingProductId - Staging product ID
 * @returns Array of staging materials
 */
export async function getStagingMaterialsForProduct(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  stagingProductId: string,
) {
  return db
    .select()
    .from(stagingProductMaterials)
    .where(eq(stagingProductMaterials.stagingProductId, stagingProductId));
}

/**
 * Get staging eco-claims for a specific staging product
 *
 * @param db - Database instance or transaction
 * @param stagingProductId - Staging product ID
 * @returns Array of staging eco-claims
 */
export async function getStagingEcoClaimsForProduct(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  stagingProductId: string,
) {
  return db
    .select()
    .from(stagingProductEcoClaims)
    .where(eq(stagingProductEcoClaims.stagingProductId, stagingProductId));
}

/**
 * Get staging journey steps for a specific staging product
 *
 * @param db - Database instance or transaction
 * @param stagingProductId - Staging product ID
 * @returns Array of staging journey steps ordered by sortIndex
 */
export async function getStagingJourneyStepsForProduct(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  stagingProductId: string,
) {
  return db
    .select()
    .from(stagingProductJourneySteps)
    .where(eq(stagingProductJourneySteps.stagingProductId, stagingProductId))
    .orderBy(asc(stagingProductJourneySteps.sortIndex));
}

/**
 * Get staging environment data for a specific staging product
 *
 * @param db - Database instance or transaction
 * @param stagingProductId - Staging product ID
 * @returns Staging environment data or null
 */
export async function getStagingEnvironmentForProduct(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  stagingProductId: string,
) {
  const results = await db
    .select()
    .from(stagingProductEnvironment)
    .where(eq(stagingProductEnvironment.stagingProductId, stagingProductId))
    .limit(1);

  return results[0] || null;
}
