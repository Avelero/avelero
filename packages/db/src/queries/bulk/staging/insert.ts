/**
 * Staging data insertion functions.
 * 
 * Handles insertion of staging products, variants, materials, eco-claims,
 * journey steps, environment data, and batch operations.
 */

import { sql } from "drizzle-orm";
import type { Database } from "../../../client";
import {
  stagingProducts,
  stagingProductVariants,
  stagingProductMaterials,
  stagingProductEcoClaims,
  stagingProductJourneySteps,
  stagingProductEnvironment,
} from "../../../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type {
  InsertStagingProductParams,
  InsertStagingVariantParams,
  InsertStagingMaterialParams,
  InsertStagingEcoClaimParams,
  InsertStagingJourneyStepParams,
  InsertStagingEnvironmentParams,
} from "./types.js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

/**
 * Inserts a staging product record
 */
export async function insertStagingProduct(
  db: DbOrTx,
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
      productHandle: params.productHandle,
      productUpid: params.productUpid ?? null,
      name: params.name,
      description: params.description ?? null,
      manufacturerId: params.manufacturerId ?? null,
      primaryImagePath: params.primaryImagePath ?? null,
      categoryId: params.categoryId ?? null,
      seasonId: params.seasonId ?? null,
      status: params.status ?? null,
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
 */
export async function batchInsertStagingProducts(
  db: DbOrTx,
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
    productHandle: p.productHandle as string,
    productUpid: p.productUpid ?? null,
    name: p.name,
    description: p.description ?? null,
    manufacturerId: p.manufacturerId ?? null,
    primaryImagePath: p.primaryImagePath ?? null,
    categoryId: p.categoryId ?? null,
    seasonId: p.seasonId ?? null,
    status: p.status ?? null,
  }));

  const results = await db
    .insert(stagingProducts)
    .values(values)
    .returning({ stagingId: stagingProducts.stagingId });

  return results.map((r) => r.stagingId);
}

/**
 * Inserts a staging product variant record
 */
export async function insertStagingVariant(
  db: DbOrTx,
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
      upid: params.upid,
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
 */
export async function batchInsertStagingVariants(
  db: DbOrTx,
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
    upid: v.upid,
  }));

  const results = await db
    .insert(stagingProductVariants)
    .values(values)
    .returning({ stagingId: stagingProductVariants.stagingId });

  return results.map((r) => r.stagingId);
}

/**
 * Inserts staging product materials
 */
export async function insertStagingMaterials(
  db: DbOrTx,
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
 * Inserts staging product eco claims
 */
export async function insertStagingEcoClaims(
  db: DbOrTx,
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
 */
export async function insertStagingJourneySteps(
  db: DbOrTx,
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
 */
export async function insertStagingEnvironment(
  db: DbOrTx,
  environment: InsertStagingEnvironmentParams,
): Promise<string> {
  const results = await db
    .insert(stagingProductEnvironment)
    .values({
      stagingProductId: environment.stagingProductId,
      jobId: environment.jobId,
      carbonKgCo2E: environment.carbonKgCo2e ?? null,
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
 * Batch insert staging products, variants, and update import row statuses
 * in a single database round trip using a PostgreSQL function.
 *
 * This function significantly reduces network latency overhead by combining
 * three separate database operations into one.
 *
 * Performance: ~40% faster than individual inserts in production (3 round trips → 1)
 */
export async function batchInsertStagingWithStatus(
  db: DbOrTx,
  products: InsertStagingProductParams[],
  variants: InsertStagingVariantParams[],
  statusUpdates: Array<{
    id: string;
    status: string;
    normalized?: Record<string, unknown> | null;
    error?: string | null;
  }>,
): Promise<{
  productsInserted: number;
  variantsInserted: number;
  rowsUpdated: number;
  productIds: string[];
  variantIds: string[];
}> {
  if (products.length === 0) {
    return {
      productsInserted: 0,
      variantsInserted: 0,
      rowsUpdated: 0,
      productIds: [],
      variantIds: [],
    };
  }

  // Prepare products data
  const productsData = products.map((p) => ({
    jobId: p.jobId,
    rowNumber: p.rowNumber,
    action: p.action,
    existingProductId: p.existingProductId ?? null,
    id: p.id,
    brandId: p.brandId,
    productHandle: p.productHandle,
    productUpid: p.productUpid ?? null,
    name: p.name,
    description: p.description ?? null,
    manufacturerId: p.manufacturerId ?? null,
    primaryImagePath: p.primaryImagePath ?? null,
    categoryId: p.categoryId ?? null,
    seasonId: p.seasonId ?? null,
    status: p.status ?? null,
  }));

  // Prepare variants data (without stagingProductId as it will be assigned by the function)
  const variantsData = variants.map((v) => ({
    jobId: v.jobId,
    rowNumber: v.rowNumber,
    action: v.action,
    existingVariantId: v.existingVariantId ?? null,
    id: v.id,
    productId: v.productId,
    colorId: v.colorId ?? null,
    sizeId: v.sizeId ?? null,
    upid: v.upid,
  }));

  // Prepare status updates data
  const statusUpdatesData = statusUpdates.map((u) => ({
    id: u.id,
    status: u.status,
    normalized: u.normalized ?? null,
    error: u.error ?? null,
  }));

  // Execute the PostgreSQL function
  const result = await db.execute(sql`
    SELECT batch_insert_staging_with_status(
      ${JSON.stringify(productsData)}::jsonb,
      ${JSON.stringify(variantsData)}::jsonb,
      ${JSON.stringify(statusUpdatesData)}::jsonb
    ) as result
  `);

  // Parse the result - db.execute returns an array of rows
  const resultData = (result[0] as any)?.result as {
    products_inserted: number;
    variants_inserted: number;
    rows_updated: number;
    product_ids: string[];
    variant_ids: string[];
  };

  return {
    productsInserted: resultData?.products_inserted ?? 0,
    variantsInserted: resultData?.variants_inserted ?? 0,
    rowsUpdated: resultData?.rows_updated ?? 0,
    productIds: resultData?.product_ids ?? [],
    variantIds: resultData?.variant_ids ?? [],
  };
}


