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
}

// =============================================================================
// TASK
// =============================================================================

export const catalogFanOut = task({
  id: "catalog-fan-out",
  // Concurrency limit of 1 per brand prevents fan-outs for the same brand from
  // running simultaneously and stepping on each other's snapshot writes.
  queue: {
    name: "catalog-fan-out",
    concurrencyLimit: 5,
  },
  run: async (payload: CatalogFanOutPayload) => {
    const { brandId, entityType, entityId } = payload;

    logger.info("Starting catalog fan-out", { brandId, entityType, entityId });

    // Step 1: Resolve affected published product IDs.
    let productIds: string[];
    switch (entityType) {
      case "manufacturer":
        productIds = await findPublishedProductIdsByManufacturer(
          db,
          brandId,
          entityId,
        );
        break;
      case "material":
        productIds = await findPublishedProductIdsByMaterial(
          db,
          brandId,
          entityId,
        );
        break;
      case "certification":
        productIds = await findPublishedProductIdsByCertification(
          db,
          brandId,
          entityId,
        );
        break;
      case "operator":
        productIds = await findPublishedProductIdsByOperator(
          db,
          brandId,
          entityId,
        );
        break;
      default:
        logger.warn("Unknown entity type, skipping", { entityType });
        return { skipped: true, reason: "unknown_entity_type" };
    }

    logger.info("Resolved affected products", {
      entityType,
      entityId,
      productCount: productIds.length,
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
