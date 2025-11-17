import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
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
  products,
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
  productIdentifier?: string | null;
  productUpid?: string | null; // Product-level UPID for passport URLs
  name: string;
  description?: string | null;
  showcaseBrandId?: string | null;
  primaryImageUrl?: string | null;
  categoryId?: string | null;
  seasonId?: string | null; // FK to brand_seasons.id
  templateId?: string | null; // FK to passport_templates.id
  status?: string | null; // Product publication status
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
  upid: string;
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
  /** Product identifier for the product (brand-scoped) */
  productIdentifier?: string | null;
  /** Product-level UPID for passport URLs */
  productUpid?: string | null;
  name: string;
  description: string | null;
  showcaseBrandId: string | null;
  primaryImageUrl: string | null;
  categoryId: string | null;
  seasonId: string | null; // FK to brand_seasons.id
  templateId: string | null; // FK to passport_templates.id
  status: string | null; // Product publication status
  createdAt: string;
  variant: StagingVariantPreview | null;
  materials: StagingMaterialPreview[];
  ecoClaims: StagingEcoClaimPreview[];
  journeySteps: StagingJourneyStepPreview[];
  environment: StagingEnvironmentPreview | null;
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
  upid: string;
  createdAt: string;
}

export interface StagingMaterialPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  brandMaterialId: string;
  percentage: string | null;
  createdAt: string;
}

export interface StagingEcoClaimPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  ecoClaimId: string;
  createdAt: string;
}

export interface StagingJourneyStepPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  sortIndex: number;
  stepType: string;
  facilityId: string;
  createdAt: string;
}

export interface StagingEnvironmentPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  carbonKgCo2e: string | null;
  waterLiters: string | null;
  createdAt: string;
}

type StagingProductRow = typeof stagingProducts.$inferSelect;

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
      productIdentifier: params.productIdentifier ?? null,
      productUpid: params.productUpid ?? null,
      name: params.name,
      description: params.description ?? null,
      showcaseBrandId: params.showcaseBrandId ?? null,
      primaryImageUrl: params.primaryImageUrl ?? null,
      categoryId: params.categoryId ?? null,
      seasonId: params.seasonId ?? null,
      templateId: params.templateId ?? null,
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
    productIdentifier: p.productIdentifier ?? null,
    productUpid: p.productUpid ?? null,
    name: p.name,
    description: p.description ?? null,
    showcaseBrandId: p.showcaseBrandId ?? null,
    primaryImageUrl: p.primaryImageUrl ?? null,
    categoryId: p.categoryId ?? null,
    seasonId: p.seasonId ?? null, // Legacy: kept for backward compatibility
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
      upid: params.upid,
      // Variant productImageUrl removed
      // Variant status removed
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
    upid: v.upid,
    // Variant productImageUrl removed
    // Variant status removed
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

  return {
    products: await hydrateStagingProductPreviews(db, jobId, products),
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
  chunkSize = 500,
): Promise<number> {
  const safeChunkSize = Math.max(chunkSize, 100);
  let totalDeleted = 0;

  while (true) {
    const chunkIds = await db
      .select({ stagingId: stagingProducts.stagingId })
      .from(stagingProducts)
      .where(eq(stagingProducts.jobId, jobId))
      .limit(safeChunkSize);

    if (chunkIds.length === 0) {
      break;
    }

    const deleted = await db
      .delete(stagingProducts)
      .where(
        inArray(
          stagingProducts.stagingId,
          chunkIds.map((row) => row.stagingId),
        ),
      )
      .returning({ stagingId: stagingProducts.stagingId });

    totalDeleted += deleted.length;

    if (deleted.length < safeChunkSize) {
      // Final chunk removed fewer rows than requested; exit early
      break;
    }
  }

  return totalDeleted;
}

/**
 * Bulk creates products for CREATE staging rows using planned IDs.
 *
 * Inserts rows directly into products table and re-evaluates completion state
 * for the core module to mimic createProduct side effects.
 */
export async function bulkCreateProductsFromStaging(
  db: Database,
  brandId: string,
  rows: StagingProductPreview[],
  options?: { skipCompletionEval?: boolean },
): Promise<Map<string, string>> {
  if (rows.length === 0) {
    return new Map();
  }

  const insertValues = rows.map((row) => ({
    id: row.id,
    brandId: row.brandId ?? brandId,
    name: row.name,
    // Use provided productIdentifier or fallback to a generated one based on the planned id
    productIdentifier: row.productIdentifier ?? `PROD-${row.id.slice(0, 8)}`,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    season: row.season ?? null,
    seasonId: row.seasonId ?? null,
    showcaseBrandId: row.showcaseBrandId ?? null,
    primaryImageUrl: row.primaryImageUrl ?? null,
  }));

  await db.transaction(async (tx) => {
    await tx.insert(products).values(insertValues).onConflictDoNothing();

    if (!options?.skipCompletionEval) {
      for (const row of rows) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          row.id,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.stagingId, row.id);
  }

  return map;
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
 * @param cursorRowNumber - Last processed row number for keyset pagination
 * @returns Array of staging products
 */
export async function getStagingProductsForCommit(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
  limit = 100,
  cursorRowNumber?: number,
): Promise<StagingProductPreview[]> {
  const whereClause =
    typeof cursorRowNumber === "number"
      ? and(
          eq(stagingProducts.jobId, jobId),
          gt(stagingProducts.rowNumber, cursorRowNumber),
        )
      : eq(stagingProducts.jobId, jobId);

  const products = await db
    .select()
    .from(stagingProducts)
    .where(whereClause)
    .orderBy(asc(stagingProducts.rowNumber))
    .limit(limit);
  return hydrateStagingProductPreviews(db, jobId, products);
}

async function hydrateStagingProductPreviews(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
  products: StagingProductRow[],
): Promise<StagingProductPreview[]> {
  if (products.length === 0) {
    return [];
  }

  const stagingIds = products.map((p) => p.stagingId);

  const [variants, materials, ecoClaims, journeySteps, environments] =
    await Promise.all([
      db
        .select()
        .from(stagingProductVariants)
        .where(
          and(
            eq(stagingProductVariants.jobId, jobId),
            inArray(stagingProductVariants.stagingProductId, stagingIds),
          ),
        ),
      db
        .select()
        .from(stagingProductMaterials)
        .where(
          and(
            eq(stagingProductMaterials.jobId, jobId),
            inArray(stagingProductMaterials.stagingProductId, stagingIds),
          ),
        )
        .orderBy(asc(stagingProductMaterials.createdAt)),
      db
        .select()
        .from(stagingProductEcoClaims)
        .where(
          and(
            eq(stagingProductEcoClaims.jobId, jobId),
            inArray(stagingProductEcoClaims.stagingProductId, stagingIds),
          ),
        )
        .orderBy(asc(stagingProductEcoClaims.createdAt)),
      db
        .select()
        .from(stagingProductJourneySteps)
        .where(
          and(
            eq(stagingProductJourneySteps.jobId, jobId),
            inArray(stagingProductJourneySteps.stagingProductId, stagingIds),
          ),
        )
        .orderBy(asc(stagingProductJourneySteps.sortIndex)),
      db
        .select()
        .from(stagingProductEnvironment)
        .where(
          and(
            eq(stagingProductEnvironment.jobId, jobId),
            inArray(stagingProductEnvironment.stagingProductId, stagingIds),
          ),
        ),
    ]);

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
      upid: v.upid,
      status: v.status,
      productImageUrl: v.productImageUrl,
      createdAt: v.createdAt,
    });
  }

  const materialMap = new Map<string, StagingMaterialPreview[]>();
  for (const material of materials) {
    const list = materialMap.get(material.stagingProductId) ?? [];
    list.push({
      stagingId: material.stagingId,
      stagingProductId: material.stagingProductId,
      jobId: material.jobId,
      brandMaterialId: material.brandMaterialId,
      percentage: material.percentage ?? null,
      createdAt: material.createdAt,
    });
    materialMap.set(material.stagingProductId, list);
  }

  const ecoClaimMap = new Map<string, StagingEcoClaimPreview[]>();
  for (const ecoClaim of ecoClaims) {
    const list = ecoClaimMap.get(ecoClaim.stagingProductId) ?? [];
    list.push({
      stagingId: ecoClaim.stagingId,
      stagingProductId: ecoClaim.stagingProductId,
      jobId: ecoClaim.jobId,
      ecoClaimId: ecoClaim.ecoClaimId,
      createdAt: ecoClaim.createdAt,
    });
    ecoClaimMap.set(ecoClaim.stagingProductId, list);
  }

  const journeyStepMap = new Map<string, StagingJourneyStepPreview[]>();
  for (const step of journeySteps) {
    const list = journeyStepMap.get(step.stagingProductId) ?? [];
    list.push({
      stagingId: step.stagingId,
      stagingProductId: step.stagingProductId,
      jobId: step.jobId,
      sortIndex: step.sortIndex,
      stepType: step.stepType,
      facilityId: step.facilityId,
      createdAt: step.createdAt,
    });
    journeyStepMap.set(step.stagingProductId, list);
  }

  const environmentMap = new Map<string, StagingEnvironmentPreview>();
  for (const environment of environments) {
    environmentMap.set(environment.stagingProductId, {
      stagingId: environment.stagingId,
      stagingProductId: environment.stagingProductId,
      jobId: environment.jobId,
      carbonKgCo2e: environment.carbonKgCo2e ?? null,
      waterLiters: environment.waterLiters ?? null,
      createdAt: environment.createdAt,
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
    productIdentifier: p.productIdentifier,
    productUpid: p.productUpid,
    name: p.name,
    description: p.description,
    showcaseBrandId: p.showcaseBrandId,
    primaryImageUrl: p.primaryImageUrl,
    categoryId: p.categoryId,
    season: p.season,
    seasonId: p.seasonId,
    status: p.status,
    createdAt: p.createdAt,
    variant: variantMap.get(p.stagingId) ?? null,
    materials: materialMap.get(p.stagingId) ?? [],
    ecoClaims: ecoClaimMap.get(p.stagingId) ?? [],
    journeySteps: journeyStepMap.get(p.stagingId) ?? [],
    environment: environmentMap.get(p.stagingId) ?? null,
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

/**
 * Batch insert staging products, variants, and update import row statuses
 * in a single database round trip using a PostgreSQL function.
 *
 * This function significantly reduces network latency overhead by combining
 * three separate database operations into one.
 *
 * Performance: ~40% faster than individual inserts in production (3 round trips → 1)
 *
 * @param db - Database instance or transaction
 * @param products - Array of staging product parameters
 * @param variants - Array of staging variant parameters (must match products array order)
 * @param statusUpdates - Array of import row status updates
 * @returns Object with counts and IDs of inserted/updated records
 */
export async function batchInsertStagingWithStatus(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
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
    productIdentifier: p.productIdentifier ?? null,
    productUpid: p.productUpid ?? null,
    name: p.name,
    description: p.description ?? null,
    showcaseBrandId: p.showcaseBrandId ?? null,
    primaryImageUrl: p.primaryImageUrl ?? null,
    categoryId: p.categoryId ?? null,
    seasonId: p.seasonId ?? null,
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
    // Variant productImageUrl removed
    // Variant status removed
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
