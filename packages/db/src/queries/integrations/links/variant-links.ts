/**
 * Variant link query functions.
 *
 * Handles mapping external variants to internal product variants.
 * Used for tracking which Avelero variants correspond to external system variants.
 */

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../../../client";
import {
  integrationVariantLinks,
  productVariants,
  products,
} from "../../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface VariantLinkData {
  id: string;
  brandIntegrationId: string;
  variantId: string;
  externalId: string;
  externalProductId: string | null;
  externalSku: string | null;
  externalBarcode: string | null;
  lastSyncedHash: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVariantLinkInput {
  brandIntegrationId: string;
  variantId: string;
  externalId: string;
  externalProductId?: string | null;
  externalSku?: string | null;
  externalBarcode?: string | null;
  lastSyncedHash?: string | null;
}

export interface UpdateVariantLinkInput {
  externalSku?: string | null;
  externalBarcode?: string | null;
  lastSyncedHash?: string | null;
}

// =============================================================================
// SINGLE OPERATIONS
// =============================================================================

/**
 * Find a variant link by external ID.
 */
export async function findVariantLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string
): Promise<VariantLinkData | null> {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.externalId, externalId)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Find a variant link by variant ID.
 */
export async function findVariantLinkByVariantId(
  db: Database,
  brandIntegrationId: string,
  variantId: string
): Promise<VariantLinkData | null> {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.variantId, variantId)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Create a variant link.
 */
export async function createVariantLink(
  db: Database,
  input: CreateVariantLinkInput
): Promise<VariantLinkData> {
  const [row] = await db
    .insert(integrationVariantLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      variantId: input.variantId,
      externalId: input.externalId,
      externalProductId: input.externalProductId ?? null,
      externalSku: input.externalSku ?? null,
      externalBarcode: input.externalBarcode ?? null,
      lastSyncedHash: input.lastSyncedHash ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    });

  if (!row) {
    throw new Error("Failed to create variant link");
  }
  return row;
}

/**
 * Update a variant link.
 */
export async function updateVariantLink(
  db: Database,
  id: string,
  input: UpdateVariantLinkInput
): Promise<VariantLinkData | null> {
  const [row] = await db
    .update(integrationVariantLinks)
    .set({
      externalSku: input.externalSku,
      externalBarcode: input.externalBarcode,
      lastSyncedHash: input.lastSyncedHash,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationVariantLinks.id, id))
    .returning({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    });
  return row ?? null;
}

/**
 * Delete a variant link.
 */
export async function deleteVariantLink(
  db: Database,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.id, id))
    .returning({ id: integrationVariantLinks.id });
  return result.length > 0;
}

/**
 * List all variant links for a brand integration.
 */
export async function listVariantLinks(
  db: Database,
  brandIntegrationId: string
): Promise<VariantLinkData[]> {
  return db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Delete all variant links for a brand integration.
 */
export async function deleteAllVariantLinks(
  db: Database,
  brandIntegrationId: string
): Promise<number> {
  const result = await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId))
    .returning({ id: integrationVariantLinks.id });
  return result.length;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Batch find variant links by external IDs.
 * Returns a Map for O(1) lookup.
 */
export async function batchFindVariantLinks(
  db: Database,
  brandIntegrationId: string,
  externalIds: string[]
): Promise<Map<string, VariantLinkData>> {
  if (externalIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        inArray(integrationVariantLinks.externalId, externalIds)
      )
    );

  const map = new Map<string, VariantLinkData>();
  for (const row of rows) {
    map.set(row.externalId, row);
  }
  return map;
}

/**
 * Batch upsert variant links.
 * Creates new links or updates existing ones.
 */
export async function batchUpsertVariantLinks(
  db: Database,
  links: CreateVariantLinkInput[]
): Promise<void> {
  if (links.length === 0) return;

  // Use ON CONFLICT DO UPDATE for upsert behavior
  await db
    .insert(integrationVariantLinks)
    .values(
      links.map((link) => ({
        brandIntegrationId: link.brandIntegrationId,
        variantId: link.variantId,
        externalId: link.externalId,
        externalProductId: link.externalProductId ?? null,
        externalSku: link.externalSku ?? null,
        externalBarcode: link.externalBarcode ?? null,
        lastSyncedHash: link.lastSyncedHash ?? null,
        lastSyncedAt: new Date().toISOString(),
      }))
    )
    .onConflictDoUpdate({
      target: [
        integrationVariantLinks.brandIntegrationId,
        integrationVariantLinks.externalId,
      ],
      set: {
        externalSku: sql`EXCLUDED.external_sku`,
        externalBarcode: sql`EXCLUDED.external_barcode`,
        lastSyncedHash: sql`EXCLUDED.last_synced_hash`,
        lastSyncedAt: sql`EXCLUDED.last_synced_at`,
        updatedAt: new Date().toISOString(),
      },
    });
}

// =============================================================================
// BATCH VARIANT PRE-FETCH
// =============================================================================

export interface PreFetchedVariant {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
}

/**
 * Batch fetch all variants for a set of product IDs.
 * Returns a Map<productId, variants[]> for O(1) lookup per product.
 * This eliminates N queries (one per product) with a single batch query.
 */
export async function batchFindVariantsByProductIds(
  db: Database,
  productIds: string[]
): Promise<Map<string, PreFetchedVariant[]>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds));

  // Group by productId for O(1) lookup
  const map = new Map<string, PreFetchedVariant[]>();
  for (const row of rows) {
    const existing = map.get(row.productId) ?? [];
    existing.push(row);
    map.set(row.productId, existing);
  }
  return map;
}

// =============================================================================
// SKU/BARCODE MATCHING
// =============================================================================

export interface VariantMatchResult {
  variantId: string;
  productId: string;
  productHandle: string;
  sku: string | null;
  barcode: string | null;
}

/**
 * Find variants by SKU or barcode within a brand.
 * Used for matching existing variants when no link exists.
 *
 * Returns all matching variants with their product info.
 */
export async function findVariantsBySKUorBarcode(
  db: Database,
  brandId: string,
  skus: string[],
  barcodes: string[]
): Promise<VariantMatchResult[]> {
  // Filter out empty strings
  const validSkus = skus.filter((s) => s?.trim());
  const validBarcodes = barcodes.filter((b) => b?.trim());

  if (validSkus.length === 0 && validBarcodes.length === 0) {
    return [];
  }

  // Build OR conditions for SKU and barcode matching
  const conditions = [];
  if (validSkus.length > 0) {
    conditions.push(inArray(productVariants.sku, validSkus));
  }
  if (validBarcodes.length > 0) {
    conditions.push(inArray(productVariants.barcode, validBarcodes));
  }

  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      productHandle: products.productHandle,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(products.brandId, brandId), or(...conditions)));

  return rows;
}

/**
 * Find a single product by any of its variant identifiers.
 * Prioritizes barcode matches (standardized) over SKU matches (system-specific).
 */
export async function findProductByVariantIdentifiers(
  db: Database,
  brandId: string,
  identifiers: { sku?: string; barcode?: string }[]
): Promise<{ productId: string; productHandle: string } | null> {
  const barcodes = identifiers
    .map((i) => i.barcode)
    .filter((b): b is string => Boolean(b?.trim()));
  const skus = identifiers
    .map((i) => i.sku)
    .filter((s): s is string => Boolean(s?.trim()));

  // Priority 1: Match by barcode (standardized, reliable)
  if (barcodes.length > 0) {
    const barcodeMatches = await findVariantsBySKUorBarcode(db, brandId, [], barcodes);
    if (barcodeMatches[0]) {
      return { productId: barcodeMatches[0].productId, productHandle: barcodeMatches[0].productHandle };
    }
  }

  // Priority 2: Fall back to SKU (less reliable across systems)
  if (skus.length > 0) {
    const skuMatches = await findVariantsBySKUorBarcode(db, brandId, skus, []);
    if (skuMatches[0]) {
      return { productId: skuMatches[0].productId, productHandle: skuMatches[0].productHandle };
    }
  }

  return null;
}

// =============================================================================
// BATCH IDENTIFIER MATCHING
// =============================================================================

/**
 * Input for batch identifier matching - one entry per external product.
 */
export interface ProductIdentifierBatch {
  externalId: string;
  identifiers: { sku?: string; barcode?: string }[];
}

/**
 * Result of batch identifier matching.
 */
export interface BatchIdentifierMatchResult {
  /** Map from external product ID to matched internal product */
  matches: Map<string, { productId: string; productHandle: string }>;
}

/**
 * Batch find products by variant identifiers for multiple external products.
 * 
 * This eliminates N queries (one per product) with 1-2 batch queries.
 * Prioritizes barcode matches over SKU matches.
 * 
 * @param db - Database connection
 * @param brandId - Brand ID to search within
 * @param products - Array of external products with their variant identifiers
 * @returns Map from external product ID to matched internal product
 */
export async function batchFindProductsByIdentifiers(
  db: Database,
  brandId: string,
  products: ProductIdentifierBatch[]
): Promise<BatchIdentifierMatchResult> {
  const matches = new Map<string, { productId: string; productHandle: string }>();
  
  if (products.length === 0) {
    return { matches };
  }

  // Collect all unique SKUs and barcodes from all products
  const allBarcodes: string[] = [];
  const allSkus: string[] = [];
  
  // Track which identifiers belong to which external product
  const barcodeToExternalIds = new Map<string, string[]>();
  const skuToExternalIds = new Map<string, string[]>();
  
  for (const product of products) {
    for (const id of product.identifiers) {
      if (id.barcode?.trim()) {
        const barcode = id.barcode.trim().toLowerCase();
        allBarcodes.push(id.barcode.trim());
        const existing = barcodeToExternalIds.get(barcode) ?? [];
        existing.push(product.externalId);
        barcodeToExternalIds.set(barcode, existing);
      }
      if (id.sku?.trim()) {
        const sku = id.sku.trim().toLowerCase();
        allSkus.push(id.sku.trim());
        const existing = skuToExternalIds.get(sku) ?? [];
        existing.push(product.externalId);
        skuToExternalIds.set(sku, existing);
      }
    }
  }

  // Priority 1: Match by barcode (single batch query)
  if (allBarcodes.length > 0) {
    const barcodeMatches = await findVariantsBySKUorBarcode(db, brandId, [], allBarcodes);
    for (const match of barcodeMatches) {
      if (!match.barcode) continue;
      const externalIds = barcodeToExternalIds.get(match.barcode.toLowerCase()) ?? [];
      for (const externalId of externalIds) {
        if (!matches.has(externalId)) {
          matches.set(externalId, { productId: match.productId, productHandle: match.productHandle });
        }
      }
    }
  }

  // Priority 2: Match by SKU for remaining unmatched products (single batch query)
  const unmatchedWithSkus = products.filter(
    p => !matches.has(p.externalId) && p.identifiers.some(i => i.sku?.trim())
  );
  
  if (unmatchedWithSkus.length > 0 && allSkus.length > 0) {
    // Only query for SKUs of unmatched products
    const skusToQuery = new Set<string>();
    for (const p of unmatchedWithSkus) {
      for (const id of p.identifiers) {
        if (id.sku?.trim()) skusToQuery.add(id.sku.trim());
      }
    }
    
    const skuMatches = await findVariantsBySKUorBarcode(db, brandId, Array.from(skusToQuery), []);
    for (const match of skuMatches) {
      if (!match.sku) continue;
      const externalIds = skuToExternalIds.get(match.sku.toLowerCase()) ?? [];
      for (const externalId of externalIds) {
        if (!matches.has(externalId)) {
          matches.set(externalId, { productId: match.productId, productHandle: match.productHandle });
        }
      }
    }
  }

  return { matches };
}
