import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { categoriesRouter } from "../categories";
import { TRPCError } from "@trpc/server";

// Mock the database and schema
const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
        groupBy: jest.fn(() => Promise.resolve([])),
      })),
      leftJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([])),
          })),
          groupBy: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{
        id: "test-category-id",
        brandId: "test-brand-id",
        name: "Test Category",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])),
    })),
  })),
  query: {
    categories: {
      findMany: jest.fn(() => Promise.resolve([])),
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
  },
};

const mockContext = {
  db: mockDb,
  brandId: "test-brand-id",
  user: { id: "test-user-id" },
};

describe("categoriesRouter - Analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("aggregate endpoint - new analytics metrics", () => {
    it("should require brand context", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };
      const caller = categoriesRouter.createCaller(contextWithoutBrand);

      await expect(
        caller.aggregate({
          metrics: ["variantAnalytics"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return variant analytics", async () => {
      // Mock variant analytics data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  categoryId: "cat-1",
                  categoryName: "Electronics",
                  categoryPath: "Electronics",
                  totalProducts: 25,
                  totalVariants: 45,
                  productsWithVariants: 20,
                  variantCoveragePercentage: 80.0,
                  avgVariantsPerProduct: 1.8,
                },
                {
                  categoryId: "cat-2",
                  categoryName: "Clothing",
                  categoryPath: "Fashion > Clothing",
                  totalProducts: 30,
                  totalVariants: 65,
                  productsWithVariants: 25,
                  variantCoveragePercentage: 83.3,
                  avgVariantsPerProduct: 2.17,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["variantAnalytics"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.variantAnalytics).toBeDefined();
      expect(Array.isArray(result.metrics.variantAnalytics)).toBe(true);
      expect(result.metrics.variantAnalytics).toHaveLength(2);
      expect(result.metrics.variantAnalytics[0].categoryName).toBe("Electronics");
      expect(result.metrics.variantAnalytics[0].variantCoveragePercentage).toBe(80.0);
      expect(result.metrics.variantAnalytics[1].avgVariantsPerProduct).toBe(2.17);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
    });

    it("should return passport coverage", async () => {
      // Mock passport coverage data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  categoryId: "cat-1",
                  categoryName: "Electronics",
                  categoryPath: "Electronics",
                  totalProducts: 25,
                  totalVariants: 45,
                  variantsWithPassports: 38,
                  passportCoveragePercentage: 84.4,
                  passportCompleteness: 85.2,
                },
                {
                  categoryId: "cat-2",
                  categoryName: "Clothing",
                  categoryPath: "Fashion > Clothing",
                  totalProducts: 30,
                  totalVariants: 65,
                  variantsWithPassports: 52,
                  passportCoveragePercentage: 80.0,
                  passportCompleteness: 78.5,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportCoverage"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.passportCoverage).toBeDefined();
      expect(Array.isArray(result.metrics.passportCoverage)).toBe(true);
      expect(result.metrics.passportCoverage).toHaveLength(2);
      expect(result.metrics.passportCoverage[0].categoryName).toBe("Electronics");
      expect(result.metrics.passportCoverage[0].passportCoveragePercentage).toBe(84.4);
      expect(result.metrics.passportCoverage[1].passportCompleteness).toBe(78.5);
    });

    it("should handle multiple new metrics in single request", async () => {
      // Mock both metrics
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => Promise.resolve([
                  {
                    categoryId: "cat-1",
                    categoryName: "Electronics",
                    categoryPath: "Electronics",
                    totalProducts: 25,
                    totalVariants: 45,
                    productsWithVariants: 20,
                    variantCoveragePercentage: 80.0,
                    avgVariantsPerProduct: 1.8,
                  },
                ])),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => Promise.resolve([
                  {
                    categoryId: "cat-1",
                    categoryName: "Electronics",
                    categoryPath: "Electronics",
                    totalProducts: 25,
                    totalVariants: 45,
                    variantsWithPassports: 38,
                    passportCoveragePercentage: 84.4,
                    passportCompleteness: 85.2,
                  },
                ])),
              })),
            })),
          })),
        });

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["variantAnalytics", "passportCoverage"],
      });

      expect(result.metrics.variantAnalytics).toBeDefined();
      expect(result.metrics.passportCoverage).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
      expect(result.meta.requestedMetrics).toContain("variantAnalytics");
      expect(result.meta.requestedMetrics).toContain("passportCoverage");
    });

    it("should apply filters when provided", async () => {
      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        filter: {
          search: "Electronics",
          rootOnly: false,
          hasProducts: true,
        },
        metrics: ["variantAnalytics"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.variantAnalytics).toBeDefined();
    });

    it("should handle empty results gracefully", async () => {
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

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["variantAnalytics", "passportCoverage"],
      });

      expect(result.metrics.variantAnalytics).toEqual([]);
      expect(result.metrics.passportCoverage).toEqual([]);
    });

    it("should validate input schema for new metrics", async () => {
      const caller = categoriesRouter.createCaller(mockContext);

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

      // Test unknown metric (should be handled gracefully)
      const result = await caller.aggregate({
        // @ts-expect-error - Testing unknown metric handling
        metrics: ["unknownMetric"],
      });
      expect(result.metrics.unknownMetric).toEqual([]);
    });

    it("should include proper meta information", async () => {
      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportCoverage"],
        filter: { hasProducts: true },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["passportCoverage"]);
      expect(result.meta.filtersApplied).toBe(true);
    });
  });

  describe("existing aggregate metrics compatibility", () => {
    it("should still support existing hierarchyDistribution metric", async () => {
      // Mock existing metric data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { depth: 0, count: 5 },
              { depth: 1, count: 15 },
              { depth: 2, count: 25 },
            ])),
          })),
        })),
      }));

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["hierarchyDistribution"],
      });

      expect(result.metrics.hierarchyDistribution).toBeDefined();
      expect(Array.isArray(result.metrics.hierarchyDistribution)).toBe(true);
    });

    it("should support mixing old and new metrics", async () => {
      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["hierarchyDistribution", "variantAnalytics"],
      });

      expect(result.metrics.hierarchyDistribution).toBeDefined();
      expect(result.metrics.variantAnalytics).toBeDefined();
    });
  });

  describe("hierarchical category support", () => {
    it("should handle hierarchical paths in variant analytics", async () => {
      // Mock hierarchical category data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  categoryId: "cat-1",
                  categoryName: "Electronics",
                  categoryPath: "Electronics",
                  totalProducts: 25,
                  totalVariants: 45,
                  productsWithVariants: 20,
                  variantCoveragePercentage: 80.0,
                  avgVariantsPerProduct: 1.8,
                },
                {
                  categoryId: "cat-2",
                  categoryName: "Smartphones",
                  categoryPath: "Electronics > Smartphones",
                  totalProducts: 15,
                  totalVariants: 30,
                  productsWithVariants: 12,
                  variantCoveragePercentage: 80.0,
                  avgVariantsPerProduct: 2.0,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = categoriesRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["variantAnalytics"],
      });

      expect(result.metrics.variantAnalytics).toHaveLength(2);
      expect(result.metrics.variantAnalytics[0].categoryPath).toBe("Electronics");
      expect(result.metrics.variantAnalytics[1].categoryPath).toBe("Electronics > Smartphones");
    });
  });
});