/**
 * Product get/retrieve query functions.
 * 
 * Provides functions for retrieving individual products by ID or handle,
 * with optional variant and attribute loading.
 */

import { and, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { products } from "../../schema";
import {
  createEmptyAttributes,
  loadAttributesForProducts,
  loadVariantsForProducts,
} from "./_shared/helpers.js";
import type { ProductHandle, ProductWithRelations } from "./types.js";

/**
 * Retrieves a product by ID.
 */
export async function getProduct(
  db: Database,
  brandId: string,
  id: string,
) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season_id: products.seasonId,
      manufacturer_id: products.manufacturerId,
      primary_image_path: products.primaryImagePath,
      product_handle: products.productHandle,
      status: products.status,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Retrieves a product by handle.
 */
export async function getProductByHandle(
  db: Database,
  brandId: string,
  handle: string,
) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season_id: products.seasonId,
      manufacturer_id: products.manufacturerId,
      primary_image_path: products.primaryImagePath,
      product_handle: products.productHandle,
      status: products.status,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.productHandle, handle), eq(products.brandId, brandId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Retrieves a product with optional variants and attributes.
 * Accepts either a product ID (UUID) or handle (brand-defined identifier).
 */
export async function getProductWithIncludes(
  db: Database,
  brandId: string,
  identifier: ProductHandle,
  opts: { includeVariants?: boolean; includeAttributes?: boolean } = {},
): Promise<ProductWithRelations | null> {
  // Determine which lookup to use based on identifier type
  const base = 'id' in identifier
    ? await getProduct(db, brandId, identifier.id)
    : await getProductByHandle(db, brandId, identifier.handle);
  
  if (!base) return null;

  const product: ProductWithRelations = { ...base };
  const productIds = [product.id];

  if (opts.includeVariants) {
    const variantsMap = await loadVariantsForProducts(db, productIds);
    product.variants = variantsMap.get(product.id) ?? [];
  }

  if (opts.includeAttributes) {
    const attributesMap = await loadAttributesForProducts(db, productIds);
    product.attributes =
      attributesMap.get(product.id) ?? createEmptyAttributes();
  }

  return product;
}




