/**
 * Publish Router.
 *
 * Exposes tRPC endpoints for publishing product passports.
 * Phase 2 rewires these endpoints to flip product status and mark passports dirty.
 *
 * Endpoints:
 * - publish.variant: Publish a single variant
 * - publish.product: Publish all variants of a product
 * - publish.bulk: Publish multiple products at once
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "@v1/db/client";
import {
  PublishLimitExceededError,
  enforcePublishCapacity,
} from "@v1/db/queries/brand";
import type { PublishCapacityResult } from "@v1/db/queries/brand";
import { publishNotificationEvent } from "@v1/db/queries/notifications";
import {
  getPublishingState,
  getOrCreatePassport,
  markPassportDirty,
  markPassportsDirtyByProductIds,
  projectDirtyPassports,
  projectSinglePassport,
} from "@v1/db/queries/products";
import { productVariants, products } from "@v1/db/schema";
import { z } from "zod";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../../../lib/dpp-revalidation.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };
type BrandDb = DatabaseOrTransaction;

interface ProductPublishSummary {
  productId: string;
  status: string;
  variantCount: number;
}

/**
 * Resolve the owning product for a variant inside the active brand.
 */
async function getVariantPublishTarget(
  db: BrandDb,
  brandId: string,
  variantId: string,
): Promise<{ productId: string } | null> {
  // Constrain the lookup to the active brand so publish cannot cross brand boundaries.
  const [target] = await db
    .select({
      productId: productVariants.productId,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(productVariants.id, variantId), eq(products.brandId, brandId)),
    )
    .limit(1);

  return target ?? null;
}

/**
 * Count variants and current status for one or more products inside the active brand.
 */
async function getProductPublishSummaries(
  db: BrandDb,
  brandId: string,
  productIds: string[],
): Promise<ProductPublishSummary[]> {
  // Read the current product status alongside variant counts for publish enforcement.
  if (productIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      productId: products.id,
      status: products.status,
      variantCount: productVariants.id,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(eq(products.brandId, brandId), inArray(products.id, productIds)));

  const summaries = new Map<string, ProductPublishSummary>();
  for (const row of rows) {
    const existing = summaries.get(row.productId);
    if (existing) {
      if (row.variantCount) {
        existing.variantCount += 1;
      }
      continue;
    }

    summaries.set(row.productId, {
      productId: row.productId,
      status: row.status,
      variantCount: row.variantCount ? 1 : 0,
    });
  }

  return productIds
    .map((productId) => summaries.get(productId))
    .filter((summary): summary is ProductPublishSummary => Boolean(summary));
}

/**
 * Flip the supplied products into published status.
 */
async function setProductsPublished(
  db: BrandDb,
  brandId: string,
  productIds: string[],
): Promise<string[]> {
  // Skip empty batches so callers can forward filtered product lists directly.
  if (productIds.length === 0) {
    return [];
  }

  const publishedAt = new Date().toISOString();
  const updated = await db
    .update(products)
    .set({
      status: "published",
      publishedAt,
      updatedAt: publishedAt,
    })
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(products.id, productIds),
        sql`${products.status} <> 'published'`,
      ),
    )
    .returning({ id: products.id });

  return updated.map((row) => row.id);
}

/**
 * Revalidate public caches after an inline passport projection.
 */
async function revalidateProjectedPassports(
  brandId: string,
  identifiers: {
    upids: string[];
    barcodes: string[];
  },
): Promise<void> {
  // Revalidate both public lookup paths without failing the mutation on cache errors.
  await Promise.allSettled([
    revalidatePassports(identifiers.upids),
    revalidateBarcodes(brandId, identifiers.barcodes),
  ]);
}

// =============================================================================
// NOTIFICATION HELPER
// =============================================================================

const PUBLISH_NOTIFICATION_THRESHOLD = 0.9;

/**
 * Publishes a publish-limit warning notification if the brand crossed the 90% threshold.
 * Piggybacks on data already computed by enforcePublishCapacity — no extra queries.
 * Deduplication ensures only one active notification per budget kind.
 */
async function maybePublishLimitNotification(params: {
  db: Database;
  brandId: string;
  capacityResult: PublishCapacityResult;
  publishedCount: number;
}): Promise<void> {
  const { capacityResult, publishedCount } = params;
  if (!capacityResult.budgetKind || capacityResult.limit == null || capacityResult.limit === 0) return;

  const newUsed = capacityResult.used + publishedCount;
  const utilization = newUsed / capacityResult.limit;
  if (utilization < PUBLISH_NOTIFICATION_THRESHOLD) return;

  await publishNotificationEvent(params.db, {
    event: "sku_limit_warning",
    brandId: params.brandId,
    payload: {
      brandId: params.brandId,
      budgetKind: capacityResult.budgetKind,
      used: newUsed,
      limit: capacityResult.limit,
    },
  });
}

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const publishVariantSchema = z.object({
  variantId: z.string().uuid("Invalid variant ID"),
});

const publishProductSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
});

const publishBulkSchema = z.object({
  productIds: z
    .array(z.string().uuid("Invalid product ID"))
    .min(1, "At least one product ID is required")
    .max(100, "Maximum 100 products per bulk publish"),
});

const getPublishingStateSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
});

// =============================================================================
// ROUTER
// =============================================================================

export const publishRouter = createTRPCRouter({
  /**
   * Publish a single variant.
   *
   * Marks the variant dirty, projects it inline, and revalidates the public cache.
   *
   * @param variantId - The variant's UUID
   * @returns Success status with passport info
   */
  variant: brandWriteProcedure
    .input(publishVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const publishResult = await db.transaction(async (tx) => {
          // Load the owning product so publish can enforce capacity only on real transitions.
          const target = await getVariantPublishTarget(
            tx,
            brandId,
            input.variantId,
          );
          if (!target) {
            throw badRequest("Variant not found");
          }

          const summaries = await getProductPublishSummaries(tx, brandId, [
            target.productId,
          ]);
          const summary = summaries[0] ?? null;
          if (!summary) {
            throw badRequest("Product not found");
          }
          if (summary.variantCount === 0) {
            throw badRequest("No variants found for product");
          }

          let capacityResult: PublishCapacityResult | null = null;
          const publishedCount = summary.status !== "published" ? summary.variantCount : 0;

          if (summary.status !== "published") {
            capacityResult = await enforcePublishCapacity(tx, brandId, summary.variantCount);
          }

          const { passport, isNew } = await getOrCreatePassport(
            tx,
            input.variantId,
            brandId,
          );
          if (!passport) {
            throw badRequest("Failed to create or retrieve passport");
          }

          await setProductsPublished(tx, brandId, [target.productId]);
          await markPassportDirty(tx, passport.id);

          return {
            passportId: passport.id,
            isNew,
            capacityResult,
            publishedCount,
          };
        });

        const projection = await projectSinglePassport(db, publishResult.passportId);

        if (!projection.found || !projection.version || !projection.passport) {
          throw badRequest(projection.error ?? "Failed to project passport");
        }

        await revalidateProjectedPassports(brandId, {
          upids: [projection.passport.upid],
          barcodes: projection.passport.barcode
            ? [projection.passport.barcode]
            : [],
        });

        if (publishResult.capacityResult) {
          maybePublishLimitNotification({
            db,
            brandId,
            capacityResult: publishResult.capacityResult,
            publishedCount: publishResult.publishedCount,
          }).catch(() => {});
        }

        return {
          success: true,
          variantId: input.variantId,
          passport: {
            id: projection.passport.id,
            upid: projection.passport.upid,
            isNew: publishResult.isNew,
          },
          version: projection.version,
        };
      } catch (error) {
        if (error instanceof PublishLimitExceededError) {
          throw badRequest(error.message);
        }
        throw wrapError(error, "Failed to publish variant");
      }
    }),

  /**
   * Publish all variants of a product.
   *
   * Marks the product's passports dirty, projects them inline, and revalidates caches.
   *
   * @param productId - The product's UUID
   * @returns Success status with count of targeted variants
   */
  product: brandWriteProcedure
    .input(publishProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const txResult = await db.transaction(async (tx) => {
          // Re-check the product state inside one transaction so publish capacity cannot race.
          const rows = await getProductPublishSummaries(tx, brandId, [
            input.productId,
          ]);
          const summary = rows[0] ?? null;
          if (!summary) {
            throw badRequest("Product not found");
          }
          if (summary.variantCount === 0) {
            throw badRequest("No variants found for product");
          }

          let capacityResult: PublishCapacityResult | null = null;
          const publishedCount = summary.status !== "published" ? summary.variantCount : 0;

          if (summary.status !== "published") {
            capacityResult = await enforcePublishCapacity(tx, brandId, summary.variantCount);
          }

          await setProductsPublished(tx, brandId, [input.productId]);

          return { summary, capacityResult, publishedCount };
        });

        await markPassportsDirtyByProductIds(db, brandId, [input.productId]);
        const projection = await projectDirtyPassports(db, brandId, {
          productIds: [input.productId],
        });

        await revalidateProjectedPassports(brandId, {
          upids: projection.upids,
          barcodes: projection.barcodes,
        });

        if (txResult.capacityResult) {
          maybePublishLimitNotification({
            db,
            brandId,
            capacityResult: txResult.capacityResult,
            publishedCount: txResult.publishedCount,
          }).catch(() => {});
        }

        return {
          success: true,
          productId: input.productId,
          count: txResult.summary.variantCount,
          failed: 0,
          passportsProjected: projection.totalPassportsProjected,
          versionsCreated: projection.versionsCreated,
          versionsSkippedUnchanged: projection.versionsSkippedUnchanged,
        };
      } catch (error) {
        if (error instanceof PublishLimitExceededError) {
          throw badRequest(error.message);
        }
        throw wrapError(error, "Failed to publish product");
      }
    }),

  /**
   * Bulk publish multiple products.
   *
   * Flips the selected products to published and leaves projection to the background job.
   *
   * @param productIds - Array of product UUIDs to publish
   * @returns Success status with total counts
   */
  bulk: brandWriteProcedure
    .input(publishBulkSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const uniqueProductIds = Array.from(new Set(input.productIds));
        const publishResult = await db.transaction(async (tx) => {
          // Enforce the publish budget only for products that are not already published.
          const summaries = await getProductPublishSummaries(
            tx,
            brandId,
            uniqueProductIds,
          );
          const intendedPublishCount = summaries
            .filter((summary) => summary.status !== "published")
            .reduce((total, summary) => total + summary.variantCount, 0);

          const capacityResult = await enforcePublishCapacity(tx, brandId, intendedPublishCount);

          return {
            updatedProductIds: await setProductsPublished(
              tx,
              brandId,
              uniqueProductIds,
            ),
            foundProductCount: summaries.length,
            capacityResult,
            intendedPublishCount,
          };
        });
        const dirtyResult = await markPassportsDirtyByProductIds(
          db,
          brandId,
          uniqueProductIds,
        );

        maybePublishLimitNotification({
          db,
          brandId,
          capacityResult: publishResult.capacityResult,
          publishedCount: publishResult.intendedPublishCount,
        }).catch(() => {});

        return {
          success: true,
          totalProductsPublished: publishResult.updatedProductIds.length,
          totalVariantsPublished: dirtyResult.marked,
          totalFailed: uniqueProductIds.length - publishResult.foundProductCount,
          productsMarkedDirty: publishResult.foundProductCount,
        };
      } catch (error) {
        if (error instanceof PublishLimitExceededError) {
          throw badRequest(error.message);
        }
        throw wrapError(error, "Failed to bulk publish products");
      }
    }),

  /**
   * Get the publishing state for a product.
   *
   * Returns information about whether the product has been published,
   * whether it has unpublished changes, and when it was last published.
   *
   * @param productId - The product's UUID
   * @returns Publishing state info
   */
  state: brandReadProcedure
    .input(getPublishingStateSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const state = await getPublishingState(db, input.productId, brandId);

        if (!state) {
          throw badRequest("Product not found");
        }

        return state;
      } catch (error) {
        throw wrapError(error, "Failed to get publishing state");
      }
    }),
});

type PublishRouter = typeof publishRouter;
