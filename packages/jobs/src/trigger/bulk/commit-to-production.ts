/**
 * Commit to Production Job (Refactored)
 *
 * Phase 2 of the bulk import process:
 * 1. Loads PENDING staging products/variants in batches
 * 2. Commits each to production tables (create or update)
 * 3. Updates per-row status to COMMITTED or FAILED
 * 4. Deletes only COMMITTED rows (keeps FAILED for correction export)
 * 5. Revalidates DPP cache for the brand
 *
 * Key changes from previous version:
 * - Auto-triggered (no "VALIDATED" status check)
 * - Uses rowStatus field on staging tables
 * - Handles variant-level materials, eco claims, journey steps, etc.
 * - Keeps failed rows for Excel export
 *
 * @module commit-to-production
 */

import "../configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { revalidateBrand } from "../../lib/dpp-revalidation";

// ============================================================================
// Types
// ============================================================================

interface CommitToProductionPayload {
  jobId: string;
  brandId: string;
}

interface CommitResult {
  stagingProductId: string;
  success: boolean;
  error?: string;
  productId?: string;
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
  stagingVariantMaterials,
  stagingVariantEcoClaims,
  stagingVariantEnvironment,
  stagingVariantJourneySteps,
  stagingVariantWeight,
  products,
  productVariants,
  productVariantAttributes,
  productTags,
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

const BATCH_SIZE = 100;

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

    let committedCount = 0;
    let failedCount = 0;

    try {
      // Update job status to COMMITTING
      await db
        .update(importJobs)
        .set({
          status: "COMMITTING",
          commitStartedAt: new Date().toISOString(),
        })
        .where(eq(importJobs.id, jobId));

      // Process staging products in batches
      let hasMore = true;
      let lastRowNumber = 0;

      while (hasMore) {
        // Fetch batch of PENDING staging products
        const batch = await db
          .select({
            stagingId: stagingProducts.stagingId,
            rowNumber: stagingProducts.rowNumber,
            action: stagingProducts.action,
            existingProductId: stagingProducts.existingProductId,
            id: stagingProducts.id,
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
              eq(stagingProducts.rowStatus, "PENDING"),
              sql`${stagingProducts.rowNumber} > ${lastRowNumber}`,
            ),
          )
          .orderBy(stagingProducts.rowNumber)
          .limit(BATCH_SIZE);

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        logger.info("Processing batch", {
          size: batch.length,
          startRow: batch[0]?.rowNumber,
          endRow: batch[batch.length - 1]?.rowNumber,
        });

        // Process each product
        for (const stagingProduct of batch) {
          const result = await commitStagingProduct(
            db,
            brandId,
            jobId,
            stagingProduct,
          );

          if (result.success) {
            committedCount++;
          } else {
            failedCount++;
          }

          lastRowNumber = stagingProduct.rowNumber;
        }
      }

      // Delete only COMMITTED staging data
      await deleteCommittedStagingData(db, jobId);

      // Determine final status
      const hasFailures = failedCount > 0;
      const finalStatus = hasFailures ? "COMPLETED_WITH_FAILURES" : "COMPLETED";

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasFailures,
          summary: {
            committed: committedCount,
            failed: failedCount,
          },
        })
        .where(eq(importJobs.id, jobId));

      // Revalidate DPP cache for the brand
      await revalidateBrandCache(brandId);

      const duration = Date.now() - startTime;
      logger.info("Commit-to-production completed", {
        jobId,
        committedCount,
        failedCount,
        duration: `${duration}ms`,
        status: finalStatus,
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
// Commit Staging Product
// ============================================================================

interface StagingProductRow {
  stagingId: string;
  rowNumber: number;
  action: string;
  existingProductId: string | null;
  id: string;
  name: string;
  description: string | null;
  manufacturerId: string | null;
  imagePath: string | null;
  categoryId: string | null;
  seasonId: string | null;
  productHandle: string | null;
  status: string | null;
}

async function commitStagingProduct(
  database: Database,
  brandId: string,
  jobId: string,
  stagingProduct: StagingProductRow,
): Promise<CommitResult> {
  const {
    stagingId,
    action,
    existingProductId,
    id: productId,
  } = stagingProduct;

  try {
    await database.transaction(async (tx) => {
      // 1. Create or update product
      if (action === "CREATE") {
        await tx.insert(products).values({
          id: productId,
          brandId,
          name: stagingProduct.name,
          productHandle: stagingProduct.productHandle ?? productId, // Use ID as fallback
          description: stagingProduct.description ?? undefined,
          categoryId: stagingProduct.categoryId ?? undefined,
          seasonId: stagingProduct.seasonId ?? undefined,
          manufacturerId: stagingProduct.manufacturerId ?? undefined,
          imagePath: stagingProduct.imagePath ?? undefined,
          status: stagingProduct.status ?? "draft",
        });
      } else {
        // UPDATE
        await tx
          .update(products)
          .set({
            name: stagingProduct.name,
            productHandle: stagingProduct.productHandle ?? undefined,
            description: stagingProduct.description ?? undefined,
            categoryId: stagingProduct.categoryId ?? undefined,
            seasonId: stagingProduct.seasonId ?? undefined,
            manufacturerId: stagingProduct.manufacturerId ?? undefined,
            imagePath: stagingProduct.imagePath ?? undefined,
            status: stagingProduct.status ?? undefined,
          })
          .where(eq(products.id, existingProductId!));
      }

      // 2. Process staging variants
      const stagingVariants = await tx
        .select()
        .from(stagingProductVariants)
        .where(eq(stagingProductVariants.stagingProductId, stagingId));

      for (const stagingVariant of stagingVariants) {
        const variantId = stagingVariant.id;

        // Create or update variant
        if (stagingVariant.action === "CREATE") {
          await tx.insert(productVariants).values({
            id: variantId,
            productId,
            barcode: stagingVariant.barcode,
            sku: stagingVariant.sku,
          });
        } else {
          await tx
            .update(productVariants)
            .set({
              barcode: stagingVariant.barcode,
              sku: stagingVariant.sku,
            })
            .where(eq(productVariants.id, stagingVariant.existingVariantId!));
        }

        // 3. Commit variant attributes
        const stagingAttrs = await tx
          .select()
          .from(stagingVariantAttributes)
          .where(
            eq(
              stagingVariantAttributes.stagingVariantId,
              stagingVariant.stagingId,
            ),
          );

        if (stagingAttrs.length > 0) {
          // Delete existing and insert new
          await tx
            .delete(productVariantAttributes)
            .where(eq(productVariantAttributes.variantId, variantId));

          await tx.insert(productVariantAttributes).values(
            stagingAttrs.map((a) => ({
              variantId,
              attributeId: a.attributeId,
              attributeValueId: a.attributeValueId,
              sortOrder: a.sortOrder,
            })),
          );
        }

        // 4. Commit variant materials
        const stagingMats = await tx
          .select()
          .from(stagingVariantMaterials)
          .where(
            eq(
              stagingVariantMaterials.stagingVariantId,
              stagingVariant.stagingId,
            ),
          );

        if (stagingMats.length > 0) {
          await tx
            .delete(variantMaterials)
            .where(eq(variantMaterials.variantId, variantId));

          await tx.insert(variantMaterials).values(
            stagingMats.map((m) => ({
              variantId,
              brandMaterialId: m.brandMaterialId,
              percentage: m.percentage,
            })),
          );
        }

        // 5. Commit variant eco claims
        const stagingClaims = await tx
          .select()
          .from(stagingVariantEcoClaims)
          .where(
            eq(
              stagingVariantEcoClaims.stagingVariantId,
              stagingVariant.stagingId,
            ),
          );

        if (stagingClaims.length > 0) {
          await tx
            .delete(variantEcoClaims)
            .where(eq(variantEcoClaims.variantId, variantId));

          await tx.insert(variantEcoClaims).values(
            stagingClaims.map((c) => ({
              variantId,
              ecoClaimId: c.ecoClaimId,
            })),
          );
        }

        // 6. Commit variant environment
        const stagingEnv = await tx
          .select()
          .from(stagingVariantEnvironment)
          .where(
            eq(
              stagingVariantEnvironment.stagingVariantId,
              stagingVariant.stagingId,
            ),
          );

        if (stagingEnv.length > 0) {
          const env = stagingEnv[0];
          await tx
            .insert(variantEnvironment)
            .values({
              variantId,
              carbonKgCo2e: env?.carbonKgCo2e,
              waterLiters: env?.waterLiters,
            })
            .onConflictDoUpdate({
              target: variantEnvironment.variantId,
              set: {
                carbonKgCo2e: env?.carbonKgCo2e,
                waterLiters: env?.waterLiters,
              },
            });
        }

        // 7. Commit variant journey steps
        const stagingSteps = await tx
          .select()
          .from(stagingVariantJourneySteps)
          .where(
            eq(
              stagingVariantJourneySteps.stagingVariantId,
              stagingVariant.stagingId,
            ),
          );

        if (stagingSteps.length > 0) {
          await tx
            .delete(variantJourneySteps)
            .where(eq(variantJourneySteps.variantId, variantId));

          await tx.insert(variantJourneySteps).values(
            stagingSteps.map((s) => ({
              variantId,
              sortIndex: s.sortIndex,
              stepType: s.stepType,
              facilityId: s.facilityId,
            })),
          );
        }

        // 8. Commit variant weight
        const stagingWeightData = await tx
          .select()
          .from(stagingVariantWeight)
          .where(
            eq(stagingVariantWeight.stagingVariantId, stagingVariant.stagingId),
          );

        if (stagingWeightData.length > 0) {
          const w = stagingWeightData[0];
          await tx
            .insert(variantWeight)
            .values({
              variantId,
              weight: w?.weight,
              weightUnit: w?.weightUnit,
            })
            .onConflictDoUpdate({
              target: variantWeight.variantId,
              set: {
                weight: w?.weight,
                weightUnit: w?.weightUnit,
              },
            });
        }

        // Update variant staging status
        await tx
          .update(stagingProductVariants)
          .set({ rowStatus: "COMMITTED" })
          .where(
            eq(stagingProductVariants.stagingId, stagingVariant.stagingId),
          );
      }

      // 3. Commit product tags
      const stagingTagsData = await tx
        .select()
        .from(stagingProductTags)
        .where(eq(stagingProductTags.stagingProductId, stagingId));

      if (stagingTagsData.length > 0) {
        await tx
          .delete(productTags)
          .where(eq(productTags.productId, productId));

        await tx.insert(productTags).values(
          stagingTagsData.map((t) => ({
            productId,
            tagId: t.tagId,
          })),
        );
      }

      // Mark product as COMMITTED
      await tx
        .update(stagingProducts)
        .set({ rowStatus: "COMMITTED" })
        .where(eq(stagingProducts.stagingId, stagingId));
    });

    return { stagingProductId: stagingId, success: true, productId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Failed to commit staging product", {
      stagingId,
      error: errorMessage,
    });

    // Mark as FAILED (outside transaction)
    await database
      .update(stagingProducts)
      .set({
        rowStatus: "FAILED",
        errors: [{ field: "commit", message: errorMessage }],
      })
      .where(eq(stagingProducts.stagingId, stagingId));

    return { stagingProductId: stagingId, success: false, error: errorMessage };
  }
}

// ============================================================================
// Delete Committed Staging Data
// ============================================================================

async function deleteCommittedStagingData(
  database: Database,
  jobId: string,
): Promise<void> {
  // Get all COMMITTED staging product IDs
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

  // Delete in batches to avoid memory issues
  const CHUNK_SIZE = 500;
  for (let i = 0; i < stagingIds.length; i += CHUNK_SIZE) {
    const chunk = stagingIds.slice(i, i + CHUNK_SIZE);

    // Delete cascades from staging_products to related tables
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
    // Don't fail the job if revalidation fails
    logger.warn("DPP cache revalidation failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
