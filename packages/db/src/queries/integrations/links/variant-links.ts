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
