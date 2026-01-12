/**
 * Commit to Production Job (Optimized with Batch Operations)
 *
 * Phase 2 of the bulk import process:
 * 1. Loads staging data in batches of 250
 * 2. For each batch: generates UPIDs, processes images, commits to production
 * 3. Updates per-row status to COMMITTED or FAILED
 * 4. Deletes only COMMITTED rows (keeps FAILED for correction export)
 * 5. Revalidates DPP cache for the brand
 *
 * Key optimizations (matching integrations engine pattern):
 * - Processes products in batches of 250 (same as integrations)
 * - Each batch goes through complete cycle: load → images → commit
 * - Memory-efficient: only 250 products in memory at a time
 *
 * @module commit-to-production
 */

import "../configure-trigger";
import { createHash } from "node:crypto";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { generateUniqueUpids } from "@v1/db/utils";
import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import { revalidateBrand } from "../../lib/dpp-revalidation";

// ============================================================================
// Types
// ============================================================================

interface CommitToProductionPayload {
  jobId: string;
  brandId: string;
  /** User email for error report notifications (optional) */
  userEmail?: string | null;
  /** Whether validation found errors (to preserve hasExportableFailures) */
  hasValidationErrors?: boolean;
}

interface CommitStats {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsDeleted: number;
  tagsSet: number;
  attributesSet: number;
  materialsSet: number;
  ecoClaimsSet: number;
  environmentSet: number;
  journeyStepsSet: number;
  weightSet: number;
  imagesProcessed: number;
  imagesFailed: number;
}

/** Image upload task for rate-limited processing */
interface ImageUploadTask {
  type: "product" | "variant";
  entityId: string;
  imageUrl: string;
}

/** Aggregated staging data for a product */
interface StagingProductData {
  stagingId: string;
  rowNumber: number;
  action: string;
  existingProductId: string | null;
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  manufacturerId: string | null;
  imagePath: string | null;
  categoryId: string | null;
  seasonId: string | null;
  productHandle: string | null;
  status: string | null;
  variants: StagingVariantData[];
  tags: { tagId: string }[];
  // Product-level environmental/supply chain data (from parent row)
  materials: { brandMaterialId: string; percentage: string | null }[];
  ecoClaims: { ecoClaimId: string }[];
  environment: {
    carbonKgCo2E: string | null;
    waterLiters: string | null;
  } | null;
  journeySteps: { sortIndex: number; stepType: string; facilityId: string }[];
  weight: { weight: string | null; weightUnit: string | null } | null;
}

interface StagingVariantData {
  stagingId: string;
  rowNumber: number;
  action: string;
  existingVariantId: string | null;
  id: string;
  productId: string;
  upid: string | null;
  barcode: string | null;
  sku: string | null;
  nameOverride: string | null;
  descriptionOverride: string | null;
  imagePathOverride: string | null;
  attributes: {
    attributeId: string;
    attributeValueId: string;
    sortOrder: number;
  }[];
  materials: { brandMaterialId: string; percentage: string | null }[];
  ecoClaims: { ecoClaimId: string }[];
  environment: {
    carbonKgCo2e: string | null;
    waterLiters: string | null;
  } | null;
  journeySteps: { sortIndex: number; stepType: string; facilityId: string }[];
  weight: { weight: string | null; weightUnit: string | null } | null;
}

/** Pending production operations (computed phase, no DB calls) */
interface PendingProductionOps {
  productCreates: Array<{
    id: string;
    brandId: string;
    name: string;
    productHandle: string;
    description?: string;
    categoryId?: string;
    seasonId?: string;
    manufacturerId?: string;
    imagePath?: string;
    status: string;
  }>;
  productUpdates: Array<{
    id: string;
    data: Partial<{
      name: string;
      productHandle: string;
      description: string;
      categoryId: string;
      seasonId: string;
      manufacturerId: string;
      imagePath: string;
      status: string;
    }>;
  }>;
  variantCreates: Array<{
    id: string;
    productId: string;
    upid: string;
    barcode?: string;
    sku?: string;
    name?: string;
    description?: string;
    imagePath?: string;
  }>;
  variantUpdates: Array<{
    id: string;
    data: Partial<{
      upid: string;
      barcode: string;
      sku: string;
      name: string;
      description: string;
      imagePath: string;
    }>;
  }>;
  variantDeletes: string[];
  productTagsToSet: Array<{ productId: string; tagIds: string[] }>;
  productMaterialsToSet: Array<{
    productId: string;
    materials: Array<{ brandMaterialId: string; percentage: string | null }>;
  }>;
  productEcoClaimsToSet: Array<{ productId: string; ecoClaimIds: string[] }>;
  productEnvironmentUpserts: Array<{
    productId: string;
    metric: string;
    value: string;
    unit: string;
  }>;
  productJourneyStepsToSet: Array<{
    productId: string;
    steps: Array<{ sortIndex: number; stepType: string; facilityId: string }>;
  }>;
  productWeightUpserts: Array<{
    productId: string;
    weight: string;
    weightUnit: string;
  }>;
  variantAttributesToSet: Array<{
    variantId: string;
    attrs: Array<{
      attributeId: string;
      attributeValueId: string;
      sortOrder: number;
    }>;
  }>;
  variantMaterialsToSet: Array<{
    variantId: string;
    materials: Array<{ brandMaterialId: string; percentage: string | null }>;
  }>;
  variantEcoClaimsToSet: Array<{ variantId: string; ecoClaimIds: string[] }>;
  variantEnvironmentUpserts: Array<{
    variantId: string;
    carbonKgCo2e: string | null;
    waterLiters: string | null;
  }>;
  variantJourneyStepsToSet: Array<{
    variantId: string;
    steps: Array<{ sortIndex: number; stepType: string; facilityId: string }>;
  }>;
  variantWeightUpserts: Array<{
    variantId: string;
    weight: string;
    weightUnit: string;
  }>;
}

// ============================================================================
// Schema References
// ============================================================================

const {
  importJobs,
  stagingProducts,
  stagingProductVariants,
  stagingVariantAttributes,
  stagingProductTags,
  // Product-level staging tables
  stagingProductMaterials,
  stagingProductEcoClaims,
  stagingProductEnvironment,
  stagingProductJourneySteps,
  stagingProductWeight,
  // Variant-level staging tables (for overrides)
  stagingVariantMaterials,
  stagingVariantEcoClaims,
  stagingVariantEnvironment,
  stagingVariantJourneySteps,
  stagingVariantWeight,
  // Production tables
  products,
  productVariants,
  productVariantAttributes,
  productTags,
  // Product-level production tables
  productMaterials,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productWeight,
  // Variant-level production tables (for overrides)
  variantMaterials,
  variantEcoClaims,
  variantEnvironment,
  variantJourneySteps,
  variantWeight,
  brands,
} = schema;

// ============================================================================
// Constants
// ============================================================================

/**
 * Batch size for processing products (same as integrations engine)
 * Each batch goes through complete cycle: load → images → commit
 */
const BATCH_SIZE = 250;

/** Concurrency for image uploads */
const IMAGE_CONCURRENCY = 15;

/** Image upload timeout in ms */
const IMAGE_TIMEOUT_MS = 60_000;

// ============================================================================
// Main Task
// ============================================================================

export const commitToProduction = task({
  id: "commit-to-production",
  maxDuration: 1800, // 30 minutes
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 2 },
  run: async (payload: CommitToProductionPayload): Promise<void> => {
    const { jobId, brandId } = payload;
    const startTime = Date.now();

    logger.info("Starting commit-to-production job", { jobId, brandId });

    const totalStats: CommitStats = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      variantsDeleted: 0,
      tagsSet: 0,
      attributesSet: 0,
      materialsSet: 0,
      ecoClaimsSet: 0,
      environmentSet: 0,
      journeyStepsSet: 0,
      weightSet: 0,
      imagesProcessed: 0,
      imagesFailed: 0,
    };

    let committedCount = 0;
    let failedCount = 0;
    let batchNumber = 0;

    try {
      // Update job status to COMMITTING
      await db
        .update(importJobs)
        .set({
          status: "COMMITTING",
          commitStartedAt: new Date().toISOString(),
        })
        .where(eq(importJobs.id, jobId));

      // Create Supabase client for storage operations
      const storageClient = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      // Process staging data in batches of 250 (same as integrations engine)
      // Each batch goes through complete cycle: load → images → UPIDs → commit
      let hasMoreData = true;
      let lastRowNumber = 0;

      while (hasMoreData) {
        batchNumber++;
        const batchStartTime = Date.now();

        // PHASE 1: Load next batch of staging data
        const batchData = await loadStagingBatch(
          db,
          jobId,
          lastRowNumber,
          BATCH_SIZE,
        );

        if (batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        logger.info(`Batch ${batchNumber}: Starting`, {
          products: batchData.length,
          variants: batchData.reduce((sum, p) => sum + p.variants.length, 0),
        });

        // Update lastRowNumber for next batch
        lastRowNumber = batchData[batchData.length - 1]!.rowNumber;

        // PHASE 2: Fetch existing product images for change detection
        const existingProductIds = batchData
          .filter((p) => p.existingProductId)
          .map((p) => p.existingProductId as string);

        const existingProducts =
          existingProductIds.length > 0
            ? await db
                .select({ id: products.id, imagePath: products.imagePath })
                .from(products)
                .where(inArray(products.id, existingProductIds))
            : [];

        const existingProductImageMap = new Map(
          existingProducts.map((p) => [p.id, p.imagePath]),
        );

        // PHASE 3: Process images for this batch
        const imageResults = await processImages(
          storageClient,
          brandId,
          batchData,
          existingProductImageMap,
        );
        totalStats.imagesProcessed += imageResults.completed;
        totalStats.imagesFailed += imageResults.failed;

        // PHASE 4: Generate UPIDs for new variants in this batch
        const upidMap = await preGenerateUpids(db, batchData);

        // PHASE 5: Compute production operations (pure, no DB)
        const { ops, batchStats } = computeProductionOps(
          batchData,
          upidMap,
          brandId,
        );

        // PHASE 6: Execute production writes for this batch
        try {
          await batchExecuteProductionOps(db, ops);

          // Accumulate stats
          totalStats.productsCreated += batchStats.productsCreated;
          totalStats.productsUpdated += batchStats.productsUpdated;
          totalStats.variantsCreated += batchStats.variantsCreated;
          totalStats.variantsUpdated += batchStats.variantsUpdated;
          totalStats.variantsDeleted += batchStats.variantsDeleted;
          totalStats.tagsSet += batchStats.tagsSet;
          totalStats.attributesSet += batchStats.attributesSet;
          totalStats.materialsSet += batchStats.materialsSet;
          totalStats.ecoClaimsSet += batchStats.ecoClaimsSet;
          totalStats.environmentSet += batchStats.environmentSet;
          totalStats.journeyStepsSet += batchStats.journeyStepsSet;
          totalStats.weightSet += batchStats.weightSet;

          committedCount += batchData.length;

          // PHASE 7: Mark batch as committed
          const stagingProductIds = batchData.map((p) => p.stagingId);
          const stagingVariantIds = batchData.flatMap((p) =>
            p.variants.map((v) => v.stagingId),
          );

          await db
            .update(stagingProducts)
            .set({ rowStatus: "COMMITTED" })
            .where(inArray(stagingProducts.stagingId, stagingProductIds));

          if (stagingVariantIds.length > 0) {
            await db
              .update(stagingProductVariants)
              .set({ rowStatus: "COMMITTED" })
              .where(
                inArray(stagingProductVariants.stagingId, stagingVariantIds),
              );
          }

          const batchDuration = Date.now() - batchStartTime;
          logger.info(`Batch ${batchNumber}: Complete`, {
            committed: batchData.length,
            duration: `${batchDuration}ms`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Batch ${batchNumber}: Failed`, { error: errorMessage });

          // Mark batch as failed
          const stagingProductIds = batchData.map((p) => p.stagingId);
          await db
            .update(stagingProducts)
            .set({
              rowStatus: "FAILED",
              errors: [{ field: "commit", message: errorMessage }],
            })
            .where(inArray(stagingProducts.stagingId, stagingProductIds));

          failedCount += batchData.length;
        }
      }

      // PHASE 8: Delete committed staging data
      logger.info("Cleaning up committed staging data");
      await deleteCommittedStagingData(db, jobId);

      // Determine final status
      // Consider both commit failures AND validation errors from earlier phase
      const hasCommitFailures = failedCount > 0;
      const hasValidationErrors = payload.hasValidationErrors ?? false;
      const hasAnyFailures = hasCommitFailures || hasValidationErrors;
      const finalStatus = hasAnyFailures
        ? "COMPLETED_WITH_FAILURES"
        : "COMPLETED";

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          // Preserve validation errors flag OR set if there are commit failures
          hasExportableFailures: hasAnyFailures,
          summary: {
            committed: committedCount,
            failed: failedCount,
            ...totalStats,
          },
        })
        .where(eq(importJobs.id, jobId));

      // Revalidate DPP cache for the brand
      await revalidateBrandCache(brandId);

      // Note: Error report is triggered in validate-and-stage.ts, not here
      // This ensures the error report includes ALL errors (validation + commit failures)

      const duration = Date.now() - startTime;
      logger.info("Commit-to-production completed", {
        jobId,
        committedCount,
        failedCount,
        batches: batchNumber,
        duration: `${duration}ms`,
        status: finalStatus,
        stats: totalStats,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Commit-to-production failed", {
        jobId,
        error: errorMessage,
      });

      await db
        .update(importJobs)
        .set({
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          summary: { error: errorMessage },
        })
        .where(eq(importJobs.id, jobId));

      throw error;
    }
  },
});

// ============================================================================
// Load Staging Batch (250 products at a time)
// ============================================================================

/**
 * Load a batch of staging products and their related data.
 */
async function loadStagingBatch(
  database: Database,
  jobId: string,
  afterRowNumber: number,
  limit: number,
): Promise<StagingProductData[]> {
  // Load batch of staging products
  const batch = await database
    .select({
      stagingId: stagingProducts.stagingId,
      rowNumber: stagingProducts.rowNumber,
      action: stagingProducts.action,
      existingProductId: stagingProducts.existingProductId,
      id: stagingProducts.id,
      brandId: stagingProducts.brandId,
      name: stagingProducts.name,
      description: stagingProducts.description,
      manufacturerId: stagingProducts.manufacturerId,
      imagePath: stagingProducts.imagePath,
      categoryId: stagingProducts.categoryId,
      seasonId: stagingProducts.seasonId,
      productHandle: stagingProducts.productHandle,
      status: stagingProducts.status,
    })
    .from(stagingProducts)
    .where(
      and(
        eq(stagingProducts.jobId, jobId),
        // Only process PENDING and PENDING_WITH_WARNINGS (skip BLOCKED)
        inArray(stagingProducts.rowStatus, [
          "PENDING",
          "PENDING_WITH_WARNINGS",
        ]),
        sql`${stagingProducts.rowNumber} > ${afterRowNumber}`,
      ),
    )
    .orderBy(stagingProducts.rowNumber)
    .limit(limit);

  if (batch.length === 0) {
    return [];
  }

  const stagingIds = batch.map((p) => p.stagingId);

  // Load all related data in parallel
  const [
    variantsResult,
    tagsResult,
    productMaterialsResult,
    productEcoClaimsResult,
    productEnvironmentResult,
    productJourneyResult,
    productWeightResult,
  ] = await Promise.all([
    loadVariantsWithRelated(database, stagingIds),
    database
      .select({
        stagingProductId: stagingProductTags.stagingProductId,
        tagId: stagingProductTags.tagId,
      })
      .from(stagingProductTags)
      .where(inArray(stagingProductTags.stagingProductId, stagingIds)),
    database
      .select()
      .from(stagingProductMaterials)
      .where(inArray(stagingProductMaterials.stagingProductId, stagingIds)),
    database
      .select()
      .from(stagingProductEcoClaims)
      .where(inArray(stagingProductEcoClaims.stagingProductId, stagingIds)),
    database
      .select()
      .from(stagingProductEnvironment)
      .where(inArray(stagingProductEnvironment.stagingProductId, stagingIds)),
    database
      .select()
      .from(stagingProductJourneySteps)
      .where(inArray(stagingProductJourneySteps.stagingProductId, stagingIds)),
    database
      .select()
      .from(stagingProductWeight)
      .where(inArray(stagingProductWeight.stagingProductId, stagingIds)),
  ]);

  // Group related data by staging product ID
  const variantsByProduct = new Map<string, StagingVariantData[]>();
  for (const v of variantsResult) {
    const list = variantsByProduct.get(v.stagingProductId) || [];
    list.push(v);
    variantsByProduct.set(v.stagingProductId, list);
  }

  const tagsByProduct = new Map<string, { tagId: string }[]>();
  for (const t of tagsResult) {
    const list = tagsByProduct.get(t.stagingProductId) || [];
    list.push({ tagId: t.tagId });
    tagsByProduct.set(t.stagingProductId, list);
  }

  const materialsByProduct = groupBy(
    productMaterialsResult,
    (m) => m.stagingProductId,
  );
  const ecoClaimsByProduct = groupBy(
    productEcoClaimsResult,
    (c) => c.stagingProductId,
  );
  const envByProduct = new Map(
    productEnvironmentResult.map((e) => [e.stagingProductId, e]),
  );
  const journeyByProduct = groupBy(
    productJourneyResult,
    (j) => j.stagingProductId,
  );
  const weightByProduct = new Map(
    productWeightResult.map((w) => [w.stagingProductId, w]),
  );

  // Assemble product data
  return batch.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.stagingId) || [],
    tags: tagsByProduct.get(product.stagingId) || [],
    materials: (materialsByProduct.get(product.stagingId) || []).map((m) => ({
      brandMaterialId: m.brandMaterialId,
      percentage: m.percentage,
    })),
    ecoClaims: (ecoClaimsByProduct.get(product.stagingId) || []).map((c) => ({
      ecoClaimId: c.ecoClaimId,
    })),
    environment: envByProduct.get(product.stagingId)
      ? {
          carbonKgCo2E: envByProduct.get(product.stagingId)!.carbonKgCo2E,
          waterLiters: envByProduct.get(product.stagingId)!.waterLiters,
        }
      : null,
    journeySteps: (journeyByProduct.get(product.stagingId) || []).map((j) => ({
      sortIndex: j.sortIndex,
      stepType: j.stepType,
      facilityId: j.facilityId,
    })),
    weight: weightByProduct.get(product.stagingId)
      ? {
          weight: weightByProduct.get(product.stagingId)!.weight,
          weightUnit: weightByProduct.get(product.stagingId)!.weightUnit,
        }
      : null,
  }));
}

/**
 * Load all variants with their related data.
 */
async function loadVariantsWithRelated(
  database: Database,
  stagingProductIds: string[],
): Promise<(StagingVariantData & { stagingProductId: string })[]> {
  // Load variants
  const variants = await database
    .select({
      stagingId: stagingProductVariants.stagingId,
      stagingProductId: stagingProductVariants.stagingProductId,
      rowNumber: stagingProductVariants.rowNumber,
      action: stagingProductVariants.action,
      existingVariantId: stagingProductVariants.existingVariantId,
      id: stagingProductVariants.id,
      productId: stagingProductVariants.productId,
      upid: stagingProductVariants.upid,
      barcode: stagingProductVariants.barcode,
      sku: stagingProductVariants.sku,
      nameOverride: stagingProductVariants.nameOverride,
      descriptionOverride: stagingProductVariants.descriptionOverride,
      imagePathOverride: stagingProductVariants.imagePathOverride,
    })
    .from(stagingProductVariants)
    .where(inArray(stagingProductVariants.stagingProductId, stagingProductIds));

  if (variants.length === 0) return [];

  const variantStagingIds = variants.map((v) => v.stagingId);

  // Load all variant-related data in parallel
  const [
    attributesResult,
    materialsResult,
    ecoClaimsResult,
    environmentResult,
    journeyResult,
    weightResult,
  ] = await Promise.all([
    database
      .select()
      .from(stagingVariantAttributes)
      .where(
        inArray(stagingVariantAttributes.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantMaterials)
      .where(
        inArray(stagingVariantMaterials.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantEcoClaims)
      .where(
        inArray(stagingVariantEcoClaims.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantEnvironment)
      .where(
        inArray(stagingVariantEnvironment.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantJourneySteps)
      .where(
        inArray(stagingVariantJourneySteps.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantWeight)
      .where(inArray(stagingVariantWeight.stagingVariantId, variantStagingIds)),
  ]);

  // Group by variant staging ID
  const attrsByVariant = groupBy(attributesResult, (a) => a.stagingVariantId);
  const matsByVariant = groupBy(materialsResult, (m) => m.stagingVariantId);
  const claimsByVariant = groupBy(ecoClaimsResult, (c) => c.stagingVariantId);
  const envByVariant = new Map(
    environmentResult.map((e) => [e.stagingVariantId, e]),
  );
  const journeyByVariant = groupBy(journeyResult, (j) => j.stagingVariantId);
  const weightByVariant = new Map(
    weightResult.map((w) => [w.stagingVariantId, w]),
  );

  // Assemble variant data
  return variants.map((v) => ({
    ...v,
    attributes: (attrsByVariant.get(v.stagingId) || []).map((a) => ({
      attributeId: a.attributeId,
      attributeValueId: a.attributeValueId,
      sortOrder: a.sortOrder,
    })),
    materials: (matsByVariant.get(v.stagingId) || []).map((m) => ({
      brandMaterialId: m.brandMaterialId,
      percentage: m.percentage,
    })),
    ecoClaims: (claimsByVariant.get(v.stagingId) || []).map((c) => ({
      ecoClaimId: c.ecoClaimId,
    })),
    environment: envByVariant.get(v.stagingId)
      ? {
          carbonKgCo2e: envByVariant.get(v.stagingId)!.carbonKgCo2e,
          waterLiters: envByVariant.get(v.stagingId)!.waterLiters,
        }
      : null,
    journeySteps: (journeyByVariant.get(v.stagingId) || []).map((j) => ({
      sortIndex: j.sortIndex,
      stepType: j.stepType,
      facilityId: j.facilityId,
    })),
    weight: weightByVariant.get(v.stagingId)
      ? {
          weight: weightByVariant.get(v.stagingId)!.weight,
          weightUnit: weightByVariant.get(v.stagingId)!.weightUnit,
        }
      : null,
  }));
}

// ============================================================================
// Pre-generate UPIDs (for one batch)
// ============================================================================

/**
 * Pre-generate all UPIDs for new variants in a batch.
 */
async function preGenerateUpids(
  database: Database,
  batchData: StagingProductData[],
): Promise<Map<string, string>> {
  // Count variants that need UPIDs
  const variantsNeedingUpids: string[] = [];

  for (const product of batchData) {
    for (const variant of product.variants) {
      if (variant.action === "CREATE" && !variant.upid) {
        variantsNeedingUpids.push(variant.stagingId);
      }
    }
  }

  if (variantsNeedingUpids.length === 0) {
    return new Map();
  }

  // Generate all UPIDs in one batch
  const upids = await generateUniqueUpids({
    count: variantsNeedingUpids.length,
    isTaken: async (candidate) => {
      const [existing] = await database
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.upid, candidate))
        .limit(1);
      return Boolean(existing);
    },
    fetchTakenSet: async (candidates) => {
      const rows = await database
        .select({ upid: productVariants.upid })
        .from(productVariants)
        .where(inArray(productVariants.upid, candidates as string[]));
      return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]);
    },
  });

  // Map stagingVariantId -> generated UPID
  const upidMap = new Map<string, string>();
  variantsNeedingUpids.forEach((stagingId, i) => {
    upidMap.set(stagingId, upids[i]!);
  });

  return upidMap;
}

// ============================================================================
// Compute Production Operations (PURE - no DB calls)
// ============================================================================

/**
 * Compute all production operations from a batch of staging data.
 * This is a PURE FUNCTION - no database calls!
 */
function computeProductionOps(
  batchData: StagingProductData[],
  upidMap: Map<string, string>,
  brandId: string,
): { ops: PendingProductionOps; batchStats: CommitStats } {
  const ops: PendingProductionOps = {
    productCreates: [],
    productUpdates: [],
    variantCreates: [],
    variantUpdates: [],
    variantDeletes: [],
    productTagsToSet: [],
    productMaterialsToSet: [],
    productEcoClaimsToSet: [],
    productEnvironmentUpserts: [],
    productJourneyStepsToSet: [],
    productWeightUpserts: [],
    variantAttributesToSet: [],
    variantMaterialsToSet: [],
    variantEcoClaimsToSet: [],
    variantEnvironmentUpserts: [],
    variantJourneyStepsToSet: [],
    variantWeightUpserts: [],
  };

  const batchStats: CommitStats = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    variantsDeleted: 0,
    tagsSet: 0,
    attributesSet: 0,
    materialsSet: 0,
    ecoClaimsSet: 0,
    environmentSet: 0,
    journeyStepsSet: 0,
    weightSet: 0,
    imagesProcessed: 0,
    imagesFailed: 0,
  };

  for (const stagingProduct of batchData) {
    const productId = stagingProduct.existingProductId || stagingProduct.id;

    // Product create or update
    if (stagingProduct.action === "CREATE") {
      ops.productCreates.push({
        id: productId,
        brandId,
        name: stagingProduct.name,
        productHandle: stagingProduct.productHandle ?? productId,
        description: stagingProduct.description ?? undefined,
        categoryId: stagingProduct.categoryId ?? undefined,
        seasonId: stagingProduct.seasonId ?? undefined,
        manufacturerId: stagingProduct.manufacturerId ?? undefined,
        imagePath: stagingProduct.imagePath ?? undefined,
        status: stagingProduct.status ?? "unpublished",
      });
      batchStats.productsCreated++;
    } else if (
      stagingProduct.action === "UPDATE" &&
      stagingProduct.existingProductId
    ) {
      const updateData: PendingProductionOps["productUpdates"][0]["data"] = {};

      if (stagingProduct.name?.trim()) updateData.name = stagingProduct.name;
      if (stagingProduct.productHandle?.trim())
        updateData.productHandle = stagingProduct.productHandle;
      if (stagingProduct.description?.trim())
        updateData.description = stagingProduct.description;
      if (stagingProduct.categoryId)
        updateData.categoryId = stagingProduct.categoryId;
      if (stagingProduct.seasonId)
        updateData.seasonId = stagingProduct.seasonId;
      if (stagingProduct.manufacturerId)
        updateData.manufacturerId = stagingProduct.manufacturerId;
      if (stagingProduct.imagePath?.trim())
        updateData.imagePath = stagingProduct.imagePath;
      if (stagingProduct.status?.trim())
        updateData.status = stagingProduct.status;

      if (Object.keys(updateData).length > 0) {
        ops.productUpdates.push({
          id: stagingProduct.existingProductId,
          data: updateData,
        });
        batchStats.productsUpdated++;
      }
    }

    // Product tags
    if (stagingProduct.tags.length > 0) {
      ops.productTagsToSet.push({
        productId,
        tagIds: stagingProduct.tags.map((t) => t.tagId),
      });
      batchStats.tagsSet += stagingProduct.tags.length;
    }

    // Product materials
    if (stagingProduct.materials.length > 0) {
      ops.productMaterialsToSet.push({
        productId,
        materials: stagingProduct.materials,
      });
      batchStats.materialsSet += stagingProduct.materials.length;
    }

    // Product eco claims
    if (stagingProduct.ecoClaims.length > 0) {
      ops.productEcoClaimsToSet.push({
        productId,
        ecoClaimIds: stagingProduct.ecoClaims.map((c) => c.ecoClaimId),
      });
      batchStats.ecoClaimsSet += stagingProduct.ecoClaims.length;
    }

    // Product environment
    if (stagingProduct.environment) {
      if (stagingProduct.environment.carbonKgCo2E) {
        ops.productEnvironmentUpserts.push({
          productId,
          metric: "carbon_kg_co2e",
          value: stagingProduct.environment.carbonKgCo2E,
          unit: "kg_co2e",
        });
        batchStats.environmentSet++;
      }
      if (stagingProduct.environment.waterLiters) {
        ops.productEnvironmentUpserts.push({
          productId,
          metric: "water_liters",
          value: stagingProduct.environment.waterLiters,
          unit: "liters",
        });
        batchStats.environmentSet++;
      }
    }

    // Product journey steps
    if (stagingProduct.journeySteps.length > 0) {
      ops.productJourneyStepsToSet.push({
        productId,
        steps: stagingProduct.journeySteps,
      });
      batchStats.journeyStepsSet += stagingProduct.journeySteps.length;
    }

    // Product weight
    if (stagingProduct.weight?.weight) {
      ops.productWeightUpserts.push({
        productId,
        weight: stagingProduct.weight.weight,
        weightUnit: stagingProduct.weight.weightUnit ?? "g",
      });
      batchStats.weightSet++;
    }

    // Variants
    for (const variant of stagingProduct.variants) {
      const variantId = variant.existingVariantId || variant.id;

      if (variant.action === "CREATE") {
        const upid = variant.upid || upidMap.get(variant.stagingId)!;
        ops.variantCreates.push({
          id: variantId,
          productId,
          upid,
          barcode: variant.barcode ?? undefined,
          sku: variant.sku ?? undefined,
          name: variant.nameOverride ?? undefined,
          description: variant.descriptionOverride ?? undefined,
          imagePath: variant.imagePathOverride ?? undefined,
        });
        batchStats.variantsCreated++;
      } else if (variant.action === "UPDATE" && variant.existingVariantId) {
        const updateData: PendingProductionOps["variantUpdates"][0]["data"] =
          {};

        if (variant.upid?.trim()) updateData.upid = variant.upid;
        if (variant.barcode?.trim()) updateData.barcode = variant.barcode;
        if (variant.sku?.trim()) updateData.sku = variant.sku;
        if (variant.nameOverride?.trim())
          updateData.name = variant.nameOverride;
        if (variant.descriptionOverride?.trim())
          updateData.description = variant.descriptionOverride;
        if (variant.imagePathOverride?.trim())
          updateData.imagePath = variant.imagePathOverride;

        if (Object.keys(updateData).length > 0) {
          ops.variantUpdates.push({
            id: variant.existingVariantId,
            data: updateData,
          });
          batchStats.variantsUpdated++;
        }
      } else if (variant.action === "DELETE" && variant.existingVariantId) {
        ops.variantDeletes.push(variant.existingVariantId);
        batchStats.variantsDeleted++;
      }

      // Skip relation updates for DELETE variants
      if (variant.action === "DELETE") continue;

      // Variant attributes
      if (variant.attributes.length > 0) {
        ops.variantAttributesToSet.push({
          variantId,
          attrs: variant.attributes,
        });
        batchStats.attributesSet += variant.attributes.length;
      }

      // Variant materials
      if (variant.materials.length > 0) {
        ops.variantMaterialsToSet.push({
          variantId,
          materials: variant.materials,
        });
        batchStats.materialsSet += variant.materials.length;
      }

      // Variant eco claims
      if (variant.ecoClaims.length > 0) {
        ops.variantEcoClaimsToSet.push({
          variantId,
          ecoClaimIds: variant.ecoClaims.map((c) => c.ecoClaimId),
        });
        batchStats.ecoClaimsSet += variant.ecoClaims.length;
      }

      // Variant environment
      if (variant.environment) {
        ops.variantEnvironmentUpserts.push({
          variantId,
          carbonKgCo2e: variant.environment.carbonKgCo2e,
          waterLiters: variant.environment.waterLiters,
        });
        batchStats.environmentSet++;
      }

      // Variant journey steps
      if (variant.journeySteps.length > 0) {
        ops.variantJourneyStepsToSet.push({
          variantId,
          steps: variant.journeySteps,
        });
        batchStats.journeyStepsSet += variant.journeySteps.length;
      }

      // Variant weight
      if (variant.weight?.weight) {
        ops.variantWeightUpserts.push({
          variantId,
          weight: variant.weight.weight,
          weightUnit: variant.weight.weightUnit ?? "g",
        });
        batchStats.weightSet++;
      }
    }
  }

  return { ops, batchStats };
}

// ============================================================================
// Batch Execute Production Operations (for one batch)
// ============================================================================

/**
 * Execute all production operations for a batch within a transaction.
 */
async function batchExecuteProductionOps(
  database: Database,
  ops: PendingProductionOps,
): Promise<void> {
  await database.transaction(async (tx) => {
    // 1. Product creates (batch)
    if (ops.productCreates.length > 0) {
      await tx.insert(products).values(ops.productCreates);
    }

    // 2. Product updates
    for (const update of ops.productUpdates) {
      await tx
        .update(products)
        .set(update.data)
        .where(eq(products.id, update.id));
    }

    // 3. Variant creates (batch)
    if (ops.variantCreates.length > 0) {
      await tx.insert(productVariants).values(ops.variantCreates);
    }

    // 4. Variant updates
    for (const update of ops.variantUpdates) {
      await tx
        .update(productVariants)
        .set(update.data)
        .where(eq(productVariants.id, update.id));
    }

    // 5. Variant deletes (batch)
    if (ops.variantDeletes.length > 0) {
      await tx
        .delete(productVariants)
        .where(inArray(productVariants.id, ops.variantDeletes));
    }

    // 6. Product tags (delete old + insert new)
    if (ops.productTagsToSet.length > 0) {
      const allProductIds = ops.productTagsToSet.map((t) => t.productId);
      await tx
        .delete(productTags)
        .where(inArray(productTags.productId, allProductIds));

      const allTagInserts = ops.productTagsToSet.flatMap((t) =>
        t.tagIds.map((tagId) => ({ productId: t.productId, tagId })),
      );
      if (allTagInserts.length > 0) {
        await tx.insert(productTags).values(allTagInserts);
      }
    }

    // 7. Product materials (delete old + insert new)
    if (ops.productMaterialsToSet.length > 0) {
      const allProductIds = ops.productMaterialsToSet.map((m) => m.productId);
      await tx
        .delete(productMaterials)
        .where(inArray(productMaterials.productId, allProductIds));

      const allMaterialInserts = ops.productMaterialsToSet.flatMap((m) =>
        m.materials.map((mat) => ({ productId: m.productId, ...mat })),
      );
      if (allMaterialInserts.length > 0) {
        await tx.insert(productMaterials).values(allMaterialInserts);
      }
    }

    // 8. Product eco claims (delete old + insert new)
    if (ops.productEcoClaimsToSet.length > 0) {
      const allProductIds = ops.productEcoClaimsToSet.map((c) => c.productId);
      await tx
        .delete(productEcoClaims)
        .where(inArray(productEcoClaims.productId, allProductIds));

      const allClaimInserts = ops.productEcoClaimsToSet.flatMap((c) =>
        c.ecoClaimIds.map((ecoClaimId) => ({
          productId: c.productId,
          ecoClaimId,
        })),
      );
      if (allClaimInserts.length > 0) {
        await tx.insert(productEcoClaims).values(allClaimInserts);
      }
    }

    // 9. Product environment (upserts)
    for (const env of ops.productEnvironmentUpserts) {
      await tx
        .insert(productEnvironment)
        .values({
          productId: env.productId,
          metric: env.metric,
          value: env.value,
          unit: env.unit,
        })
        .onConflictDoUpdate({
          target: [productEnvironment.productId, productEnvironment.metric],
          set: {
            value: env.value,
            unit: env.unit,
          },
        });
    }

    // 10. Product journey steps (delete old + insert new)
    if (ops.productJourneyStepsToSet.length > 0) {
      const allProductIds = ops.productJourneyStepsToSet.map(
        (j) => j.productId,
      );
      await tx
        .delete(productJourneySteps)
        .where(inArray(productJourneySteps.productId, allProductIds));

      const allJourneyInserts = ops.productJourneyStepsToSet.flatMap((j) =>
        j.steps.map((step) => ({ productId: j.productId, ...step })),
      );
      if (allJourneyInserts.length > 0) {
        await tx.insert(productJourneySteps).values(allJourneyInserts);
      }
    }

    // 11. Product weight (upserts)
    for (const w of ops.productWeightUpserts) {
      await tx
        .insert(productWeight)
        .values({
          productId: w.productId,
          weight: w.weight,
          weightUnit: w.weightUnit,
        })
        .onConflictDoUpdate({
          target: productWeight.productId,
          set: {
            weight: w.weight,
            weightUnit: w.weightUnit,
          },
        });
    }

    // 12. Variant attributes (delete old + insert new)
    if (ops.variantAttributesToSet.length > 0) {
      const allVariantIds = ops.variantAttributesToSet.map((a) => a.variantId);
      await tx
        .delete(productVariantAttributes)
        .where(inArray(productVariantAttributes.variantId, allVariantIds));

      const allAttrInserts = ops.variantAttributesToSet.flatMap((a) =>
        a.attrs.map((attr) => ({ variantId: a.variantId, ...attr })),
      );
      if (allAttrInserts.length > 0) {
        await tx.insert(productVariantAttributes).values(allAttrInserts);
      }
    }

    // 13. Variant materials (delete old + insert new)
    if (ops.variantMaterialsToSet.length > 0) {
      const allVariantIds = ops.variantMaterialsToSet.map((m) => m.variantId);
      await tx
        .delete(variantMaterials)
        .where(inArray(variantMaterials.variantId, allVariantIds));

      const allMaterialInserts = ops.variantMaterialsToSet.flatMap((m) =>
        m.materials.map((mat) => ({ variantId: m.variantId, ...mat })),
      );
      if (allMaterialInserts.length > 0) {
        await tx.insert(variantMaterials).values(allMaterialInserts);
      }
    }

    // 14. Variant eco claims (delete old + insert new)
    if (ops.variantEcoClaimsToSet.length > 0) {
      const allVariantIds = ops.variantEcoClaimsToSet.map((c) => c.variantId);
      await tx
        .delete(variantEcoClaims)
        .where(inArray(variantEcoClaims.variantId, allVariantIds));

      const allClaimInserts = ops.variantEcoClaimsToSet.flatMap((c) =>
        c.ecoClaimIds.map((ecoClaimId) => ({
          variantId: c.variantId,
          ecoClaimId,
        })),
      );
      if (allClaimInserts.length > 0) {
        await tx.insert(variantEcoClaims).values(allClaimInserts);
      }
    }

    // 15. Variant environment (upserts)
    for (const env of ops.variantEnvironmentUpserts) {
      await tx
        .insert(variantEnvironment)
        .values({
          variantId: env.variantId,
          carbonKgCo2e: env.carbonKgCo2e,
          waterLiters: env.waterLiters,
        })
        .onConflictDoUpdate({
          target: variantEnvironment.variantId,
          set: {
            carbonKgCo2e: env.carbonKgCo2e,
            waterLiters: env.waterLiters,
          },
        });
    }

    // 16. Variant journey steps (delete old + insert new)
    if (ops.variantJourneyStepsToSet.length > 0) {
      const allVariantIds = ops.variantJourneyStepsToSet.map(
        (j) => j.variantId,
      );
      await tx
        .delete(variantJourneySteps)
        .where(inArray(variantJourneySteps.variantId, allVariantIds));

      const allJourneyInserts = ops.variantJourneyStepsToSet.flatMap((j) =>
        j.steps.map((step) => ({ variantId: j.variantId, ...step })),
      );
      if (allJourneyInserts.length > 0) {
        await tx.insert(variantJourneySteps).values(allJourneyInserts);
      }
    }

    // 17. Variant weight (upserts)
    for (const w of ops.variantWeightUpserts) {
      await tx
        .insert(variantWeight)
        .values({
          variantId: w.variantId,
          weight: w.weight,
          weightUnit: w.weightUnit,
        })
        .onConflictDoUpdate({
          target: variantWeight.variantId,
          set: {
            weight: w.weight,
            weightUnit: w.weightUnit,
          },
        });
    }
  });
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Extract URL hash for comparison.
 */
function getUrlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/**
 * Check if existing image path was generated from the same source URL.
 */
function isSameImageSource(
  existingPath: string | null,
  newUrl: string,
): boolean {
  if (!existingPath) return false;
  const urlHash = getUrlHash(newUrl);
  const filename = existingPath.split("/").pop() || "";
  const existingHash = filename.split(".")[0];
  return existingHash === urlHash;
}

/**
 * Process images for a batch with rate limiting.
 */
async function processImages(
  storageClient: SupabaseClient,
  brandId: string,
  batchData: StagingProductData[],
  existingProductImageMap: Map<string, string | null>,
): Promise<{ completed: number; failed: number; skipped: number }> {
  const tasks: ImageUploadTask[] = [];
  let skipped = 0;

  // Collect all image upload tasks for this batch
  for (const product of batchData) {
    if (product.imagePath && isExternalImageUrl(product.imagePath)) {
      const existingImagePath = existingProductImageMap.get(
        product.existingProductId || "",
      );

      if (
        product.existingProductId &&
        existingImagePath &&
        isSameImageSource(existingImagePath, product.imagePath)
      ) {
        product.imagePath = existingImagePath ?? null;
        skipped++;
      } else {
        tasks.push({
          type: "product",
          entityId: product.id,
          imageUrl: product.imagePath,
        });
      }
    }

    for (const variant of product.variants) {
      if (
        variant.imagePathOverride &&
        isExternalImageUrl(variant.imagePathOverride)
      ) {
        tasks.push({
          type: "variant",
          entityId: variant.id,
          imageUrl: variant.imagePathOverride,
        });
      }
    }
  }

  if (tasks.length === 0) {
    return { completed: 0, failed: 0, skipped };
  }

  // Process with rate limiting
  let completed = 0;
  let failed = 0;
  let currentIndex = 0;
  const imagePathResults = new Map<string, string | null>();

  await new Promise<void>((resolve) => {
    const processNext = async () => {
      if (currentIndex >= tasks.length) {
        if (completed + failed === tasks.length) {
          resolve();
        }
        return;
      }

      const task = tasks[currentIndex++]!;

      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error("Image upload timeout")),
            IMAGE_TIMEOUT_MS,
          ),
        );

        const pathPrefix =
          task.type === "product" ? brandId : `${brandId}/variants`;

        const uploadPromise = downloadAndUploadImage(storageClient, {
          url: task.imageUrl,
          bucket: "products",
          pathPrefix,
        });

        const path = await Promise.race([uploadPromise, timeoutPromise]);

        if (path) {
          imagePathResults.set(`${task.type}:${task.entityId}`, path as string);
          completed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      } finally {
        if (currentIndex < tasks.length) {
          processNext();
        }
        if (completed + failed === tasks.length) {
          resolve();
        }
      }
    };

    const initialBatch = Math.min(IMAGE_CONCURRENCY, tasks.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
  });

  // Update batch data with new image paths
  for (const product of batchData) {
    const productPath = imagePathResults.get(`product:${product.id}`);
    if (productPath) {
      product.imagePath = productPath;
    }

    for (const variant of product.variants) {
      const variantPath = imagePathResults.get(`variant:${variant.id}`);
      if (variantPath) {
        variant.imagePathOverride = variantPath;
      }
    }
  }

  return { completed, failed, skipped };
}

// ============================================================================
// Delete Committed Staging Data
// ============================================================================

async function deleteCommittedStagingData(
  database: Database,
  jobId: string,
): Promise<void> {
  const committedProducts = await database
    .select({ stagingId: stagingProducts.stagingId })
    .from(stagingProducts)
    .where(
      and(
        eq(stagingProducts.jobId, jobId),
        eq(stagingProducts.rowStatus, "COMMITTED"),
      ),
    );

  if (committedProducts.length === 0) {
    return;
  }

  const stagingIds = committedProducts.map((p) => p.stagingId);

  // Delete in chunks to avoid memory issues
  const CHUNK_SIZE = 500;
  for (let i = 0; i < stagingIds.length; i += CHUNK_SIZE) {
    const chunk = stagingIds.slice(i, i + CHUNK_SIZE);
    await database.delete(stagingProducts).where(
      sql`${stagingProducts.stagingId} = ANY(ARRAY[${sql.join(
        chunk.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[])`,
    );
  }

  logger.info("Deleted committed staging data", {
    jobId,
    count: stagingIds.length,
  });
}

// ============================================================================
// Revalidate Brand Cache
// ============================================================================

async function revalidateBrandCache(brandId: string): Promise<void> {
  try {
    const [brand] = await db
      .select({ slug: brands.slug })
      .from(brands)
      .where(eq(brands.id, brandId))
      .limit(1);

    if (brand?.slug) {
      await revalidateBrand(brand.slug);
      logger.info("DPP cache revalidated", { brandSlug: brand.slug });
    }
  } catch (error) {
    logger.warn("DPP cache revalidation failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}
