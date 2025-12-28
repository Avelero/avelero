/**
 * Product variants router implementation.
 *
 * Covers the nested `products.variants.*` namespace responsible for variant
 * listings, batch upserts, and explicit delete operations.
 *
 * Phase 3 changes:
 * - Implemented variant upsert with generic attribute system
 * - Supports explicit mode (direct variant definitions) and matrix mode (cartesian product)
 */
import { and, eq } from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import {
  listVariantsForProduct,
  replaceProductVariantsExplicit,
  replaceProductVariantsMatrix,
  getProductVariantsWithAttributes,
  type ReplaceVariantsResult,
} from "@v1/db/queries/products";
import {
  productVariantsDeleteSchema,
  productVariantsUpsertSchema,
  variantUnifiedListSchema,
} from "../../../schemas/products.js";
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

/**
 * List variants for a product.
 * Accepts discriminated union: { product_id } OR { product_handle }
 */
const variantListProcedure = brandRequiredProcedure
  .input(variantUnifiedListSchema)
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;

    // Handle discriminated union: { product_id } or { product_handle }
    const identifier =
      "product_id" in input
        ? { product_id: input.product_id }
        : { product_handle: input.product_handle };

    const variants = await listVariantsForProduct(db, brandId, identifier, {
      limit: input.limit,
    });
    return createListResponse(variants);
  });

/**
 * Upsert variants for a product using the generic attribute system.
 *
 * Supports two modes:
 * - explicit: Provide complete variant definitions with attribute assignments
 * - matrix: Provide dimensions for cartesian product generation
 *
 * Both modes replace all existing variants for the product.
 */
const variantUpsertProcedure = brandRequiredProcedure
  .input(productVariantsUpsertSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx as BrandContext;

    try {
      // Get product handle before upsert for cache revalidation
      const productHandle = await getProductHandle(db, brandId, input.product_id);

      let result: ReplaceVariantsResult;

      if (input.mode === "explicit") {
        // Explicit mode: caller provides complete variant definitions
        result = await replaceProductVariantsExplicit(
          db,
          brandId,
          input.product_id,
          input.variants.map((v) => ({
            sku: v.sku,
            barcode: v.barcode,
            upid: v.upid,
            attributeValueIds: v.attribute_value_ids,
          }))
        );
      } else {
        // Matrix mode: generate cartesian product from dimensions
        const variantMetadata = input.variant_metadata
          ? new Map(Object.entries(input.variant_metadata))
          : undefined;

        result = await replaceProductVariantsMatrix(
          db,
          brandId,
          input.product_id,
          input.dimensions.map((d) => ({
            attributeId: d.attribute_id,
            valueIds: d.value_ids,
          })),
          variantMetadata
        );
      }

      // Revalidate parent product's DPP cache (fire-and-forget)
      if (productHandle) {
        revalidateProduct(productHandle).catch(() => { });
      }

      // Return created variants with their attribute assignments
      const variantsWithAttributes = await getProductVariantsWithAttributes(
        db,
        brandId,
        input.product_id
      );

      return createEntityResponse({
        created: result.created,
        variants: variantsWithAttributes,
      });
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
      let productHandle: string | null = null;

      if ("productHandle" in input && "variantUpid" in input) {
        // Delete by productHandle + variantUpid
        productHandle = input.productHandle;
        const deleted = await deleteVariantByUpid(db, brandId, input.productHandle, input.variantUpid);

        // Revalidate parent product's DPP cache (fire-and-forget)
        if (productHandle) {
          revalidateProduct(productHandle).catch(() => { });
        }

        return createEntityResponse({ deleted });
      }

      // Handle legacy union type: { product_id: string } or { variant_id: string }
      const productId =
        "product_id" in input
          ? input.product_id
          : await getProductIdFromVariant(db, brandId, input.variant_id);
      productHandle = productId
        ? await getProductHandle(db, brandId, productId)
        : null;

      const deleted = await deleteProductVariants(db, brandId, input);

      // Revalidate parent product's DPP cache (fire-and-forget)
      if (productHandle) {
        revalidateProduct(productHandle).catch(() => { });
      }

      return createEntityResponse({ deleted });
    } catch (error) {
      throw wrapError(error, "Failed to delete product variants");
    }
  });

/**
 * Delete a variant by product handle and variant UPID.
 */
async function deleteVariantByUpid(
  db: BrandDb,
  brandId: string,
  productHandle: string,
  variantUpid: string
): Promise<number> {
  const deleted = await db.transaction(async (tx) => {
    // First, find the product by handle
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.productHandle, productHandle),
          eq(products.brandId, brandId)
        )
      )
      .limit(1);

    if (!product) {
      throw badRequest("Product not found for the active brand");
    }

    // Find the variant by UPID
    const [variant] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, product.id),
          eq(productVariants.upid, variantUpid)
        )
      )
      .limit(1);

    if (!variant) {
      throw badRequest("Variant not found");
    }

    // Delete the variant
    const removed = await tx
      .delete(productVariants)
      .where(eq(productVariants.id, variant.id))
      .returning({ id: productVariants.id });

    return removed.length;
  });

  return deleted;
}

async function deleteProductVariants(
  db: BrandDb,
  brandId: string,
  input: { variant_id?: string; product_id?: string }
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
            eq(products.brandId, brandId)
          )
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
  productId: string
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
  productId: string
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
  variantId?: string
): Promise<string | null> {
  if (!variantId) return null;
  const [variant] = await db
    .select({ productId: productVariants.productId })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(productVariants.id, variantId), eq(products.brandId, brandId))
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
