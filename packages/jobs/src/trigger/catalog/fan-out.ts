/**
 * Catalog Fan-Out Task
 *
 * Republishes DPP snapshots for all published products affected by a catalog
 * entity change (manufacturer, material, certification, or operator).
 *
 * Each run is triggered with a 45-second delay from the API. Multiple triggers
 * within the same window create multiple delayed runs, but publish is
 * content-hash-deduplicated so only genuine content changes produce new versions
 * — redundant runs are fast no-ops (versionsSkippedUnchanged will be high).
 *
 * Effective refresh latency: 45–90 seconds from the triggering edit.
 */

import "../configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { eq, inArray } from "@v1/db/index";
import {
  findPublishedProductIdsByCertification,
  findPublishedProductIdsByManufacturer,
  findPublishedProductIdsByMaterial,
  findPublishedProductIdsByOperator,
  publishProductsSetBased,
} from "@v1/db/queries/products";
import { productVariants, products } from "@v1/db/schema";
import { and } from "drizzle-orm";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../../lib/dpp-revalidation";

// =============================================================================
// TYPES
// =============================================================================

export type CatalogEntityType =
  | "manufacturer"
  | "material"
  | "certification"
  | "operator";

export interface CatalogFanOutPayload {
  brandId: string;
  entityType: CatalogEntityType;
  entityId: string;
  productIds?: string[];
}

type CatalogFanOutProductResolvers = {
  findPublishedProductIdsByCertification: typeof findPublishedProductIdsByCertification;
  findPublishedProductIdsByManufacturer: typeof findPublishedProductIdsByManufacturer;
  findPublishedProductIdsByMaterial: typeof findPublishedProductIdsByMaterial;
  findPublishedProductIdsByOperator: typeof findPublishedProductIdsByOperator;
};

const defaultCatalogFanOutResolvers: CatalogFanOutProductResolvers = {
  findPublishedProductIdsByCertification,
  findPublishedProductIdsByManufacturer,
  findPublishedProductIdsByMaterial,
  findPublishedProductIdsByOperator,
};

// =============================================================================
// TASK
// =============================================================================

/**
 * Resolve the published product IDs for a catalog fan-out run.
 */
export async function resolveCatalogFanOutProductIds(
  payload: CatalogFanOutPayload,
  resolvers: CatalogFanOutProductResolvers = defaultCatalogFanOutResolvers,
): Promise<string[]> {
  // Prefer pre-delete product IDs captured by the API before FK nullification.
  if (payload.productIds) {
    return Array.from(new Set(payload.productIds));
  }

  switch (payload.entityType) {
    case "manufacturer":
      return resolvers.findPublishedProductIdsByManufacturer(
        db,
        payload.brandId,
        payload.entityId,
      );
    case "material":
      return resolvers.findPublishedProductIdsByMaterial(
        db,
        payload.brandId,
        payload.entityId,
      );
    case "certification":
      return resolvers.findPublishedProductIdsByCertification(
        db,
        payload.brandId,
        payload.entityId,
      );
    case "operator":
      return resolvers.findPublishedProductIdsByOperator(
        db,
        payload.brandId,
        payload.entityId,
      );
    default:
      logger.warn("Unknown entity type, skipping", {
        entityType: payload.entityType,
      });
      return [];
  }
}

export const catalogFanOut = task({
  id: "catalog-fan-out",
  // A per-brand concurrency key plus a queue limit of 1 prevents overlapping
  // fan-outs for the same brand from stepping on each other's snapshot writes.
  queue: {
    name: "catalog-fan-out",
    concurrencyLimit: 1,
  },
  run: async (payload: CatalogFanOutPayload) => {
    // Resolve affected products, preferring any pre-delete IDs from the payload.
    const { brandId, entityType, entityId } = payload;

    logger.info("Starting catalog fan-out", { brandId, entityType, entityId });

    const productIds = await resolveCatalogFanOutProductIds(payload);

    logger.info("Resolved affected products", {
      entityType,
      entityId,
      productCount: productIds.length,
      resolvedFromPayload: Boolean(payload.productIds),
    });

    if (productIds.length === 0) {
      logger.info("No published products affected, skipping publish");
      return {
        productCount: 0,
        versionsCreated: 0,
        versionsSkippedUnchanged: 0,
      };
    }

    // Step 2: Collect UPIDs and barcodes for cache revalidation after publish.
    // We query before publishing so we have the identifiers even if publish
    // produces no new versions (content-hash deduplication).
    const variantRows = await db
      .select({
        upid: productVariants.upid,
        barcode: productVariants.barcode,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(
          eq(products.brandId, brandId),
          inArray(productVariants.productId, productIds),
        ),
      );

    const upids = variantRows
      .map((r) => r.upid)
      .filter((u): u is string => u !== null && u.trim().length > 0);

    const barcodes = variantRows
      .map((r) => r.barcode)
      .filter((b): b is string => b !== null && b.trim().length > 0);

    // Step 3: Republish snapshots for all affected products.
    const publishResult = await publishProductsSetBased(db, {
      brandId,
      productIds,
    });

    logger.info("Fan-out publish complete", {
      entityType,
      entityId,
      ...publishResult,
    });

    // Step 4: Revalidate DPP cache for affected passports and barcodes.
    // Fire-and-forget: revalidation failures don't affect publish correctness.
    await Promise.allSettled([
      revalidatePassports(upids),
      revalidateBarcodes(brandId, barcodes),
    ]);

    return {
      productCount: productIds.length,
      versionsCreated: publishResult.versionsCreated,
      versionsSkippedUnchanged: publishResult.versionsSkippedUnchanged,
    };
  },
});
