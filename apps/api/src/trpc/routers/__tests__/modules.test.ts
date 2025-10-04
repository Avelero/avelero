import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { modulesRouter } from "../modules";
import { TRPCError } from "@trpc/server";

// Mock the database and schema
const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      leftJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          groupBy: jest.fn(() => Promise.resolve([
            {
              moduleId: "module-1",
              moduleName: "Validation Module",
              moduleType: "validation",
              templateCount: 5,
              usageCount: 12
            },
            {
              moduleId: "module-2",
              moduleName: "Compliance Module",
              moduleType: "compliance",
              templateCount: 3,
              usageCount: 8
            },
          ])),
        })),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
        groupBy: jest.fn(() => Promise.resolve([
          { moduleType: "validation", count: 8 },
          { moduleType: "compliance", count: 5 },
        ])),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{
        id: "test-module-id",
        brandId: "test-brand-id",
        name: "Test Module",
        moduleType: "validation",
        moduleStatus: "draft",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])),
    })),
  })),
  query: {
    modules: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
  },
};

const mockContext = {
  db: mockDb,
  brandId: "test-brand-id",
  user: { id: "test-user-id" },
};

describe("modulesRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("aggregate - cross-passport metrics", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Setup default successful mock responses for aggregate queries
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  moduleId: "module-1",
                  moduleName: "Validation Module",
                  moduleType: "validation",
                  templateCount: 5,
                  passportCount: 25,
                  avgPassportValidation: 80
                },
                {
                  moduleId: "module-2",
                  moduleName: "Compliance Module",
                  moduleType: "compliance",
                  templateCount: 3,
                  passportCount: 15,
                  avgPassportValidation: 75
                },
              ])),
            })),
          })),
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { moduleType: "validation", count: 8 },
              { moduleType: "compliance", count: 5 },
            ])),
          })),
        })),
      }));
    });

    it("should require brand context", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };
      const caller = modulesRouter.createCaller(contextWithoutBrand);
      await expect(
        caller.aggregate({
          metrics: ["templateUtilization"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return template utilization stats", async () => {
      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["templateUtilization"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.templateUtilization).toBeDefined();
      expect(Array.isArray(result.metrics.templateUtilization)).toBe(true);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["templateUtilization"]);
    });

    it("should return passport linkage stats", async () => {
      // Mock for passportLinkageStats query
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  moduleId: "module-1",
                  moduleName: "Validation Module",
                  moduleType: "validation",
                  linkedTemplates: 5,
                  passportCount: 25,
                  avgModuleDataSize: 1024
                }
              ])),
            })),
          })),
        })),
      }));

      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
      });

      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(Array.isArray(result.metrics.passportLinkageStats)).toBe(true);
      expect(result.metrics.passportLinkageStats[0]).toHaveProperty("moduleId");
      expect(result.metrics.passportLinkageStats[0]).toHaveProperty("passportCount");
    });

    it("should return cross-passport validation metrics", async () => {
      // Mock for crossPassportValidationMetrics query
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  moduleId: "module-1",
                  moduleName: "Validation Module",
                  moduleType: "validation",
                  validationScore: 85,
                  passportCount: 25,
                  avgPassportValidation: 80,
                  effectivenessRating: 90
                }
              ])),
            })),
          })),
        })),
      }));

      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["crossPassportValidationMetrics"],
      });

      expect(result.metrics.crossPassportValidationMetrics).toBeDefined();
      expect(Array.isArray(result.metrics.crossPassportValidationMetrics)).toBe(true);
      expect(result.metrics.crossPassportValidationMetrics[0]).toHaveProperty("moduleId");
      expect(result.metrics.crossPassportValidationMetrics[0]).toHaveProperty("validationScore");
      expect(result.metrics.crossPassportValidationMetrics[0]).toHaveProperty("passportCount");
    });

    it("should return cross-passport compliance metrics", async () => {
      // Mock for crossPassportComplianceMetrics query
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  moduleId: "module-2",
                  moduleName: "Compliance Module",
                  moduleType: "compliance",
                  complianceImpact: 8,
                  completionWeight: 3,
                  passportCount: 15,
                  avgComplianceScore: 85,
                  impactEffectiveness: 92
                }
              ])),
            })),
          })),
        })),
      }));

      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["crossPassportComplianceMetrics"],
      });

      expect(result.metrics.crossPassportComplianceMetrics).toBeDefined();
      expect(Array.isArray(result.metrics.crossPassportComplianceMetrics)).toBe(true);
      expect(result.metrics.crossPassportComplianceMetrics[0]).toHaveProperty("moduleId");
      expect(result.metrics.crossPassportComplianceMetrics[0]).toHaveProperty("complianceImpact");
      expect(result.metrics.crossPassportComplianceMetrics[0]).toHaveProperty("passportCount");
    });

    it("should handle multiple cross-passport metrics in single request", async () => {
      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["templateUtilization", "passportLinkageStats"],
      });

      expect(result.metrics.templateUtilization).toBeDefined();
      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
    });

    it("should apply filters when provided", async () => {
      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        filter: {
          moduleTypes: ["validation"],
          enabled: true,
        },
        metrics: ["crossPassportValidationMetrics"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.crossPassportValidationMetrics).toBeDefined();
    });

    it("should handle unknown metrics gracefully", async () => {
      const caller = modulesRouter.createCaller(mockContext);
      // @ts-expect-error - Testing unknown metric handling
      const result = await caller.aggregate({
        metrics: ["unknownMetric"],
      });
      expect(result.metrics.unknownMetric).toEqual([]);
    });

    it("should validate input structure", async () => {
      const caller = modulesRouter.createCaller(mockContext);

      // Test invalid metrics type
      await expect(
        // @ts-expect-error - Testing invalid input validation
        caller.aggregate({
          metrics: "invalid",
        })
      ).rejects.toThrow();

      // Test empty metrics array
      await expect(
        caller.aggregate({
          metrics: [],
        })
      ).rejects.toThrow();
    });

    it("should include proper meta information for cross-passport metrics", async () => {
      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["crossPassportValidationMetrics"],
        filter: { moduleTypes: ["validation"] },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["crossPassportValidationMetrics"]);
      expect(result.meta.filtersApplied).toBe(true);
    });

    it("should handle edge case with no passport data", async () => {
      // Mock empty results
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      }));

      const caller = modulesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
      });

      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(Array.isArray(result.metrics.passportLinkageStats)).toBe(true);
      expect(result.metrics.passportLinkageStats).toHaveLength(0);
    });
  });
});