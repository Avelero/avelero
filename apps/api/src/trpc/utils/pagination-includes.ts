import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, gt, lt, gte, lte } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { TRPCContext } from "../init";

// ================================
// Cursor Pagination Types & Utilities
// ================================

/**
 * Enhanced cursor information for pagination
 */
export interface CursorInfo {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
  pageSize: number;
}

/**
 * Cursor data structure for encoding/decoding
 */
export interface CursorData {
  sortField: string;
  sortValue: any;
  id: string;
  direction: "asc" | "desc";
  timestamp?: string;
}

/**
 * Sort configuration for cursor pagination
 */
export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
  fallbackField?: string; // Usually 'id' for uniqueness
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  cursor?: string | null;
  limit?: number;
  maxLimit?: number;
  defaultLimit?: number;
}

// ================================
// Enhanced Cursor Utilities
// ================================

/**
 * Encodes cursor data with validation and error handling
 */
export function encodeCursor(data: CursorData): string {
  try {
    // Validate required fields
    if (!data.sortField || !data.id || !data.direction) {
      throw new Error("Invalid cursor data: missing required fields");
    }

    // Add timestamp for debugging
    const cursorWithTimestamp = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    return Buffer.from(JSON.stringify(cursorWithTimestamp)).toString('base64');
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to encode cursor",
      cause: error,
    });
  }
}

/**
 * Decodes cursor data with validation and error handling
 */
export function decodeCursor(cursor: string): CursorData {
  try {
    if (!cursor || typeof cursor !== 'string') {
      throw new Error("Cursor must be a non-empty string");
    }

    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());

    // Validate decoded cursor structure
    if (!decoded.sortField || !decoded.id || !decoded.direction) {
      throw new Error("Invalid cursor structure");
    }

    if (!["asc", "desc"].includes(decoded.direction)) {
      throw new Error("Invalid sort direction in cursor");
    }

    return decoded as CursorData;
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid cursor format",
      cause: error,
    });
  }
}

/**
 * Creates cursor conditions for database queries
 */
export function createCursorConditions<TTable extends PgTable>(
  table: TTable,
  cursorData: CursorData
) {
  const { sortField, sortValue, id, direction } = cursorData;
  const sortColumn = (table as any)[sortField];
  const idColumn = (table as any).id;

  if (!sortColumn) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid sort field: ${sortField}`,
    });
  }

  // Handle different cursor positioning strategies
  if (sortField === 'id') {
    // Simple ID-based cursor
    return direction === "asc"
      ? gt(idColumn, id)
      : lt(idColumn, id);
  } else {
    // Multi-field cursor (sort field + ID for uniqueness)
    if (direction === "asc") {
      return and(
        gte(sortColumn, sortValue),
        gt(idColumn, id)
      );
    } else {
      return and(
        lte(sortColumn, sortValue),
        lt(idColumn, id)
      );
    }
  }
}

/**
 * Validates and normalizes pagination parameters
 */
export function validatePaginationConfig(
  config: PaginationConfig,
  defaults: { limit: number; maxLimit: number } = { limit: 20, maxLimit: 100 }
): Required<Omit<PaginationConfig, 'cursor'>> & { cursor?: string | null } {
  const limit = Math.min(
    config.limit || defaults.limit,
    defaults.maxLimit
  );

  if (limit < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Limit must be at least 1",
    });
  }

  return {
    cursor: config.cursor || null,
    limit,
    maxLimit: defaults.maxLimit,
    defaultLimit: defaults.limit,
  };
}

/**
 * Creates pagination info from query results
 */
export function createPaginationInfo<T extends { id: string; [key: string]: any }>(
  data: T[],
  requestedLimit: number,
  sortConfig: SortConfig,
  totalCount?: number
): { paginatedData: T[]; cursorInfo: CursorInfo } {
  const hasMore = data.length > requestedLimit;
  const paginatedData = hasMore ? data.slice(0, requestedLimit) : data;

  let nextCursor: string | null = null;

  if (hasMore && paginatedData.length > 0) {
    const lastItem = paginatedData[paginatedData.length - 1];
    if (lastItem) {
      const cursorData: CursorData = {
        sortField: sortConfig.field,
        sortValue: (lastItem as any)[sortConfig.field],
        id: lastItem.id,
        direction: sortConfig.direction,
      };
      nextCursor = encodeCursor(cursorData);
    }
  }

  const cursorInfo: CursorInfo = {
    nextCursor,
    hasMore,
    pageSize: paginatedData.length,
    ...(totalCount !== undefined && { totalCount }),
  };

  return { paginatedData, cursorInfo };
}

// ================================
// Include System Types & Utilities
// ================================

/**
 * Include configuration for related data loading
 */
export interface IncludeConfig {
  [relation: string]: boolean | IncludeConfig;
}

/**
 * Relation definition for include system
 */
export interface RelationDefinition {
  table: string;
  foreignKey: string;
  type: "one" | "many";
  optional?: boolean;
  conditions?: Record<string, any>;
}

/**
 * Module relations registry
 */
export interface ModuleRelations {
  [moduleName: string]: {
    [relationName: string]: RelationDefinition;
  };
}

// Sample relation definitions (to be extended per module)
export const moduleRelations: ModuleRelations = {
  products: {
    category: {
      table: "categories",
      foreignKey: "categoryId",
      type: "one",
      optional: true,
    },
    variants: {
      table: "product_variants",
      foreignKey: "productId",
      type: "many",
      conditions: { deletedAt: null },
    },
    passports: {
      table: "product_passports",
      foreignKey: "productId",
      type: "many",
      conditions: { active: true },
    },
  },
  categories: {
    products: {
      table: "products",
      foreignKey: "categoryId",
      type: "many",
      conditions: { deletedAt: null },
    },
    parent: {
      table: "categories",
      foreignKey: "parentId",
      type: "one",
      optional: true,
    },
  },
  variants: {
    product: {
      table: "products",
      foreignKey: "productId",
      type: "one",
    },
    passports: {
      table: "variant_passports",
      foreignKey: "variantId",
      type: "many",
    },
  },
  passports: {
    template: {
      table: "passport_templates",
      foreignKey: "templateId",
      type: "one",
    },
    products: {
      table: "product_passports",
      foreignKey: "passportId",
      type: "many",
    },
    variants: {
      table: "variant_passports",
      foreignKey: "passportId",
      type: "many",
    },
  },
};

/**
 * Validates include configuration against allowed relations
 */
export function validateIncludeConfig(
  include: IncludeConfig,
  moduleName: string,
  maxDepth: number = 2
): IncludeConfig {
  const allowedRelations = moduleRelations[moduleName];

  if (!allowedRelations) {
    // If module not found, return empty config (allow but don't validate)
    console.warn(`Module relations not found for: ${moduleName}. Allowing includes without validation.`);
    return include;
  }

  function validateRecursive(config: IncludeConfig, depth: number): IncludeConfig {
    if (depth > maxDepth) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Include depth exceeds maximum of ${maxDepth}`,
      });
    }

    const validated: IncludeConfig = {};

    for (const [relationName, includeValue] of Object.entries(config)) {
      if (!allowedRelations[relationName]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid relation '${relationName}' for module '${moduleName}'`,
        });
      }

      if (typeof includeValue === "boolean") {
        validated[relationName] = includeValue;
      } else if (typeof includeValue === "object") {
        // Nested include configuration
        const relatedModule = getRelatedModuleName(moduleName, relationName);
        validated[relationName] = validateRecursive(includeValue, depth + 1);
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid include value for '${relationName}'. Must be boolean or object.`,
        });
      }
    }

    return validated;
  }

  return validateRecursive(include, 0);
}

/**
 * Gets the related module name for a given relation
 */
function getRelatedModuleName(moduleName: string, relationName: string): string {
  const relation = moduleRelations[moduleName]?.[relationName];
  if (!relation) {
    throw new Error(`Unknown relation: ${moduleName}.${relationName}`);
  }

  // Map table names to module names
  const tableToModule: Record<string, string> = {
    "products": "products",
    "categories": "categories",
    "product_variants": "variants",
    "passport_templates": "templates",
    "product_passports": "passports",
    "variant_passports": "passports",
  };

  return tableToModule[relation.table] || relation.table;
}

/**
 * Converts include config to Drizzle query with options
 */
export function buildIncludeQuery(
  include: IncludeConfig,
  moduleName: string
): Record<string, any> {
  const drizzleIncludes: Record<string, any> = {};

  for (const [relationName, includeValue] of Object.entries(include)) {
    if (includeValue === true) {
      drizzleIncludes[relationName] = true;
    } else if (typeof includeValue === "object") {
      // Nested includes would require recursive query building
      // For now, we'll support one level deep
      drizzleIncludes[relationName] = true;
    }
  }

  return drizzleIncludes;
}

/**
 * Calculates total count for pagination when requested
 */
export async function getTotalCount<TTable extends PgTable>(
  db: TRPCContext["db"],
  table: TTable,
  conditions: any[]
): Promise<number> {
  try {
    // Use a simple count approach
    const result = await db
      .select()
      .from(table)
      .where(and(...conditions));

    return result.length;
  } catch (error) {
    console.warn("Failed to get total count:", error);
    return 0;
  }
}

// ================================
// Utility Schemas for Input Validation
// ================================

/**
 * Enhanced pagination schema with validation
 */
export const enhancedPaginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().min(1).max(100).default(20),
  includeTotalCount: z.boolean().default(false),
});

/**
 * Enhanced sort schema with fallback support
 */
export const enhancedSortSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(["asc", "desc"]).default("desc"),
  fallbackField: z.string().default("id"),
});

/**
 * Enhanced include schema factory
 */
export function createEnhancedIncludeSchema(
  allowedIncludes: string[]
): z.ZodType<IncludeConfig> {
  const includeSchema: Record<string, z.ZodTypeAny> = {};

  for (const include of allowedIncludes) {
    includeSchema[include] = z.boolean().default(false);
  }

  return z.object(includeSchema);
}

// ================================
// Integration Helpers
// ================================

/**
 * Creates a complete pagination + include query for resourceful endpoints
 */
export async function createPaginatedQuery<TTable extends PgTable>(
  config: {
    table: TTable;
    moduleName: string;
    pagination: PaginationConfig;
    sort: SortConfig;
    include: IncludeConfig;
    conditions: any[];
    ctx: TRPCContext;
  }
) {
  const { table, moduleName, pagination, sort, include, conditions, ctx } = config;

  // Validate and normalize pagination
  const validatedPagination = validatePaginationConfig(pagination);

  // Validate includes
  const validatedIncludes = validateIncludeConfig(include, moduleName);

  // Build cursor conditions if cursor exists
  let cursorConditions: any[] = [];
  if (validatedPagination.cursor) {
    const cursorData = decodeCursor(validatedPagination.cursor);
    cursorConditions = [createCursorConditions(table, cursorData)];
  }

  // Combine all conditions
  const allConditions = [...conditions, ...cursorConditions];

  // Build include query
  const includeQuery = buildIncludeQuery(validatedIncludes, moduleName);

  // Execute query with +1 for hasMore check
  const data = await ctx.db
    .select()
    .from(table)
    .where(and(...allConditions))
    .orderBy(
      sort.direction === "asc"
        ? asc((table as any)[sort.field])
        : desc((table as any)[sort.field])
    )
    .limit(validatedPagination.limit + 1);

  // Get total count if requested
  let totalCount: number | undefined;
  if (validatedPagination.cursor === null) {
    // Only count on first page to avoid expensive operations
    totalCount = await getTotalCount(ctx.db, table, conditions);
  }

  // Create pagination info
  const { paginatedData, cursorInfo } = createPaginationInfo(
    data,
    validatedPagination.limit,
    sort,
    totalCount
  );

  return {
    data: paginatedData,
    cursorInfo,
    meta: {
      moduleName,
      includes: Object.keys(validatedIncludes).filter(key => validatedIncludes[key]),
      sortField: sort.field,
      sortDirection: sort.direction,
    },
  };
}