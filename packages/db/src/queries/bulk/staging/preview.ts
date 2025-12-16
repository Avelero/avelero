/**
 * Staging preview and query functions.
 * 
 * Handles retrieval of staging data for preview, counting, and hydration.
 */

import { and, asc, count, eq, inArray } from "drizzle-orm";
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
  ActionCounts,
  StagingProductPreview,
  StagingVariantPreview,
  StagingMaterialPreview,
  StagingEcoClaimPreview,
  StagingJourneyStepPreview,
  StagingEnvironmentPreview,
} from "./types.js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

type StagingProductRow = typeof stagingProducts.$inferSelect;

/**
 * Retrieves staging product preview with pagination
 */
export async function getStagingPreview(
  db: DbOrTx,
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
 * Counts staging products by action type (CREATE/UPDATE)
 */
export async function countStagingProductsByAction(
  db: DbOrTx,
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
 * Hydrates staging product rows with their related data (variants, materials, etc.)
 */
export async function hydrateStagingProductPreviews(
  db: DbOrTx,
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
      carbonKgCo2e: environment.carbonKgCo2E ?? null,
      waterLiters: environment.waterLiters ?? null,
      createdAt: environment.createdAt,
    });
  }

  for (const p of products) {
    if (!p.productHandle) {
      throw new Error(
        `Staging product ${p.stagingId} is missing productHandle`,
      );
    }
  }

  return products.map((p) => ({
    stagingId: p.stagingId,
    jobId: p.jobId,
    rowNumber: p.rowNumber,
    action: p.action,
    existingProductId: p.existingProductId,
    id: p.id,
    brandId: p.brandId,
    productHandle: p.productHandle as string,
    productUpid: p.productUpid,
    name: p.name,
    description: p.description,
    manufacturerId: p.manufacturerId,
    primaryImagePath: p.primaryImagePath,
    categoryId: p.categoryId,
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
 */
export async function getStagingMaterialsForProduct(
  db: DbOrTx,
  stagingProductId: string,
) {
  return db
    .select()
    .from(stagingProductMaterials)
    .where(eq(stagingProductMaterials.stagingProductId, stagingProductId));
}

/**
 * Get staging eco-claims for a specific staging product
 */
export async function getStagingEcoClaimsForProduct(
  db: DbOrTx,
  stagingProductId: string,
) {
  return db
    .select()
    .from(stagingProductEcoClaims)
    .where(eq(stagingProductEcoClaims.stagingProductId, stagingProductId));
}

/**
 * Get staging journey steps for a specific staging product
 */
export async function getStagingJourneyStepsForProduct(
  db: DbOrTx,
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
 */
export async function getStagingEnvironmentForProduct(
  db: DbOrTx,
  stagingProductId: string,
) {
  const results = await db
    .select()
    .from(stagingProductEnvironment)
    .where(eq(stagingProductEnvironment.stagingProductId, stagingProductId))
    .limit(1);

  return results[0] || null;
}

