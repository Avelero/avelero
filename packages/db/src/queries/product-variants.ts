import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
import { productVariants, products } from "../schema";

type CompletionEvalOptions = {
  skipCompletionEval?: boolean;
};

/**
 * Variant summary returned alongside products.
 */
export interface ProductVariantSummary {
  id: string;
  product_id: string;
  color_id: string | null;
  size_id: string | null;
  upid: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result payload for variant upsert operations.
 */
export interface VariantUpsertResult {
  readonly reference: string;
  readonly variant_id?: string;
  readonly status: "created" | "updated" | "error";
  readonly error?: string;
}

/**
 * Validates that a product belongs to a specific brand.
 *
 * Security check to prevent cross-brand product access. Throws an error
 * if the product doesn't exist or belongs to a different brand.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @param productId - Product identifier to validate
 * @returns Product ID if validation passes
 * @throws {Error} If product doesn't belong to brand
 */
async function ensureProductBelongsToBrand(
  db: Database,
  brandId: string,
  productId: string,
): Promise<{ id: string }> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  const product = rows[0];
  if (!product) {
    throw new Error("Product does not belong to the specified brand");
  }
  return product;
}

/**
 * Batch loads variants for multiple products.
 *
 * Performs a single database query to fetch all variants for the given
 * product IDs, then groups them by product ID for efficient lookups.
 * Optimizes N+1 query problems when loading product lists.
 *
 * @param db - Database instance
 * @param productIds - Array of product IDs to load variants for
 * @returns Map of product ID to array of variants
 */
export async function loadVariantsForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductVariantSummary[]>> {
  const map = new Map<string, ProductVariantSummary[]>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, [...productIds]))
    .orderBy(asc(productVariants.createdAt));

  for (const row of rows) {
    const collection = map.get(row.product_id) ?? [];
    collection.push({
      id: row.id,
      product_id: row.product_id,
      color_id: row.color_id ?? null,
      size_id: row.size_id ?? null,
      upid: row.upid ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    map.set(row.product_id, collection);
  }

  return map;
}

/**
 * Lists all variants for a given product.
 *
 * @param db - Database instance
 * @param productId - Product ID to list variants for
 * @returns Array of product variants
 */
export async function listVariantsForProduct(
  db: Database,
  productId: string,
): Promise<ProductVariantSummary[]> {
  const rows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.createdAt));

  return rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    color_id: row.color_id ?? null,
    size_id: row.size_id ?? null,
    upid: row.upid ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Gets a variant by ID.
 *
 * @param db - Database instance
 * @param variantId - Variant ID to retrieve
 * @returns Variant or null if not found
 */
export async function getVariantById(
  db: Database,
  variantId: string,
): Promise<ProductVariantSummary | null> {
  const rows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    product_id: row.product_id,
    color_id: row.color_id ?? null,
    size_id: row.size_id ?? null,
    upid: row.upid ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Auto-generates product variants from color × size combinations.
 *
 * Creates all possible combinations of the provided colors and sizes for a product.
 * Each variant is assigned a unique UUID.
 *
 * @param db - Database instance
 * @param productId - Product ID to generate variants for
 * @param colorIds - Array of color IDs to combine
 * @param sizeIds - Array of size IDs to combine
 * @returns Array of created variant IDs
 *
 * @example
 * ```ts
 * // Generate 6 variants (2 colors × 3 sizes)
 * const variantIds = await bulkCreateVariants(
 *   db,
 *   productId,
 *   ['blue-id', 'red-id'],
 *   ['small-id', 'medium-id', 'large-id']
 * );
 * // Results: Blue+S, Blue+M, Blue+L, Red+S, Red+M, Red+L
 * ```
 */
export async function bulkCreateVariants(
  db: Database,
  productId: string,
  colorIds: readonly string[],
  sizeIds: readonly string[],
): Promise<readonly string[]> {
  if (colorIds.length === 0 || sizeIds.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const createdIds: string[] = [];

    // Generate all color × size combinations
    for (const colorId of colorIds) {
      for (const sizeId of sizeIds) {
        const [created] = await tx
          .insert(productVariants)
          .values({
            productId,
            colorId,
            sizeId,
            upid: null,
          })
          .returning({ id: productVariants.id });

        if (created?.id) {
          createdIds.push(created.id);
        }
      }
    }

    // Update product completion status after generating variants
    if (createdIds.length > 0) {
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }

    return createdIds as readonly string[];
  });
}

/**
 * Creates a single variant for a product.
 *
 * @param db - Database instance
 * @param productId - Product ID to create variant for
 * @param input - Variant data (colorId, sizeId, upid)
 * @param options - Optional completion evaluation options
 * @returns Created variant
 */
export async function createVariant(
  db: Database,
  productId: string,
  input: {
    colorId?: string;
    sizeId?: string;
    upid?: string;
  },
  options?: CompletionEvalOptions,
): Promise<{ id: string } | undefined> {
  let created: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productVariants)
      .values({
        productId,
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        upid: input.upid ?? null,
      })
      .returning({ id: productVariants.id });
    created = row;
    if (row?.id && !options?.skipCompletionEval) {
      // Need brandId for evaluator: read via product
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return created;
}

/**
 * Updates a variant by ID.
 *
 * @param db - Database instance
 * @param id - Variant ID to update
 * @param input - Updated variant data
 * @param options - Optional completion evaluation options
 * @returns Updated variant
 */
export async function updateVariant(
  db: Database,
  id: string,
  input: {
    colorId?: string | null;
    sizeId?: string | null;
    upid?: string | null;
  },
  options?: CompletionEvalOptions,
): Promise<{ id: string } | undefined> {
  let updated: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(productVariants)
      .set({
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        upid: input.upid ?? null,
      })
      .where(eq(productVariants.id, id))
      .returning({
        id: productVariants.id,
        productId: productVariants.productId,
      });
    updated = row ? { id: row.id } : undefined;
    if (row?.productId && !options?.skipCompletionEval) {
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, row.productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          row.productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return updated;
}

/**
 * Deletes a variant by ID.
 *
 * @param db - Database instance
 * @param id - Variant ID to delete
 * @returns Deleted variant
 */
export async function deleteVariant(
  db: Database,
  id: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .delete(productVariants)
    .where(eq(productVariants.id, id))
    .returning({ id: productVariants.id });
  return row;
}

/**
 * Lists all variants for a product within a brand context.
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param productId - Product ID to list variants for
 * @returns Array of product variants
 */
export async function listProductVariantsForBrand(
  db: Database,
  brandId: string,
  productId: string,
): Promise<ProductVariantSummary[]> {
  await ensureProductBelongsToBrand(db, brandId, productId);
  const variantsMap = await loadVariantsForProducts(db, [productId]);
  return variantsMap.get(productId) ?? [];
}

/**
 * Upserts multiple variants for a product.
 *
 * Creates new variants or updates existing ones based on ID or UPID matching.
 * Supports batch operations for efficient variant management.
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param productId - Product ID to upsert variants for
 * @param variants - Array of variants to upsert
 * @returns Results array indicating created/updated/error status for each variant
 */
export async function upsertProductVariantsForBrand(
  db: Database,
  brandId: string,
  productId: string,
  variants: ReadonlyArray<{
    id?: string;
    color_id?: string | null;
    size_id?: string | null;
    upid?: string | null;
  }>,
): Promise<VariantUpsertResult[]> {
  if (variants.length === 0) return [];
  await ensureProductBelongsToBrand(db, brandId, productId);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: productVariants.id,
        product_id: productVariants.productId,
        upid: productVariants.upid,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    type VariantLookup = {
      id: string;
      product_id: string;
      upid: string | null;
    };

    const byId = new Map<string, VariantLookup>();
    const byUpid = new Map<string, VariantLookup>();

    for (const row of existing) {
      const lookup: VariantLookup = {
        id: row.id,
        product_id: row.product_id,
        upid: row.upid,
      };
      byId.set(row.id, lookup);
      if (row.upid != null) {
        byUpid.set(row.upid, lookup);
      }
    }

    const results: VariantUpsertResult[] = [];
    let mutated = false;

    for (let index = 0; index < variants.length; index += 1) {
      const input = variants[index]!;
      const reference =
        input.id ?? input.upid ?? `index:${index.toString().padStart(2, "0")}`;
      try {
        let target: VariantLookup | undefined;
        if (input.id) {
          target = byId.get(input.id);
        }
        if (!target && input.upid) {
          target = byUpid.get(input.upid);
        }

        if (!target) {
          const [created] = await tx
            .insert(productVariants)
            .values({
              productId,
              colorId: input.color_id ?? null,
              sizeId: input.size_id ?? null,
              upid: input.upid ?? null,
            })
            .returning({ id: productVariants.id });

          if (!created?.id) {
            throw new Error("Failed to create product variant.");
          }

          const lookup: VariantLookup = {
            id: created.id,
            product_id: productId,
            upid: input.upid ?? null,
          };
          byId.set(created.id, lookup);
          if (input.upid) {
            byUpid.set(input.upid, lookup);
          }

          results.push({
            reference,
            variant_id: created.id,
            status: "created",
          });
          mutated = true;
          continue;
        }

        const updateValues: Partial<typeof productVariants.$inferInsert> = {};
        const hasOwn = Object.prototype.hasOwnProperty;

        if (hasOwn.call(input, "color_id")) {
          updateValues.colorId = input.color_id ?? null;
        }
        if (hasOwn.call(input, "size_id")) {
          updateValues.sizeId = input.size_id ?? null;
        }
        if (hasOwn.call(input, "upid")) {
          updateValues.upid = input.upid ?? null;
          if (target.upid) {
            byUpid.delete(target.upid);
          }
          if (input.upid) {
            byUpid.set(input.upid, {
              id: target.id,
              product_id: target.product_id,
              upid: input.upid,
            });
          }
        }

        if (Object.keys(updateValues).length > 0) {
          await tx
            .update(productVariants)
            .set(updateValues)
            .where(eq(productVariants.id, target.id));
          mutated = true;
        }

        results.push({
          reference,
          variant_id: target.id,
          status: "updated",
        });
      } catch (error) {
        results.push({
          reference,
          status: "error",
          error:
            error instanceof Error ? error.message : "Unknown variant error",
        });
      }
    }

    if (mutated) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }

    return results;
  });
}

/**
 * Deletes variants for a product.
 *
 * Supports two deletion modes:
 * 1. Delete specific variants by variant_ids
 * 2. Delete all variants for a product, optionally filtered by color/size
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param input - Deletion criteria (variant IDs or product ID with optional filters)
 * @returns Number of variants deleted
 */
export async function deleteProductVariantsForBrand(
  db: Database,
  brandId: string,
  input:
    | {
        variant_ids: readonly string[];
      }
    | {
        product_id: string;
        filter?: {
          color_id?: string;
          size_id?: string;
        };
      },
): Promise<number> {
  return db.transaction(async (tx) => {
    let affected = 0;
    const impactedProducts = new Set<string>();

    if ("variant_ids" in input) {
      if (input.variant_ids.length === 0) return 0;
      const rows = await tx
        .select({
          id: productVariants.id,
          product_id: productVariants.productId,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            inArray(productVariants.id, [...input.variant_ids]),
            eq(products.brandId, brandId),
          ),
        );

      const idsToDelete = rows.map((row) => row.id);
      for (const row of rows) {
        impactedProducts.add(row.product_id);
      }

      if (idsToDelete.length === 0) {
        return 0;
      }

      const deleted = await tx
        .delete(productVariants)
        .where(inArray(productVariants.id, idsToDelete))
        .returning({ id: productVariants.id });
      affected = deleted.length;
    } else {
      await ensureProductBelongsToBrand(
        tx as unknown as Database,
        brandId,
        input.product_id,
      );

      const conditions = [eq(productVariants.productId, input.product_id)];

      if (input.filter?.color_id) {
        conditions.push(eq(productVariants.colorId, input.filter.color_id));
      }
      if (input.filter?.size_id) {
        conditions.push(eq(productVariants.sizeId, input.filter.size_id));
      }

      const deleted = await tx
        .delete(productVariants)
        .where(and(...conditions))
        .returning({ id: productVariants.id });
      affected = deleted.length;
      if (affected > 0) {
        impactedProducts.add(input.product_id);
      }
    }

    if (affected > 0) {
      for (const productId of impactedProducts) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }

    return affected;
  });
}
