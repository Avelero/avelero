/**
 * Publish Router.
 *
 * Exposes tRPC endpoints for publishing product passports.
 * Phase 2 rewires these endpoints to flip product status and mark passports dirty.
 *
 * Endpoints:
 * - publish.variant: Publish a single variant
 * - publish.product: Publish all variants of a product
 * - publish.bulk: Publish multiple products at once
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  getPublishingState,
  getOrCreatePassport,
  markPassportDirty,
  markPassportsDirtyByProductIds,
  projectDirtyPassports,
  projectSinglePassport,
} from "@v1/db/queries/products";
import { productVariants, products } from "@v1/db/schema";
import { z } from "zod";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../../../lib/dpp-revalidation.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Resolve the owning product for a variant inside the active brand.
 */
async function getVariantPublishTarget(
  db: BrandContext["db"],
  brandId: string,
  variantId: string,
): Promise<{ productId: string } | null> {
  // Constrain the lookup to the active brand so publish cannot cross brand boundaries.
  const [target] = await db
    .select({ productId: productVariants.productId })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(productVariants.id, variantId), eq(products.brandId, brandId)),
    )
    .limit(1);

  return target ?? null;
}

/**
 * Count variants for a product inside the active brand.
 */
async function countProductVariants(
  db: BrandContext["db"],
  brandId: string,
  productId: string,
): Promise<number | null> {
  // Read all matching variants so publish can keep the existing no-variants guard.
  const variants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)));

  if (variants.length === 0) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
      .limit(1);

    return product ? 0 : null;
  }

  return variants.length;
}

/**
 * Flip the supplied products into published status.
 */
async function setProductsPublished(
  db: BrandContext["db"],
  brandId: string,
  productIds: string[],
): Promise<string[]> {
  // Skip empty batches so callers can forward filtered product lists directly.
  if (productIds.length === 0) {
    return [];
  }

  const updated = await db
    .update(products)
    .set({
      status: "published",
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.brandId, brandId), inArray(products.id, productIds)))
    .returning({ id: products.id });

  return updated.map((row) => row.id);
}

/**
 * Revalidate public caches after an inline passport projection.
 */
async function revalidateProjectedPassports(
  brandId: string,
  identifiers: {
    upids: string[];
    barcodes: string[];
  },
): Promise<void> {
  // Revalidate both public lookup paths without failing the mutation on cache errors.
  await Promise.allSettled([
    revalidatePassports(identifiers.upids),
    revalidateBarcodes(brandId, identifiers.barcodes),
  ]);
}

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const publishVariantSchema = z.object({
  variantId: z.string().uuid("Invalid variant ID"),
});

const publishProductSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
});

const publishBulkSchema = z.object({
  productIds: z
    .array(z.string().uuid("Invalid product ID"))
    .min(1, "At least one product ID is required")
    .max(100, "Maximum 100 products per bulk publish"),
});

const getPublishingStateSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
});

// =============================================================================
// ROUTER
// =============================================================================

export const publishRouter = createTRPCRouter({
  /**
   * Publish a single variant.
   *
   * Marks the variant dirty, projects it inline, and revalidates the public cache.
   *
   * @param variantId - The variant's UUID
   * @returns Success status with passport info
   */
  variant: brandWriteProcedure
    .input(publishVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const target = await getVariantPublishTarget(db, brandId, input.variantId);
        if (!target) {
          throw badRequest("Variant not found");
        }

        const { passport, isNew } = await getOrCreatePassport(
          db,
          input.variantId,
          brandId,
        );
        if (!passport) {
          throw badRequest("Failed to create or retrieve passport");
        }

        await setProductsPublished(db, brandId, [target.productId]);
        await markPassportDirty(db, passport.id);
        const projection = await projectSinglePassport(db, passport.id);

        if (!projection.found || !projection.version || !projection.passport) {
          throw badRequest(projection.error ?? "Failed to project passport");
        }

        await revalidateProjectedPassports(brandId, {
          upids: [projection.passport.upid],
          barcodes: projection.passport.barcode ? [projection.passport.barcode] : [],
        });

        return {
          success: true,
          variantId: input.variantId,
          passport: {
            id: projection.passport.id,
            upid: projection.passport.upid,
            isNew,
          },
          version: projection.version,
        };
      } catch (error) {
        throw wrapError(error, "Failed to publish variant");
      }
    }),

  /**
   * Publish all variants of a product.
   *
   * Marks the product's passports dirty, projects them inline, and revalidates caches.
   *
   * @param productId - The product's UUID
   * @returns Success status with count of targeted variants
   */
  product: brandWriteProcedure
    .input(publishProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const variantCount = await countProductVariants(db, brandId, input.productId);
        if (variantCount === null) {
          throw badRequest("Product not found");
        }
        if (variantCount === 0) {
          throw badRequest("No variants found for product");
        }

        await setProductsPublished(db, brandId, [input.productId]);
        await markPassportsDirtyByProductIds(db, brandId, [input.productId]);
        const projection = await projectDirtyPassports(db, brandId, {
          productIds: [input.productId],
        });

        await revalidateProjectedPassports(brandId, {
          upids: projection.upids,
          barcodes: projection.barcodes,
        });

        return {
          success: true,
          productId: input.productId,
          count: variantCount,
          failed: 0,
          passportsProjected: projection.totalPassportsProjected,
          versionsCreated: projection.versionsCreated,
          versionsSkippedUnchanged: projection.versionsSkippedUnchanged,
        };
      } catch (error) {
        throw wrapError(error, "Failed to publish product");
      }
    }),

  /**
   * Bulk publish multiple products.
   *
   * Flips the selected products to published and leaves projection to the background job.
   *
   * @param productIds - Array of product UUIDs to publish
   * @returns Success status with total counts
   */
  bulk: brandWriteProcedure
    .input(publishBulkSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const uniqueProductIds = Array.from(new Set(input.productIds));
        const updatedProductIds = await setProductsPublished(
          db,
          brandId,
          uniqueProductIds,
        );
        const dirtyResult = await markPassportsDirtyByProductIds(
          db,
          brandId,
          updatedProductIds,
        );

        return {
          success: true,
          totalProductsPublished: updatedProductIds.length,
          totalVariantsPublished: dirtyResult.marked,
          totalFailed: uniqueProductIds.length - updatedProductIds.length,
          productsMarkedDirty: updatedProductIds.length,
        };
      } catch (error) {
        throw wrapError(error, "Failed to bulk publish products");
      }
    }),

  /**
   * Get the publishing state for a product.
   *
   * Returns information about whether the product has been published,
   * whether it has unpublished changes, and when it was last published.
   *
   * @param productId - The product's UUID
   * @returns Publishing state info
   */
  state: brandReadProcedure
    .input(getPublishingStateSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const state = await getPublishingState(db, input.productId, brandId);

        if (!state) {
          throw badRequest("Product not found");
        }

        return state;
      } catch (error) {
        throw wrapError(error, "Failed to get publishing state");
      }
    }),
});

type PublishRouter = typeof publishRouter;
