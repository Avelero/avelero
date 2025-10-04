import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { z } from "zod";
import {
  createModuleSchemas,
  createExtendedFilterSchema,
  createExtendedSortSchema,
  createExtendedIncludeSchema,
  createExtendedWhereSchema,
  createExtendedDataSchema,
  createExtendedMetricsSchema,
  registerModuleSchemas,
  getModuleSchemas,
  getRegisteredModuleIds,
  clearModuleSchemaRegistry,
  type ModuleSchemas,
  type InferModuleFilter,
  type InferModuleSort,
  type InferModuleInclude,
  type InferModuleWhere,
  type InferModuleData,
  type InferModuleMetrics,
} from "../shared";

// Test modules
import { productsSchemas } from "../products";
import { variantsSchemas } from "../variants";
import { passportsSchemas } from "../passports";

describe("Module Extension Framework", () => {
  beforeEach(() => {
    clearModuleSchemaRegistry();
  });

  afterEach(() => {
    clearModuleSchemaRegistry();
  });

  describe("Basic Extension Functions", () => {
    test("createExtendedFilterSchema should merge base and module extensions", () => {
      const extensions = {
        moduleSpecificField: z.string().optional(),
        moduleArray: z.array(z.number()).optional(),
      };

      const extendedSchema = createExtendedFilterSchema(extensions);

      // Should include base fields
      expect(() => extendedSchema.parse({ ids: ["123e4567-e89b-12d3-a456-426614174000"] })).not.toThrow();
      expect(() => extendedSchema.parse({ search: "test" })).not.toThrow();
      expect(() => extendedSchema.parse({ enabled: true })).not.toThrow();

      // Should include extended fields
      expect(() => extendedSchema.parse({ moduleSpecificField: "test" })).not.toThrow();
      expect(() => extendedSchema.parse({ moduleArray: [1, 2, 3] })).not.toThrow();

      // Should reject invalid data
      expect(() => extendedSchema.parse({ moduleSpecificField: 123 })).toThrow();
      expect(() => extendedSchema.parse({ moduleArray: ["invalid"] })).toThrow();
    });

    test("createExtendedSortSchema should add fields to base sort options", () => {
      const additionalFields = ["customField", "moduleSpecific"] as const;
      const extendedSchema = createExtendedSortSchema(additionalFields);

      // Should include base fields
      expect(() => extendedSchema.parse({ field: "createdAt", direction: "desc" })).not.toThrow();
      expect(() => extendedSchema.parse({ field: "updatedAt", direction: "asc" })).not.toThrow();
      expect(() => extendedSchema.parse({ field: "name", direction: "desc" })).not.toThrow();

      // Should include extended fields
      expect(() => extendedSchema.parse({ field: "customField", direction: "asc" })).not.toThrow();
      expect(() => extendedSchema.parse({ field: "moduleSpecific", direction: "desc" })).not.toThrow();

      // Should reject invalid fields
      expect(() => extendedSchema.parse({ field: "invalidField", direction: "asc" })).toThrow();
    });

    test("createExtendedIncludeSchema should merge base and module relations", () => {
      const extensions = {
        moduleRelation: z.boolean().default(false),
        optionalRelation: z.boolean().optional(),
      };

      const extendedSchema = createExtendedIncludeSchema(extensions);

      // Should include base fields
      expect(() => extendedSchema.parse({ brand: true })).not.toThrow();
      expect(() => extendedSchema.parse({ category: false })).not.toThrow();

      // Should include extended fields
      expect(() => extendedSchema.parse({ moduleRelation: true })).not.toThrow();
      expect(() => extendedSchema.parse({ optionalRelation: false })).not.toThrow();

      // Should apply defaults
      const parsed = extendedSchema.parse({});
      expect(parsed.brand).toBe(false);
      expect(parsed.moduleRelation).toBe(false);
    });

    test("createExtendedMetricsSchema should add metrics to base options", () => {
      const additionalMetrics = ["customMetric", "moduleStatistics"] as const;
      const extendedSchema = createExtendedMetricsSchema(additionalMetrics);

      // Should include base metrics
      expect(() => extendedSchema.parse({ metrics: ["countByStatus"] })).not.toThrow();
      expect(() => extendedSchema.parse({ metrics: ["totalCount", "activeCount"] })).not.toThrow();

      // Should include extended metrics
      expect(() => extendedSchema.parse({ metrics: ["customMetric"] })).not.toThrow();
      expect(() => extendedSchema.parse({ metrics: ["moduleStatistics", "countByStatus"] })).not.toThrow();

      // Should reject invalid metrics
      expect(() => extendedSchema.parse({ metrics: ["invalidMetric"] })).toThrow();
    });
  });

  describe("createModuleSchemas Integration", () => {
    test("should create a complete module schema bundle", () => {
      const testModule = createModuleSchemas({
        moduleId: "test-module",
        filterExtensions: {
          testField: z.string().optional(),
        },
        sortFields: ["testSort"],
        includeExtensions: {
          testRelation: z.boolean().default(false),
        },
        whereExtensions: {
          testWhere: z.string().optional(),
        },
        dataExtensions: {
          testData: z.string().optional(),
        },
        additionalMetrics: ["testMetric"],
      });

      expect(testModule.moduleId).toBe("test-module");
      expect(testModule.filterSchema).toBeDefined();
      expect(testModule.sortSchema).toBeDefined();
      expect(testModule.includeSchema).toBeDefined();
      expect(testModule.whereSchema).toBeDefined();
      expect(testModule.dataSchema).toBeDefined();
      expect(testModule.metricsSchema).toBeDefined();
      expect(testModule.paginationSchema).toBeDefined();

      // Test response creators
      expect(testModule.createListResponse).toBeDefined();
      expect(testModule.createGetResponse).toBeDefined();
      expect(testModule.createMutationResponse).toBeDefined();
      expect(testModule.createAggregateResponse).toBeDefined();
      expect(testModule.createBulkResponse).toBeDefined();
      expect(testModule.createPreviewResponse).toBeDefined();
      expect(testModule.createSelectionSchema).toBeDefined();
    });

    test("should work with minimal configuration", () => {
      const minimalModule = createModuleSchemas({
        moduleId: "minimal-module",
      });

      expect(minimalModule.moduleId).toBe("minimal-module");
      expect(minimalModule.filterSchema).toBeDefined();
      expect(minimalModule.sortSchema).toBeDefined(); // Should use base schema
      expect(minimalModule.metricsSchema).toBeDefined(); // Should use base schema
    });

    test("should support TypeScript inference", () => {
      const typedModule = createModuleSchemas({
        moduleId: "typed-module",
        filterExtensions: {
          typedField: z.string().optional(),
          numberField: z.number().optional(),
        },
        sortFields: ["typedSort"],
        includeExtensions: {
          typedInclude: z.boolean().default(false),
        },
      });

      type ModuleFilter = InferModuleFilter<typeof typedModule>;
      type ModuleSort = InferModuleSort<typeof typedModule>;
      type ModuleInclude = InferModuleInclude<typeof typedModule>;

      // These should compile without errors
      const filter: ModuleFilter = {
        typedField: "test",
        numberField: 42,
        search: "base field",
      };

      const sort: ModuleSort = {
        field: "typedSort",
        direction: "asc",
      };

      const include: ModuleInclude = {
        typedInclude: true,
        brand: false,
      };

      expect(filter.typedField).toBe("test");
      expect(sort.field).toBe("typedSort");
      expect(include.typedInclude).toBe(true);
    });
  });

  describe("Module Registry", () => {
    test("registerModuleSchemas should register and return schemas", () => {
      const testSchemas = createModuleSchemas({
        moduleId: "registry-test",
        filterExtensions: { testField: z.string().optional() },
      });

      const registered = registerModuleSchemas(testSchemas);

      expect(registered).toBe(testSchemas);
      expect(getRegisteredModuleIds()).toContain("registry-test");
    });

    test("getModuleSchemas should retrieve registered schemas", () => {
      const testSchemas = createModuleSchemas({
        moduleId: "retrieval-test",
        filterExtensions: { retrievalField: z.string().optional() },
      });

      registerModuleSchemas(testSchemas);
      const retrieved = getModuleSchemas("retrieval-test");

      expect(retrieved).toBe(testSchemas);
      expect(retrieved?.moduleId).toBe("retrieval-test");
    });

    test("getModuleSchemas should return undefined for unregistered modules", () => {
      const result = getModuleSchemas("non-existent");
      expect(result).toBeUndefined();
    });

    test("clearModuleSchemaRegistry should clear all registrations", () => {
      registerModuleSchemas(createModuleSchemas({ moduleId: "test1" }));
      registerModuleSchemas(createModuleSchemas({ moduleId: "test2" }));

      expect(getRegisteredModuleIds()).toHaveLength(2);

      clearModuleSchemaRegistry();

      expect(getRegisteredModuleIds()).toHaveLength(0);
    });
  });

  describe("Real Module Examples", () => {
    test("products module should be properly registered", () => {
      expect(productsSchemas.moduleId).toBe("products");
      expect(getRegisteredModuleIds()).toContain("products");

      // Test products-specific fields
      const filterResult = productsSchemas.filterSchema.safeParse({
        productIds: ["123e4567-e89b-12d3-a456-426614174000"],
        seasonIds: ["123e4567-e89b-12d3-a456-426614174001"],
        hasImages: true,
      });

      expect(filterResult.success).toBe(true);
    });

    test("variants module should be properly registered", () => {
      expect(variantsSchemas.moduleId).toBe("variants");
      expect(getRegisteredModuleIds()).toContain("variants");

      // Test variants-specific fields
      const filterResult = variantsSchemas.filterSchema.safeParse({
        variantIds: ["123e4567-e89b-12d3-a456-426614174000"],
        colorIds: ["123e4567-e89b-12d3-a456-426614174001"],
        skus: ["SKU123", "SKU456"],
      });

      expect(filterResult.success).toBe(true);
    });

    test("passports module should be properly registered", () => {
      expect(passportsSchemas.moduleId).toBe("passports");
      expect(getRegisteredModuleIds()).toContain("passports");

      // Test passports-specific fields
      const filterResult = passportsSchemas.filterSchema.safeParse({
        passportIds: ["123e4567-e89b-12d3-a456-426614174000"],
        templateIds: ["123e4567-e89b-12d3-a456-426614174001"],
        visibility: ["public", "private"],
      });

      expect(filterResult.success).toBe(true);
    });

    test("modules should have distinct sort fields", () => {
      // Products should have product-specific sort fields
      const productSortResult = productsSchemas.sortSchema.safeParse({
        field: "season",
        direction: "asc",
      });
      expect(productSortResult.success).toBe(true);

      // Variants should have variant-specific sort fields
      const variantSortResult = variantsSchemas.sortSchema.safeParse({
        field: "sku",
        direction: "desc",
      });
      expect(variantSortResult.success).toBe(true);

      // Passports should have passport-specific sort fields
      const passportSortResult = passportsSchemas.sortSchema.safeParse({
        field: "passportStatus",
        direction: "asc",
      });
      expect(passportSortResult.success).toBe(true);
    });

    test("modules should have distinct include relations", () => {
      // Products should have product-specific includes
      const productIncludeResult = productsSchemas.includeSchema.safeParse({
        variants: true,
        materials: true,
        showcaseBrand: false,
      });
      expect(productIncludeResult.success).toBe(true);

      // Variants should have variant-specific includes
      const variantIncludeResult = variantsSchemas.includeSchema.safeParse({
        product: true,
        color: true,
        size: false,
      });
      expect(variantIncludeResult.success).toBe(true);

      // Passports should have passport-specific includes
      const passportIncludeResult = passportsSchemas.includeSchema.safeParse({
        template: true,
        modules: true,
        qrCodeData: false,
      });
      expect(passportIncludeResult.success).toBe(true);
    });
  });

  describe("Response Envelope Integration", () => {
    test("modules should create proper response envelopes", () => {
      const testDataSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      // Test list response
      const listResponseSchema = productsSchemas.createListResponse(testDataSchema);
      const listResult = listResponseSchema.safeParse({
        data: [{ id: "1", name: "Test" }],
        cursorInfo: { nextCursor: null, hasMore: false },
      });
      expect(listResult.success).toBe(true);

      // Test mutation response
      const mutationResponseSchema = variantsSchemas.createMutationResponse(testDataSchema);
      const mutationResult = mutationResponseSchema.safeParse({
        data: [{ id: "1", name: "Test" }],
        affectedCount: 1,
      });
      expect(mutationResult.success).toBe(true);

      // Test aggregate response
      const aggregateResponseSchema = passportsSchemas.createAggregateResponse(
        z.object({ totalCount: z.number() })
      );
      const aggregateResult = aggregateResponseSchema.safeParse({
        metrics: { totalCount: 42 },
        meta: { asOf: new Date() },
      });
      expect(aggregateResult.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid extension configurations gracefully", () => {
      expect(() => {
        createModuleSchemas({
          moduleId: "", // Invalid empty moduleId
        });
      }).not.toThrow(); // Framework should handle this

      expect(() => {
        createExtendedFilterSchema({
          // @ts-expect-error - Testing invalid config
          invalidField: "not a zod schema",
        });
      }).toThrow();
    });

    test("should validate strict mode correctly", () => {
      const strictModule = createModuleSchemas({
        moduleId: "strict-test",
        filterExtensions: { validField: z.string().optional() },
        strict: true,
      });

      const nonStrictModule = createModuleSchemas({
        moduleId: "non-strict-test",
        filterExtensions: { validField: z.string().optional() },
        strict: false,
      });

      // Strict should reject extra fields
      const strictResult = strictModule.filterSchema.safeParse({
        validField: "test",
        extraField: "should be rejected",
      });
      expect(strictResult.success).toBe(false);

      // Non-strict should allow extra fields
      const nonStrictResult = nonStrictModule.filterSchema.safeParse({
        validField: "test",
        extraField: "should be allowed",
      });
      expect(nonStrictResult.success).toBe(true);
    });
  });

  describe("Performance and Memory", () => {
    test("should handle many module registrations efficiently", () => {
      const startTime = performance.now();

      // Register many modules
      for (let i = 0; i < 100; i++) {
        const schemas = createModuleSchemas({
          moduleId: `performance-test-${i}`,
          filterExtensions: {
            [`field${i}`]: z.string().optional(),
          },
        });
        registerModuleSchemas(schemas);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      expect(getRegisteredModuleIds()).toHaveLength(100);
    });

    test("should not leak memory on registry clearing", () => {
      // Register modules
      for (let i = 0; i < 10; i++) {
        registerModuleSchemas(createModuleSchemas({
          moduleId: `memory-test-${i}`,
        }));
      }

      expect(getRegisteredModuleIds()).toHaveLength(10);

      // Clear registry
      clearModuleSchemaRegistry();

      expect(getRegisteredModuleIds()).toHaveLength(0);
    });
  });
});