/**
 * Product variant query functions.
 * 
 * Provides functions for listing variants for a product with attributes.
 */

import { asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributes,
  brandAttributeValues,
  productVariantAttributes,
  productVariants,
} from "../../schema";
import { normalizeLimit, parseCursor } from "../_shared/pagination.js";
import { getProduct, getProductByHandle } from "./get";
import type { ProductVariantWithAttributes, VariantAttributeSummary } from "./types";

/**
 * Identifier for variant listing - accepts either product UUID or handle.
 */
export type VariantProductIdentifier = { product_id: string } | { product_handle: string };

/**
 * Lists variants for a product with their attributes.
 * Accepts either a product ID (UUID) or product handle.
 */
export async function listVariantsForProduct(
  db: Database,
  brandId: string,
  identifier: VariantProductIdentifier,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ProductVariantWithAttributes[]> {
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

  // Load variants
  const variantRows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
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

  if (variantRows.length === 0) return [];

  // Load attributes for all variants
  const variantIds = variantRows.map((v) => v.id);
  const attributeRows = await db
    .select({
      variant_id: productVariantAttributes.variantId,
      attribute_id: brandAttributeValues.attributeId,
      attribute_name: brandAttributes.name,
      taxonomy_attribute_id: brandAttributes.taxonomyAttributeId,
      value_id: brandAttributeValues.id,
      value_name: brandAttributeValues.name,
      taxonomy_value_id: brandAttributeValues.taxonomyValueId,
      sort_order: productVariantAttributes.sortOrder,
    })
    .from(productVariantAttributes)
    .innerJoin(
      brandAttributeValues,
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id)
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id)
    )
    .where(inArray(productVariantAttributes.variantId, variantIds))
    .orderBy(asc(productVariantAttributes.sortOrder));

  // Group attributes by variant ID
  const attributesByVariant = new Map<string, VariantAttributeSummary[]>();
  for (const row of attributeRows) {
    const attrs = attributesByVariant.get(row.variant_id) ?? [];
    attrs.push({
      attribute_id: row.attribute_id,
      attribute_name: row.attribute_name,
      taxonomy_attribute_id: row.taxonomy_attribute_id ?? null,
      value_id: row.value_id,
      value_name: row.value_name,
      taxonomy_value_id: row.taxonomy_value_id ?? null,
    });
    attributesByVariant.set(row.variant_id, attrs);
  }

  return variantRows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    upid: row.upid ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attributes: attributesByVariant.get(row.id) ?? [],
  }));
}

