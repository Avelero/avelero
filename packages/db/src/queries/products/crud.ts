/**
 * Product CRUD operations.
 *
 * Provides create, update, and delete functions for products.
 */

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../../client";
import { products } from "../../schema";

/**
 * Creates a new product.
 */
export async function createProduct(
  db: Database,
  brandId: string,
  input: {
    name: string;
    productHandle?: string;
    description?: string;
    categoryId?: string;
    seasonId?: string;
    manufacturerId?: string;
    imagePath?: string;
    status?: string;
  },
) {
  let created:
    | { id: string; productHandle: string; variantIds?: readonly string[] }
    | undefined;
  await db.transaction(async (tx) => {
    const productHandleValue =
      input.productHandle ??
      `prod-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const [row] = await tx
      .insert(products)
      .values({
        brandId,
        name: input.name,
        productHandle: productHandleValue,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        seasonId: input.seasonId ?? null,
        manufacturerId: input.manufacturerId ?? null,
        imagePath: input.imagePath ?? null,
        status: input.status ?? "unpublished",
      })
      .returning({ id: products.id, productHandle: products.productHandle });

    if (!row?.id) {
      return;
    }

    created = { id: row.id, productHandle: row.productHandle };
  });
  return created;
}

/**
 * Updates an existing product.
 *
 * Only updates fields that are explicitly provided (not undefined).
 * This prevents accidentally nullifying fields that weren't meant to be updated.
 */
export async function updateProduct(
  db: Database,
  brandId: string,
  input: {
    id: string;
    name?: string;
    productHandle?: string | null;
    description?: string | null;
    categoryId?: string | null;
    seasonId?: string | null;
    manufacturerId?: string | null;
    imagePath?: string | null;
    status?: string | null;
  },
) {
  let updated: { id: string; variantIds?: readonly string[] } | undefined;
  await db.transaction(async (tx) => {
    // Only include fields that are explicitly provided (not undefined)
    // This prevents accidentally nullifying fields that weren't meant to be updated
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.categoryId !== undefined)
      updateData.categoryId = input.categoryId;
    if (input.seasonId !== undefined) updateData.seasonId = input.seasonId;
    if (input.productHandle !== undefined)
      updateData.productHandle = input.productHandle;
    if (input.manufacturerId !== undefined)
      updateData.manufacturerId = input.manufacturerId;
    if (input.imagePath !== undefined) updateData.imagePath = input.imagePath;
    if (input.status !== undefined) updateData.status = input.status;

    // If no content fields to update, return early without modifying anything
    if (Object.keys(updateData).length === 0) {
      const [existing] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
        .limit(1);
      if (existing) {
        updated = { id: existing.id };
      }
      return;
    }

    // Always set hasUnpublishedChanges = true when any content field is modified
    // This ensures the publishing state correctly tracks pending changes
    updateData.hasUnpublishedChanges = true;
    updateData.updatedAt = new Date().toISOString();

    const [row] = await tx
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
      .returning({ id: products.id });

    if (!row?.id) {
      return;
    }

    updated = { id: row.id };
  });
  return updated;
}

/**
 * Deletes a product.
 */
export async function deleteProduct(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .returning({ id: products.id });
  return row;
}
