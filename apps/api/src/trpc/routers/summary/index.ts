/**
 * Summary router implementation.
 *
 * Provides aggregated data and statistics for various entities:
 * - Product completion rates
 * - Passport status counts
 * - Module completion statistics
 * - Overall brand metrics
 *
 * This router is designed for dashboard and analytics use cases where
 * summarized data is needed without fetching full entity lists.
 */
import type { Database } from "@v1/db/client";
import { and, count, eq, sql } from "@v1/db/queries";
import {
  products,
  productVariants,
  passportTemplates,
} from "@v1/db/schema";
import { z } from "zod";
import { wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Get product summary statistics for a brand
 */
async function getProductSummary(db: Database, brandId: string) {
  const [productCount] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.brandId, brandId));

  const [variantCount] = await db
    .select({ count: count() })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(products.brandId, brandId));

  const statusCounts = await db
    .select({
      status: products.status,
      count: count(),
    })
    .from(products)
    .where(eq(products.brandId, brandId))
    .groupBy(products.status);

  return {
    totalProducts: productCount?.count ?? 0,
    totalVariants: variantCount?.count ?? 0,
    byStatus: statusCounts.reduce(
      (acc, { status, count }) => {
        acc[status] = count;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}

/**
 * Get template summary statistics for a brand
 */
async function getTemplateSummary(db: Database, brandId: string) {
  const [templateCount] = await db
    .select({ count: count() })
    .from(passportTemplates)
    .where(eq(passportTemplates.brandId, brandId));

  return {
    totalTemplates: templateCount?.count ?? 0,
  };
}

export const summaryRouter = createTRPCRouter({
  /**
   * Get comprehensive summary of all brand data
   */
  overview: brandRequiredProcedure.query(async ({ ctx }) => {
    const brandCtx = ctx as BrandContext;
    try {
      const [productStats, templateStats] = await Promise.all([
        getProductSummary(brandCtx.db, brandCtx.brandId),
        getTemplateSummary(brandCtx.db, brandCtx.brandId),
      ]);

      return {
        products: productStats,
        templates: templateStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw wrapError(error, "Failed to load summary overview");
    }
  }),

  /**
   * Get detailed product statistics
   */
  products: brandRequiredProcedure.query(async ({ ctx }) => {
    const brandCtx = ctx as BrandContext;
    try {
      return await getProductSummary(brandCtx.db, brandCtx.brandId);
    } catch (error) {
      throw wrapError(error, "Failed to load product summary");
    }
  }),

  /**
   * Get template statistics
   */
  templates: brandRequiredProcedure.query(async ({ ctx }) => {
    const brandCtx = ctx as BrandContext;
    try {
      return await getTemplateSummary(brandCtx.db, brandCtx.brandId);
    } catch (error) {
      throw wrapError(error, "Failed to load template summary");
    }
  }),
});

export type SummaryRouter = typeof summaryRouter;
