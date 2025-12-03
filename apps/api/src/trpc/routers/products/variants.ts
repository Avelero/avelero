/**
 * Product variants router implementation.
 *
 * Covers the nested `products.variants.*` namespace responsible for variant
 * listings, batch upserts, and explicit delete operations.
 */
import { and, eq, inArray } from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import {
  getVariantsSchema,
  listVariantsSchema,
  productVariantsDeleteSchema,
  productVariantsUpsertSchema,
} from "../../../schemas/products.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };
type BrandDb = BrandContext["db"];

const MAX_VARIANT_DIMENSION = 12;

const variantListProcedure = brandRequiredProcedure
  .input(listVariantsSchema)
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;
    const variants = await fetchProductVariants(db, brandId, input.product_id, {
      limit: input.limit,
    });
    return createListResponse(variants);
  });

const variantGetProcedure = brandRequiredProcedure
  .input(getVariantsSchema)
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;
    const variants = await fetchProductVariants(db, brandId, input.product_id);
    return createListResponse(variants);
  });

const variantUpsertProcedure = brandRequiredProcedure
  .input(productVariantsUpsertSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;
    try {
      await replaceProductVariants(
        db,
        brandId,
        input.product_id,
        input.color_ids ?? [],
        input.size_ids ?? [],
      );

      const variants = await fetchProductVariants(
        db,
        brandId,
        input.product_id,
      );
      return createListResponse(variants);
    } catch (error) {
      throw wrapError(error, "Failed to upsert product variants");
    }
  });

const variantDeleteProcedure = brandRequiredProcedure
  .input(productVariantsDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;
    try {
      const deleted = await deleteProductVariants(db, brandId, input);
      return createEntityResponse({ deleted });
    } catch (error) {
      throw wrapError(error, "Failed to delete product variants");
    }
  });

function makeVariantKey(colorId: string | null, sizeId: string | null) {
  return `${colorId ?? "null"}:${sizeId ?? "null"}`;
}

function buildDesiredVariants(
  colorIds: readonly string[],
  sizeIds: readonly string[],
): Array<{ colorId: string | null; sizeId: string | null }> {
  if (colorIds.length === 0 && sizeIds.length === 0) {
    return [];
  }

  if (colorIds.length === 0) {
    return sizeIds.map((sizeId) => ({ colorId: null, sizeId }));
  }

  if (sizeIds.length === 0) {
    return colorIds.map((colorId) => ({ colorId, sizeId: null }));
  }

  const combinations: Array<{ colorId: string; sizeId: string }> = [];
  for (const colorId of colorIds) {
    for (const sizeId of sizeIds) {
      combinations.push({ colorId, sizeId });
    }
  }
  return combinations;
}

async function fetchProductVariants(
  db: BrandDb,
  brandId: string,
  productId: string,
  opts: { limit?: number } = {},
) {
  await assertProductForBrand(db, brandId, productId);

  const baseQuery = db
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
    .orderBy(productVariants.createdAt, productVariants.id);

  const rows = opts.limit ? await baseQuery.limit(opts.limit) : await baseQuery;
  return rows;
}

async function replaceProductVariants(
  db: BrandDb,
  brandId: string,
  productId: string,
  colorIds: string[],
  sizeIds: string[],
) {
  const uniqueColors = Array.from(new Set(colorIds));
  const uniqueSizes = Array.from(new Set(sizeIds));

  if (
    uniqueColors.length > MAX_VARIANT_DIMENSION ||
    uniqueSizes.length > MAX_VARIANT_DIMENSION
  ) {
    throw badRequest("color_ids and size_ids cannot exceed 12 each.");
  }

  await assertProductForBrand(db, brandId, productId);

  const desired = buildDesiredVariants(uniqueColors, uniqueSizes);
  const desiredKeys = new Set(
    desired.map((variant) => makeVariantKey(variant.colorId, variant.sizeId)),
  );

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: productVariants.id,
        color_id: productVariants.colorId,
        size_id: productVariants.sizeId,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const existingByKey = new Map<string, string>();
    for (const row of existing) {
      existingByKey.set(makeVariantKey(row.color_id, row.size_id), row.id);
    }

    const idsToDelete = existing
      .filter(
        (row) => !desiredKeys.has(makeVariantKey(row.color_id, row.size_id)),
      )
      .map((row) => row.id);

    if (idsToDelete.length > 0) {
      await tx
        .delete(productVariants)
        .where(inArray(productVariants.id, idsToDelete));
    }

    const toInsert = desired
      .filter(
        (variant) =>
          !existingByKey.has(makeVariantKey(variant.colorId, variant.sizeId)),
      )
      .map((variant) => ({
        productId,
        colorId: variant.colorId,
        sizeId: variant.sizeId,
        upid: null,
      }));

    if (toInsert.length > 0) {
      await tx.insert(productVariants).values(toInsert);
    }
  });
}

async function deleteProductVariants(
  db: BrandDb,
  brandId: string,
  input: { variant_id?: string; product_id?: string },
) {
  if (input.variant_id) {
    const deleted = await db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(productVariants.id, input.variant_id as string),
            eq(products.brandId, brandId),
          ),
        )
        .limit(1);

      if (!owned[0]) {
        throw badRequest("Variant not found for the active brand");
      }

      const removed = await tx
        .delete(productVariants)
        .where(eq(productVariants.id, input.variant_id as string))
        .returning({ id: productVariants.id });

      return removed.length;
    });

    return deleted;
  }

  const productId = input.product_id!;
  await assertProductForBrand(db, brandId, productId);

  const removed = await db
    .delete(productVariants)
    .where(eq(productVariants.productId, productId))
    .returning({ id: productVariants.id });

  return removed.length;
}

async function assertProductForBrand(
  db: BrandDb,
  brandId: string,
  productId: string,
) {
  const owned = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  if (!owned[0]) {
    throw badRequest("Product not found for the active brand");
  }
}

export const productVariantsRouter = createTRPCRouter({
  list: variantListProcedure,
  get: variantGetProcedure,
  upsert: variantUpsertProcedure,
  delete: variantDeleteProcedure,
});

export type ProductVariantsRouter = typeof productVariantsRouter;
