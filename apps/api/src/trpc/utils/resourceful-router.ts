import { TRPCError } from "@trpc/server";
import {
  type ResponseMeta,
  baseFilterSchema,
  basePaginationSchema,
  baseSortSchema,
  createCommonErrors,
  createErrorResponse,
  createExtendedFilterSchema,
  createExtendedIncludeSchema,
  createExtendedMetricsSchema,
  createExtendedSortSchema,
  createSuccessGetResponse,
  createSuccessListResponse,
  createSuccessMutationResponse,
} from "@v1/db/schemas/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import type { TRPCContext } from "../init";
import {
  type BulkOperationType,
  type BulkPreviewResult,
  BulkSafetyValidator,
  type BulkSelectionCriteria,
  bulkSafetyOptionsSchema,
  bulkSelectionSchema,
  countAffectedRecords,
  createBulkOperationSchema,
  createBulkPreview,
} from "./bulk-safety";
import {
  type IncludeConfig,
  type SortConfig,
  createEnhancedIncludeSchema,
  createPaginatedQuery,
  createPaginationInfo,
  decodeCursor,
  encodeCursor,
  enhancedPaginationSchema,
  enhancedSortSchema,
  validateIncludeConfig,
  validatePaginationConfig,
} from "./pagination-includes";

// ================================
// Core Types and Interfaces
// ================================

/**
 * Configuration for a resourceful router
 */
export interface ResourcefulRouterConfig<
  TTable extends PgTable,
  TEntity = any,
  TCreateInput = any,
  TUpdateInput = any,
> {
  /**
   * The database table for this resource
   */
  table: TTable;

  /**
   * Resource name for error messages and logging
   */
  resourceName: string;

  /**
   * Column name for brand scoping (default: 'brandId')
   */
  brandColumn?: keyof TTable["$inferSelect"];

  /**
   * Column name for soft delete (optional)
   */
  deletedAtColumn?: keyof TTable["$inferSelect"];

  /**
   * Custom filter extensions beyond base filters
   */
  filterExtensions?: Record<string, z.ZodTypeAny>;

  /**
   * Additional sortable fields beyond createdAt, updatedAt, name
   */
  sortFields?: readonly string[];

  /**
   * Include relationships configuration
   */
  includeConfig?: Record<string, z.ZodTypeAny>;

  /**
   * Custom metrics for aggregate endpoint
   */
  customMetrics?: readonly string[];

  /**
   * Create input schema
   */
  createSchema?: z.ZodSchema<TCreateInput>;

  /**
   * Update input schema (partial)
   */
  updateSchema?: z.ZodSchema<TUpdateInput>;

  /**
   * Custom permission checks
   */
  permissions?: {
    list?: (ctx: TRPCContext) => Promise<boolean>;
    get?: (ctx: TRPCContext) => Promise<boolean>;
    create?: (ctx: TRPCContext) => Promise<boolean>;
    update?: (ctx: TRPCContext) => Promise<boolean>;
    delete?: (ctx: TRPCContext) => Promise<boolean>;
    bulkUpdate?: (ctx: TRPCContext) => Promise<boolean>;
    aggregate?: (ctx: TRPCContext) => Promise<boolean>;
  };

  /**
   * Custom query modifiers
   */
  queryModifiers?: {
    beforeQuery?: (query: any, ctx: TRPCContext) => any;
    afterQuery?: (results: any[], ctx: TRPCContext) => any[];
  };
}

/**
 * Standard where conditions builder
 */
export interface WhereConditions {
  id?: string;
  ids?: string[];
  [key: string]: any;
}

/**
 * Cursor pagination info
 */
export interface CursorInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

// ================================
// Base Endpoint Factories
// ================================

/**
 * Creates a standardized list endpoint with enhanced filtering, sorting, and pagination
 */
export function createListEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  // Get module name from resource name (default mapping)
  const moduleName = config.resourceName.toLowerCase().replace(/s$/, ""); // Remove plural 's'

  const inputSchema = z.object({
    filter: createExtendedFilterSchema(
      config.filterExtensions || {},
    ).optional(),
    sort: enhancedSortSchema
      .extend({
        field: z
          .enum([
            "createdAt",
            "updatedAt",
            "name",
            "id",
            ...(config.sortFields || []),
          ] as [string, ...string[]])
          .default("createdAt"),
      })
      .optional(),
    pagination: enhancedPaginationSchema.optional(),
    include: createEnhancedIncludeSchema(
      Object.keys(config.includeConfig || {}),
    ).optional(),
  });

  return protectedProcedure.input(inputSchema).query(async ({ ctx, input }) => {
    try {
      // Permission check
      if (config.permissions?.list && !(await config.permissions.list(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient permissions to list ${config.resourceName}`,
        });
      }

      const {
        filter = {},
        sort = { field: "createdAt", direction: "desc", fallbackField: "id" },
        pagination = {},
        include = {},
      } = input;

      // Build brand-scoped base conditions
      const brandColumn = config.brandColumn || "brandId";
      const conditions = [eq((config.table as any)[brandColumn], ctx.brandId!)];

      // Apply basic filters
      if (filter.ids && filter.ids.length > 0) {
        conditions.push(inArray((config.table as any).id, filter.ids));
      }

      if (filter.search && (config.table as any).name) {
        conditions.push(
          ilike((config.table as any).name, `%${filter.search}%`),
        );
      }

      // Apply soft delete filter
      if (config.deletedAtColumn && !filter.includeDeleted) {
        conditions.push(isNull((config.table as any)[config.deletedAtColumn]));
      }

      // Apply custom filter extensions
      for (const [key, value] of Object.entries(filter)) {
        if (
          value !== undefined &&
          config.filterExtensions?.[key] &&
          (config.table as any)[key]
        ) {
          if (Array.isArray(value)) {
            conditions.push(inArray((config.table as any)[key], value));
          } else {
            conditions.push(eq((config.table as any)[key], value));
          }
        }
      }

      // Use enhanced pagination system
      const result = await createPaginatedQuery({
        table: config.table,
        moduleName,
        pagination: {
          cursor: (pagination as any).cursor,
          limit: (pagination as any).limit,
        },
        sort: {
          field: sort.field,
          direction: sort.direction,
          fallbackField: sort.fallbackField || "id",
        },
        include: include as IncludeConfig,
        conditions,
        ctx,
      });

      // Apply post-query modifiers
      let processedData = result.data;
      if (config.queryModifiers?.afterQuery) {
        processedData = config.queryModifiers.afterQuery(processedData, ctx);
      }

      return createSuccessListResponse(processedData, result.cursorInfo, {
        ...(result.meta as any),
        pageSize: result.cursorInfo.pageSize,
        hasMore: result.cursorInfo.hasMore,
        totalCount: result.cursorInfo.totalCount,
      });
    } catch (error) {
      console.error(`Error listing ${config.resourceName}:`, error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to list ${config.resourceName}`,
        cause: error,
      });
    }
  });
}

/**
 * Creates a standardized get endpoint with enhanced includes and flexible where conditions
 */
export function createGetEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  // Get module name from resource name (default mapping)
  const moduleName = config.resourceName.toLowerCase().replace(/s$/, ""); // Remove plural 's'

  const inputSchema = z.object({
    where: z.object({
      id: z.string().uuid().optional(),
      ids: z.array(z.string().uuid()).optional(),
      ...config.filterExtensions,
    }),
    include: createEnhancedIncludeSchema(
      Object.keys(config.includeConfig || {}),
    ).optional(),
  });

  return protectedProcedure.input(inputSchema).query(async ({ ctx, input }) => {
    try {
      // Permission check
      if (config.permissions?.get && !(await config.permissions.get(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient permissions to get ${config.resourceName}`,
        });
      }

      const { where, include = {} } = input;

      // Build brand-scoped base conditions
      const brandColumn = config.brandColumn || "brandId";
      const conditions = [eq((config.table as any)[brandColumn], ctx.brandId!)];

      // Apply where conditions
      if (where.id) {
        conditions.push(eq((config.table as any).id, where.id));
      }

      if (where.ids && where.ids.length > 0) {
        conditions.push(inArray((config.table as any).id, where.ids));
      }

      // Apply soft delete filter
      if (config.deletedAtColumn) {
        conditions.push(isNull((config.table as any)[config.deletedAtColumn]));
      }

      // Apply additional where conditions
      for (const [key, value] of Object.entries(where)) {
        if (
          value !== undefined &&
          key !== "id" &&
          key !== "ids" &&
          (config.table as any)[key]
        ) {
          if (Array.isArray(value)) {
            conditions.push(inArray((config.table as any)[key], value));
          } else {
            conditions.push(eq((config.table as any)[key], value));
          }
        }
      }

      // Validate and build include query
      const validatedIncludes = validateIncludeConfig(
        include as IncludeConfig,
        moduleName,
      );

      // Execute query with enhanced includes
      const result = await (ctx.db.query as any)[config.table._.name].findFirst(
        {
          where: and(...conditions),
          with: validatedIncludes,
        },
      );

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${config.resourceName} not found`,
        });
      }

      return createSuccessGetResponse(result, {
        ...({
          includes: Object.keys(validatedIncludes).filter(
            (key) => validatedIncludes[key],
          ),
          resourceType: config.resourceName,
        } as any),
      });
    } catch (error) {
      console.error(`Error getting ${config.resourceName}:`, error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to get ${config.resourceName}`,
        cause: error,
      });
    }
  });
}

/**
 * Creates a standardized create endpoint
 */
export function createCreateEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  if (!config.createSchema) {
    throw new Error(`Create schema required for ${config.resourceName}`);
  }

  return protectedProcedure
    .input(config.createSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Permission check
        if (
          config.permissions?.create &&
          !(await config.permissions.create(ctx))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Insufficient permissions to create ${config.resourceName}`,
          });
        }

        // Add brand scoping to input
        const brandColumn = config.brandColumn || "brandId";
        const dataWithBrand = {
          ...input,
          [brandColumn]: ctx.brandId!,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const [newRecord] = await ctx.db
          .insert(config.table)
          .values(dataWithBrand)
          .returning();

        return createSuccessMutationResponse([newRecord], 1, {
          ...({
            operation: "create",
            resourceType: config.resourceName,
          } as any),
        });
      } catch (error) {
        console.error(`Error creating ${config.resourceName}:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create ${config.resourceName}`,
          cause: error,
        });
      }
    });
}

/**
 * Creates a standardized update endpoint
 */
export function createUpdateEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  if (!config.updateSchema) {
    throw new Error(`Update schema required for ${config.resourceName}`);
  }

  const inputSchema = z.object({
    where: z.object({
      id: z.string().uuid().optional(),
      ids: z.array(z.string().uuid()).optional(),
    }),
    data: config.updateSchema,
  });

  return protectedProcedure
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Permission check
        if (
          config.permissions?.update &&
          !(await config.permissions.update(ctx))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Insufficient permissions to update ${config.resourceName}`,
          });
        }

        const { where, data } = input;

        // Build brand-scoped base conditions
        const brandColumn = config.brandColumn || "brandId";
        const conditions = [
          eq((config.table as any)[brandColumn], ctx.brandId!),
        ];

        if (where.id) {
          conditions.push(eq((config.table as any).id, where.id));
        }

        if (where.ids && where.ids.length > 0) {
          conditions.push(inArray((config.table as any).id, where.ids));
        }

        // Apply soft delete filter
        if (config.deletedAtColumn) {
          conditions.push(
            isNull((config.table as any)[config.deletedAtColumn]),
          );
        }

        const dataWithTimestamp = {
          ...data,
          updatedAt: new Date(),
        };

        const updatedRecords = await ctx.db
          .update(config.table)
          .set(dataWithTimestamp)
          .where(and(...conditions))
          .returning();

        return createSuccessMutationResponse(
          updatedRecords,
          updatedRecords.length,
          {
            ...({
              operation: "update",
              resourceType: config.resourceName,
            } as any),
          },
        );
      } catch (error) {
        console.error(`Error updating ${config.resourceName}:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update ${config.resourceName}`,
          cause: error,
        });
      }
    });
}

/**
 * Creates an enhanced delete endpoint with bulk safety guards (soft delete)
 */
export function createDeleteEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  const inputSchema = z.object({
    selection: z
      .object({
        id: z.string().uuid().optional(),
        ids: z.array(z.string().uuid()).optional(),
      })
      .refine((data) => data.id || data.ids, {
        message: "Must provide either 'id' or 'ids' for deletion",
      }),
    options: bulkSafetyOptionsSchema.optional(),
  });

  return protectedProcedure
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Permission check
        if (
          config.permissions?.delete &&
          !(await config.permissions.delete(ctx))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Insufficient permissions to delete ${config.resourceName}`,
          });
        }

        const { selection, options = {} as any } = input;
        const {
          preview = false,
          confirmed = false,
          skipSafetyChecks = false,
        } = options as any;

        // Build brand-scoped base conditions
        const brandColumn = config.brandColumn || "brandId";
        const baseConditions = [
          eq((config.table as any)[brandColumn], ctx.brandId!),
        ];

        // Apply existing soft delete filter to prevent double-deletion
        if (config.deletedAtColumn) {
          baseConditions.push(
            isNull((config.table as any)[config.deletedAtColumn]),
          );
        }

        // Convert where conditions to bulk selection format
        const bulkSelection: BulkSelectionCriteria = {
          ids: selection.id ? [selection.id] : selection.ids,
        };

        // Create bulk safety validator for delete operations
        const safetyValidator = new BulkSafetyValidator(
          "delete",
          config.resourceName,
        );

        if (preview) {
          // Return comprehensive preview information
          const previewResult = await createBulkPreview(
            ctx.db,
            config.table,
            bulkSelection,
            "delete",
            config.resourceName,
            baseConditions,
          );

          return {
            success: true,
            preview: true,
            data: [],
            affectedCount: previewResult.affectedCount,
            sampleRecords: previewResult.sampleRecords,
            safetyStatus: previewResult.safetyStatus,
            warnings: previewResult.warnings,
            requiresConfirmation: previewResult.requiresConfirmation,
            estimatedDuration: previewResult.estimatedDuration,
            meta: {
              operation: "delete",
              resourceType: config.resourceName,
              safetyInfo: previewResult.safetyInfo,
            },
          };
        }

        // Count affected records for safety validation
        const affectedCount = await countAffectedRecords(
          ctx.db,
          config.table,
          bulkSelection,
          baseConditions,
        );

        // Apply safety validation unless skipped by admin
        if (!skipSafetyChecks) {
          safetyValidator.validateSafety(affectedCount, false, confirmed);
        }

        // Build database conditions
        const conditions = [...baseConditions];

        if (selection.id) {
          conditions.push(eq((config.table as any).id, selection.id));
        }

        if (selection.ids && selection.ids.length > 0) {
          conditions.push(inArray((config.table as any).id, selection.ids));
        }

        // Perform soft delete by setting deletedAt timestamp
        const deletedRecords = await ctx.db
          .update(config.table)
          .set({ [config.deletedAtColumn as any]: new Date() })
          .where(and(...conditions))
          .returning();

        return createSuccessMutationResponse(
          deletedRecords,
          deletedRecords.length,
          {
            ...({
              operation: "delete",
              resourceType: config.resourceName,
              affectedCount,
              safetyStatus: safetyValidator.getSafetyStatus(affectedCount),
              estimatedDuration:
                safetyValidator.estimateDuration(affectedCount),
            } as any),
          },
        );
      } catch (error) {
        console.error(`Error deleting ${config.resourceName}:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete ${config.resourceName}`,
          cause: error,
        });
      }
    });
}

/**
 * Creates an enhanced bulk update endpoint with comprehensive safety guards
 */
export function createBulkUpdateEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  if (!config.updateSchema) {
    throw new Error(
      `Update schema required for bulk update on ${config.resourceName}`,
    );
  }

  const inputSchema = createBulkOperationSchema(config.updateSchema);

  return protectedProcedure
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Permission check
        if (
          config.permissions?.bulkUpdate &&
          !(await config.permissions.bulkUpdate(ctx))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Insufficient permissions to bulk update ${config.resourceName}`,
          });
        }

        const { selection, data, options = {} as any } = input;
        const {
          preview = false,
          confirmed = false,
          skipSafetyChecks = false,
        } = options as any;

        // Build brand-scoped base conditions
        const brandColumn = config.brandColumn || "brandId";
        const baseConditions = [
          eq((config.table as any)[brandColumn], ctx.brandId!),
        ];

        // Apply soft delete filter
        if (config.deletedAtColumn) {
          baseConditions.push(
            isNull((config.table as any)[config.deletedAtColumn]),
          );
        }

        // Create bulk safety validator
        const safetyValidator = new BulkSafetyValidator(
          "update",
          config.resourceName,
        );

        if (preview) {
          // Return comprehensive preview information
          const previewResult = await createBulkPreview(
            ctx.db,
            config.table,
            selection,
            "update",
            config.resourceName,
            baseConditions,
          );

          return {
            success: true,
            preview: true,
            data: [],
            affectedCount: previewResult.affectedCount,
            sampleRecords: previewResult.sampleRecords,
            safetyStatus: previewResult.safetyStatus,
            warnings: previewResult.warnings,
            requiresConfirmation: previewResult.requiresConfirmation,
            estimatedDuration: previewResult.estimatedDuration,
            meta: {
              operation: "bulkUpdate",
              resourceType: config.resourceName,
              safetyInfo: previewResult.safetyInfo,
            },
          };
        }

        // Count affected records for safety validation
        const affectedCount = await countAffectedRecords(
          ctx.db,
          config.table,
          selection,
          baseConditions,
        );

        // Apply safety validation unless skipped by admin
        if (!skipSafetyChecks) {
          safetyValidator.validateSafety(affectedCount, false, confirmed);
        }

        // Build database conditions from selection criteria
        const conditions = [...baseConditions];

        if (selection.ids && selection.ids.length > 0) {
          conditions.push(inArray((config.table as any).id, selection.ids));
        } else if (selection.filter) {
          for (const [key, value] of Object.entries(selection.filter)) {
            if (value !== undefined && (config.table as any)[key]) {
              if (Array.isArray(value)) {
                conditions.push(inArray((config.table as any)[key], value));
              } else {
                conditions.push(eq((config.table as any)[key], value));
              }
            }
          }
        }
        // For "all" selection, use only base conditions

        // Exclude specific IDs if provided
        if (selection.excludeIds && selection.excludeIds.length > 0) {
          // Note: This is a simplified exclusion, in production you'd want proper NOT IN
          console.warn(
            "excludeIds not fully implemented in this basic version",
          );
        }

        const dataWithTimestamp = {
          ...data,
          updatedAt: new Date(),
        };

        const updatedRecords = await ctx.db
          .update(config.table)
          .set(dataWithTimestamp)
          .where(and(...conditions))
          .returning();

        return createSuccessMutationResponse(
          updatedRecords,
          updatedRecords.length,
          {
            ...({
              operation: "bulkUpdate",
              resourceType: config.resourceName,
              affectedCount,
              safetyStatus: safetyValidator.getSafetyStatus(affectedCount),
              estimatedDuration:
                safetyValidator.estimateDuration(affectedCount),
            } as any),
          },
        );
      } catch (error) {
        console.error(`Error bulk updating ${config.resourceName}:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to bulk update ${config.resourceName}`,
          cause: error,
        });
      }
    });
}

/**
 * Creates a standardized aggregate endpoint for metrics
 */
export function createAggregateEndpoint<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  const inputSchema = z.object({
    filter: createExtendedFilterSchema(
      config.filterExtensions || {},
    ).optional(),
    metrics: createExtendedMetricsSchema(config.customMetrics || []),
  });

  return protectedProcedure.input(inputSchema).query(async ({ ctx, input }) => {
    try {
      // Permission check
      if (
        config.permissions?.aggregate &&
        !(await config.permissions.aggregate(ctx))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient permissions to aggregate ${config.resourceName}`,
        });
      }

      const { filter = {}, metrics } = input;

      // Build brand-scoped base conditions
      const brandColumn = config.brandColumn || "brandId";
      const conditions = [eq((config.table as any)[brandColumn], ctx.brandId!)];

      // Apply soft delete filter
      if (config.deletedAtColumn && !filter.includeDeleted) {
        conditions.push(isNull((config.table as any)[config.deletedAtColumn]));
      }

      // Apply basic filters
      if (filter.ids && filter.ids.length > 0) {
        conditions.push(inArray((config.table as any).id, filter.ids));
      }

      // Apply custom filter extensions
      for (const [key, value] of Object.entries(filter)) {
        if (
          value !== undefined &&
          config.filterExtensions?.[key] &&
          (config.table as any)[key]
        ) {
          if (Array.isArray(value)) {
            conditions.push(inArray((config.table as any)[key], value));
          } else {
            conditions.push(eq((config.table as any)[key], value));
          }
        }
      }

      const results: Record<string, any> = {};

      // Compute requested metrics
      for (const metric of metrics as unknown as any[]) {
        switch (metric) {
          case "count": {
            const countResult = await ctx.db
              .select({ total: count() })
              .from(config.table as any)
              .where(and(...conditions));
            results.count = countResult[0]?.total ?? 0;
            break;
          }

          case "countByStatus":
            if ((config.table as any).status) {
              const statusCounts = await ctx.db
                .select({
                  status: (config.table as any).status,
                  count: count(),
                })
                .from(config.table as any)
                .where(and(...conditions))
                .groupBy((config.table as any).status);
              results.countByStatus = statusCounts;
            }
            break;

          default:
            // Handle custom metrics defined in config
            if (config.customMetrics?.includes(metric)) {
              // Custom metric implementation would go here
              // For now, just acknowledge the metric was requested
              results[metric] = null;
            }
            break;
        }
      }

      return {
        success: true,
        data: results,
        meta: {
          resourceType: config.resourceName,
          timestamp: new Date(),
          filterApplied: Object.keys(filter).length > 0,
        },
      };
    } catch (error) {
      console.error(`Error aggregating ${config.resourceName}:`, error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to aggregate ${config.resourceName}`,
        cause: error,
      });
    }
  });
}

// ================================
// Main Resourceful Router Factory
// ================================

/**
 * Creates a complete resourceful router with standard CRUD + bulk operations
 */
export function createResourcefulRouter<TTable extends PgTable>(
  config: ResourcefulRouterConfig<TTable>,
) {
  const router: Record<string, any> = {};

  // Standard CRUD endpoints
  router.list = createListEndpoint(config);
  router.get = createGetEndpoint(config);

  if (config.createSchema) {
    router.create = createCreateEndpoint(config);
  }

  if (config.updateSchema) {
    router.update = createUpdateEndpoint(config);
  }

  // Add delete endpoint if schema supports it
  if (config.deletedAtColumn) {
    router.delete = createDeleteEndpoint(config);
  }

  // Always add bulk update and aggregate endpoints
  router.bulkUpdate = createBulkUpdateEndpoint(config);
  router.aggregate = createAggregateEndpoint(config);

  return createTRPCRouter(router);
}

// ================================
// Utility Functions
// ================================

/**
 * Creates brand-scoped base conditions for any table
 */
export function createBrandScopedConditions<TTable extends PgTable>(
  table: TTable,
  brandId: string,
  brandColumn: keyof TTable["$inferSelect"] = "brandId" as any,
) {
  return [eq((table as any)[brandColumn], brandId)];
}

// Legacy bulk validation and cursor utilities are now imported from enhanced modules
