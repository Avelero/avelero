/**
 * Publish Router.
 *
 * Exposes tRPC endpoints for publishing product passports.
 * Publishing creates an immutable version record that persists independently
 * of the working layer.
 *
 * Endpoints:
 * - publish.variant: Publish a single variant
 * - publish.product: Publish all variants of a product
 * - publish.bulk: Publish multiple products at once
 */
import {
  publishVariant,
  publishProduct,
  bulkPublishProducts,
  getPublishingState,
} from "@v1/db/queries/products";
import { z } from "zod";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

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
   * Creates or updates the variant's passport with a new immutable version
   * containing the current working data as a JSON-LD snapshot.
   *
   * @param variantId - The variant's UUID
   * @returns Success status with passport and version info
   */
  variant: brandRequiredProcedure
    .input(publishVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const result = await publishVariant(db, input.variantId, brandId);

        if (!result.success) {
          throw badRequest(result.error ?? "Failed to publish variant");
        }

        return {
          success: true,
          variantId: result.variantId,
          passport: result.passport,
          version: result.version,
        };
      } catch (error) {
        throw wrapError(error, "Failed to publish variant");
      }
    }),

  /**
   * Publish all variants of a product.
   *
   * Creates or updates passports for all variants of the specified product.
   * Updates the product's status to 'published' and clears the
   * has_unpublished_changes flag.
   *
   * @param productId - The product's UUID
   * @returns Success status with count of published variants
   */
  product: brandRequiredProcedure
    .input(publishProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const result = await publishProduct(db, input.productId, brandId);

        if (!result.success) {
          throw badRequest(result.error ?? "Failed to publish product");
        }

        return {
          success: true,
          productId: result.productId,
          count: result.totalPublished,
          failed: result.totalFailed,
          variants: result.variants,
        };
      } catch (error) {
        throw wrapError(error, "Failed to publish product");
      }
    }),

  /**
   * Bulk publish multiple products.
   *
   * Publishes all variants for each product in the provided list.
   * Useful for publishing multiple products from the list view.
   *
   * @param productIds - Array of product UUIDs to publish
   * @returns Success status with total counts
   */
  bulk: brandRequiredProcedure
    .input(publishBulkSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const result = await bulkPublishProducts(db, input.productIds, brandId);

        return {
          success: result.success,
          totalProductsPublished: result.totalProductsPublished,
          totalVariantsPublished: result.totalVariantsPublished,
          totalFailed: result.totalFailed,
          products: result.products,
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
  state: brandRequiredProcedure
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

export type PublishRouter = typeof publishRouter;
