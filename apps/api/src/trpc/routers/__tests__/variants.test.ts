const { describe, it, expect, beforeEach, jest } = require("@jest/globals");
const { variantsRouter } = require("../variants");
const { TRPCError } = require("@trpc/server");

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
        id: "test-variant-id",
        brandId: "test-brand-id",
        productId: "test-product-id",
        name: "Test Variant",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])),
    })),
  })),
  query: {
    productVariants: {
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

describe("variantsRouter - Analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("aggregate endpoint - new analytics metrics", () => {
    it("should require brand context", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };
      const caller = variantsRouter.createCaller(contextWithoutBrand);

      await expect(
        caller.aggregate({
          metrics: ["passportLinkageStats"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return passport linkage statistics", async () => {
      // Mock passport linkage statistics data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  totalVariants: 100,
                  variantsWithPassports: 85,
                  variantsWithoutPassports: 15,
                  passportCoveragePercentage: 85.0,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(result.metrics.passportLinkageStats.totalVariants).toBe(100);
      expect(result.metrics.passportLinkageStats.variantsWithPassports).toBe(85);
      expect(result.metrics.passportLinkageStats.passportCoveragePercentage).toBe(85.0);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
    });

    it("should return category distribution", async () => {
      // Mock category distribution data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              groupBy: jest.fn(() => Promise.resolve([
                {
                  categoryId: "cat-1",
                  categoryName: "Electronics",
                  variantCount: 45,
                  variantsWithPassports: 38,
                  passportCoveragePercentage: 84.4,
                },
                {
                  categoryId: "cat-2",
                  categoryName: "Clothing",
                  variantCount: 32,
                  variantsWithPassports: 28,
                  passportCoveragePercentage: 87.5,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["categoryDistribution"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.categoryDistribution).toBeDefined();
      expect(Array.isArray(result.metrics.categoryDistribution)).toBe(true);
      expect(result.metrics.categoryDistribution).toHaveLength(2);
      expect(result.metrics.categoryDistribution[0].categoryName).toBe("Electronics");
      expect(result.metrics.categoryDistribution[0].variantCount).toBe(45);
      expect(result.metrics.categoryDistribution[1].passportCoveragePercentage).toBe(87.5);
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
                    totalVariants: 100,
                    variantsWithPassports: 85,
                    variantsWithoutPassports: 15,
                    passportCoveragePercentage: 85.0,
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
                    variantCount: 45,
                    variantsWithPassports: 38,
                    passportCoveragePercentage: 84.4,
                  },
                ])),
              })),
            })),
          })),
        });

      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportLinkageStats", "categoryDistribution"],
      });

      expect(result.metrics.passportLinkageStats).toBeDefined();
      expect(result.metrics.categoryDistribution).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
      expect(result.meta.requestedMetrics).toContain("passportLinkageStats");
      expect(result.meta.requestedMetrics).toContain("categoryDistribution");
    });

    it("should apply filters when provided", async () => {
      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        filter: {
          productIds: ["product-1", "product-2"],
          enabled: true,
        },
        metrics: ["passportLinkageStats"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.passportLinkageStats).toBeDefined();
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

      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportLinkageStats", "categoryDistribution"],
      });

      expect(result.metrics.passportLinkageStats).toEqual({
        totalVariants: 0,
        variantsWithPassports: 0,
        variantsWithoutPassports: 0,
        passportCoveragePercentage: 0,
      });
      expect(result.metrics.categoryDistribution).toEqual([]);
    });

    it("should validate input schema for new metrics", async () => {
      const caller = variantsRouter.createCaller(mockContext);

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
      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportLinkageStats"],
        filter: { enabled: true },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.requestedMetrics).toEqual(["passportLinkageStats"]);
      expect(result.meta.filtersApplied).toBe(true);
    });
  });

  describe("existing aggregate metrics compatibility", () => {
    it("should still support existing statusDistribution metric", async () => {
      // Mock existing metric data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { status: "active", count: 15 },
              { status: "inactive", count: 5 },
            ])),
          })),
        })),
      }));

      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["statusDistribution"],
      });

      expect(result.metrics.statusDistribution).toBeDefined();
      expect(Array.isArray(result.metrics.statusDistribution)).toBe(true);
    });

    it("should support mixing old and new metrics", async () => {
      const caller = variantsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["statusDistribution", "passportLinkageStats"],
      });

      expect(result.metrics.statusDistribution).toBeDefined();
      expect(result.metrics.passportLinkageStats).toBeDefined();
    });
  });
});