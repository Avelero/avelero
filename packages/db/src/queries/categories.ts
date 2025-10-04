import { sql, and, eq, isNull, ilike, desc, asc, gte, lte, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import { categories, products } from "../schema";

/**
 * Hierarchical category queries using Common Table Expressions (CTEs)
 */

// Helper type for category with computed fields
export interface CategoryWithHierarchy {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  depth: number;
  path: string;
  hasChildren: boolean;
  productCount?: number;
  ancestors?: CategoryWithHierarchy[];
  descendants?: CategoryWithHierarchy[];
  children?: CategoryWithHierarchy[];
}

/**
 * Get category tree starting from a root category using recursive CTE
 */
export async function getCategoryTree(
  db: Database,
  options: {
    rootId?: string | null;
    maxDepth?: number;
    includeProductCounts?: boolean;
    filter?: {
      search?: string;
      hasProducts?: boolean;
    };
  } = {}
): Promise<CategoryWithHierarchy[]> {
  const { rootId = null, maxDepth = 5, includeProductCounts = false, filter } = options;

  let query = sql`
    WITH RECURSIVE category_tree AS (
      -- Base case: root categories or specific root
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.created_at,
        c.updated_at,
        0 as depth,
        c.name as path,
        CASE
          WHEN EXISTS (SELECT 1 FROM ${categories} child WHERE child.parent_id = c.id)
          THEN true
          ELSE false
        END as has_children
        ${includeProductCounts ? sql`, (SELECT COUNT(*) FROM ${products} p WHERE p.category_id = c.id) as product_count` : sql``}
      FROM ${categories} c
      WHERE ${rootId ? sql`c.id = ${rootId}` : sql`c.parent_id IS NULL`}

      UNION ALL

      -- Recursive case: children
      SELECT
        child.id,
        child.name,
        child.parent_id,
        child.created_at,
        child.updated_at,
        parent.depth + 1,
        parent.path || ' > ' || child.name,
        CASE
          WHEN EXISTS (SELECT 1 FROM ${categories} grandchild WHERE grandchild.parent_id = child.id)
          THEN true
          ELSE false
        END as has_children
        ${includeProductCounts ? sql`, (SELECT COUNT(*) FROM ${products} p WHERE p.category_id = child.id) as product_count` : sql``}
      FROM ${categories} child
      INNER JOIN category_tree parent ON child.parent_id = parent.id
      WHERE parent.depth < ${maxDepth}
    )
    SELECT * FROM category_tree
  `;

  // Add filters
  const conditions = [];
  if (filter?.search) {
    conditions.push(sql`name ILIKE ${`%${filter.search}%`}`);
  }
  if (filter?.hasProducts !== undefined) {
    if (includeProductCounts) {
      conditions.push(filter.hasProducts ? sql`product_count > 0` : sql`product_count = 0`);
    }
  }

  if (conditions.length > 0) {
    query = sql`${query} WHERE ${sql.join(conditions, sql` AND `)}`;
  }

  query = sql`${query} ORDER BY depth, name`;

  const result = await db.execute(query);
  return result as unknown as CategoryWithHierarchy[];
}

/**
 * Get category path (breadcrumb) from root to category
 */
export async function getCategoryPath(
  db: Database,
  categoryId: string,
  options: {
    separator?: string;
    includeIds?: boolean;
  } = {}
): Promise<{ path: string; pathIds?: string[]; categories: CategoryWithHierarchy[] }> {
  const { separator = " > ", includeIds = false } = options;

  const query = sql`
    WITH RECURSIVE category_path AS (
      -- Start with the target category
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.created_at,
        c.updated_at,
        0 as level
      FROM ${categories} c
      WHERE c.id = ${categoryId}

      UNION ALL

      -- Walk up the parent chain
      SELECT
        parent.id,
        parent.name,
        parent.parent_id,
        parent.created_at,
        parent.updated_at,
        child.level + 1
      FROM ${categories} parent
      INNER JOIN category_path child ON parent.id = child.parent_id
    )
    SELECT * FROM category_path
    ORDER BY level DESC
  `;

  const result = await db.execute(query);
  const pathCategories = result as unknown as (CategoryWithHierarchy & { level: number })[];

  const path = pathCategories.map(cat => cat.name).join(separator);
  const pathIds = includeIds ? pathCategories.map(cat => cat.id) : undefined;

  return {
    path,
    pathIds,
    categories: pathCategories,
  };
}

/**
 * Get category ancestors (parents up to root)
 */
export async function getCategoryAncestors(
  db: Database,
  categoryId: string
): Promise<CategoryWithHierarchy[]> {
  const query = sql`
    WITH RECURSIVE category_ancestors AS (
      -- Start with the parent of target category
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.created_at,
        c.updated_at,
        1 as depth
      FROM ${categories} c
      WHERE c.id = (SELECT parent_id FROM ${categories} WHERE id = ${categoryId})

      UNION ALL

      -- Walk up the parent chain
      SELECT
        parent.id,
        parent.name,
        parent.parent_id,
        parent.created_at,
        parent.updated_at,
        child.depth + 1
      FROM ${categories} parent
      INNER JOIN category_ancestors child ON parent.id = child.parent_id
    )
    SELECT * FROM category_ancestors
    ORDER BY depth DESC
  `;

  const result = await db.execute(query);
  return result as unknown as CategoryWithHierarchy[];
}

/**
 * Get category descendants (all children recursively)
 */
export async function getCategoryDescendants(
  db: Database,
  categoryId: string,
  maxDepth = 10
): Promise<CategoryWithHierarchy[]> {
  const query = sql`
    WITH RECURSIVE category_descendants AS (
      -- Base case: direct children
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.created_at,
        c.updated_at,
        1 as depth,
        c.name as path
      FROM ${categories} c
      WHERE c.parent_id = ${categoryId}

      UNION ALL

      -- Recursive case: children of children
      SELECT
        child.id,
        child.name,
        child.parent_id,
        child.created_at,
        child.updated_at,
        parent.depth + 1,
        parent.path || ' > ' || child.name
      FROM ${categories} child
      INNER JOIN category_descendants parent ON child.parent_id = parent.id
      WHERE parent.depth < ${maxDepth}
    )
    SELECT * FROM category_descendants
    ORDER BY depth, name
  `;

  const result = await db.execute(query);
  return result as unknown as CategoryWithHierarchy[];
}

/**
 * Check for cycles in category hierarchy
 */
export async function validateCategoryHierarchy(
  db: Database,
  categoryId: string,
  newParentId: string | null
): Promise<{ isValid: boolean; issues: string[] }> {
  const issues: string[] = [];

  if (newParentId === null) {
    // Moving to root is always valid
    return { isValid: true, issues: [] };
  }

  if (categoryId === newParentId) {
    issues.push("Category cannot be its own parent");
    return { isValid: false, issues };
  }

  // Check if newParentId is a descendant of categoryId (would create cycle)
  const descendants = await getCategoryDescendants(db, categoryId);
  const isDescendant = descendants.some(desc => desc.id === newParentId);

  if (isDescendant) {
    issues.push("Cannot move category under its own descendant (would create cycle)");
    return { isValid: false, issues };
  }

  // Check depth limits
  const ancestors = await getCategoryAncestors(db, newParentId);
  if (ancestors.length >= 10) {
    issues.push("Maximum hierarchy depth (10 levels) would be exceeded");
    return { isValid: false, issues };
  }

  return { isValid: true, issues: [] };
}

/**
 * Get hierarchy statistics
 */
export async function getCategoryHierarchyStats(db: Database): Promise<{
  totalCategories: number;
  rootCategories: number;
  leafCategories: number;
  maxDepth: number;
  avgDepth: number;
  branchingFactor: number;
}> {
  // Get basic counts
  const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM ${categories}`);
  const rootResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${categories} WHERE parent_id IS NULL`);
  const leafResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${categories} c1
    WHERE NOT EXISTS (SELECT 1 FROM ${categories} c2 WHERE c2.parent_id = c1.id)
  `);

  // Get depth statistics using CTE
  const depthStatsQuery = sql`
    WITH RECURSIVE category_depths AS (
      SELECT id, name, parent_id, 0 as depth
      FROM ${categories}
      WHERE parent_id IS NULL

      UNION ALL

      SELECT c.id, c.name, c.parent_id, cd.depth + 1
      FROM ${categories} c
      INNER JOIN category_depths cd ON c.parent_id = cd.id
    )
    SELECT
      MAX(depth) as max_depth,
      AVG(depth) as avg_depth
    FROM category_depths
  `;

  const depthResult = await db.execute(depthStatsQuery);

  // Get branching factor (average children per parent)
  const branchingQuery = sql`
    SELECT AVG(child_count) as avg_branching
    FROM (
      SELECT COUNT(*) as child_count
      FROM ${categories}
      WHERE parent_id IS NOT NULL
      GROUP BY parent_id
    ) child_counts
  `;

  const branchingResult = await db.execute(branchingQuery);

  return {
    totalCategories: Number((totalResult as any)[0]?.total || 0),
    rootCategories: Number((rootResult as any)[0]?.count || 0),
    leafCategories: Number((leafResult as any)[0]?.count || 0),
    maxDepth: Number((depthResult as any)[0]?.max_depth || 0),
    avgDepth: Number((depthResult as any)[0]?.avg_depth || 0),
    branchingFactor: Number((branchingResult as any)[0]?.avg_branching || 0),
  };
}

/**
 * Get categories with product counts
 */
export async function getCategoriesWithProductCounts(
  db: Database,
  options: {
    parentId?: string | null;
    includeEmpty?: boolean;
  } = {}
): Promise<Array<CategoryWithHierarchy & { productCount: number }>> {
  const { parentId, includeEmpty = true } = options;

  let whereCondition = sql`1 = 1`;
  if (parentId !== undefined) {
    whereCondition = parentId === null
      ? sql`c.parent_id IS NULL`
      : sql`c.parent_id = ${parentId}`;
  }

  const query = sql`
    SELECT
      c.id,
      c.name,
      c.parent_id,
      c.created_at,
      c.updated_at,
      COALESCE(p.product_count, 0) as product_count,
      CASE
        WHEN EXISTS (SELECT 1 FROM ${categories} child WHERE child.parent_id = c.id)
        THEN true
        ELSE false
      END as has_children
    FROM ${categories} c
    LEFT JOIN (
      SELECT category_id, COUNT(*) as product_count
      FROM ${products}
      WHERE category_id IS NOT NULL
      GROUP BY category_id
    ) p ON c.id = p.category_id
    WHERE ${whereCondition}
    ${includeEmpty ? sql`` : sql`AND COALESCE(p.product_count, 0) > 0`}
    ORDER BY c.name
  `;

  const result = await db.execute(query);
  return result as unknown as Array<CategoryWithHierarchy & { productCount: number }>;
}