import { z } from "zod";

// Shared schemas for consistent API patterns
const paginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().min(1).max(1000).default(20),
});

const sortSchema = z.object({
  field: z.enum(["createdAt", "updatedAt", "name", "depth", "path"]),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const includeSchema = z.object({
  parent: z.boolean().default(false),
  children: z.boolean().default(false),
  ancestors: z.boolean().default(false),
  descendants: z.boolean().default(false),
  productCount: z.boolean().default(false),
  path: z.boolean().default(false),
});

// Filter schema for hierarchical operations
const filterSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  rootOnly: z.boolean().optional(), // Only root categories (parentId is null)
  leafOnly: z.boolean().optional(), // Only leaf categories (no children)
  depth: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  hasProducts: z.boolean().optional(), // Categories with/without products
  name: z.string().optional(), // Exact name match
  pathContains: z.string().optional(), // Path contains substring
});

// List categories with hierarchical support
export const listCategoriesSchema = z.object({
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
  pagination: paginationSchema.optional(),
  include: includeSchema.optional(),
});

// Get single category with relations
export const getCategorySchema = z.object({
  where: z.object({
    categoryId: z.string().uuid().optional(),
    path: z.string().optional(), // Find by hierarchical path
    name: z.string().optional(), // Find by name
    parentId: z.string().uuid().nullable().optional(),
  }),
  include: includeSchema.optional(),
});

// Create category
export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Update category
export const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Move category (change parent)
export const moveCategorySchema = z.object({
  id: z.string().uuid(),
  newParentId: z.string().uuid().nullable(),
  preventCycles: z.boolean().default(true),
});

// Bulk operations
export const bulkUpdateCategoriesSchema = z.object({
  selection: z.union([
    z.object({ ids: z.array(z.string().uuid()) }),
    z.object({ filter: filterSchema }),
    z.literal("all"),
  ]),
  data: z.object({
    parentId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  preview: z.boolean().default(false),
});

// Category tree operations
export const getCategoryTreeSchema = z.object({
  rootId: z.string().uuid().nullable().optional(), // Start from this category
  maxDepth: z.number().min(1).max(10).default(5),
  includeProductCounts: z.boolean().default(false),
  filter: z
    .object({
      search: z.string().optional(),
      hasProducts: z.boolean().optional(),
    })
    .optional(),
});

// Category path operations
export const getCategoryPathSchema = z.object({
  categoryId: z.string().uuid(),
  separator: z.string().default(" > "),
  includeIds: z.boolean().default(false),
});

// Category metrics/aggregations
export const categoryMetricsSchema = z.object({
  filter: filterSchema.optional(),
  metrics: z.array(
    z.enum([
      "hierarchyDistribution", // Count by depth level
      "productDistribution", // Products per category
      "parentChildCounts", // Parent/child relationship stats
      "pathAnalysis", // Path length analysis
      "utilizationStats", // Categories with/without products
      "branchingFactor", // Average children per parent
      "variantAnalytics", // Variant distribution across categories
      "passportCoverage", // Passport coverage per category
    ]),
  ),
});

// Validation schemas
export const validateCategoryHierarchySchema = z.object({
  categoryId: z.string().uuid().optional(),
  checkCycles: z.boolean().default(true),
  maxDepth: z.number().min(1).max(20).default(10),
});

// Reorder categories within same parent
export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  categoryIds: z.array(z.string().uuid()), // Ordered list
});

// Export types for use in tRPC router
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
export type GetCategoryInput = z.infer<typeof getCategorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type MoveCategoryInput = z.infer<typeof moveCategorySchema>;
export type BulkUpdateCategoriesInput = z.infer<
  typeof bulkUpdateCategoriesSchema
>;
export type GetCategoryTreeInput = z.infer<typeof getCategoryTreeSchema>;
export type GetCategoryPathInput = z.infer<typeof getCategoryPathSchema>;
export type CategoryMetricsInput = z.infer<typeof categoryMetricsSchema>;
export type ValidateCategoryHierarchyInput = z.infer<
  typeof validateCategoryHierarchySchema
>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
