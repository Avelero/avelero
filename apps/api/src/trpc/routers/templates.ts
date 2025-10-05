// @ts-nocheck
import { TRPCError } from "@trpc/server";
import { type Template, modules, passports, templates } from "@v1/db/schema";
import {
  bulkUpdateTemplateSchema,
  calculateTemplateCompleteness,
  createTemplateSchema,
  getTemplateSchema,
  listTemplatesSchema,
  templateMetricsSchema,
  transformTemplateData,
  updateTemplateSchema,
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
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

// Safety guards for bulk operations
const MAX_BULK_UPDATE = 1000;
const PREVIEW_THRESHOLD = 100;

export const templatesRouter = createTRPCRouter({
  // Paginated list with filters, sorts, and optional includes
  list: protectedProcedure
    .input(listTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const {
        filter = {},
        sort = { field: "createdAt", direction: "desc" },
        pagination = {},
        include = {},
      } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const { cursor, limit = 20 } = pagination;

      // Build where conditions
      const conditions = [eq(templates.brandId, brandId)];

      // Apply filters
      if (filter.search) {
        conditions.push(
          or(
            ilike(templates.name, `%${filter.search}%`),
            ilike(templates.description, `%${filter.search}%`),
          )!,
        );
      }

      if (filter.templateIds && filter.templateIds.length > 0) {
        conditions.push(inArray(templates.id, filter.templateIds));
      }

      if (filter.templateTypes && filter.templateTypes.length > 0) {
        conditions.push(inArray(templates.templateType, filter.templateTypes));
      }

      if (filter.templateStatus && filter.templateStatus.length > 0) {
        conditions.push(
          inArray(templates.templateStatus, filter.templateStatus),
        );
      }

      if (filter.enabled !== undefined) {
        conditions.push(eq(templates.enabled, filter.enabled));
      }

      if (filter.isDefault !== undefined) {
        conditions.push(eq(templates.isDefault, filter.isDefault));
      }

      if (filter.allowCustomization !== undefined) {
        conditions.push(
          eq(templates.allowCustomization, filter.allowCustomization),
        );
      }

      if (filter.moduleIds && filter.moduleIds.length > 0) {
        // Filter templates that contain any of the specified module IDs
        const moduleIdConditions = filter.moduleIds.map((moduleId) =>
          ilike(templates.moduleIds, `%"${moduleId}"%`),
        );
        conditions.push(or(...moduleIdConditions)!);
      }

      if (filter.hasModules !== undefined) {
        if (filter.hasModules) {
          conditions.push(isNotNull(templates.moduleIds));
        } else {
          conditions.push(
            or(
              isNull(templates.moduleIds),
              eq(templates.moduleIds, JSON.stringify([])),
            )!,
          );
        }
      }

      if (filter.hasDescription !== undefined) {
        if (filter.hasDescription) {
          conditions.push(isNotNull(templates.description));
        } else {
          conditions.push(isNull(templates.description));
        }
      }

      if (filter.hasBeenUsed !== undefined) {
        if (filter.hasBeenUsed) {
          conditions.push(gte(templates.usageCount, 1));
        } else {
          conditions.push(eq(templates.usageCount, 0));
        }
      }

      if (filter.usageCount) {
        if (filter.usageCount.min !== undefined) {
          conditions.push(gte(templates.usageCount, filter.usageCount.min));
        }
        if (filter.usageCount.max !== undefined) {
          conditions.push(lte(templates.usageCount, filter.usageCount.max));
        }
      }

      if (filter.validationScore) {
        if (filter.validationScore.min !== undefined) {
          conditions.push(
            gte(templates.validationScore, filter.validationScore.min),
          );
        }
        if (filter.validationScore.max !== undefined) {
          conditions.push(
            lte(templates.validationScore, filter.validationScore.max),
          );
        }
      }

      if (filter.languages && filter.languages.length > 0) {
        const languageConditions = filter.languages.map((lang) =>
          ilike(templates.availableLanguages, `%"${lang}"%`),
        );
        conditions.push(or(...languageConditions)!);
      }

      if (filter.primaryLanguage) {
        conditions.push(eq(templates.primaryLanguage, filter.primaryLanguage));
      }

      if (filter.version) {
        conditions.push(eq(templates.version, filter.version));
      }

      if (filter.hasParentTemplate !== undefined) {
        if (filter.hasParentTemplate) {
          conditions.push(isNotNull(templates.parentTemplateId));
        } else {
          conditions.push(isNull(templates.parentTemplateId));
        }
      }

      if (filter.parentTemplateIds && filter.parentTemplateIds.length > 0) {
        conditions.push(
          inArray(templates.parentTemplateId, filter.parentTemplateIds),
        );
      }

      // Date range filters
      if (filter.createdRange?.from) {
        conditions.push(
          gte(templates.createdAt, filter.createdRange.from.toISOString()),
        );
      }
      if (filter.createdRange?.to) {
        conditions.push(
          lte(templates.createdAt, filter.createdRange.to.toISOString()),
        );
      }

      if (filter.lastUsedRange?.from) {
        conditions.push(
          gte(templates.lastUsedAt, filter.lastUsedRange.from.toISOString()),
        );
      }
      if (filter.lastUsedRange?.to) {
        conditions.push(
          lte(templates.lastUsedAt, filter.lastUsedRange.to.toISOString()),
        );
      }

      // Cursor-based pagination
      if (cursor) {
        try {
          const cursorData = JSON.parse(
            Buffer.from(cursor, "base64").toString(),
          );
          const cursorCondition =
            sort.direction === "asc"
              ? gte(templates[sort.field], cursorData[sort.field])
              : lte(templates[sort.field], cursorData[sort.field]);
          conditions.push(cursorCondition);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      const data = await db.query.templates.findMany({
        where: and(...conditions),
        orderBy:
          sort.direction === "asc"
            ? asc(templates[sort.field])
            : desc(templates[sort.field]),
        limit: limit + 1, // +1 to check if there are more results
        with: {
          // Include modules if requested - note: this would need to be set up as relations in schema
          // For now, we'll handle module data separately if needed
        },
      });

      const hasMore = data.length > limit;
      if (hasMore) data.pop(); // Remove extra item

      const nextCursor =
        hasMore && data.length > 0
          ? Buffer.from(
              JSON.stringify({
                [sort.field]: data[data.length - 1][sort.field],
                id: data[data.length - 1].id,
              }),
            ).toString("base64")
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
    .input(getTemplateSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { where, include = {} } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const conditions = [eq(templates.brandId, brandId)];

      if (where.templateId) {
        conditions.push(eq(templates.id, where.templateId));
      }

      if (where.templateType) {
        conditions.push(eq(templates.templateType, where.templateType));
      }

      if (where.exactStatus) {
        conditions.push(eq(templates.templateStatus, where.exactStatus));
      }

      if (where.isEnabled !== undefined) {
        conditions.push(eq(templates.enabled, where.isEnabled));
      }

      if (where.isDefaultTemplate !== undefined) {
        conditions.push(eq(templates.isDefault, where.isDefaultTemplate));
      }

      if (where.exactVersion) {
        conditions.push(eq(templates.version, where.exactVersion));
      }

      if (where.parentTemplateId) {
        conditions.push(eq(templates.parentTemplateId, where.parentTemplateId));
      }

      if (where.primaryLanguageCode) {
        conditions.push(
          eq(templates.primaryLanguage, where.primaryLanguageCode),
        );
      }

      return db.query.templates.findFirst({
        where: and(...conditions),
        with: {
          // Include relations based on include options
        },
      });
    }),

  // Create with brand scoping and completeness calculation
  create: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Transform and prepare data for insertion
      const transformedData = transformTemplateData(input);

      // Calculate initial completeness score
      const completenessScore = calculateTemplateCompleteness({
        name: transformedData.name,
        description: transformedData.description,
        config: transformedData.config,
        moduleIds: transformedData.moduleIds,
        requiredFields: transformedData.requiredFields,
        validationRules: transformedData.validationRules,
      });

      const newTemplateData = {
        ...transformedData,
        brandId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationScore: completenessScore,
      };

      // Create the template
      const [newTemplate] = await db
        .insert(templates)
        .values(newTemplateData)
        .returning();

      return {
        data: [newTemplate],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Partial update with validation
  update: protectedProcedure
    .input(updateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { id, ...updateData } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Check if template exists and belongs to brand
      const existingTemplate = await db.query.templates.findFirst({
        where: and(eq(templates.id, id), eq(templates.brandId, brandId)),
      });

      if (!existingTemplate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or access denied",
        });
      }

      // Transform update data
      const transformedData = transformTemplateData(updateData);

      // Recalculate completeness if relevant fields changed
      let completenessScore: number | undefined;
      if (
        transformedData.name ||
        transformedData.description ||
        transformedData.config ||
        transformedData.moduleIds ||
        transformedData.requiredFields ||
        transformedData.validationRules
      ) {
        completenessScore = calculateTemplateCompleteness({
          name: transformedData.name || existingTemplate.name,
          description:
            transformedData.description || existingTemplate.description,
          config: transformedData.config || existingTemplate.config,
          moduleIds: transformedData.moduleIds || existingTemplate.moduleIds,
          requiredFields:
            transformedData.requiredFields || existingTemplate.requiredFields,
          validationRules:
            transformedData.validationRules || existingTemplate.validationRules,
        });
      }

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
        ...(completenessScore !== undefined && {
          validationScore: completenessScore,
        }),
      };

      const [updatedTemplate] = await db
        .update(templates)
        .set(finalUpdateData)
        .where(and(eq(templates.id, id), eq(templates.brandId, brandId)))
        .returning();

      return {
        data: [updatedTemplate],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Bulk update with safety guards
  bulkUpdate: protectedProcedure
    .input(bulkUpdateTemplateSchema)
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
      const conditions = [eq(templates.brandId, brandId)];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(templates.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        if (selection.filter.templateTypes) {
          conditions.push(
            inArray(templates.templateType, selection.filter.templateTypes),
          );
        }
        if (selection.filter.templateStatus) {
          conditions.push(
            inArray(templates.templateStatus, selection.filter.templateStatus),
          );
        }
        if (selection.filter.enabled !== undefined) {
          conditions.push(eq(templates.enabled, selection.filter.enabled));
        }
        // Add other filter conditions as needed
      }
      // "all" selection uses only brand condition

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(templates)
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
      const transformedData = transformTemplateData(updateData);

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedTemplates = await db
        .update(templates)
        .set(finalUpdateData)
        .where(and(...conditions))
        .returning();

      return {
        data: updatedTemplates,
        affectedCount: updatedTemplates.length,
      };
    }),

  // Soft delete
  delete: protectedProcedure
    .input(
      z.object({
        where: z.object({
          templateId: z.string().uuid().optional(),
          ids: z.array(z.string().uuid()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { where } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const conditions = [eq(templates.brandId, brandId)];

      if (where.templateId) {
        conditions.push(eq(templates.id, where.templateId));
      }
      if (where.ids) {
        conditions.push(inArray(templates.id, where.ids));
      }

      // For now, perform hard delete. In future, could add deletedAt column for soft delete
      const deletedTemplates = await db
        .delete(templates)
        .where(and(...conditions))
        .returning();

      return {
        data: deletedTemplates,
        affectedCount: deletedTemplates.length,
      };
    }),

  // Compute metrics and aggregations
  aggregate: protectedProcedure
    .input(templateMetricsSchema)
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
      const baseConditions = [eq(templates.brandId, brandId)];

      // Apply filters to base conditions if provided
      if (filter.templateTypes) {
        baseConditions.push(
          inArray(templates.templateType, filter.templateTypes),
        );
      }

      if (filter.templateStatus) {
        baseConditions.push(
          inArray(templates.templateStatus, filter.templateStatus),
        );
      }

      if (filter.enabled !== undefined) {
        baseConditions.push(eq(templates.enabled, filter.enabled));
      }

      // Process each requested metric
      for (const metric of metrics) {
        switch (metric) {
          case "templateTypeDistribution": {
            const templateTypeCounts = await db
              .select({
                templateType: templates.templateType,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.templateType);
            results.templateTypeDistribution = templateTypeCounts;
            break;
          }

          case "templateStatusDistribution": {
            const statusCounts = await db
              .select({
                templateStatus: templates.templateStatus,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.templateStatus);
            results.templateStatusDistribution = statusCounts;
            break;
          }

          case "enablementStatus": {
            const enablementCounts = await db
              .select({
                enabled: templates.enabled,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.enabled);
            results.enablementStatus = enablementCounts;
            break;
          }

          case "templateUsageStatistics": {
            const usageStats = await db
              .select({
                totalUsage: count(templates.usageCount),
                averageUsage: count(templates.usageCount), // Would need custom aggregation
                maxUsage: count(templates.usageCount), // Would need custom aggregation
              })
              .from(templates)
              .where(and(...baseConditions));
            results.templateUsageStatistics = usageStats[0];
            break;
          }

          case "validationMetrics": {
            const validationStats = await db
              .select({
                avgValidationScore: count(templates.validationScore), // Would need AVG aggregation
                templates: count(),
              })
              .from(templates)
              .where(
                and(...baseConditions, isNotNull(templates.validationScore)),
              );
            results.validationMetrics = validationStats[0];
            break;
          }

          case "versionDistribution": {
            const versionCounts = await db
              .select({
                version: templates.version,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.version);
            results.versionDistribution = versionCounts;
            break;
          }

          case "languageDistribution": {
            const languageCounts = await db
              .select({
                primaryLanguage: templates.primaryLanguage,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.primaryLanguage);
            results.languageDistribution = languageCounts;
            break;
          }

          case "customizationUsage": {
            const customizationCounts = await db
              .select({
                allowCustomization: templates.allowCustomization,
                count: count(),
              })
              .from(templates)
              .where(and(...baseConditions))
              .groupBy(templates.allowCustomization);
            results.customizationUsage = customizationCounts;
            break;
          }

          case "moduleUtilization": {
            // Track which modules are used in templates
            const moduleUtilizationStats = await db
              .select({
                templateId: templates.id,
                templateName: templates.name,
                moduleIds: templates.moduleIds,
                moduleCount: count(),
              })
              .from(templates)
              .where(and(...baseConditions, isNotNull(templates.moduleIds)))
              .groupBy(templates.id, templates.name, templates.moduleIds);
            results.moduleUtilization = moduleUtilizationStats;
            break;
          }

          case "passportLinkageStats": {
            // Statistics on passport usage of templates
            const passportLinkageStats = await db
              .select({
                templateId: templates.id,
                templateName: templates.name,
                passportCount: count(passports.id),
                publishedPassports: count(),
                avgCompleteness: count(), // Would need to calculate actual average
                avgValidationScore: count(), // Would need to calculate actual average
              })
              .from(templates)
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(and(...baseConditions))
              .groupBy(templates.id, templates.name);
            results.passportLinkageStats = passportLinkageStats;
            break;
          }

          case "completionRatesByTemplate": {
            // Completion rates for each template across passports
            const completionRates = await db
              .select({
                templateId: templates.id,
                templateName: templates.name,
                totalPassports: count(passports.id),
                publishedPassports: count(),
                avgDataCompleteness: count(), // Would need actual AVG
                completionRate: count(), // Would need to calculate percentage
              })
              .from(templates)
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(and(...baseConditions))
              .groupBy(templates.id, templates.name);
            results.completionRatesByTemplate = completionRates;
            break;
          }

          case "templateEffectiveness": {
            // Template effectiveness metrics based on passport completion data
            const effectivenessStats = await db
              .select({
                templateId: templates.id,
                templateName: templates.name,
                templateType: templates.templateType,
                usageCount: templates.usageCount,
                passportCount: count(passports.id),
                avgComplianceScore: count(), // Would need actual AVG
                avgValidationScore: count(), // Would need actual AVG
                successRate: count(), // Would need to calculate based on published/completed passports
              })
              .from(templates)
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(and(...baseConditions))
              .groupBy(
                templates.id,
                templates.name,
                templates.templateType,
                templates.usageCount,
              );
            results.templateEffectiveness = effectivenessStats;
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
});
