/**
 * Variant link query functions.
 * 
 * Handles mapping external variants to internal variants.
 * Primary matching table - SKU, EAN, GTIN, barcode are variant-level.
 */

import { and, eq } from "drizzle-orm";
import type { Database } from "../../../client";
import { integrationVariantLinks } from "../../../schema";

/**
 * Find a variant link by external ID.
 * This is the primary lookup during sync - variants are matched by SKU/barcode.
 */
export async function findVariantLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a variant link by variant ID.
 * Useful for checking if a variant is already linked to an external system.
 */
export async function findVariantLinkByVariantId(
  db: Database,
  brandIntegrationId: string,
  variantId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.variantId, variantId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a variant link.
 * Called when a variant is first synced from an external system.
 */
export async function createVariantLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    variantId: string;
    externalId: string;
    externalProductId?: string | null;
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(integrationVariantLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      variantId: input.variantId,
      externalId: input.externalId,
      externalProductId: input.externalProductId ?? null,
      externalSku: input.externalSku ?? null,
      externalBarcode: input.externalBarcode ?? null,
      lastSyncedAt: now,
      lastSyncedHash: input.lastSyncedHash ?? null,
    })
    .returning({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
    });
  return row;
}

/**
 * Update a variant link.
 * Called after subsequent syncs to update sync metadata.
 */
export async function updateVariantLink(
  db: Database,
  id: string,
  input: {
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .update(integrationVariantLinks)
    .set({
      ...input,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(integrationVariantLinks.id, id))
    .returning({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      updatedAt: integrationVariantLinks.updatedAt,
    });
  return row;
}

/**
 * List all variant links for a brand integration.
 */
export async function listVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
    })
    .from(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Delete a variant link.
 * Called when unlinking a variant from an external system.
 */
export async function deleteVariantLink(db: Database, id: string) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.id, id));
}

/**
 * Delete all variant links for a brand integration.
 * Called when disconnecting an integration.
 */
export async function deleteAllVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

