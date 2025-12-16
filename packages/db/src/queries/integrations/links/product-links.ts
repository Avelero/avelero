/**
 * Product link query functions.
 * 
 * Handles mapping external products to internal products.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../client";
import { integrationProductLinks, products } from "../../../schema";

/**
 * Find a product link by external ID.
 */
export async function findProductLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a product link by product ID.
 */
export async function findProductLinkByProductId(
  db: Database,
  brandIntegrationId: string,
  productId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.productId, productId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a product link.
 */
export async function createProductLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    productId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationProductLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      productId: input.productId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
    });
  return row;
}

/**
 * Update a product link.
 */
export async function updateProductLink(
  db: Database,
  id: string,
  input: {
    externalName?: string | null;
    lastSyncedAt?: string;
  },
) {
  const [row] = await db
    .update(integrationProductLinks)
    .set({
      externalName: input.externalName,
      lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationProductLinks.id, id))
    .returning({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      updatedAt: integrationProductLinks.updatedAt,
    });
  return row;
}

/**
 * List all product links for a brand integration.
 */
export async function listProductLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
    })
    .from(integrationProductLinks)
    .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Find a product by product handle.
 */
export async function findProductByHandle(
  db: Database,
  brandId: string,
  productHandle: string,
) {
  const [row] = await db
    .select({
      id: products.id,
      productHandle: products.productHandle,
      name: products.name,
    })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.productHandle, productHandle),
      ),
    )
    .limit(1);
  return row;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

export interface ProductLinkData {
  id: string;
  brandIntegrationId: string;
  productId: string;
  externalId: string;
  externalName: string | null;
  lastSyncedAt: string | null;
}

/**
 * Batch find product links by external IDs.
 * Returns a Map for O(1) lookup.
 */
export async function batchFindProductLinks(
  db: Database,
  brandIntegrationId: string,
  externalIds: string[],
): Promise<Map<string, ProductLinkData>> {
  if (externalIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        inArray(integrationProductLinks.externalId, externalIds),
      ),
    );

  const map = new Map<string, ProductLinkData>();
  for (const row of rows) {
    map.set(row.externalId, row);
  }
  return map;
}

/**
 * Upsert a product link.
 * Creates if not exists, updates if exists.
 */
export async function upsertProductLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    productId: string;
    externalId: string;
    externalName?: string | null;
  },
): Promise<ProductLinkData> {
  const [row] = await db
    .insert(integrationProductLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      productId: input.productId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [
        integrationProductLinks.brandIntegrationId,
        integrationProductLinks.externalId,
      ],
      set: {
        externalName: input.externalName ?? null,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    .returning({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
    });

  if (!row) {
    throw new Error("Failed to upsert product link");
  }
  return row;
}

