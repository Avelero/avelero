// @ts-nocheck
import { TRPCError } from "@trpc/server";
import {
  getCategoriesWithProductCounts,
  getCategoryAncestors,
  getCategoryDescendants,
  getCategoryHierarchyStats,
  getCategoryPath,
  getCategoryTree,
  validateCategoryHierarchy,
} from "@v1/db/queries";
import {
  categories,
  passports,
  productVariants,
  products,
} from "@v1/db/schema";
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
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  bulkUpdateCategoriesSchema,
  categoryMetricsSchema,
  createCategorySchema,
  getCategoryPathSchema,
  getCategorySchema,
  getCategoryTreeSchema,
  listCategoriesSchema,
  moveCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
  validateCategoryHierarchySchema,
} from "../../schemas/categories.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

// Safety guards for bulk operations
const MAX_BULK_UPDATE = 1000;
const PREVIEW_THRESHOLD = 100;

export const categoriesRouter = createTRPCRouter({
  // Hierarchical list with tree support
  list: protectedProcedure
    .input(listCategoriesSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const {
        filter = {},
        sort = { field: "name", direction: "asc" },
        pagination = {},
        include = {},
      } = input;

      const { cursor, limit = 20 } = pagination;

      // Build where conditions
      const conditions = [];

      // Apply filters
      if (filter.search) {
        conditions.push(ilike(categories.name, `%${filter.search}%`));
      }

      if (filter.parentId !== undefined) {
        if (filter.parentId === null) {
          conditions.push(isNull(categories.parentId));
        } else {
          conditions.push(eq(categories.parentId, filter.parentId));
        }
      }

      if (filter.rootOnly) {
        conditions.push(isNull(categories.parentId));
      }

      if (filter.leafOnly) {
        // Categories with no children
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM ${categories} child WHERE child.parent_id = ${categories}.id)`,
        );
      }

      if (filter.name) {
        conditions.push(eq(categories.name, filter.name));
      }

      // Cursor-based pagination
      if (cursor) {
        try {
          const cursorData = JSON.parse(
            Buffer.from(cursor, "base64").toString(),
          );
          const cursorCondition =
            sort.direction === "asc"
              ? gte(categories[sort.field], cursorData[sort.field])
              : lte(categories[sort.field], cursorData[sort.field]);
          conditions.push(cursorCondition);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      // Execute base query
      const data = await db.query.categories.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy:
          sort.direction === "asc"
            ? asc(categories[sort.field])
            : desc(categories[sort.field]),
        limit: limit + 1, // +1 to check if there are more results
      });

      const hasMore = data.length > limit;
      if (hasMore) data.pop();

      // Enhance with hierarchical data if requested
      const enhancedData = await Promise.all(
        data.map(async (category) => {
          const enhanced: any = { ...category };

          if (include.ancestors) {
            enhanced.ancestors = await getCategoryAncestors(db, category.id);
          }

          if (include.descendants) {
            enhanced.descendants = await getCategoryDescendants(
              db,
              category.id,
            );
          }

          if (include.children) {
            enhanced.children = await db.query.categories.findMany({
              where: eq(categories.parentId, category.id),
              orderBy: asc(categories.name),
            });
          }

          if (include.parent && category.parentId) {
            enhanced.parent = await db.query.categories.findFirst({
              where: eq(categories.id, category.parentId),
            });
          }

          if (include.path) {
            const pathData = await getCategoryPath(db, category.id);
            enhanced.path = pathData.path;
            enhanced.pathCategories = pathData.categories;
          }

          if (include.productCount) {
            const productCountResult = await db.execute(
              sql`SELECT COUNT(*) as count FROM products WHERE category_id = ${category.id}`,
            );
            enhanced.productCount = Number(
              productCountResult.rows[0]?.count || 0,
            );
          }

          return enhanced;
        }),
      );

      const nextCursor =
        hasMore && enhancedData.length > 0
          ? Buffer.from(
              JSON.stringify({
                [sort.field]: enhancedData[enhancedData.length - 1][sort.field],
                id: enhancedData[enhancedData.length - 1].id,
              }),
            ).toString("base64")
          : null;

      return {
        data: enhancedData,
        cursorInfo: { nextCursor, hasMore },
        meta: {
          total: enhancedData.length,
          appliedFilters: Object.keys(filter).length > 0 ? filter : undefined,
        },
      };
    }),

  // Get single category with hierarchical relations
  get: protectedProcedure
    .input(getCategorySchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { where, include = {} } = input;

      const conditions = [];

      if (where.categoryId) {
        conditions.push(eq(categories.id, where.categoryId));
      }

      if (where.name) {
        conditions.push(eq(categories.name, where.name));
      }

      if (where.parentId !== undefined) {
        if (where.parentId === null) {
          conditions.push(isNull(categories.parentId));
        } else {
          conditions.push(eq(categories.parentId, where.parentId));
        }
      }

      const category = await db.query.categories.findFirst({
        where: and(...conditions),
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Enhance with hierarchical data
      const enhanced: any = { ...category };

      if (include.ancestors) {
        enhanced.ancestors = await getCategoryAncestors(db, category.id);
      }

      if (include.descendants) {
        enhanced.descendants = await getCategoryDescendants(db, category.id);
      }

      if (include.children) {
        enhanced.children = await db.query.categories.findMany({
          where: eq(categories.parentId, category.id),
          orderBy: asc(categories.name),
        });
      }

      if (include.parent && category.parentId) {
        enhanced.parent = await db.query.categories.findFirst({
          where: eq(categories.id, category.parentId),
        });
      }

      if (include.path) {
        const pathData = await getCategoryPath(db, category.id);
        enhanced.path = pathData.path;
        enhanced.pathCategories = pathData.categories;
      }

      if (include.productCount) {
        const productCountResult = await db.execute(
          sql`SELECT COUNT(*) as count FROM products WHERE category_id = ${category.id}`,
        );
        enhanced.productCount = Number(productCountResult.rows[0]?.count || 0);
      }

      return enhanced;
    }),

  // Get hierarchical tree
  tree: protectedProcedure
    .input(getCategoryTreeSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const {
        rootId = null,
        maxDepth = 5,
        includeProductCounts = false,
        filter,
      } = input;

      const tree = await getCategoryTree(db, {
        rootId,
        maxDepth,
        includeProductCounts,
        filter,
      });

      return {
        data: tree,
        meta: {
          rootId,
          maxDepth,
          totalNodes: tree.length,
        },
      };
    }),

  // Get category path/breadcrumb
  path: protectedProcedure
    .input(getCategoryPathSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { categoryId, separator = " > ", includeIds = false } = input;

      const pathData = await getCategoryPath(db, categoryId, {
        separator,
        includeIds,
      });

      return {
        path: pathData.path,
        pathIds: pathData.pathIds,
        categories: pathData.categories,
      };
    }),

  // Create category with hierarchy validation
  create: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { name, parentId, description, metadata } = input;

      // Validate hierarchy if parentId provided
      if (parentId) {
        const parent = await db.query.categories.findFirst({
          where: eq(categories.id, parentId),
        });

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent category not found",
          });
        }

        // Check depth limits
        const ancestors = await getCategoryAncestors(db, parentId);
        if (ancestors.length >= 9) {
          // Allow up to 10 levels (0-9)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum hierarchy depth (10 levels) would be exceeded",
          });
        }
      }

      // Check for duplicate names under same parent
      const existingCategory = await db.query.categories.findFirst({
        where: and(
          eq(categories.name, name),
          parentId
            ? eq(categories.parentId, parentId)
            : isNull(categories.parentId),
        ),
      });

      if (existingCategory) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Category with this name already exists under the same parent",
        });
      }

      const [newCategory] = await db
        .insert(categories)
        .values({
          name,
          parentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      return {
        data: [newCategory],
        affectedCount: 1,
      };
    }),

  // Update category
  update: protectedProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { id, name, parentId, description, metadata } = input;

      // Check if category exists
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.id, id),
      });

      if (!existingCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Validate hierarchy if parentId is being changed
      if (parentId !== undefined && parentId !== existingCategory.parentId) {
        const validation = await validateCategoryHierarchy(db, id, parentId);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid hierarchy: ${validation.issues.join(", ")}`,
          });
        }
      }

      // Check for duplicate names if name is being changed
      if (name && name !== existingCategory.name) {
        const conflictCategory = await db.query.categories.findFirst({
          where: and(
            eq(categories.name, name),
            parentId !== undefined
              ? parentId
                ? eq(categories.parentId, parentId)
                : isNull(categories.parentId)
              : existingCategory.parentId
                ? eq(categories.parentId, existingCategory.parentId)
                : isNull(categories.parentId),
          ),
        });

        if (conflictCategory && conflictCategory.id !== id) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Category with this name already exists under the same parent",
          });
        }
      }

      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (parentId !== undefined) updateData.parentId = parentId;

      const [updatedCategory] = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning();

      return {
        data: [updatedCategory],
        affectedCount: 1,
      };
    }),

  // Move category (change parent)
  move: protectedProcedure
    .input(moveCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { id, newParentId, preventCycles = true } = input;

      if (preventCycles) {
        const validation = await validateCategoryHierarchy(db, id, newParentId);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot move category: ${validation.issues.join(", ")}`,
          });
        }
      }

      const [movedCategory] = await db
        .update(categories)
        .set({
          parentId: newParentId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(categories.id, id))
        .returning();

      return {
        data: [movedCategory],
        affectedCount: 1,
      };
    }),

  // Validate hierarchy
  validateHierarchy: protectedProcedure
    .input(validateCategoryHierarchySchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { categoryId, checkCycles = true, maxDepth = 10 } = input;

      if (!categoryId) {
        // Validate entire hierarchy
        const stats = await getCategoryHierarchyStats(db);
        return {
          isValid: stats.maxDepth <= maxDepth,
          issues:
            stats.maxDepth > maxDepth
              ? [`Maximum depth exceeded: ${stats.maxDepth}`]
              : [],
          stats,
        };
      }

      // Validate specific category
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
      });

      if (!category) {
        return {
          isValid: false,
          issues: ["Category not found"],
        };
      }

      if (checkCycles && category.parentId) {
        const validation = await validateCategoryHierarchy(
          db,
          categoryId,
          category.parentId,
        );
        return validation;
      }

      return { isValid: true, issues: [] };
    }),

  // Bulk update with safety guards
  bulkUpdate: protectedProcedure
    .input(bulkUpdateCategoriesSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { selection, data: updateData, preview = false } = input;

      // Build conditions based on selection
      const conditions = [];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(categories.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        if (selection.filter.parentId !== undefined) {
          conditions.push(
            selection.filter.parentId === null
              ? isNull(categories.parentId)
              : eq(categories.parentId, selection.filter.parentId),
          );
        }
        if (selection.filter.search) {
          conditions.push(
            ilike(categories.name, `%${selection.filter.search}%`),
          );
        }
      }
      // "all" selection uses no additional conditions

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(categories)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const affectedCount = countQuery[0].count;

      if (affectedCount > MAX_BULK_UPDATE) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation affects ${affectedCount} records. Maximum allowed is ${MAX_BULK_UPDATE}.`,
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

      const finalUpdateData = {
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedCategories = await db
        .update(categories)
        .set(finalUpdateData)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .returning();

      return {
        data: updatedCategories,
        affectedCount: updatedCategories.length,
      };
    }),

  // Delete category (cascade or prevent if has children)
  delete: protectedProcedure
    .input(
      z.object({
        where: z.object({
          categoryId: z.string().uuid().optional(),
          ids: z.array(z.string().uuid()).optional(),
        }),
        cascade: z.boolean().default(false), // Delete children too
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { where, cascade = false } = input;

      const conditions = [];

      if (where.categoryId) {
        conditions.push(eq(categories.id, where.categoryId));
      }
      if (where.ids) {
        conditions.push(inArray(categories.id, where.ids));
      }

      // Check for children if not cascading
      if (!cascade) {
        const hasChildrenQuery = await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              conditions.length > 0 ? or(...conditions) : sql`true`,
              sql`EXISTS (SELECT 1 FROM ${categories} child WHERE child.parent_id = ${categories}.id)`,
            ),
          )
          .limit(1);

        if (hasChildrenQuery.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot delete categories with children. Use cascade=true or move children first.",
          });
        }
      }

      const deletedCategories = await db
        .delete(categories)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .returning();

      return {
        data: deletedCategories,
        affectedCount: deletedCategories.length,
      };
    }),

  // Compute metrics and aggregations
  aggregate: protectedProcedure
    .input(categoryMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { filter = {}, metrics } = input;

      const results: Record<string, any> = {};

      for (const metric of metrics) {
        switch (metric) {
          case "hierarchyDistribution": {
            const hierarchyStats = await getCategoryHierarchyStats(db);
            results.hierarchyDistribution = hierarchyStats;
            break;
          }

          case "productDistribution": {
            const productDist = await getCategoriesWithProductCounts(db, {
              includeEmpty: false,
            });
            results.productDistribution = productDist;
            break;
          }

          case "pathAnalysis": {
            // Get path length analysis
            const pathAnalysis = await db.execute(sql`
              WITH RECURSIVE category_paths AS (
                SELECT id, name, parent_id, 0 as depth, name as path
                FROM ${categories}
                WHERE parent_id IS NULL

                UNION ALL

                SELECT c.id, c.name, c.parent_id, cp.depth + 1, cp.path || ' > ' || c.name
                FROM ${categories} c
                INNER JOIN category_paths cp ON c.parent_id = cp.id
              )
              SELECT
                AVG(depth) as avg_depth,
                MIN(depth) as min_depth,
                MAX(depth) as max_depth,
                AVG(LENGTH(path)) as avg_path_length
              FROM category_paths
            `);
            results.pathAnalysis = pathAnalysis.rows[0];
            break;
          }

          case "utilizationStats": {
            const utilizationQuery = await db.execute(sql`
              SELECT
                COUNT(*) as total_categories,
                COUNT(CASE WHEN product_counts.count > 0 THEN 1 END) as categories_with_products,
                COUNT(CASE WHEN product_counts.count = 0 OR product_counts.count IS NULL THEN 1 END) as empty_categories,
                AVG(COALESCE(product_counts.count, 0)) as avg_products_per_category
              FROM ${categories} c
              LEFT JOIN (
                SELECT category_id, COUNT(*) as count
                FROM products
                WHERE category_id IS NOT NULL
                GROUP BY category_id
              ) product_counts ON c.id = product_counts.category_id
            `);
            results.utilizationStats = utilizationQuery.rows[0];
            break;
          }

          case "branchingFactor": {
            const branchingQuery = await db.execute(sql`
              SELECT
                AVG(child_count) as avg_children_per_parent,
                MAX(child_count) as max_children,
                MIN(child_count) as min_children
              FROM (
                SELECT COUNT(*) as child_count
                FROM ${categories}
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
              ) child_counts
            `);
            results.branchingFactor = branchingQuery.rows[0];
            break;
          }

          case "variantAnalytics": {
            const variantAnalyticsQuery = await db.execute(sql`
              SELECT
                c.id as category_id,
                c.name as category_name,
                COUNT(DISTINCT p.id) as product_count,
                COUNT(DISTINCT pv.id) as variant_count,
                AVG(CASE WHEN pv.sku IS NOT NULL THEN 1 ELSE 0 END) * 100 as sku_coverage_percentage,
                AVG(CASE WHEN pv.color_id IS NOT NULL THEN 1 ELSE 0 END) * 100 as color_coverage_percentage,
                AVG(CASE WHEN pv.size_id IS NOT NULL THEN 1 ELSE 0 END) * 100 as size_coverage_percentage,
                AVG(CASE WHEN pv.product_image_url IS NOT NULL THEN 1 ELSE 0 END) * 100 as image_coverage_percentage
              FROM ${categories} c
              LEFT JOIN ${products} p ON c.id = p.category_id
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              GROUP BY c.id, c.name
              ORDER BY variant_count DESC
            `);
            results.variantAnalytics = variantAnalyticsQuery.rows;
            break;
          }

          case "passportCoverage": {
            const passportCoverageQuery = await db.execute(sql`
              SELECT
                c.id as category_id,
                c.name as category_name,
                COUNT(DISTINCT p.id) as product_count,
                COUNT(DISTINCT pv.id) as variant_count,
                COUNT(DISTINCT CASE WHEN pass.id IS NOT NULL THEN pass.id END) as passport_count,
                ROUND((COUNT(DISTINCT CASE WHEN pass.id IS NOT NULL THEN pass.id END) * 100.0) / NULLIF(COUNT(DISTINCT pv.id), 0), 2) as passport_coverage_percentage,
                COUNT(DISTINCT CASE WHEN pass.passport_status = 'published' THEN pass.id END) as published_passports,
                COUNT(DISTINCT CASE WHEN pass.passport_status = 'draft' THEN pass.id END) as draft_passports
              FROM ${categories} c
              LEFT JOIN ${products} p ON c.id = p.category_id
              LEFT JOIN ${productVariants} pv ON p.id = pv.product_id
              LEFT JOIN ${passports} pass ON (pass.product_id = p.id OR pass.variant_id = pv.id)
              GROUP BY c.id, c.name
              HAVING COUNT(DISTINCT p.id) > 0
              ORDER BY passport_coverage_percentage DESC
            `);
            results.passportCoverage = passportCoverageQuery.rows;
            break;
          }
        }
      }

      return {
        metrics: results,
        meta: {
          asOf: new Date(),
          requestedMetrics: metrics,
          filtersApplied: Object.keys(filter).length > 0,
        },
      };
    }),
});
