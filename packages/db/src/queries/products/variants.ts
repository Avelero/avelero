/**
 * Product variant query functions.
 *
 * Provides functions for listing variants for a product with attributes,
 * and barcode uniqueness checking within brands.
 */

import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributeValues,
  brandAttributes,
  productVariantAttributes,
  productVariants,
  products,
} from "../../schema";
import { normalizeLimit, parseCursor } from "../_shared/pagination.js";
import { getProduct, getProductByHandle } from "./get";
import type {
  ProductVariantWithAttributes,
  VariantAttributeSummary,
} from "./types";

/**
 * Identifier for variant listing - accepts either product UUID or handle.
 */
export type VariantProductIdentifier =
  | { product_id: string }
  | { product_handle: string };

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

  if ("product_id" in identifier) {
    // Direct product ID - verify it belongs to brand
    const product = await getProduct(db, brandId, identifier.product_id);
    if (!product) return [];
    productId = product.id;
  } else {
    // handle - look up product first
    const product = await getProductByHandle(
      db,
      brandId,
      identifier.product_handle,
    );
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
      isGhost: productVariants.isGhost,
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
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id),
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id),
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
    isGhost: row.isGhost,
  }));
}

// ============================================================================
// Barcode Uniqueness Functions
// ============================================================================

/**
 * Checks if a barcode is already taken within a brand.
 *
 * @param db - Database instance
 * @param brandId - The brand ID to check within
 * @param barcode - The barcode to check
 * @param excludeVariantId - Optional variant ID to exclude (for updates)
 * @returns true if barcode is taken, false if available
 */
export async function isBarcodeTakenInBrand(
  db: Database,
  brandId: string,
  barcode: string,
  excludeVariantId?: string,
): Promise<boolean> {
  // Empty barcodes are always available (not unique constraint enforced)
  if (!barcode || barcode.trim() === "") {
    return false;
  }

  const conditions = [
    eq(productVariants.barcode, barcode),
    eq(products.brandId, brandId),
  ];

  if (excludeVariantId) {
    conditions.push(ne(productVariants.id, excludeVariantId));
  }

  const rows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...conditions))
    .limit(1);

  return rows.length > 0;
}

/**
 * Checks multiple barcodes at once and returns the ones that are already taken.
 * Used during sync/import operations for efficiency.
 *
 * @param db - Database instance
 * @param brandId - The brand ID to check within
 * @param barcodes - Array of barcodes to check
 * @param excludeVariantIds - Optional variant IDs to exclude (for updates)
 * @returns Array of barcodes that are already taken
 */
export async function getBatchTakenBarcodes(
  db: Database,
  brandId: string,
  barcodes: string[],
  excludeVariantIds?: string[],
): Promise<string[]> {
  // Filter out empty/whitespace barcodes
  const validBarcodes = barcodes
    .map((b) => b?.trim())
    .filter((b): b is string => Boolean(b));

  if (validBarcodes.length === 0) {
    return [];
  }

  const conditions = [
    inArray(productVariants.barcode, validBarcodes),
    eq(products.brandId, brandId),
  ];

  if (excludeVariantIds && excludeVariantIds.length > 0) {
    conditions.push(
      // Using SQL to express NOT IN since drizzle's ne doesn't support arrays directly
      // We need to use a different approach - filter after query or use raw SQL
      // For simplicity, we'll filter the results in JS
    );
  }

  let rows = await db
    .select({
      id: productVariants.id,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...conditions));

  // Filter out excluded variants if provided
  if (excludeVariantIds && excludeVariantIds.length > 0) {
    const excludeSet = new Set(excludeVariantIds);
    rows = rows.filter((row) => !excludeSet.has(row.id));
  }

  // Return unique barcodes that are taken
  const takenBarcodes = new Set<string>();
  for (const row of rows) {
    if (row.barcode) {
      takenBarcodes.add(row.barcode);
    }
  }

  return Array.from(takenBarcodes);
}
