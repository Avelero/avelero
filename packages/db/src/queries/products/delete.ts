/**
 * Shared product deletion helpers.
 *
 * Every product delete path should use these helpers so storage cleanup and
 * public-cache invalidation inputs are collected consistently before cascade
 * deletion removes the related rows.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { productVariants, products } from "../../schema";

/**
 * Identifiers and storage paths collected before a delete chunk runs.
 */
export interface ProductDeleteArtifacts {
  productIds: string[];
  imagePaths: string[];
  upids: string[];
  barcodes: string[];
  storageCleanupBarcodes: string[];
}

/**
 * Result of deleting one chunk of products.
 */
export interface DeleteProductsChunkResult extends ProductDeleteArtifacts {
  deleted: number;
}

/**
 * Options for one product delete chunk.
 */
export interface DeleteProductsChunkOptions {
  /** Suppress row-level realtime broadcasts for the current transaction only. */
  suppressRealtimeBroadcast?: boolean;
}

/**
 * Collect delete-time identifiers and storage paths for one product chunk.
 */
export async function collectProductDeleteArtifacts(
  db: DatabaseOrTransaction,
  brandId: string,
  productIds: string[],
): Promise<ProductDeleteArtifacts> {
  // Snapshot the current products and variants before cascade deletion removes them.
  const uniqueProductIds = Array.from(new Set(productIds));
  if (uniqueProductIds.length === 0) {
    return {
      productIds: [],
      imagePaths: [],
      upids: [],
      barcodes: [],
      storageCleanupBarcodes: [],
    };
  }

  const [productRows, variantRows] = await Promise.all([
    db
      .select({
        id: products.id,
        imagePath: products.imagePath,
      })
      .from(products)
      .where(and(eq(products.brandId, brandId), inArray(products.id, uniqueProductIds))),
    db
      .select({
        upid: productVariants.upid,
        barcode: productVariants.barcode,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(products.brandId, brandId), inArray(products.id, uniqueProductIds))),
  ]);

  return {
    productIds: productRows.map((row) => row.id),
    imagePaths: productRows
      .map((row) => row.imagePath)
      .filter((imagePath): imagePath is string => Boolean(imagePath)),
    upids: Array.from(
      new Set(
        variantRows
          .map((row) => row.upid?.trim() ?? null)
          .filter((upid): upid is string => Boolean(upid)),
      ),
    ),
    barcodes: Array.from(
      new Set(
        variantRows
          .map((row) => row.barcode?.trim() ?? null)
          .filter((barcode): barcode is string => Boolean(barcode)),
      ),
    ),
    storageCleanupBarcodes: Array.from(
      new Set(
        variantRows
          .map((row) => row.barcode ?? null)
          .filter(
            (barcode): barcode is string =>
              typeof barcode === "string" && barcode.trim().length > 0,
          ),
      ),
    ),
  };
}

/**
 * Disable row-level realtime broadcasts for the current transaction only.
 */
async function suppressRealtimeBroadcastsForTransaction(
  db: DatabaseOrTransaction,
): Promise<void> {
  await db.execute(
    sql`select set_config('app.skip_realtime_broadcast', 'on', true)`,
  );
}

/**
 * Delete one chunk of products after collecting cleanup artifacts.
 */
export async function deleteProductsChunk(
  db: DatabaseOrTransaction,
  brandId: string,
  productIds: string[],
  opts: DeleteProductsChunkOptions = {},
): Promise<DeleteProductsChunkResult> {
  // Gather all cleanup inputs first, then perform one cascade delete.
  const artifacts = await collectProductDeleteArtifacts(db, brandId, productIds);

  if (artifacts.productIds.length === 0) {
    return {
      ...artifacts,
      deleted: 0,
    };
  }

  if (opts.suppressRealtimeBroadcast) {
    await suppressRealtimeBroadcastsForTransaction(db);
  }

  const deletedRows = await db
    .delete(products)
    .where(and(eq(products.brandId, brandId), inArray(products.id, artifacts.productIds)))
    .returning({ id: products.id });

  return {
    ...artifacts,
    deleted: deletedRows.length,
  };
}
