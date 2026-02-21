/**
 * Product query helpers for QR export.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { productVariants, products } from "../../schema";
import {
  getProductSelectionCounts,
  resolveSelectedProductIds,
  type ProductSelectionCounts,
  type ProductSelectionOptions,
} from "./count";

export interface QrExportVariantRow {
  variantId: string;
  productId: string;
  productTitle: string;
  variantUpid: string | null;
  barcode: string;
}

export type QrExportSelectionOptions = ProductSelectionOptions;
export type QrExportSelectionSummary = ProductSelectionCounts;
export const resolveQrExportProductIds = resolveSelectedProductIds;
export const getQrExportSelectionSummary = getProductSelectionCounts;

/**
 * Loads eligible variant rows (non-ghost variants with non-empty barcode)
 * for QR export generation.
 */
export async function getQrExportVariantRows(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<QrExportVariantRow[]> {
  if (productIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productTitle: products.name,
      variantUpid: productVariants.upid,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(productVariants.productId, productIds),
        eq(productVariants.isGhost, false),
        sql`${productVariants.barcode} is not null`,
        sql`btrim(${productVariants.barcode}) <> ''`,
      ),
    )
    .orderBy(asc(products.createdAt), asc(productVariants.createdAt));

  return rows.map((row) => ({
    variantId: row.variantId,
    productId: row.productId,
    productTitle: row.productTitle,
    variantUpid: row.variantUpid,
    barcode: row.barcode ?? "",
  }));
}
