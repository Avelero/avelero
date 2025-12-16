/**
 * Product variants router implementation.
 *
 * Covers the nested `products.variants.*` namespace responsible for variant
 * listings, batch upserts, and explicit delete operations.
 *
 * Phase 5 changes:
 * - Updated `list` to support discriminated union (product_id OR product_upid)
 * - Removed redundant `get` endpoint (use `list` instead)
 */
import { and, eq, inArray } from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import { generateUniqueUpids } from "@v1/db/utils";
import {
  productVariantsDeleteSchema,
  productVariantsUpsertSchema,
  variantUnifiedListSchema,
} from "../../../schemas/products.js";
import { listVariantsForProduct } from "@v1/db/queries/products";
import { revalidateProduct } from "../../../lib/dpp-revalidation.js";
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

/**
 * List variants for a product.
 * Accepts discriminated union: { product_id } OR { product_handle }
 */
const variantListProcedure = brandRequiredProcedure
  .input(variantUnifiedListSchema)
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;
    
    // Handle discriminated union: { product_id } or { product_handle }
    const identifier = 'product_id' in input 
      ? { product_id: input.product_id } 
      : { product_handle: input.product_handle };
    
    const variants = await listVariantsForProduct(db, brandId, identifier, {
      limit: input.limit,
    });
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
        input.variant_data,
      );

      const variants = await fetchProductVariants(
        db,
        brandId,
        input.product_id,
      );

      // Revalidate parent product's DPP cache (fire-and-forget)
      const productHandle = await getProductHandle(db, brandId, input.product_id);
      if (productHandle) {
        revalidateProduct(productHandle).catch(() => {});
      }

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
      // Get product handle before deletion for cache revalidation
      // Handle union type: input is either { product_id: string } or { variant_id: string }
      const productId = 'product_id' in input 
        ? input.product_id 
        : await getProductIdFromVariant(db, brandId, input.variant_id);
      const productHandle = productId ? await getProductHandle(db, brandId, productId) : null;

      const deleted = await deleteProductVariants(db, brandId, input);

      // Revalidate parent product's DPP cache (fire-and-forget)
      if (productHandle) {
        revalidateProduct(productHandle).catch(() => {});
      }

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
      sku: productVariants.sku,
      barcode: productVariants.barcode,
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
  variantData?: Array<{
    color_id?: string | null;
    size_id?: string | null;
    sku?: string;
    barcode?: string;
  }>,
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

  // Validate SKU/barcode uniqueness within brand (excluding current product's variants)
  if (variantData && variantData.length > 0) {
    const skusToCheck = variantData
      .map((v) => v.sku)
      .filter((sku): sku is string => Boolean(sku?.trim()));
    const barcodesToCheck = variantData
      .map((v) => v.barcode)
      .filter((barcode): barcode is string => Boolean(barcode?.trim()));

    // Check for duplicates within the submitted data itself
    const skuSet = new Set<string>();
    for (const sku of skusToCheck) {
      if (skuSet.has(sku.toLowerCase())) {
        throw badRequest(`Duplicate SKU in request: "${sku}"`);
      }
      skuSet.add(sku.toLowerCase());
    }

    const barcodeSet = new Set<string>();
    for (const barcode of barcodesToCheck) {
      if (barcodeSet.has(barcode.toLowerCase())) {
        throw badRequest(`Duplicate barcode in request: "${barcode}"`);
      }
      barcodeSet.add(barcode.toLowerCase());
    }

    // Check for conflicts with other products in the brand
    if (skusToCheck.length > 0) {
      const existingSkus = await db
        .select({ sku: productVariants.sku, productId: productVariants.productId })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(products.brandId, brandId),
            inArray(productVariants.sku, skusToCheck),
          ),
        );

      const conflictingSku = existingSkus.find(
        (row) => row.productId !== productId && row.sku,
      );
      if (conflictingSku) {
        throw badRequest(`SKU "${conflictingSku.sku}" is already in use by another product`);
      }
    }

    if (barcodesToCheck.length > 0) {
      const existingBarcodes = await db
        .select({ barcode: productVariants.barcode, productId: productVariants.productId })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(products.brandId, brandId),
            inArray(productVariants.barcode, barcodesToCheck),
          ),
        );

      const conflictingBarcode = existingBarcodes.find(
        (row) => row.productId !== productId && row.barcode,
      );
      if (conflictingBarcode) {
        throw badRequest(`Barcode "${conflictingBarcode.barcode}" is already in use by another product`);
      }
    }
  }

  const desired = buildDesiredVariants(uniqueColors, uniqueSizes);
  const desiredKeys = new Set(
    desired.map((variant) => makeVariantKey(variant.colorId, variant.sizeId)),
  );

  // Build a lookup map for variant metadata (SKU/barcode) by variant key
  const variantDataMap = new Map<string, { sku?: string; barcode?: string }>();
  if (variantData) {
    for (const data of variantData) {
      const key = makeVariantKey(data.color_id ?? null, data.size_id ?? null);
      variantDataMap.set(key, {
        sku: data.sku,
        barcode: data.barcode,
      });
    }
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: productVariants.id,
        color_id: productVariants.colorId,
        size_id: productVariants.sizeId,
        sku: productVariants.sku,
        barcode: productVariants.barcode,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const existingByKey = new Map<string, { id: string; sku: string | null; barcode: string | null }>();
    for (const row of existing) {
      existingByKey.set(makeVariantKey(row.color_id, row.size_id), {
        id: row.id,
        sku: row.sku,
        barcode: row.barcode,
      });
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

    // Update existing variants with new SKU/barcode data if provided
    if (variantDataMap.size > 0) {
      for (const variant of desired) {
        const key = makeVariantKey(variant.colorId, variant.sizeId);
        const existingVariant = existingByKey.get(key);
        const metadata = variantDataMap.get(key);

        if (existingVariant && metadata) {
          // Update SKU/barcode if they differ from current values
          const needsUpdate =
            existingVariant.sku !== metadata.sku ||
            existingVariant.barcode !== metadata.barcode;

          if (needsUpdate) {
            await tx
              .update(productVariants)
              .set({
                sku: metadata.sku ?? null,
                barcode: metadata.barcode ?? null,
              })
              .where(eq(productVariants.id, existingVariant.id));
          }
        }
      }
    }

    // Only insert NEW variants (ones that don't already exist)
    // Existing variants keep their UPIDs - we never touch them
    const variantsToInsert = desired.filter(
      (variant) =>
        !existingByKey.has(makeVariantKey(variant.colorId, variant.sizeId)),
    );

    if (variantsToInsert.length > 0) {
      // Generate unique UPIDs for new variants only (brand-unique)
      const upids = await generateUniqueUpids({
        count: variantsToInsert.length,
        isTaken: async (candidate) => {
          const [row] = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(
              and(
                eq(productVariants.upid, candidate),
                eq(products.brandId, brandId),
              ),
            )
            .limit(1);
          return Boolean(row);
        },
        fetchTakenSet: async (candidates) => {
          const rows = await tx
            .select({ upid: productVariants.upid })
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(
              and(
                inArray(productVariants.upid, candidates as string[]),
                eq(products.brandId, brandId),
              ),
            );
          return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]);
        },
      });

      const toInsert = variantsToInsert.map((variant, index) => {
        const key = makeVariantKey(variant.colorId, variant.sizeId);
        const metadata = variantDataMap.get(key);
        return {
          productId,
          colorId: variant.colorId,
          sizeId: variant.sizeId,
          upid: upids[index],
          sku: metadata?.sku ?? null,
          barcode: metadata?.barcode ?? null,
        };
      });

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

/**
 * Get a product's handle for DPP cache revalidation.
 */
async function getProductHandle(
  db: BrandDb,
  brandId: string,
  productId: string,
): Promise<string | null> {
  const [product] = await db
    .select({ productHandle: products.productHandle })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  return product?.productHandle ?? null;
}

/**
 * Get a product ID from a variant ID for DPP cache revalidation.
 */
async function getProductIdFromVariant(
  db: BrandDb,
  brandId: string,
  variantId?: string,
): Promise<string | null> {
  if (!variantId) return null;
  const [variant] = await db
    .select({ productId: productVariants.productId })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(productVariants.id, variantId), eq(products.brandId, brandId)),
    )
    .limit(1);
  return variant?.productId ?? null;
}

export const productVariantsRouter = createTRPCRouter({
  list: variantListProcedure,
  upsert: variantUpsertProcedure,
  delete: variantDeleteProcedure,
});

export type ProductVariantsRouter = typeof productVariantsRouter;
