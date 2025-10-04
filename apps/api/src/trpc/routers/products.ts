import { TRPCError } from "@trpc/server";
import {
  type Product,
  products,
  productVariants,
  categories,
  showcaseBrands,
  brandCertifications,
} from "@v1/db/schema";
import {
  bulkUpdateProductSchema,
  calculateProductCompleteness,
  createProductSchema,
  getProductSchema,
  listProductsSchema,
  productMetricsSchema,
  transformProductData,
  updateProductSchema,
} from "@v1/db/schemas/modules";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";
import { getOrComputeMetrics, CACHE_TTL } from "@v1/kv/cache";
import { invalidateProductCaches } from "@v1/kv/invalidation";
import {
  createProductWithVariantsTransaction,
  bulkStatusUpdateTransaction,
  deleteWithCascadeTransaction,
  createTransactionFromTRPCContext,
} from "@v1/db/utils/cross-module-transactions";

// Shared schemas for consistent API patterns
const paginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().min(1).max(1000).default(20),
});

const sortSchema = z.object({
  field: z.enum([
    "createdAt",
    "updatedAt",
    "name",
    "season",
    "variantCount",
  ]),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

// Safety guards for bulk operations
const MAX_BULK_UPDATE = 1000;
const PREVIEW_THRESHOLD = 100;

export const productsRouter = createTRPCRouter({
  // Paginated list with filters, sorts, and optional includes
  list: protectedProcedure
    .input(listProductsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { filter = {}, sort = { field: "createdAt", direction: "desc" }, pagination = {}, include = {} } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const { cursor, limit = 20 } = pagination;

      // Build where conditions
      const conditions = [eq(products.brandId, brandId)];

      // Apply filters
      if (filter.search) {
        conditions.push(
          or(
            ilike(products.name, `%${filter.search}%`),
            ilike(products.description, `%${filter.search}%`)
          )!,
        );
      }

      if (filter.categoryIds && filter.categoryIds.length > 0) {
        conditions.push(inArray(products.categoryId, filter.categoryIds));
      }

      if (filter.seasons && filter.seasons.length > 0) {
        conditions.push(inArray(products.season, filter.seasons));
      }

      if (filter.showcaseBrandIds && filter.showcaseBrandIds.length > 0) {
        conditions.push(inArray(products.showcaseBrandId, filter.showcaseBrandIds));
      }

      if (filter.hasDescription !== undefined) {
        if (filter.hasDescription) {
          conditions.push(isNotNull(products.description));
        } else {
          conditions.push(isNull(products.description));
        }
      }

      if (filter.hasImages !== undefined) {
        if (filter.hasImages) {
          conditions.push(isNotNull(products.primaryImageUrl));
        } else {
          conditions.push(isNull(products.primaryImageUrl));
        }
      }

      // Date range filters
      if (filter.createdRange?.from) {
        conditions.push(gte(products.createdAt, filter.createdRange.from.toISOString()));
      }
      if (filter.createdRange?.to) {
        conditions.push(lte(products.createdAt, filter.createdRange.to.toISOString()));
      }

      // Cursor-based pagination
      if (cursor) {
        try {
          const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
          const cursorCondition = sort.direction === "asc"
            ? gte(products[sort.field], cursorData[sort.field])
            : lte(products[sort.field], cursorData[sort.field]);
          conditions.push(cursorCondition);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      const data = await db.query.products.findMany({
        where: and(...conditions),
        orderBy: sort.direction === "asc" ? asc(products[sort.field]) : desc(products[sort.field]),
        limit: limit + 1, // +1 to check if there are more results
        with: {
          category: include.category,
          showcaseBrand: include.showcaseBrand,
          variants: include.variants,
          certification: include.certification,
        },
      });

      const hasMore = data.length > limit;
      if (hasMore) data.pop(); // Remove extra item

      const nextCursor = hasMore && data.length > 0
        ? Buffer.from(JSON.stringify({
            [sort.field]: data[data.length - 1][sort.field],
            id: data[data.length - 1].id
          })).toString('base64')
        : null;

      return {
        data,
        cursorInfo: { nextCursor, hasMore },
        meta: {
          total: data.length,
          brandId,
          appliedFilters: Object.keys(filter).length > 0 ? filter : undefined,
        },
      };
    }),

  // Flexible get by where conditions
  get: protectedProcedure
    .input(getProductSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { where, include = {} } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const conditions = [eq(products.brandId, brandId)];

      if (where.productId) {
        conditions.push(eq(products.id, where.productId));
      }

      if (where.categoryId) {
        conditions.push(eq(products.categoryId, where.categoryId));
      }

      if (where.season) {
        conditions.push(eq(products.season, where.season));
      }

      return db.query.products.findFirst({
        where: and(...conditions),
        with: {
          category: include.category,
          showcaseBrand: include.showcaseBrand,
          variants: include.variants,
          certification: include.certification,
        },
      });
    }),

  // Create with brand scoping and completeness calculation
  create: protectedProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Transform and prepare data for insertion
      const transformedData = transformProductData(input);

      // Calculate initial completeness score
      const completenessScore = calculateProductCompleteness({
        name: transformedData.name,
        description: transformedData.description,
        categoryId: transformedData.categoryId,
        primaryImageUrl: transformedData.primaryImageUrl,
        season: transformedData.season,
      });

      const newProductData = {
        ...transformedData,
        brandId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create the product
      const [newProduct] = await db
        .insert(products)
        .values(newProductData)
        .returning();

      // Invalidate relevant caches after creation
      await invalidateProductCaches(brandId);

      return {
        data: [newProduct],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Create product with variants and optional passports using transactions
  createWithVariants: protectedProcedure
    .input(z.object({
      productData: createProductSchema,
      variants: z.array(z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        customData: z.record(z.any()).optional(),
      })).optional(),
      createDefaultPassports: z.boolean().default(false),
      templateId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const txContext = createTransactionFromTRPCContext(ctx);

      // Transform product data
      const transformedProductData = transformProductData(input.productData);

      // Prepare transaction input
      const transactionInput = {
        brandId: txContext.brandId,
        productData: {
          ...transformedProductData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        variants: input.variants,
        createDefaultPassports: input.createDefaultPassports,
        templateId: input.templateId,
      };

      // Execute transaction
      const result = await createProductWithVariantsTransaction(
        ctx.db,
        transactionInput,
        {
          timeout: 30000,
          isolation: 'read committed',
          maxRetries: 3,
        }
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Transaction failed: ${result.error}`,
        });
      }

      // Invalidate caches
      await invalidateProductCaches(txContext.brandId);

      return {
        data: result.data || [],
        affectedCount: result.data?.length || 0,
        transactionInfo: {
          operations: result.operations,
          success: result.success,
        },
      };
    }),

  // Partial update with validation
  update: protectedProcedure
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { id, ...updateData } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Check if product exists and belongs to brand
      const existingProduct = await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.brandId, brandId)),
      });

      if (!existingProduct) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found or access denied",
        });
      }

      // Transform update data
      const transformedData = transformProductData(updateData);

      // Recalculate completeness if relevant fields changed
      let completenessScore: number | undefined;
      if (transformedData.name || transformedData.description || transformedData.categoryId ||
          transformedData.primaryImageUrl || transformedData.season) {
        completenessScore = calculateProductCompleteness({
          name: transformedData.name || existingProduct.name,
          description: transformedData.description || existingProduct.description,
          categoryId: transformedData.categoryId || existingProduct.categoryId,
          primaryImageUrl: transformedData.primaryImageUrl || existingProduct.primaryImageUrl,
          season: transformedData.season || existingProduct.season,
        });
      }

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      const [updatedProduct] = await db
        .update(products)
        .set(finalUpdateData)
        .where(and(eq(products.id, id), eq(products.brandId, brandId)))
        .returning();

      // Invalidate relevant caches after update
      await invalidateProductCaches(brandId);

      return {
        data: [updatedProduct],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Bulk update with safety guards
  bulkUpdate: protectedProcedure
    .input(bulkUpdateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { selection, data: updateData, preview = false } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Build conditions based on selection
      const conditions = [eq(products.brandId, brandId)];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(products.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        if (selection.filter.categoryIds) {
          conditions.push(inArray(products.categoryId, selection.filter.categoryIds));
        }
        if (selection.filter.seasons) {
          conditions.push(inArray(products.season, selection.filter.seasons));
        }
        // Add other filter conditions as needed
      }
      // "all" selection uses only brand condition

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(products)
        .where(and(...conditions));

      const affectedCount = countQuery[0].count;

      if (affectedCount > MAX_BULK_UPDATE) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation affects ${affectedCount} records. Maximum allowed is ${MAX_BULK_UPDATE}. Use more specific filters.`,
        });
      }

      if (affectedCount > PREVIEW_THRESHOLD && !preview) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation affects ${affectedCount} records. Use preview=true first to confirm.`,
        });
      }

      // Preview mode: return count without making changes
      if (preview) {
        return {
          data: [],
          affectedCount,
          preview: true,
        };
      }

      // Transform update data
      const transformedData = transformProductData(updateData);

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedProducts = await db
        .update(products)
        .set(finalUpdateData)
        .where(and(...conditions))
        .returning();

      // Invalidate relevant caches after bulk update
      await invalidateProductCaches(brandId);

      return {
        data: updatedProducts,
        affectedCount: updatedProducts.length,
      };
    }),

  // Soft delete
  delete: protectedProcedure
    .input(z.object({
      where: z.object({
        productId: z.string().uuid().optional(),
        ids: z.array(z.string().uuid()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { where } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const conditions = [eq(products.brandId, brandId)];

      if (where.productId) {
        conditions.push(eq(products.id, where.productId));
      }
      if (where.ids) {
        conditions.push(inArray(products.id, where.ids));
      }

      // For now, perform hard delete. In future, could add deletedAt column for soft delete
      const deletedProducts = await db
        .delete(products)
        .where(and(...conditions))
        .returning();

      // Invalidate relevant caches after deletion
      await invalidateProductCaches(brandId);

      return {
        data: deletedProducts,
        affectedCount: deletedProducts.length,
      };
    }),

  // Compute metrics and aggregations with caching
  aggregate: protectedProcedure
    .input(productMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { filter = {}, metrics } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const results: Record<string, any> = {};

      // Helper function to build base conditions for queries
      const buildBaseConditions = () => {
        const baseConditions = [eq(products.brandId, brandId)];

        if (filter.categoryIds) {
          baseConditions.push(inArray(products.categoryId, filter.categoryIds));
        }

        if (filter.seasons) {
          baseConditions.push(inArray(products.season, filter.seasons));
        }

        return baseConditions;
      };

      // Process each requested metric with caching
      for (const metric of metrics) {
        const computeFn = async () => {
          const baseConditions = buildBaseConditions();

          switch (metric) {
            case "seasonDistribution":
              return await db
                .select({
                  season: products.season,
                  count: count(),
                })
                .from(products)
                .where(and(...baseConditions))
                .groupBy(products.season);

            case "categoryDistribution":
              return await db
                .select({
                  categoryId: products.categoryId,
                  count: count(),
                })
                .from(products)
                .where(and(...baseConditions, isNotNull(products.categoryId)))
                .groupBy(products.categoryId);

            case "contentCompleteness":
              const stats = await db
                .select({
                  withDescription: count(),
                  withImages: count(),
                  total: count(),
                })
                .from(products)
                .where(and(...baseConditions));
              return stats[0];

            case "variantStatistics":
              const variantStats = await db
                .select({
                  productId: products.id,
                  variantCount: count(productVariants.id),
                })
                .from(products)
                .leftJoin(productVariants, eq(products.id, productVariants.productId))
                .where(and(...baseConditions))
                .groupBy(products.id);

              return {
                productsWithVariants: variantStats.filter(s => s.variantCount > 0).length,
                totalVariants: variantStats.reduce((sum, s) => sum + s.variantCount, 0),
                avgVariantsPerProduct: variantStats.length > 0
                  ? variantStats.reduce((sum, s) => sum + s.variantCount, 0) / variantStats.length
                  : 0,
              };

            case "showcaseBrandDistribution":
              return await db
                .select({
                  showcaseBrandId: products.showcaseBrandId,
                  count: count(),
                })
                .from(products)
                .where(and(...baseConditions, isNotNull(products.showcaseBrandId)))
                .groupBy(products.showcaseBrandId);

            case "certificationDistribution":
              return await db
                .select({
                  certificationId: products.brandCertificationId,
                  count: count(),
                })
                .from(products)
                .where(and(...baseConditions, isNotNull(products.brandCertificationId)))
                .groupBy(products.brandCertificationId);

            default:
              // For any metrics not explicitly handled, return empty result
              return [];
          }
        };

        // Get cached metrics or compute them
        results[metric] = await getOrComputeMetrics(
          "PRODUCTS",
          brandId,
          metric,
          computeFn,
          {
            filters: filter,
            ttl: CACHE_TTL.METRICS, // 5 minutes TTL
          }
        );
      }

      return {
        metrics: results,
        meta: {
          asOf: new Date(),
          brandId,
          requestedMetrics: metrics,
          filtersApplied: Object.keys(filter).length > 0,
          cached: true, // Indicate these results may be cached
        },
      };
    }),
});
