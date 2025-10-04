import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { templatesRouter } from "../templates";
import { TRPCError } from "@trpc/server";

// Mock the database and schema
const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      leftJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          groupBy: jest.fn(() => Promise.resolve([
            { templateId: "template-1", templateName: "Basic Template", passportCount: 15 },
            { templateId: "template-2", templateName: "Advanced Template", passportCount: 8 },
          ])),
        })),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
        groupBy: jest.fn(() => Promise.resolve([
          { templateType: "passport", count: 10 },
          { templateType: "product", count: 5 },
        ])),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{
        id: "test-template-id",
        brandId: "test-brand-id",
        name: "Test Template",
        templateType: "passport",
        templateStatus: "draft",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])),
    })),
  })),
  query: {
    templates: {
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

describe("templatesRouter", () => {
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
                  templateId: "template-1",
                  templateName: "Basic Template",
                  passportCount: 15,
                  avgCompleteness: 75,
                  avgValidationScore: 80
                },
                {
                  templateId: "template-2",
                  templateName: "Advanced Template",
                  passportCount: 8,
                  avgCompleteness: 65,
                  avgValidationScore: 70
                },
              ])),
            })),
          })),
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { templateType: "passport", count: 10 },
              { templateType: "product", count: 5 },
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
      const caller = templatesRouter.createCaller(contextWithoutBrand);
      await expect(
        caller.aggregate({
          metrics: ["moduleUtilization"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return module utilization stats", async () => {
      // Mock for moduleUtilization query
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              {
                templateId: "template-1",
                templateName: "Basic Template",
                moduleIds: ["module-1", "module-2"],
                moduleCount: 2
              },
              {
                templateId: "template-2",
                templateName: "Advanced Template",
                moduleIds: ["module-1", "module-3"],
                moduleCount: 2
              }
            ])),
          })),
        })),
      }));

      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["moduleUtilization"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.moduleUtilization).toBeDefined();
      expect(Array.isArray(result.metrics.moduleUtilization)).toBe(true);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["moduleUtilization"]);
    });

    it("should return passport linkage stats", async () => {
      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
      });

      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(Array.isArray(result.metrics.passportLinkageStats)).toBe(true);
      expect(result.metrics.passportLinkageStats[0]).toHaveProperty("templateId");
      expect(result.metrics.passportLinkageStats[0]).toHaveProperty("passportCount");
    });

    it("should return completion rates by template", async () => {
      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["completionRatesByTemplate"],
      });

      expect(result.metrics.completionRatesByTemplate).toBeDefined();
      expect(Array.isArray(result.metrics.completionRatesByTemplate)).toBe(true);
      expect(result.metrics.completionRatesByTemplate[0]).toHaveProperty("templateId");
      expect(result.metrics.completionRatesByTemplate[0]).toHaveProperty("totalPassports");
    });

    it("should return template effectiveness stats", async () => {
      // Mock for templateEffectiveness query
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  templateId: "template-1",
                  templateName: "Basic Template",
                  templateType: "passport",
                  usageCount: 25,
                  passportCount: 15,
                  avgComplianceScore: 80,
                  avgValidationScore: 85,
                  successRate: 75
                }
              ])),
            })),
          })),
        })),
      }));

      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["templateEffectiveness"],
      });

      expect(result.metrics.templateEffectiveness).toBeDefined();
      expect(Array.isArray(result.metrics.templateEffectiveness)).toBe(true);
      expect(result.metrics.templateEffectiveness[0]).toHaveProperty("templateId");
      expect(result.metrics.templateEffectiveness[0]).toHaveProperty("passportCount");
      expect(result.metrics.templateEffectiveness[0]).toHaveProperty("usageCount");
    });

    it("should handle multiple cross-passport metrics in single request", async () => {
      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["passportLinkageStats", "completionRatesByTemplate"],
      });

      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(result.metrics.completionRatesByTemplate).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
    });

    it("should apply filters when provided", async () => {
      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        filter: {
          templateTypes: ["passport"],
          enabled: true,
        },
        metrics: ["moduleUtilization"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.moduleUtilization).toBeDefined();
    });

    it("should handle unknown metrics gracefully", async () => {
      const caller = templatesRouter.createCaller(mockContext);
      // @ts-expect-error - Testing unknown metric handling
      const result = await caller.aggregate({
        metrics: ["unknownMetric"],
      });
      expect(result.metrics.unknownMetric).toEqual([]);
    });

    it("should validate input structure", async () => {
      const caller = templatesRouter.createCaller(mockContext);

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
      const caller = templatesRouter.createCaller(mockContext);
      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
        filter: { templateTypes: ["passport"] },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["passportLinkageStats"]);
      expect(result.meta.filtersApplied).toBe(true);
    });
  });
});