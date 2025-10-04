import { TRPCError } from "@trpc/server";
import {
  type Passport,
  type PassportStatus,
  type Visibility,
  passports,
  passportTemplates,
  productVariants,
  products,
} from "@v1/db/schema";
import {
  bulkUpdatePassportSchema,
  calculatePassportCompleteness,
  calculatePassportCompliance,
  createPassportSchema,
  getPassportSchema,
  listPassportsSchema,
  passportMetricsSchema,
  transformPassportData,
  updatePassportSchema,
  passportsSchemas,
  type PassportsInclude,
  type PassportsFilter,
  type PassportsSort,
} from "@v1/db/schemas/modules";
import {
  createCrossModuleQueryCapabilities,
  applyCrossModuleIncludes,
  transformCrossModuleResults,
  createCrossModulePerformanceTracker,
} from "@v1/db/schemas/shared";
import {
  createPassportTransaction,
  createTransactionFromTRPCContext,
} from "@v1/db/utils/cross-module-transactions";
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

// Enhanced schemas with cross-module capabilities
const {
  filterSchema,
  sortSchema,
  includeSchema,
  paginationSchema,
} = passportsSchemas;

// Create cross-module query capabilities for passports
const crossModuleCapabilities = createCrossModuleQueryCapabilities(
  "passports",
  passports,
  z.any() // Passport data schema placeholder
);

// Create performance tracker
const performanceTracker = createCrossModulePerformanceTracker("passports");

export const passportsRouter = createTRPCRouter({
  /**
   * List passports with advanced filtering, sorting, and cursor pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        filter: filterSchema.optional(),
        sort: sortSchema.optional(),
        pagination: paginationSchema.optional(),
        include: includeSchema.optional(),
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

      const {
        filter = {},
        sort = { field: "createdAt", direction: "desc" },
        pagination = {},
        include = {},
      } = input;

      const { cursor, limit = 20 } = pagination;

      // Validate includes and get performance metrics
      const startTime = Date.now();
      const includeValidation = crossModuleCapabilities.validateIncludes(
        include,
        ctx.role || "member"
      );

      if (!includeValidation.isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Include validation failed: ${includeValidation.warnings.join(", ")}`,
        });
      }

      // Build base conditions
      const conditions = [eq(passports.brandId, brandId)];

      // Apply search filter - search across product name, SKU, and passport ID
      if (filter.search?.trim()) {
        const searchTerm = `%${filter.search.trim()}%`;
        conditions.push(
          or(
            ilike(products.name, searchTerm),
            ilike(productVariants.sku, searchTerm),
            ilike(passports.id, searchTerm),
          )!,
        );
      }

      // Apply filters
      if (filter.passportStatus && filter.passportStatus.length > 0) {
        conditions.push(
          or(
            ...filter.passportStatus.map((status) =>
              eq(passports.status, status),
            ),
          )!,
        );
      }

      // Note: visibility column not available in current database schema

      if (filter.productIds && filter.productIds.length > 0) {
        conditions.push(
          or(...filter.productIds.map((id) => eq(passports.productId, id)))!,
        );
      }

      if (filter.variantIds && filter.variantIds.length > 0) {
        conditions.push(
          or(...filter.variantIds.map((id) => eq(passports.variantId, id)))!,
        );
      }

      if (filter.templateIds && filter.templateIds.length > 0) {
        conditions.push(
          or(...filter.templateIds.map((id) => eq(passports.templateId, id)))!,
        );
      }

      // Season filter (direct field on passports table)
      if (filter.season && filter.season.length > 0) {
        conditions.push(
          or(...filter.season.map((season) => eq(passports.season, season)))!,
        );
      }

      // Color filter (through variant join)
      if (filter.colorIds && filter.colorIds.length > 0) {
        conditions.push(
          or(...filter.colorIds.map((colorId) => eq(productVariants.colorId, colorId)))!,
        );
      }

      // Size filter (through variant join)
      if (filter.sizeIds && filter.sizeIds.length > 0) {
        conditions.push(
          or(...filter.sizeIds.map((sizeId) => eq(productVariants.sizeId, sizeId)))!,
        );
      }

      // Category filter (through product join)
      if (filter.categoryIds && filter.categoryIds.length > 0) {
        conditions.push(
          or(...filter.categoryIds.map((categoryId) => eq(products.categoryId, categoryId)))!,
        );
      }

      // Date range filters for basic columns
      if (filter.createdRange?.from) {
        conditions.push(
          gte(passports.createdAt, filter.createdRange.from.toISOString()),
        );
      }
      if (filter.createdRange?.to) {
        conditions.push(
          lte(passports.createdAt, filter.createdRange.to.toISOString()),
        );
      }

      // Cursor-based pagination
      if (cursor) {
        try {
          const cursorData = JSON.parse(
            Buffer.from(cursor, "base64").toString(),
          );
          const cursorField =
            sort.field === "createdAt"
              ? passports.createdAt
              : sort.field === "updatedAt"
                ? passports.updatedAt
                : sort.field === "passportStatus"
                  ? passports.status
                  : passports.createdAt; // fallback

          if (sort.direction === "desc") {
            conditions.push(
              or(
                lte(cursorField, cursorData[sort.field]),
                and(
                  eq(cursorField, cursorData[sort.field]),
                  lte(passports.id, cursorData.id),
                ),
              )!,
            );
          } else {
            conditions.push(
              or(
                gte(cursorField, cursorData[sort.field]),
                and(
                  eq(cursorField, cursorData[sort.field]),
                  gte(passports.id, cursorData.id),
                ),
              )!,
            );
          }
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      // Build query with proper joins based on includes
      const sortField =
        sort.field === "createdAt"
          ? passports.createdAt
          : sort.field === "updatedAt"
            ? passports.updatedAt
            : sort.field === "passportStatus"
              ? passports.status
              : sort.field === "name"
                ? products.name
                : passports.createdAt;

      // Execute query with joins - always join for search functionality
      let results: any[];
      const needsJoins = include.product || include.variant || include.template || filter.search?.trim();
      
      if (needsJoins) {
        const queryResults = await db
          .select({
            passport: passports,
            ...(include.product && { product: products }),
            ...(include.variant && { variant: productVariants }),
            ...(include.template && { template: passportTemplates }),
          })
          .from(passports)
          .leftJoin(products, eq(passports.productId, products.id))
          .leftJoin(productVariants, eq(passports.variantId, productVariants.id))
          .leftJoin(passportTemplates, eq(passports.templateId, passportTemplates.id))
          .where(and(...conditions))
          .orderBy(
            sort.direction === "asc" ? asc(sortField) : desc(sortField),
            sort.direction === "asc" ? asc(passports.id) : desc(passports.id),
          )
          .limit(limit + 1);

        results = queryResults.map((row) => ({
          ...row.passport,
          ...(include.product && row.product && { product: row.product }),
          ...(include.variant && row.variant && { variant: row.variant }),
          ...(include.template && row.template && { template: row.template }),
        }));
      } else {
        results = await db
          .select()
          .from(passports)
          .where(and(...conditions))
          .orderBy(
            sort.direction === "asc" ? asc(sortField) : desc(sortField),
            sort.direction === "asc" ? asc(passports.id) : desc(passports.id),
          )
          .limit(limit + 1);
      }

      // Check if there are more results
      const hasMore = results.length > limit;
      if (hasMore) {
        results.pop(); // Remove the extra item
      }

      const transformedResults = results;

      // Generate next cursor
      const nextCursor =
        hasMore && transformedResults.length > 0
          ? Buffer.from(
              JSON.stringify({
                [sort.field]: (transformedResults[transformedResults.length - 1] as any)[sort.field],
                id: (transformedResults[transformedResults.length - 1] as any).id,
              }),
            ).toString("base64")
          : null;

      // Get performance metrics
      const performanceMetrics = performanceTracker.trackQuery(include, startTime);

      return {
        data: transformedResults,
        cursorInfo: {
          nextCursor,
          hasMore,
        },
        meta: {
          total: undefined, // Optional: could add total count if needed
          performance: performanceMetrics,
          includeValidation: {
            warnings: includeValidation.warnings,
            recommendedStrategy: includeValidation.recommendedStrategy,
          },
        },
      };
    }),

  /**
   * Simple aggregate for dashboard status cards
   */
  countByStatus: protectedProcedure
    .input(
      z
        .object({
          filter: filterSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const filter = input?.filter ?? {};

      const conditions = [eq(passports.brandId, brandId)];

      if (filter.passportStatus?.length) {
        conditions.push(inArray(passports.status, filter.passportStatus));
      }

      if (filter.productIds?.length) {
        conditions.push(inArray(passports.productId, filter.productIds));
      }

      if (filter.variantIds?.length) {
        conditions.push(inArray(passports.variantId, filter.variantIds));
      }

      if (filter.templateIds?.length) {
        conditions.push(inArray(passports.templateId, filter.templateIds));
      }

      if (filter.visibility?.length) {
        conditions.push(inArray(passports.visibility, filter.visibility));
      }

      if (filter.isPublic !== undefined) {
        conditions.push(eq(passports.isPublic, filter.isPublic));
      }

      if (filter.createdRange?.from) {
        const from =
          filter.createdRange.from instanceof Date
            ? filter.createdRange.from
            : new Date(filter.createdRange.from);
        conditions.push(gte(passports.createdAt, from.toISOString()));
      }

      if (filter.createdRange?.to) {
        const to =
          filter.createdRange.to instanceof Date
            ? filter.createdRange.to
            : new Date(filter.createdRange.to);
        conditions.push(lte(passports.createdAt, to.toISOString()));
      }

      const rows = await db
        .select({
          status: passports.status,
          count: count(),
        })
        .from(passports)
        .where(and(...conditions))
        .groupBy(passports.status);

      const dashboardStatuses = [
        "published",
        "scheduled",
        "unpublished",
        "archived",
      ] as const;

      const results = Object.fromEntries(
        dashboardStatuses.map((status) => [status, 0]),
      ) as Record<(typeof dashboardStatuses)[number], number>;

      for (const row of rows) {
        const countValue = Number(row.count ?? 0);
        const normalizedStatus = String(row.status ?? "").toLowerCase();

        switch (normalizedStatus) {
          case "published":
            results.published += countValue;
            break;
          case "scheduled":
            results.scheduled += countValue;
            break;
          case "archived":
            results.archived += countValue;
            break;
          case "unpublished":
            results.unpublished += countValue;
            break;
          case "draft":
          case "blocked":
          default:
            results.unpublished += countValue;
            break;
        }
      }

      return results;
    }),

  /**
   * Get passport(s) by flexible where conditions
   */
  get: protectedProcedure
    .input(
      z.object({
        where: z.object({
          passportId: z.string().uuid().optional(),
          productId: z.string().uuid().optional(),
          variantId: z.string().uuid().optional(),
          templateId: z.string().uuid().optional(),
          passportStatus: z
            .enum(["draft", "published", "archived", "blocked"])
            .optional(),
        }),
        include: includeSchema.optional(),
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

      const { where, include = {} } = input;

      // Build conditions
      const conditions = [eq(passports.brandId, brandId)];

      if (where.passportId) {
        conditions.push(eq(passports.id, where.passportId));
      }
      if (where.productId) {
        conditions.push(eq(passports.productId, where.productId));
      }
      if (where.variantId) {
        conditions.push(eq(passports.variantId, where.variantId));
      }
      if (where.templateId) {
        conditions.push(eq(passports.templateId, where.templateId));
      }
      if (where.passportStatus) {
        conditions.push(eq(passports.status, where.passportStatus));
      }
      // Note: visibility column not available in current database schema

      // Build query with optional includes
      if (include.product || include.variant) {
        const result = await db
          .select({
            passport: passports,
            ...(include.product && { product: products }),
            ...(include.variant && { variant: productVariants }),
          })
          .from(passports)
          .leftJoin(products, eq(passports.productId, products.id))
          .leftJoin(
            productVariants,
            eq(passports.variantId, productVariants.id),
          )
          .where(and(...conditions))
          .limit(1);

        if (result.length === 0) return null;

        const item = result[0];
        return {
          ...item.passport,
          ...(include.product && item.product && { product: item.product }),
          ...(include.variant && item.variant && { variant: item.variant }),
        };
      }

      const result = await db
        .select()
        .from(passports)
        .where(and(...conditions))
        .limit(1);

      return result[0] || null;
    }),

  /**
   * Create a new passport with cross-module transaction management
   */
  create: protectedProcedure
    .input(createPassportSchema)
    .mutation(async ({ ctx, input }) => {
      // Create transaction context from tRPC context
      const txContext = createTransactionFromTRPCContext(ctx);

      // Calculate scores using the existing utility functions
      const dataCompleteness = calculatePassportCompleteness({
        templateId: input.templateId,
        customData: input.customData,
        moduleData: input.moduleData,
        passportStatus: input.passportStatus,
        visibility: input.visibility,
      });

      const complianceScore = calculatePassportCompliance({
        templateId: input.templateId,
        customData: input.customData,
        moduleData: input.moduleData,
        validationScore: 75, // Default initial validation score
      });

      // Transform input data
      const transformedData = transformPassportData(input);

      // Prepare transaction input
      const transactionInput = {
        brandId: txContext.brandId,
        productId: input.productId,
        variantId: input.variantId,
        templateId: input.templateId,
        passportData: {
          ...transformedData,
          dataCompleteness,
          complianceScore,
          validationScore: 75,
        },
        // Enable all validation checks for create operation
        validateProductVariantRelation: true,
        validateTemplateAccess: true,
        enforceUniquePassport: true,
      };

      // Execute transaction with automatic rollback on failure
      const result = await createPassportTransaction(
        ctx.db,
        transactionInput,
        {
          timeout: 30000, // 30 second timeout
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

      // Extract the created passport from transaction results
      const createdPassport = result.data?.[result.data.length - 1]; // Last operation is create-passport

      return {
        data: [createdPassport],
        affectedCount: 1,
        transactionInfo: {
          operations: result.operations,
          success: result.success,
        },
      };
    }),

  /**
   * Update a passport with partial data and automatic score recalculation
   */
  update: protectedProcedure
    .input(updatePassportSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { id, ...updateData } = input;

      // Check if passport exists and belongs to brand
      const existingPassport = await db.query.passports.findFirst({
        where: and(eq(passports.id, id), eq(passports.brandId, brandId)),
      });

      if (!existingPassport) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Passport not found or does not belong to your brand",
        });
      }

      // Transform update data
      const transformedData = transformPassportData(updateData);

      // Recalculate scores if relevant data changed
      let calculatedUpdates = {};
      const hasRelevantChanges =
        transformedData.customData ||
        transformedData.moduleData ||
        transformedData.passportStatus ||
        transformedData.visibility ||
        transformedData.templateId;

      if (hasRelevantChanges) {
        const updatedPassportData = {
          ...existingPassport,
          ...transformedData,
        };

        calculatedUpdates = {
          dataCompleteness: calculatePassportCompleteness(updatedPassportData),
          complianceScore: calculatePassportCompliance({
            ...updatedPassportData,
            validationScore: updatedPassportData.validationScore || 75,
          }),
        };
      }

      // Handle status transitions with automatic timestamp updates
      const statusUpdates = {};
      if (transformedData.passportStatus === "published" && existingPassport.passportStatus !== "published") {
        statusUpdates.publishedAt = new Date().toISOString();
      }

      // Perform the update
      const finalUpdateData = {
        ...transformedData,
        ...calculatedUpdates,
        ...statusUpdates,
        updatedAt: new Date().toISOString(),
      };

      const [updatedPassport] = await db
        .update(passports)
        .set(finalUpdateData)
        .where(and(eq(passports.id, id), eq(passports.brandId, brandId)))
        .returning();

      return {
        data: [updatedPassport],
        affectedCount: 1,
      };
    }),

  /**
   * Bulk update passports with safety guards and preview mode
   */
  bulkUpdate: protectedProcedure
    .input(bulkUpdatePassportSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { selection, data: updateData, preview } = input;

      // Build base conditions (always include brand isolation)
      const baseConditions = [eq(passports.brandId, brandId)];

      // Build selection conditions based on criteria
      const conditions = [...baseConditions];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(passports.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        const filter = selection.filter;

        // Apply passport-specific filters
        if (filter.passportStatus) {
          conditions.push(inArray(passports.status, filter.passportStatus));
        }
        if (filter.visibility) {
          conditions.push(inArray(passports.visibility, filter.visibility));
        }
        if (filter.productIds) {
          conditions.push(inArray(passports.productId, filter.productIds));
        }
        if (filter.variantIds) {
          conditions.push(inArray(passports.variantId, filter.variantIds));
        }
        if (filter.templateIds) {
          conditions.push(inArray(passports.templateId, filter.templateIds));
        }
        if (filter.isPublic !== undefined) {
          conditions.push(eq(passports.isPublic, filter.isPublic));
        }
        if (filter.syncEnabled !== undefined) {
          conditions.push(eq(passports.syncEnabled, filter.syncEnabled));
        }
      }
      // For "all" selection, use only base conditions

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(passports)
        .where(and(...conditions));

      const affectedCount = countQuery[0]?.count || 0;

      // Safety guards
      const MAX_BULK_UPDATE = 1000;
      const PREVIEW_THRESHOLD = 100;

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
      const transformedData = transformPassportData(updateData);

      // Handle status transitions for bulk updates
      const statusUpdates = {};
      if (transformedData.passportStatus === "published") {
        statusUpdates.publishedAt = new Date().toISOString();
      }

      // For bulk updates, we don't recalculate individual scores due to performance
      // This could be enhanced with a background job for score recalculation
      const finalUpdateData = {
        ...transformedData,
        ...statusUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedPassports = await db
        .update(passports)
        .set(finalUpdateData)
        .where(and(...conditions))
        .returning();

      return {
        data: updatedPassports,
        affectedCount: updatedPassports.length,
      };
    }),

  // Compute metrics and aggregations
  aggregate: protectedProcedure
    .input(passportMetricsSchema)
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

      // Base conditions for all aggregations
      const baseConditions = [eq(passports.brandId, brandId)];

      // Apply filters to base conditions if provided
      if (filter.passportStatus) {
        baseConditions.push(
          or(
            ...filter.passportStatus.map((status) =>
              eq(passports.status, status),
            ),
          )!,
        );
      }

      if (filter.visibility) {
        baseConditions.push(
          or(
            ...filter.visibility.map((visibility) =>
              eq(passports.visibility, visibility),
            ),
          )!,
        );
      }

      if (filter.isPublic !== undefined) {
        baseConditions.push(eq(passports.isPublic, filter.isPublic));
      }

      // Process each requested metric
      for (const metric of metrics) {
        switch (metric) {
          case "passportStatusDistribution":
            const statusCounts = await db
              .select({
                status: passports.status,
                count: count(),
              })
              .from(passports)
              .where(and(...baseConditions))
              .groupBy(passports.status);
            results.passportStatusDistribution = statusCounts;
            break;

          case "visibilityDistribution":
            const visibilityCounts = await db
              .select({
                visibility: passports.visibility,
                count: count(),
              })
              .from(passports)
              .where(and(...baseConditions))
              .groupBy(passports.visibility);
            results.visibilityDistribution = visibilityCounts;
            break;

          case "dataCompletenessStatistics":
            const completenessStats = await db
              .select({
                avgCompleteness: count(passports.dataCompleteness),
                minCompleteness: count(passports.dataCompleteness),
                maxCompleteness: count(passports.dataCompleteness),
                completePassports: count(),
              })
              .from(passports)
              .where(and(...baseConditions, gte(passports.dataCompleteness, 100)));
            results.dataCompletenessStatistics = completenessStats[0];
            break;

          case "validationStatistics":
            const validationStats = await db
              .select({
                avgValidationScore: count(passports.validationScore),
                validPassports: count(),
              })
              .from(passports)
              .where(and(...baseConditions, gte(passports.validationScore, 80)));
            results.validationStatistics = validationStats[0];
            break;

          case "complianceStatistics":
            const complianceStats = await db
              .select({
                avgComplianceScore: count(passports.complianceScore),
                compliantPassports: count(),
              })
              .from(passports)
              .where(and(...baseConditions, gte(passports.complianceScore, 80)));
            results.complianceStatistics = complianceStats[0];
            break;

          case "sharingStatistics":
            const sharingStats = await db
              .select({
                publicPassports: count(),
                shareablePassports: count(),
                totalShares: count(passports.shareCount),
              })
              .from(passports)
              .where(
                and(
                  ...baseConditions,
                  or(
                    eq(passports.isPublic, true),
                    eq(passports.allowSharing, true),
                  )!,
                ),
              );
            results.sharingStatistics = sharingStats[0];
            break;

          case "qrCodeUsage":
            const qrStats = await db
              .select({
                withQrCode: count(),
                format: passports.qrCodeFormat,
              })
              .from(passports)
              .where(and(...baseConditions, eq(passports.includeQrCode, true)))
              .groupBy(passports.qrCodeFormat);
            results.qrCodeUsage = qrStats;
            break;

          case "syncHealthMetrics":
            const syncStats = await db
              .select({
                status: passports.syncStatus,
                count: count(),
              })
              .from(passports)
              .where(and(...baseConditions, eq(passports.syncEnabled, true)))
              .groupBy(passports.syncStatus);
            results.syncHealthMetrics = syncStats;
            break;

          case "templateUsage":
            const templateStats = await db
              .select({
                templateId: passports.templateId,
                count: count(),
              })
              .from(passports)
              .where(and(...baseConditions, isNotNull(passports.templateId)))
              .groupBy(passports.templateId);
            results.templateUsage = templateStats;
            break;

          case "accessStatistics":
            const accessStats = await db
              .select({
                totalAccesses: count(passports.shareCount),
                recentlyAccessed: count(),
              })
              .from(passports)
              .where(
                and(
                  ...baseConditions,
                  gte(
                    passports.lastAccessedAt,
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  ),
                ),
              );
            results.accessStatistics = accessStats[0];
            break;

          case "languageDistribution":
            const languageStats = await db
              .select({
                language: passports.primaryLanguage,
                count: count(),
              })
              .from(passports)
              .where(and(...baseConditions))
              .groupBy(passports.primaryLanguage);
            results.languageDistribution = languageStats;
            break;

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
   * Get available filter options from actual database values
   */
  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;

    if (!brandId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No active brand context",
      });
    }

    // Get distinct seasons used in passports
    const seasonsQuery = await db
      .selectDistinct({ season: passports.season })
      .from(passports)
      .where(and(eq(passports.brandId, brandId), isNotNull(passports.season)));
    
    const seasons = seasonsQuery
      .map(row => row.season)
      .filter(Boolean)
      .sort();

    // Get categories from products linked to passports
    const categoriesQuery = await db
      .selectDistinct({
        id: products.categoryId,
        name: products.category,
      })
      .from(passports)
      .innerJoin(products, eq(passports.productId, products.id))
      .where(and(
        eq(passports.brandId, brandId),
        isNotNull(products.categoryId)
      ));

    const categories = categoriesQuery
      .filter(cat => cat.id && cat.name)
      .map(cat => ({ id: cat.id!, name: cat.name! }));

    // Get colors from variants linked to passports
    const colorsQuery = await db
      .selectDistinct({
        id: productVariants.colorId,
        name: productVariants.color,
      })
      .from(passports)
      .innerJoin(productVariants, eq(passports.variantId, productVariants.id))
      .where(and(
        eq(passports.brandId, brandId),
        isNotNull(productVariants.colorId)
      ));

    const colors = colorsQuery
      .filter(color => color.id && color.name)
      .map(color => ({ id: color.id!, name: color.name! }));

    // Get sizes from variants linked to passports
    const sizesQuery = await db
      .selectDistinct({
        id: productVariants.sizeId,
        name: productVariants.size,
      })
      .from(passports)
      .innerJoin(productVariants, eq(passports.variantId, productVariants.id))
      .where(and(
        eq(passports.brandId, brandId),
        isNotNull(productVariants.sizeId)
      ));

    const sizes = sizesQuery
      .filter(size => size.id && size.name)
      .map(size => ({ id: size.id!, name: size.name! }));

    return {
      seasons,
      categories,
      colors,
      sizes,
    };
  }),
});
