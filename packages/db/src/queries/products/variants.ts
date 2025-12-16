/**
 * Product variant query functions.
 * 
 * Provides functions for listing variants for a product.
 */

import { asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { productVariants } from "../../schema";
import { normalizeLimit, parseCursor } from "../_shared/pagination.js";
import { getProduct, getProductByHandle } from "./get.js";
import type { ProductVariantSummary } from "./types.js";

/**
 * Identifier for variant listing - accepts either product UUID or handle.
 */
export type VariantProductIdentifier = { product_id: string } | { product_handle: string };

/**
 * Lists variants for a product.
 * Accepts either a product ID (UUID) or product handle.
 */
export async function listVariantsForProduct(
  db: Database,
  brandId: string,
  identifier: VariantProductIdentifier,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ProductVariantSummary[]> {
  // Resolve product ID from identifier
  let productId: string;
  
  if ('product_id' in identifier) {
    // Direct product ID - verify it belongs to brand
    const product = await getProduct(db, brandId, identifier.product_id);
    if (!product) return [];
    productId = product.id;
  } else {
    // handle - look up product first
    const product = await getProductByHandle(db, brandId, identifier.product_handle);
    if (!product) return [];
    productId = product.id;
  }

  const limit = normalizeLimit(opts.limit, 1, 100);
  const offset = parseCursor(opts.cursor);

  const rows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    color_id: row.color_id ?? null,
    size_id: row.size_id ?? null,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    upid: row.upid ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

