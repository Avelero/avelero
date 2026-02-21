/**
 * Commit to Production Job (Optimized with Batch Operations)
 *
 * Phase 2 of the bulk import process:
 * 1. Loads import_rows.normalized data in batches of 250
 * 2. For each batch: generates UPIDs, processes images, commits to production
 * 3. Updates per-row status to COMMITTED or FAILED
 * 4. Deletes only COMMITTED rows (keeps FAILED for correction export)
 * 5. Revalidates DPP cache for the brand
 *
 * Key optimizations (matching integrations engine pattern):
 * - Processes products in batches of 250 (same as integrations)
 * - Each batch goes through complete cycle: load → images → commit
 * - Memory-efficient: only 250 products in memory at a time
 * - Uses NormalizedRowData directly (no intermediate type conversion)
 *
 * @module commit-to-production
 */

import "../configure-trigger";
import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray, sql } from "@v1/db/queries";
import {
  type NormalizedRowData,
  type NormalizedVariant,
  getImportJobStatus,
} from "@v1/db/queries/bulk";
import { publishNotificationEvent } from "@v1/db/queries/notifications";
import { generateGloballyUniqueUpids } from "@v1/db/queries/products";
import * as schema from "@v1/db/schema";
import { sendBulkBroadcast } from "@v1/db/utils";
import ImportFailuresEmail from "@v1/email/emails/import-failures";
import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import { revalidateBrand } from "../../lib/dpp-revalidation";
import { getResend } from "../../utils/resend";

// ============================================================================
// Types
// ============================================================================

interface CommitToProductionPayload {
  jobId: string;
  brandId: string;
  /** User ID who initiated the import (for notifications) */
  userId?: string | null;
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
  tagsSet: number;
  attributesSet: number;
  materialsSet: number;
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

/** Image upload failure with error details for reporting */
interface ImageFailure {
  type: "product" | "variant";
  entityId: string;
  url: string;
  error: string;
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
  productTagsToSet: Array<{ productId: string; tagIds: string[] }>;
  productMaterialsToSet: Array<{
    productId: string;
    materials: Array<{ brandMaterialId: string; percentage: string | null }>;
  }>;
  productEnvironmentUpserts: Array<{
    productId: string;
    metric: string;
    value: string;
    unit: string;
  }>;
  productJourneyStepsToSet: Array<{
    productId: string;
    steps: Array<{
      sortIndex: number;
      stepType: string;
      operatorIds: string[];
    }>;
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
  variantEnvironmentUpserts: Array<{
    variantId: string;
    carbonKgCo2e: string | null;
    waterLiters: string | null;
  }>;
  variantJourneyStepsToSet: Array<{
    variantId: string;
    steps: Array<{
      sortIndex: number;
      stepType: string;
      operatorIds: string[];
    }>;
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
  importRows,
  // Production tables
  products,
  productVariants,
  productVariantAttributes,
  productTags,
  // Product-level production tables
  productMaterials,
  productEnvironment,
  productJourneySteps,
  productWeight,
  // Variant-level production tables (for overrides)
  variantMaterials,
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

/** Email from address */
const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

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
      tagsSet: 0,
      attributesSet: 0,
      materialsSet: 0,
      environmentSet: 0,
      journeyStepsSet: 0,
      weightSet: 0,
      imagesProcessed: 0,
      imagesFailed: 0,
    };

    // Track all image failures across batches for error reporting
    const allImageFailures: ImageFailure[] = [];

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

      // Process data in batches of 250 (same as integrations engine)
      // Each batch goes through complete cycle: load → images → UPIDs → commit
      let hasMoreData = true;
      let lastRowNumber = 0;

      while (hasMoreData) {
        batchNumber++;
        const batchStartTime = Date.now();

        // PHASE 1: Load next batch of NormalizedRowData from import_rows
        const result = await loadBatchFromImportRows(
          db,
          jobId,
          lastRowNumber,
          BATCH_SIZE,
        );
        const batchData = result.data;
        const batchRowIds = result.rowIds;

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
        allImageFailures.push(...imageResults.failures);

        // PHASE 4: Generate UPIDs for new variants in this batch
        const upidMap = await preGenerateUpids(db, batchData);

        // PHASE 5: Compute production operations (pure, no DB)
        const { ops, batchStats } = computeProductionOps(
          batchData,
          upidMap,
          brandId,
        );

        // PHASE 6: Execute production writes for this batch
        // Triggers are disabled inside the transaction using SET LOCAL
        // This prevents overwhelming Supabase Realtime with per-row broadcasts
        try {
          await batchExecuteProductionOps(db, ops);

          // Accumulate stats
          totalStats.productsCreated += batchStats.productsCreated;
          totalStats.productsUpdated += batchStats.productsUpdated;
          totalStats.variantsCreated += batchStats.variantsCreated;
          totalStats.variantsUpdated += batchStats.variantsUpdated;
          totalStats.tagsSet += batchStats.tagsSet;
          totalStats.attributesSet += batchStats.attributesSet;
          totalStats.materialsSet += batchStats.materialsSet;
          totalStats.environmentSet += batchStats.environmentSet;
          totalStats.journeyStepsSet += batchStats.journeyStepsSet;
          totalStats.weightSet += batchStats.weightSet;

          committedCount += batchData.length;

          // PHASE 7: Mark batch as committed
          await markImportRowsCommitted(db, batchRowIds);

          // Send single consolidated broadcast for this batch
          await sendBulkBroadcast(db, {
            domain: "products",
            brandId,
            operation: "BULK_INSERT",
            summary: {
              created: batchStats.productsCreated,
              updated: batchStats.productsUpdated,
              total: batchData.length,
            },
          });

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
          await markImportRowsFailed(db, batchRowIds, errorMessage);

          failedCount += batchData.length;
        }
      }

      // PHASE 8: Add image errors to import_rows (BEFORE deletion)
      // This ensures image failures appear in the error report
      if (allImageFailures.length > 0) {
        logger.info("Adding image failures to import_rows", {
          failureCount: allImageFailures.length,
        });
        await addImageErrorsToImportRows(db, jobId, allImageFailures);
      }

      // PHASE 9: Count final row statuses (AFTER image errors are added)
      // This gives us accurate blocked/warning counts for the summary and notification
      const rowCounts = await countImportRowStatuses(db, jobId);
      const blockedProducts = rowCounts.blocked;
      const warningProducts = rowCounts.pendingWithWarnings;

      logger.info("Final row status counts", {
        jobId,
        ...rowCounts,
      });

      // Determine final status
      // Consider commit failures, validation errors, AND image failures
      const hasCommitFailures = failedCount > 0;
      const hasValidationErrors = payload.hasValidationErrors ?? false;
      const hasImageFailures = allImageFailures.length > 0;
      const hasAnyFailures =
        hasCommitFailures ||
        hasValidationErrors ||
        hasImageFailures ||
        blockedProducts > 0 ||
        warningProducts > 0;
      const finalStatus = hasAnyFailures
        ? "COMPLETED_WITH_FAILURES"
        : "COMPLETED";

      // PHASE 10: Generate error report if there are any errors
      // Must happen BEFORE deleting committed rows
      if (hasAnyFailures) {
        logger.info("Generating error report", {
          jobId,
          hasValidationErrors,
          hasImageFailures,
          imageFailureCount: allImageFailures.length,
          blockedProducts,
          warningProducts,
        });

        await tasks.triggerAndWait("generate-error-report", {
          jobId,
          brandId,
          userEmail: payload.userEmail ?? null,
        });

        logger.info("Error report generation completed", { jobId });

        const totalIssues = blockedProducts + warningProducts;
        const importJob = await getImportJobStatus(db, jobId);

        try {
          await publishNotificationEvent(db, {
            event: "import_failure",
            brandId,
            actorUserId: payload.userId ?? null,
            payload: {
              jobId,
              totalIssues,
              blockedProducts,
              warningProducts,
              correctionDownloadUrl: importJob?.correctionDownloadUrl ?? null,
              correctionExpiresAt: importJob?.correctionExpiresAt ?? null,
              correctionFilename: importJob?.filename
                ? `${importJob.filename}-corrections.xlsx`
                : null,
            },
          });
        } catch (notificationError) {
          logger.warn("Failed to publish import failure notification", {
            error:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown error",
          });
        }

        if (payload.userEmail) {
          try {
            if (!importJob?.correctionDownloadUrl) {
              logger.warn("Skipping import failure email - no correction URL", {
                jobId,
              });
            } else {
              const totalProducts =
                rowCounts.pending +
                rowCounts.pendingWithWarnings +
                rowCounts.blocked;
              const successfulProductCount = Math.max(
                0,
                totalProducts - totalIssues,
              );

              const html = await render(
                ImportFailuresEmail({
                  issueProductCount: totalIssues,
                  successfulProductCount,
                  downloadUrl: importJob.correctionDownloadUrl,
                  expiresAt:
                    importJob?.correctionExpiresAt ??
                    new Date(
                      Date.now() + 7 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                  filename: importJob?.filename ?? "import",
                }),
              );

              const resend = getResend();
              await resend.emails.send({
                from: EMAIL_FROM,
                to: [payload.userEmail],
                subject: `${totalIssues} product${totalIssues !== 1 ? "s" : ""} had issues during your import`,
                html,
              });
            }
          } catch (emailError) {
            logger.warn("Failed to send import failure email", {
              error:
                emailError instanceof Error
                  ? emailError.message
                  : "Unknown error",
            });
          }
        }
      }

      // PHASE 11: Delete committed import_rows (AFTER error report is generated)
      logger.info("Cleaning up committed data");
      await deleteCommittedImportRows(db, jobId);

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasAnyFailures,
          summary: {
            committed: committedCount,
            failed: failedCount,
            blockedProducts,
            warningProducts,
            ...totalStats,
          },
        })
        .where(eq(importJobs.id, jobId));

      // Revalidate DPP cache for the brand
      await revalidateBrandCache(brandId);

      // Create success notification (only if no failures)
      if (finalStatus === "COMPLETED") {
        const totalProcessed =
          totalStats.productsCreated + totalStats.productsUpdated;

        try {
          await publishNotificationEvent(db, {
            event: "import_success",
            brandId,
            actorUserId: payload.userId ?? null,
            payload: {
              jobId,
              productsCreated: totalStats.productsCreated,
              productsUpdated: totalStats.productsUpdated,
              totalProcessed,
            },
          });
        } catch (notificationError) {
          logger.warn("Failed to publish import success notification", {
            error:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown error",
          });
        }
      }

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
// Load Batch from import_rows (Direct NormalizedRowData)
// ============================================================================

/**
 * Load a batch of products from import_rows.normalized JSONB.
 * Returns NormalizedRowData directly - no type conversion needed.
 */
async function loadBatchFromImportRows(
  database: Database,
  jobId: string,
  afterRowNumber: number,
  limit: number,
): Promise<{ data: NormalizedRowData[]; rowIds: string[] }> {
  // Load batch of import rows with normalized data
  const batch = await database
    .select({
      id: importRows.id,
      rowNumber: importRows.rowNumber,
      normalized: importRows.normalized,
    })
    .from(importRows)
    .where(
      and(
        eq(importRows.jobId, jobId),
        // Only process PENDING and PENDING_WITH_WARNINGS (skip BLOCKED)
        inArray(importRows.status, ["PENDING", "PENDING_WITH_WARNINGS"]),
        sql`${importRows.rowNumber} > ${afterRowNumber}`,
      ),
    )
    .orderBy(importRows.rowNumber)
    .limit(limit);

  if (batch.length === 0) {
    return { data: [], rowIds: [] };
  }

  const rowIds = batch.map((r) => r.id);

  // Return NormalizedRowData directly
  const data: NormalizedRowData[] = batch
    .filter((row) => row.normalized !== null)
    .map((row) => row.normalized as NormalizedRowData);

  return { data, rowIds };
}

/**
 * Mark import rows as committed.
 */
async function markImportRowsCommitted(
  database: Database,
  rowIds: string[],
): Promise<void> {
  if (rowIds.length === 0) return;

  await database
    .update(importRows)
    .set({ status: "COMMITTED" })
    .where(inArray(importRows.id, rowIds));
}

/**
 * Mark import rows as failed.
 */
async function markImportRowsFailed(
  database: Database,
  rowIds: string[],
  errorMessage: string,
): Promise<void> {
  if (rowIds.length === 0) return;

  await database
    .update(importRows)
    .set({ status: "FAILED", error: errorMessage })
    .where(inArray(importRows.id, rowIds));
}

/**
 * Delete committed import rows.
 */
async function deleteCommittedImportRows(
  database: Database,
  jobId: string,
): Promise<number> {
  const committed = await database
    .select({ id: importRows.id })
    .from(importRows)
    .where(
      and(eq(importRows.jobId, jobId), eq(importRows.status, "COMMITTED")),
    );

  if (committed.length === 0) return 0;

  // Delete in chunks
  const CHUNK_SIZE = 500;
  for (let i = 0; i < committed.length; i += CHUNK_SIZE) {
    const chunk = committed.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((r) => r.id);
    await database.delete(importRows).where(inArray(importRows.id, ids));
  }

  logger.info("Deleted committed import rows", {
    jobId,
    count: committed.length,
  });

  return committed.length;
}

// ============================================================================
// Pre-generate UPIDs (for one batch)
// ============================================================================

/**
 * Pre-generate all UPIDs for new variants in a batch.
 *
 * Uses the centralized generateGloballyUniqueUpids function which checks
 * uniqueness against BOTH product_variants AND product_passports tables.
 */
async function preGenerateUpids(
  database: Database,
  batchData: NormalizedRowData[],
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

  // Generate all UPIDs using the centralized function that checks both tables
  const upids = await generateGloballyUniqueUpids(
    database,
    variantsNeedingUpids.length,
  );

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
 * Compute all production operations from a batch of NormalizedRowData.
 * This is a PURE FUNCTION - no database calls!
 */
function computeProductionOps(
  batchData: NormalizedRowData[],
  upidMap: Map<string, string>,
  brandId: string,
): { ops: PendingProductionOps; batchStats: CommitStats } {
  const ops: PendingProductionOps = {
    productCreates: [],
    productUpdates: [],
    variantCreates: [],
    variantUpdates: [],
    productTagsToSet: [],
    productMaterialsToSet: [],
    productEnvironmentUpserts: [],
    productJourneyStepsToSet: [],
    productWeightUpserts: [],
    variantAttributesToSet: [],
    variantMaterialsToSet: [],
    variantEnvironmentUpserts: [],
    variantJourneyStepsToSet: [],
    variantWeightUpserts: [],
  };

  const batchStats: CommitStats = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    tagsSet: 0,
    attributesSet: 0,
    materialsSet: 0,
    environmentSet: 0,
    journeyStepsSet: 0,
    weightSet: 0,
    imagesProcessed: 0,
    imagesFailed: 0,
  };

  for (const normalizedProduct of batchData) {
    const productId =
      normalizedProduct.existingProductId || normalizedProduct.id;

    // Product create or update
    if (normalizedProduct.action === "CREATE") {
      ops.productCreates.push({
        id: productId,
        brandId,
        name: normalizedProduct.name,
        productHandle: normalizedProduct.productHandle ?? productId,
        description: normalizedProduct.description ?? undefined,
        categoryId: normalizedProduct.categoryId ?? undefined,
        seasonId: normalizedProduct.seasonId ?? undefined,
        manufacturerId: normalizedProduct.manufacturerId ?? undefined,
        imagePath: normalizedProduct.imagePath ?? undefined,
        status: normalizedProduct.status ?? "unpublished",
      });
      batchStats.productsCreated++;
    } else if (
      normalizedProduct.action === "UPDATE" &&
      normalizedProduct.existingProductId
    ) {
      const updateData: PendingProductionOps["productUpdates"][0]["data"] = {};

      if (normalizedProduct.name?.trim())
        updateData.name = normalizedProduct.name;
      if (normalizedProduct.productHandle?.trim())
        updateData.productHandle = normalizedProduct.productHandle;
      if (normalizedProduct.description?.trim())
        updateData.description = normalizedProduct.description;
      if (normalizedProduct.categoryId)
        updateData.categoryId = normalizedProduct.categoryId;
      if (normalizedProduct.seasonId)
        updateData.seasonId = normalizedProduct.seasonId;
      if (normalizedProduct.manufacturerId)
        updateData.manufacturerId = normalizedProduct.manufacturerId;
      if (normalizedProduct.imagePath?.trim())
        updateData.imagePath = normalizedProduct.imagePath;
      if (normalizedProduct.status?.trim())
        updateData.status = normalizedProduct.status;

      if (Object.keys(updateData).length > 0) {
        ops.productUpdates.push({
          id: normalizedProduct.existingProductId,
          data: updateData,
        });
        batchStats.productsUpdated++;
      }
    }

    // Product tags (now directly array of tag IDs)
    if (normalizedProduct.tags.length > 0) {
      ops.productTagsToSet.push({
        productId,
        tagIds: normalizedProduct.tags,
      });
      batchStats.tagsSet += normalizedProduct.tags.length;
    }

    // Product materials
    if (normalizedProduct.materials.length > 0) {
      ops.productMaterialsToSet.push({
        productId,
        materials: normalizedProduct.materials,
      });
      batchStats.materialsSet += normalizedProduct.materials.length;
    }

    // Product environment
    if (normalizedProduct.environment) {
      if (normalizedProduct.environment.carbonKgCo2e) {
        ops.productEnvironmentUpserts.push({
          productId,
          metric: "carbon_kg_co2e",
          value: normalizedProduct.environment.carbonKgCo2e,
          unit: "kg_co2e",
        });
        batchStats.environmentSet++;
      }
      if (normalizedProduct.environment.waterLiters) {
        ops.productEnvironmentUpserts.push({
          productId,
          metric: "water_liters",
          value: normalizedProduct.environment.waterLiters,
          unit: "liters",
        });
        batchStats.environmentSet++;
      }
    }

    // Product journey steps
    if (normalizedProduct.journeySteps.length > 0) {
      ops.productJourneyStepsToSet.push({
        productId,
        steps: normalizedProduct.journeySteps,
      });
      batchStats.journeyStepsSet += normalizedProduct.journeySteps.length;
    }

    // Product weight
    if (normalizedProduct.weight?.weight) {
      ops.productWeightUpserts.push({
        productId,
        weight: normalizedProduct.weight.weight,
        weightUnit: normalizedProduct.weight.weightUnit ?? "g",
      });
      batchStats.weightSet++;
    }

    // Variants
    for (const variant of normalizedProduct.variants) {
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
      }

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
 * Uses SET LOCAL to disable triggers for this transaction only.
 * This prevents per-row broadcasts from overwhelming Supabase Realtime.
 */
async function batchExecuteProductionOps(
  database: Database,
  ops: PendingProductionOps,
): Promise<void> {
  await database.transaction(async (tx) => {
    // Note: Database-level throttling in realtime.broadcast_domain_changes() ensures
    // only one broadcast per domain/brand per second, preventing message flooding.

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

    // 5. Product tags (delete old + insert new)
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

    // 8. Product environment (upserts)
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

      // Flatten steps: one row per operator
      const allJourneyInserts = ops.productJourneyStepsToSet.flatMap((j) =>
        j.steps.flatMap((step) =>
          step.operatorIds.map((operatorId) => ({
            productId: j.productId,
            sortIndex: step.sortIndex,
            stepType: step.stepType,
            operatorId,
          })),
        ),
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

    // 14. Variant environment (upserts)
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

      // Flatten steps: one row per operator
      const allJourneyInserts = ops.variantJourneyStepsToSet.flatMap((j) =>
        j.steps.flatMap((step) =>
          step.operatorIds.map((operatorId) => ({
            variantId: j.variantId,
            sortIndex: step.sortIndex,
            stepType: step.stepType,
            operatorId,
          })),
        ),
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
 * Works directly with NormalizedRowData.
 * Returns detailed failure information for error reporting.
 */
async function processImages(
  storageClient: SupabaseClient,
  brandId: string,
  batchData: NormalizedRowData[],
  existingProductImageMap: Map<string, string | null>,
): Promise<{
  completed: number;
  failed: number;
  skipped: number;
  failures: ImageFailure[];
}> {
  const uploadTasks: ImageUploadTask[] = [];
  const failures: ImageFailure[] = [];
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
        // Mutate the product to use existing image path
        (product as { imagePath: string | null }).imagePath =
          existingImagePath ?? null;
        skipped++;
      } else {
        uploadTasks.push({
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
        uploadTasks.push({
          type: "variant",
          entityId: variant.id,
          imageUrl: variant.imagePathOverride,
        });
      }
    }
  }

  if (uploadTasks.length === 0) {
    return { completed: 0, failed: 0, skipped, failures };
  }

  // Process with rate limiting
  let completed = 0;
  let failed = 0;
  let currentIndex = 0;
  const imagePathResults = new Map<string, string | null>();

  await new Promise<void>((resolve) => {
    const processNext = async () => {
      if (currentIndex >= uploadTasks.length) {
        if (completed + failed === uploadTasks.length) {
          resolve();
        }
        return;
      }

      const uploadTask = uploadTasks[currentIndex++]!;

      try {
        const pathPrefix =
          uploadTask.type === "product" ? brandId : `${brandId}/variants`;

        const result = await Promise.race([
          downloadAndUploadImage(storageClient, {
            url: uploadTask.imageUrl,
            bucket: "products",
            pathPrefix,
          }),
          new Promise<{ success: false; path: null; error: string }>(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    success: false,
                    path: null,
                    error: "Request timed out",
                  }),
                IMAGE_TIMEOUT_MS,
              ),
          ),
        ]);

        if (result.success && result.path) {
          imagePathResults.set(
            `${uploadTask.type}:${uploadTask.entityId}`,
            result.path,
          );
          completed++;
        } else {
          failed++;
          failures.push({
            type: uploadTask.type,
            entityId: uploadTask.entityId,
            url: uploadTask.imageUrl,
            error: result.error || "Unknown error",
          });
        }
      } catch (error) {
        failed++;
        failures.push({
          type: uploadTask.type,
          entityId: uploadTask.entityId,
          url: uploadTask.imageUrl,
          error:
            error instanceof Error ? error.message : "Network error or timeout",
        });
      } finally {
        if (currentIndex < uploadTasks.length) {
          processNext();
        }
        if (completed + failed === uploadTasks.length) {
          resolve();
        }
      }
    };

    const initialBatch = Math.min(IMAGE_CONCURRENCY, uploadTasks.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
  });

  // Update batch data with new image paths (mutate in place)
  for (const product of batchData) {
    const productPath = imagePathResults.get(`product:${product.id}`);
    if (productPath) {
      (product as { imagePath: string | null }).imagePath = productPath;
    }

    for (const variant of product.variants) {
      const variantPath = imagePathResults.get(`variant:${variant.id}`);
      if (variantPath) {
        (variant as { imagePathOverride: string | null }).imagePathOverride =
          variantPath;
      }
    }
  }

  return { completed, failed, skipped, failures };
}

// ============================================================================
// Add Image Errors to Import Rows
// ============================================================================

/**
 * Add image download errors to import_rows.normalized so they appear in error report.
 * Must be called BEFORE deleting committed rows.
 */
async function addImageErrorsToImportRows(
  database: Database,
  jobId: string,
  failures: ImageFailure[],
): Promise<void> {
  if (failures.length === 0) return;

  // Group failures by product/variant ID
  const productFailures = new Map<string, ImageFailure>();
  const variantFailures = new Map<string, ImageFailure>();

  for (const failure of failures) {
    if (failure.type === "product") {
      productFailures.set(failure.entityId, failure);
    } else {
      variantFailures.set(failure.entityId, failure);
    }
  }

  // Load all import_rows for this job
  const rows = await database
    .select({
      id: importRows.id,
      normalized: importRows.normalized,
      status: importRows.status,
    })
    .from(importRows)
    .where(eq(importRows.jobId, jobId));

  for (const row of rows) {
    const normalized = row.normalized as NormalizedRowData | null;
    if (!normalized) continue;

    let needsUpdate = false;

    // Check product-level image failure
    const productFailure = productFailures.get(normalized.id);
    if (productFailure) {
      normalized.errors = normalized.errors || [];
      normalized.errors.push({
        field: "Image",
        message: `Image download failed: ${productFailure.error}. Field skipped.`,
      });
      normalized.rowStatus = "PENDING_WITH_WARNINGS";
      needsUpdate = true;
    }

    // Check variant-level image failures
    for (const variant of normalized.variants) {
      const variantFailure = variantFailures.get(variant.id);
      if (variantFailure) {
        variant.errors = variant.errors || [];
        variant.errors.push({
          field: "Image",
          message: `Image download failed: ${variantFailure.error}. Field skipped.`,
        });
        variant.rowStatus = "PENDING_WITH_WARNINGS";
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await database
        .update(importRows)
        .set({
          normalized,
          status: "PENDING_WITH_WARNINGS",
        })
        .where(eq(importRows.id, row.id));
    }
  }

  logger.info("Added image errors to import_rows", {
    productFailures: productFailures.size,
    variantFailures: variantFailures.size,
  });
}

// ============================================================================
// Count Import Row Statuses
// ============================================================================

interface ImportRowCounts {
  pending: number;
  pendingWithWarnings: number;
  blocked: number;
}

/**
 * Count import rows by normalized.rowStatus for the job.
 * This matches how generate-error-report counts issues.
 *
 * Important: We count normalized.rowStatus (inside the JSON), NOT importRows.status (the column).
 * This is because committed rows still have their original normalized.rowStatus preserved,
 * which the error report uses to show which products had issues.
 */
async function countImportRowStatuses(
  database: Database,
  jobId: string,
): Promise<ImportRowCounts> {
  const rows = await database
    .select({ normalized: importRows.normalized })
    .from(importRows)
    .where(eq(importRows.jobId, jobId));

  const counts: ImportRowCounts = {
    pending: 0,
    pendingWithWarnings: 0,
    blocked: 0,
  };

  for (const row of rows) {
    const normalized = row.normalized as NormalizedRowData | null;
    if (!normalized) continue;

    switch (normalized.rowStatus) {
      case "PENDING":
        counts.pending++;
        break;
      case "PENDING_WITH_WARNINGS":
        counts.pendingWithWarnings++;
        break;
      case "BLOCKED":
        counts.blocked++;
        break;
    }
  }

  return counts;
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
