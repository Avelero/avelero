// @ts-nocheck
import { TRPCError } from "@trpc/server";
import {
  brandColors,
  brandSizes,
  categories,
  passports,
  productVariants,
  products,
} from "@v1/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

// Analytics schemas for cross-module queries
const analyticsFilterSchema = z.object({
  // Date range filters
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),

  // Entity filters
  categoryIds: z.array(z.string().uuid()).optional(),
  productIds: z.array(z.string().uuid()).optional(),
  passportStatus: z
    .array(z.enum(["draft", "published", "archived", "blocked"]))
    .optional(),

  // Completeness filters
  minCompleteness: z.number().min(0).max(100).optional(),
  includeEmpty: z.boolean().default(true),
});

const crossModuleMetricsSchema = z.object({
  filter: analyticsFilterSchema.optional(),
  metrics: z.array(
    z.enum([
      "overallHealth", // Overall system health metrics
      "categoryVariantPassportFlow", // Full flow from categories to variants to passports
      "completenessAnalysis", // Completeness analysis across all modules
      "productCatalogMaturity", // Product catalog maturity score
      "passportAdoptionFunnel", // Passport adoption funnel analysis
      "contentGaps", // Identify content gaps across the system
      "topPerformingCategories", // Categories with best variant/passport coverage
    ]),
  ),
});

export const analyticsRouter = createTRPCRouter({
  /**
   * Cross-module analytics for comprehensive insights
   */
  crossModule: protectedProcedure
    .input(crossModuleMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { filter, metrics } = input;
      const results: Record<string, any> = {};

      // Base conditions for brand isolation
      const baseConditions = [eq(products.brandId, brandId)];

      // Apply date range filters if provided
      if (filter?.dateRange?.from) {
        baseConditions.push(
          sql`${products.createdAt} >= ${filter.dateRange.from.toISOString()}`,
        );
      }
      if (filter?.dateRange?.to) {
        baseConditions.push(
          sql`${products.createdAt} <= ${filter.dateRange.to.toISOString()}`,
        );
      }

      // Process each requested metric
      for (const metric of metrics) {
        switch (metric) {
          case "overallHealth": {
            const healthQuery = await db.execute(sql`
              SELECT
                COUNT(DISTINCT c.id) as total_categories,
                COUNT(DISTINCT p.id) as total_products,
                COUNT(DISTINCT pv.id) as total_variants,
                COUNT(DISTINCT pass.id) as total_passports,
                ROUND(
                  (COUNT(DISTINCT pass.id) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
                ) as overall_passport_coverage,
                ROUND(
                  (COUNT(DISTINCT CASE WHEN pv.sku IS NOT NULL AND pv.color_id IS NOT NULL AND pv.size_id IS NOT NULL THEN pv.id END) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
                ) as variant_completeness_rate,
                ROUND(
                  (COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) * 100.0) / NULLIF(COUNT(DISTINCT pass.id), 0), 2
                ) as passport_publish_rate
              FROM ${categories} c
              LEFT JOIN ${products} p ON c.id = p.category_id AND ${and(...baseConditions)}
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
            `);
            results.overallHealth = healthQuery.rows[0];
            break;
          }

          case "categoryVariantPassportFlow": {
            const flowQuery = await db.execute(sql`
              SELECT
                c.id as category_id,
                c.name as category_name,
                COUNT(DISTINCT p.id) as products_in_category,
                COUNT(DISTINCT pv.id) as variants_in_category,
                COUNT(DISTINCT pass.id) as passports_in_category,
                ROUND(
                  (COUNT(DISTINCT pv.id) * 1.0) / NULLIF(COUNT(DISTINCT p.id), 0), 2
                ) as variants_per_product,
                ROUND(
                  (COUNT(DISTINCT pass.id) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
                ) as passport_coverage_percentage,
                ROUND(
                  (COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) * 100.0) / NULLIF(COUNT(DISTINCT pass.id), 0), 2
                ) as published_passport_rate
              FROM ${categories} c
              LEFT JOIN ${products} p ON c.id = p.category_id AND ${and(...baseConditions)}
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
              GROUP BY c.id, c.name
              HAVING COUNT(DISTINCT p.id) > 0
              ORDER BY passport_coverage_percentage DESC, variants_per_product DESC
            `);
            results.categoryVariantPassportFlow = flowQuery.rows;
            break;
          }

          case "completenessAnalysis": {
            const completenessQuery = await db.execute(sql`
              SELECT
                'variants' as entity_type,
                COUNT(*) as total_entities,
                COUNT(CASE WHEN sku IS NOT NULL THEN 1 END) as with_sku,
                COUNT(CASE WHEN color_id IS NOT NULL THEN 1 END) as with_color,
                COUNT(CASE WHEN size_id IS NOT NULL THEN 1 END) as with_size,
                COUNT(CASE WHEN product_image_url IS NOT NULL THEN 1 END) as with_image,
                COUNT(CASE WHEN sku IS NOT NULL AND color_id IS NOT NULL AND size_id IS NOT NULL AND product_image_url IS NOT NULL THEN 1 END) as fully_complete,
                ROUND(
                  (COUNT(CASE WHEN sku IS NOT NULL AND color_id IS NOT NULL AND size_id IS NOT NULL AND product_image_url IS NOT NULL THEN 1 END) * 100.0) / COUNT(*), 2
                ) as completeness_percentage
              FROM ${productVariants} pv
              INNER JOIN ${products} p ON pv.product_id = p.id
              WHERE ${and(...baseConditions)}

              UNION ALL

              SELECT
                'passports' as entity_type,
                COUNT(*) as total_entities,
                COUNT(CASE WHEN template_id IS NOT NULL THEN 1 END) as with_template,
                COUNT(CASE WHEN custom_data IS NOT NULL THEN 1 END) as with_custom_data,
                COUNT(CASE WHEN module_data IS NOT NULL THEN 1 END) as with_module_data,
                COUNT(CASE WHEN passport_status = 'published' THEN 1 END) as published,
                COUNT(CASE WHEN template_id IS NOT NULL AND (custom_data IS NOT NULL OR module_data IS NOT NULL) AND passport_status = 'published' THEN 1 END) as fully_complete,
                ROUND(
                  (COUNT(CASE WHEN template_id IS NOT NULL AND (custom_data IS NOT NULL OR module_data IS NOT NULL) AND passport_status = 'published' THEN 1 END) * 100.0) / COUNT(*), 2
                ) as completeness_percentage
              FROM ${passports} pass
              INNER JOIN ${products} p ON (pass.product_id = p.id OR pass.variant_id IN (
                SELECT pv.id FROM ${productVariants} pv WHERE pv.product_id = p.id
              ))
              WHERE ${and(...baseConditions)}
            `);
            results.completenessAnalysis = completenessQuery.rows;
            break;
          }

          case "productCatalogMaturity": {
            const maturityQuery = await db.execute(sql`
              WITH category_scores AS (
                SELECT
                  c.id as category_id,
                  c.name as category_name,
                  COUNT(DISTINCT p.id) as product_count,
                  COUNT(DISTINCT pv.id) as variant_count,
                  COUNT(DISTINCT pass.id) as passport_count,
                  CASE
                    WHEN COUNT(DISTINCT p.id) = 0 THEN 0
                    WHEN COUNT(DISTINCT pv.id) = 0 THEN 25
                    WHEN COUNT(DISTINCT pass.id) = 0 THEN 50
                    WHEN COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) = 0 THEN 75
                    ELSE 100
                  END as maturity_score
                FROM ${categories} c
                LEFT JOIN ${products} p ON c.id = p.category_id AND ${and(...baseConditions)}
                LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
                LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
                GROUP BY c.id, c.name
              )
              SELECT
                AVG(maturity_score) as overall_maturity_score,
                COUNT(CASE WHEN maturity_score = 100 THEN 1 END) as fully_mature_categories,
                COUNT(CASE WHEN maturity_score >= 75 THEN 1 END) as mostly_mature_categories,
                COUNT(CASE WHEN maturity_score >= 50 THEN 1 END) as partially_mature_categories,
                COUNT(CASE WHEN maturity_score < 50 THEN 1 END) as immature_categories,
                COUNT(*) as total_categories
              FROM category_scores
            `);
            results.productCatalogMaturity = maturityQuery.rows[0];
            break;
          }

          case "passportAdoptionFunnel": {
            const funnelQuery = await db.execute(sql`
              SELECT
                'Products Created' as stage,
                COUNT(DISTINCT p.id) as count,
                100 as percentage
              FROM ${products} p
              WHERE ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Products with Variants' as stage,
                COUNT(DISTINCT p.id) as count,
                ROUND(
                  (COUNT(DISTINCT p.id) * 100.0) / NULLIF((SELECT COUNT(DISTINCT id) FROM ${products} WHERE ${and(...baseConditions)}), 0), 2
                ) as percentage
              FROM ${products} p
              INNER JOIN ${productVariants} pv ON p.id = pv.product_id
              WHERE ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Variants with Passports' as stage,
                COUNT(DISTINCT pv.id) as count,
                ROUND(
                  (COUNT(DISTINCT pv.id) * 100.0) / NULLIF((
                    SELECT COUNT(DISTINCT pv.id)
                    FROM ${productVariants} pv
                    INNER JOIN ${products} p ON pv.product_id = p.id
                    WHERE ${and(...baseConditions)}
                  ), 0), 2
                ) as percentage
              FROM ${productVariants} pv
              INNER JOIN ${products} p ON pv.product_id = p.id
              INNER JOIN ${passports} pass ON pass.variant_id = pv.id
              WHERE ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Published Passports' as stage,
                COUNT(DISTINCT pass.id) as count,
                ROUND(
                  (COUNT(DISTINCT pass.id) * 100.0) / NULLIF((
                    SELECT COUNT(DISTINCT pass.id)
                    FROM ${passports} pass
                    INNER JOIN ${products} p ON (pass.product_id = p.id OR pass.variant_id IN (
                      SELECT pv.id FROM ${productVariants} pv WHERE pv.product_id = p.id
                    ))
                    WHERE ${and(...baseConditions)}
                  ), 0), 2
                ) as percentage
              FROM ${passports} pass
              INNER JOIN ${products} p ON (pass.product_id = p.id OR pass.variant_id IN (
                SELECT pv.id FROM ${productVariants} pv WHERE pv.product_id = p.id
              ))
              WHERE pass.passport_status = 'published' AND ${and(...baseConditions)}

              ORDER BY percentage DESC
            `);
            results.passportAdoptionFunnel = funnelQuery.rows;
            break;
          }

          case "contentGaps": {
            const gapsQuery = await db.execute(sql`
              SELECT
                'Products without variants' as gap_type,
                COUNT(*) as count,
                ARRAY_AGG(p.name ORDER BY p.name) as examples
              FROM ${products} p
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              WHERE pv.id IS NULL AND ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Variants without SKUs' as gap_type,
                COUNT(*) as count,
                ARRAY_AGG(p.name ORDER BY p.name) as examples
              FROM ${productVariants} pv
              INNER JOIN ${products} p ON pv.product_id = p.id
              WHERE pv.sku IS NULL AND ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Variants without passports' as gap_type,
                COUNT(*) as count,
                ARRAY_AGG(p.name ORDER BY p.name) as examples
              FROM ${productVariants} pv
              INNER JOIN ${products} p ON pv.product_id = p.id
              LEFT JOIN ${passports} pass ON pass.variant_id = pv.id
              WHERE pass.id IS NULL AND ${and(...baseConditions)}

              UNION ALL

              SELECT
                'Draft passports' as gap_type,
                COUNT(*) as count,
                ARRAY_AGG(p.name ORDER BY p.name) as examples
              FROM ${passports} pass
              INNER JOIN ${products} p ON (pass.product_id = p.id OR pass.variant_id IN (
                SELECT pv.id FROM ${productVariants} pv WHERE pv.product_id = p.id
              ))
              WHERE pass.passport_status = 'draft' AND ${and(...baseConditions)}
            `);
            results.contentGaps = gapsQuery.rows;
            break;
          }

          case "topPerformingCategories": {
            const topCategoriesQuery = await db.execute(sql`
              SELECT
                c.id as category_id,
                c.name as category_name,
                COUNT(DISTINCT p.id) as product_count,
                COUNT(DISTINCT pv.id) as variant_count,
                COUNT(DISTINCT pass.id) as passport_count,
                ROUND(
                  (COUNT(DISTINCT pv.id) * 1.0) / NULLIF(COUNT(DISTINCT p.id), 0), 2
                ) as variants_per_product,
                ROUND(
                  (COUNT(DISTINCT pass.id) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
                ) as passport_coverage,
                ROUND(
                  (COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) * 100.0) / NULLIF(COUNT(DISTINCT pass.id), 0), 2
                ) as published_rate,
                ROUND(
                  (
                    (COUNT(DISTINCT pv.id) * 1.0 / NULLIF(COUNT(DISTINCT p.id), 0)) * 0.3 +
                    (COUNT(DISTINCT pass.id) * 100.0 / NULLIF(COUNT(DISTINCT pv.id), 0)) * 0.4 +
                    (COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) * 100.0 / NULLIF(COUNT(DISTINCT pass.id), 0)) * 0.3
                  ), 2
                ) as performance_score
              FROM ${categories} c
              LEFT JOIN ${products} p ON c.id = p.category_id AND ${and(...baseConditions)}
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
              GROUP BY c.id, c.name
              HAVING COUNT(DISTINCT p.id) > 0
              ORDER BY performance_score DESC
              LIMIT 10
            `);
            results.topPerformingCategories = topCategoriesQuery.rows;
            break;
          }

          default:
            // For any metrics not explicitly handled, return empty result
            results[metric] = [];
            break;
        }
      }

      return {
        metrics: results,
        meta: {
          asOf: new Date(),
          brandId,
          requestedMetrics: metrics,
          filtersApplied: Object.keys(filter).length > 0,
        },
      };
    }),

  /**
   * Quick dashboard overview combining key metrics
   */
  dashboard: protectedProcedure
    .input(
      z.object({
        includeComparisons: z.boolean().default(false),
        timeframe: z.enum(["7d", "30d", "90d"]).default("30d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { includeComparisons, timeframe } = input;

      // Calculate date range based on timeframe
      const daysAgo = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);

      const dashboardQuery = await db.execute(sql`
        WITH current_stats AS (
          SELECT
            COUNT(DISTINCT c.id) as categories,
            COUNT(DISTINCT p.id) as products,
            COUNT(DISTINCT pv.id) as variants,
            COUNT(DISTINCT pass.id) as passports,
            COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) as published_passports,
            ROUND(
              (COUNT(DISTINCT pass.id) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
            ) as passport_coverage,
            ROUND(
              (COUNT(DISTINCT CASE WHEN pv.sku IS NOT NULL AND pv.color_id IS NOT NULL AND pv.size_id IS NOT NULL THEN pv.id END) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2
            ) as variant_completeness
          FROM ${categories} c
          LEFT JOIN ${products} p ON c.id = p.category_id AND p.brand_id = ${brandId}
          LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
          LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
        )
        SELECT * FROM current_stats
      `);

      const dashboard = dashboardQuery.rows[0];

      // Add growth comparison if requested
      let growth = null;
      if (includeComparisons) {
        const previousPeriodEnd = new Date(fromDate);
        const previousPeriodStart = new Date(fromDate);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - daysAgo);

        const growthQuery = await db.execute(sql`
          SELECT
            COUNT(DISTINCT p.id) as products_previous,
            COUNT(DISTINCT pv.id) as variants_previous,
            COUNT(DISTINCT pass.id) as passports_previous
          FROM ${categories} c
          LEFT JOIN ${products} p ON c.id = p.category_id AND p.brand_id = ${brandId}
            AND p.created_at < ${previousPeriodEnd.toISOString()}
          LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
            AND pv.created_at < ${previousPeriodEnd.toISOString()}
          LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
            AND pass.created_at < ${previousPeriodEnd.toISOString()}
        `);

        const previous = growthQuery.rows[0];
        growth = {
          products: dashboard.products - (previous.products_previous || 0),
          variants: dashboard.variants - (previous.variants_previous || 0),
          passports: dashboard.passports - (previous.passports_previous || 0),
        };
      }

      return {
        overview: dashboard,
        growth,
        meta: {
          asOf: new Date(),
          timeframe,
          brandId,
        },
      };
    }),
});
