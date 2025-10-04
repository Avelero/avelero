import { TRPCError } from "@trpc/server";
import { type Module, modules, passports, templates } from "@v1/db/schema";
import {
  bulkUpdateModuleSchema,
  calculateModuleCompleteness,
  createModuleSchema,
  getModuleSchema,
  listModulesSchema,
  moduleMetricsSchema,
  transformModuleData,
  updateModuleSchema,
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

export const modulesRouter = createTRPCRouter({
  // Paginated list with filters, sorts, and optional includes
  list: protectedProcedure
    .input(listModulesSchema)
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
      const conditions = [eq(modules.brandId, brandId)];

      // Apply filters
      if (filter.search) {
        conditions.push(
          or(
            ilike(modules.name, `%${filter.search}%`),
            ilike(modules.description, `%${filter.search}%`),
          )!,
        );
      }

      if (filter.moduleIds && filter.moduleIds.length > 0) {
        conditions.push(inArray(modules.id, filter.moduleIds));
      }

      if (filter.moduleTypes && filter.moduleTypes.length > 0) {
        conditions.push(inArray(modules.moduleType, filter.moduleTypes));
      }

      if (filter.moduleStatus && filter.moduleStatus.length > 0) {
        conditions.push(inArray(modules.moduleStatus, filter.moduleStatus));
      }

      if (filter.enabled !== undefined) {
        conditions.push(eq(modules.enabled, filter.enabled));
      }

      if (filter.required !== undefined) {
        conditions.push(eq(modules.required, filter.required));
      }

      if (filter.allowMultiple !== undefined) {
        conditions.push(eq(modules.allowMultiple, filter.allowMultiple));
      }

      if (filter.isSystem !== undefined) {
        conditions.push(eq(modules.isSystem, filter.isSystem));
      }

      if (filter.dependsOnModules && filter.dependsOnModules.length > 0) {
        // Filter modules that depend on any of the specified module IDs
        const dependencyConditions = filter.dependsOnModules.map((moduleId) =>
          ilike(modules.dependsOnModules, `%"${moduleId}"%`),
        );
        conditions.push(or(...dependencyConditions)!);
      }

      if (filter.hasDependencies !== undefined) {
        if (filter.hasDependencies) {
          conditions.push(isNotNull(modules.dependsOnModules));
        } else {
          conditions.push(
            or(
              isNull(modules.dependsOnModules),
              eq(modules.dependsOnModules, JSON.stringify([])),
            )!,
          );
        }
      }

      if (filter.hasDescription !== undefined) {
        if (filter.hasDescription) {
          conditions.push(isNotNull(modules.description));
        } else {
          conditions.push(isNull(modules.description));
        }
      }

      if (filter.hasBeenUsed !== undefined) {
        if (filter.hasBeenUsed) {
          conditions.push(gte(modules.usageCount, 1));
        } else {
          conditions.push(eq(modules.usageCount, 0));
        }
      }

      if (filter.usageCount) {
        if (filter.usageCount.min !== undefined) {
          conditions.push(gte(modules.usageCount, filter.usageCount.min));
        }
        if (filter.usageCount.max !== undefined) {
          conditions.push(lte(modules.usageCount, filter.usageCount.max));
        }
      }

      if (filter.validationScore) {
        if (filter.validationScore.min !== undefined) {
          conditions.push(
            gte(modules.validationScore, filter.validationScore.min),
          );
        }
        if (filter.validationScore.max !== undefined) {
          conditions.push(
            lte(modules.validationScore, filter.validationScore.max),
          );
        }
      }

      if (filter.complianceImpact) {
        if (filter.complianceImpact.min !== undefined) {
          conditions.push(
            gte(modules.complianceImpact, filter.complianceImpact.min),
          );
        }
        if (filter.complianceImpact.max !== undefined) {
          conditions.push(
            lte(modules.complianceImpact, filter.complianceImpact.max),
          );
        }
      }

      if (filter.completionWeight) {
        if (filter.completionWeight.min !== undefined) {
          conditions.push(
            gte(modules.completionWeight, filter.completionWeight.min),
          );
        }
        if (filter.completionWeight.max !== undefined) {
          conditions.push(
            lte(modules.completionWeight, filter.completionWeight.max),
          );
        }
      }

      if (filter.languages && filter.languages.length > 0) {
        const languageConditions = filter.languages.map((lang) =>
          ilike(modules.availableLanguages, `%"${lang}"%`),
        );
        conditions.push(or(...languageConditions)!);
      }

      if (filter.primaryLanguage) {
        conditions.push(eq(modules.primaryLanguage, filter.primaryLanguage));
      }

      if (filter.version) {
        conditions.push(eq(modules.version, filter.version));
      }

      if (filter.hasParentModule !== undefined) {
        if (filter.hasParentModule) {
          conditions.push(isNotNull(modules.parentModuleId));
        } else {
          conditions.push(isNull(modules.parentModuleId));
        }
      }

      if (filter.parentModuleIds && filter.parentModuleIds.length > 0) {
        conditions.push(
          inArray(modules.parentModuleId, filter.parentModuleIds),
        );
      }

      if (filter.compatibleWith && filter.compatibleWith.length > 0) {
        const compatibilityConditions = filter.compatibleWith.map((compat) =>
          ilike(modules.compatibleWith, `%"${compat}"%`),
        );
        conditions.push(or(...compatibilityConditions)!);
      }

      // Date range filters
      if (filter.createdRange?.from) {
        conditions.push(
          gte(modules.createdAt, filter.createdRange.from.toISOString()),
        );
      }
      if (filter.createdRange?.to) {
        conditions.push(
          lte(modules.createdAt, filter.createdRange.to.toISOString()),
        );
      }

      if (filter.lastUsedRange?.from) {
        conditions.push(
          gte(modules.lastUsedAt, filter.lastUsedRange.from.toISOString()),
        );
      }
      if (filter.lastUsedRange?.to) {
        conditions.push(
          lte(modules.lastUsedAt, filter.lastUsedRange.to.toISOString()),
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
              ? gte(modules[sort.field], cursorData[sort.field])
              : lte(modules[sort.field], cursorData[sort.field]);
          conditions.push(cursorCondition);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      const data = await db.query.modules.findMany({
        where: and(...conditions),
        orderBy:
          sort.direction === "asc"
            ? asc(modules[sort.field])
            : desc(modules[sort.field]),
        limit: limit + 1, // +1 to check if there are more results
        with: {
          // Include relations if needed
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
    .input(getModuleSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { where, include = {} } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const conditions = [eq(modules.brandId, brandId)];

      if (where.moduleId) {
        conditions.push(eq(modules.id, where.moduleId));
      }

      if (where.moduleType) {
        conditions.push(eq(modules.moduleType, where.moduleType));
      }

      if (where.exactStatus) {
        conditions.push(eq(modules.moduleStatus, where.exactStatus));
      }

      if (where.isEnabled !== undefined) {
        conditions.push(eq(modules.enabled, where.isEnabled));
      }

      if (where.isRequired !== undefined) {
        conditions.push(eq(modules.required, where.isRequired));
      }

      if (where.isSystemModule !== undefined) {
        conditions.push(eq(modules.isSystem, where.isSystemModule));
      }

      if (where.exactVersion) {
        conditions.push(eq(modules.version, where.exactVersion));
      }

      if (where.parentModuleId) {
        conditions.push(eq(modules.parentModuleId, where.parentModuleId));
      }

      if (where.primaryLanguageCode) {
        conditions.push(eq(modules.primaryLanguage, where.primaryLanguageCode));
      }

      if (where.complianceImpactExact !== undefined) {
        conditions.push(
          eq(modules.complianceImpact, where.complianceImpactExact),
        );
      }

      if (where.completionWeightExact !== undefined) {
        conditions.push(
          eq(modules.completionWeight, where.completionWeightExact),
        );
      }

      return db.query.modules.findFirst({
        where: and(...conditions),
        with: {
          // Include relations based on include options
        },
      });
    }),

  // Create with brand scoping and completeness calculation
  create: protectedProcedure
    .input(createModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Transform and prepare data for insertion
      const transformedData = transformModuleData(input);

      // Calculate initial completeness score
      const completenessScore = calculateModuleCompleteness({
        name: transformedData.name,
        description: transformedData.description,
        config: transformedData.config,
        fieldDefinitions: transformedData.fieldDefinitions,
        validationRules: transformedData.validationRules,
        displaySettings: transformedData.displaySettings,
      });

      const newModuleData = {
        ...transformedData,
        brandId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationScore: completenessScore,
      };

      // Create the module
      const [newModule] = await db
        .insert(modules)
        .values(newModuleData)
        .returning();

      return {
        data: [newModule],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Partial update with validation
  update: protectedProcedure
    .input(updateModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { id, ...updateData } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      // Check if module exists and belongs to brand
      const existingModule = await db.query.modules.findFirst({
        where: and(eq(modules.id, id), eq(modules.brandId, brandId)),
      });

      if (!existingModule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Module not found or access denied",
        });
      }

      // Transform update data
      const transformedData = transformModuleData(updateData);

      // Recalculate completeness if relevant fields changed
      let completenessScore: number | undefined;
      if (
        transformedData.name ||
        transformedData.description ||
        transformedData.config ||
        transformedData.fieldDefinitions ||
        transformedData.validationRules ||
        transformedData.displaySettings
      ) {
        completenessScore = calculateModuleCompleteness({
          name: transformedData.name || existingModule.name,
          description:
            transformedData.description || existingModule.description,
          config: transformedData.config || existingModule.config,
          fieldDefinitions:
            transformedData.fieldDefinitions || existingModule.fieldDefinitions,
          validationRules:
            transformedData.validationRules || existingModule.validationRules,
          displaySettings:
            transformedData.displaySettings || existingModule.displaySettings,
        });
      }

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
        ...(completenessScore !== undefined && {
          validationScore: completenessScore,
        }),
      };

      const [updatedModule] = await db
        .update(modules)
        .set(finalUpdateData)
        .where(and(eq(modules.id, id), eq(modules.brandId, brandId)))
        .returning();

      return {
        data: [updatedModule],
        affectedCount: 1,
        meta: { completenessScore },
      };
    }),

  // Bulk update with safety guards
  bulkUpdate: protectedProcedure
    .input(bulkUpdateModuleSchema)
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
      const conditions = [eq(modules.brandId, brandId)];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(modules.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        if (selection.filter.moduleTypes) {
          conditions.push(
            inArray(modules.moduleType, selection.filter.moduleTypes),
          );
        }
        if (selection.filter.moduleStatus) {
          conditions.push(
            inArray(modules.moduleStatus, selection.filter.moduleStatus),
          );
        }
        if (selection.filter.enabled !== undefined) {
          conditions.push(eq(modules.enabled, selection.filter.enabled));
        }
        if (selection.filter.required !== undefined) {
          conditions.push(eq(modules.required, selection.filter.required));
        }
        if (selection.filter.isSystem !== undefined) {
          conditions.push(eq(modules.isSystem, selection.filter.isSystem));
        }
        // Add other filter conditions as needed
      }
      // "all" selection uses only brand condition

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(modules)
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
      const transformedData = transformModuleData(updateData);

      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedModules = await db
        .update(modules)
        .set(finalUpdateData)
        .where(and(...conditions))
        .returning();

      return {
        data: updatedModules,
        affectedCount: updatedModules.length,
      };
    }),

  // Soft delete
  delete: protectedProcedure
    .input(
      z.object({
        where: z.object({
          moduleId: z.string().uuid().optional(),
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

      const conditions = [eq(modules.brandId, brandId)];

      if (where.moduleId) {
        conditions.push(eq(modules.id, where.moduleId));
      }
      if (where.ids) {
        conditions.push(inArray(modules.id, where.ids));
      }

      // For now, perform hard delete. In future, could add deletedAt column for soft delete
      const deletedModules = await db
        .delete(modules)
        .where(and(...conditions))
        .returning();

      return {
        data: deletedModules,
        affectedCount: deletedModules.length,
      };
    }),

  // Compute metrics and aggregations
  aggregate: protectedProcedure
    .input(moduleMetricsSchema)
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
      const baseConditions = [eq(modules.brandId, brandId)];

      // Apply filters to base conditions if provided
      if (filter.moduleTypes) {
        baseConditions.push(inArray(modules.moduleType, filter.moduleTypes));
      }

      if (filter.moduleStatus) {
        baseConditions.push(inArray(modules.moduleStatus, filter.moduleStatus));
      }

      if (filter.enabled !== undefined) {
        baseConditions.push(eq(modules.enabled, filter.enabled));
      }

      if (filter.required !== undefined) {
        baseConditions.push(eq(modules.required, filter.required));
      }

      if (filter.isSystem !== undefined) {
        baseConditions.push(eq(modules.isSystem, filter.isSystem));
      }

      // Process each requested metric
      for (const metric of metrics) {
        switch (metric) {
          case "moduleTypeDistribution": {
            const moduleTypeCounts = await db
              .select({
                moduleType: modules.moduleType,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.moduleType);
            results.moduleTypeDistribution = moduleTypeCounts;
            break;
          }

          case "moduleStatusDistribution": {
            const statusCounts = await db
              .select({
                moduleStatus: modules.moduleStatus,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.moduleStatus);
            results.moduleStatusDistribution = statusCounts;
            break;
          }

          case "enablementStatus": {
            const enablementCounts = await db
              .select({
                enabled: modules.enabled,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.enabled);
            results.enablementStatus = enablementCounts;
            break;
          }

          case "systemModuleStats": {
            const systemModuleCounts = await db
              .select({
                isSystem: modules.isSystem,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.isSystem);
            results.systemModuleStats = systemModuleCounts;
            break;
          }

          case "moduleUsageStatistics": {
            const usageStats = await db
              .select({
                totalUsage: count(modules.usageCount),
                averageUsage: count(modules.usageCount), // Would need custom aggregation
                maxUsage: count(modules.usageCount), // Would need custom aggregation
              })
              .from(modules)
              .where(and(...baseConditions));
            results.moduleUsageStatistics = usageStats[0];
            break;
          }

          case "complianceImpactMetrics": {
            const complianceStats = await db
              .select({
                avgComplianceImpact: count(modules.complianceImpact), // Would need AVG aggregation
                maxComplianceImpact: count(modules.complianceImpact), // Would need MAX aggregation
                modules: count(),
              })
              .from(modules)
              .where(
                and(...baseConditions, isNotNull(modules.complianceImpact)),
              );
            results.complianceImpactMetrics = complianceStats[0];
            break;
          }

          case "validationEffectiveness": {
            const validationStats = await db
              .select({
                avgValidationScore: count(modules.validationScore), // Would need AVG aggregation
                modules: count(),
              })
              .from(modules)
              .where(
                and(...baseConditions, isNotNull(modules.validationScore)),
              );
            results.validationEffectiveness = validationStats[0];
            break;
          }

          case "completionWeightDistribution": {
            const weightCounts = await db
              .select({
                completionWeight: modules.completionWeight,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.completionWeight);
            results.completionWeightDistribution = weightCounts;
            break;
          }

          case "versionDistribution": {
            const versionCounts = await db
              .select({
                version: modules.version,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.version);
            results.versionDistribution = versionCounts;
            break;
          }

          case "languageDistribution": {
            const languageCounts = await db
              .select({
                primaryLanguage: modules.primaryLanguage,
                count: count(),
              })
              .from(modules)
              .where(and(...baseConditions))
              .groupBy(modules.primaryLanguage);
            results.languageDistribution = languageCounts;
            break;
          }

          case "dependencyAnalysis": {
            const dependencyCounts = await db
              .select({
                hasDependencies: count(),
                noDependencies: count(),
              })
              .from(modules)
              .where(and(...baseConditions));
            results.dependencyAnalysis = dependencyCounts[0];
            break;
          }

          case "templateUtilization": {
            // Track template usage of modules
            const templateUtilizationStats = await db
              .select({
                moduleId: modules.id,
                moduleName: modules.name,
                moduleType: modules.moduleType,
                templateCount: count(templates.id),
                usageCount: modules.usageCount,
              })
              .from(modules)
              .leftJoin(
                templates,
                ilike(templates.moduleIds, `%"${modules.id}"%`),
              )
              .where(and(...baseConditions))
              .groupBy(
                modules.id,
                modules.name,
                modules.moduleType,
                modules.usageCount,
              );
            results.templateUtilization = templateUtilizationStats;
            break;
          }

          case "passportLinkageStats": {
            // Statistics on passport usage of modules via templates
            const passportLinkageStats = await db
              .select({
                moduleId: modules.id,
                moduleName: modules.name,
                moduleType: modules.moduleType,
                linkedTemplates: count(),
                passportCount: count(passports.id),
                avgModuleDataSize: count(), // Would need actual calculation
              })
              .from(modules)
              .leftJoin(
                templates,
                ilike(templates.moduleIds, `%"${modules.id}"%`),
              )
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(and(...baseConditions))
              .groupBy(modules.id, modules.name, modules.moduleType);
            results.passportLinkageStats = passportLinkageStats;
            break;
          }

          case "crossPassportValidationMetrics": {
            // Validation effectiveness based on passport data
            const validationEffectivenessStats = await db
              .select({
                moduleId: modules.id,
                moduleName: modules.name,
                moduleType: modules.moduleType,
                validationScore: modules.validationScore,
                passportCount: count(passports.id),
                avgPassportValidation: count(), // Would need actual average
                effectivenessRating: count(), // Would need calculation based on validation outcomes
              })
              .from(modules)
              .leftJoin(
                templates,
                ilike(templates.moduleIds, `%"${modules.id}"%`),
              )
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(and(...baseConditions, isNotNull(modules.validationScore)))
              .groupBy(
                modules.id,
                modules.name,
                modules.moduleType,
                modules.validationScore,
              );
            results.crossPassportValidationMetrics =
              validationEffectivenessStats;
            break;
          }

          case "crossPassportComplianceMetrics": {
            // Compliance impact based on passport completion
            const complianceImpactStats = await db
              .select({
                moduleId: modules.id,
                moduleName: modules.name,
                moduleType: modules.moduleType,
                complianceImpact: modules.complianceImpact,
                completionWeight: modules.completionWeight,
                passportCount: count(passports.id),
                avgComplianceScore: count(), // Would need actual average
                impactEffectiveness: count(), // Would need calculation based on compliance outcomes
              })
              .from(modules)
              .leftJoin(
                templates,
                ilike(templates.moduleIds, `%"${modules.id}"%`),
              )
              .leftJoin(passports, eq(passports.templateId, templates.id))
              .where(
                and(...baseConditions, isNotNull(modules.complianceImpact)),
              )
              .groupBy(
                modules.id,
                modules.name,
                modules.moduleType,
                modules.complianceImpact,
                modules.completionWeight,
              );
            results.crossPassportComplianceMetrics = complianceImpactStats;
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
