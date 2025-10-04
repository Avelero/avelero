import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { analyticsRouter } from "../analytics";
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
  })),
};

const mockContext = {
  db: mockDb,
  brandId: "test-brand-id",
  user: { id: "test-user-id" },
};

describe("analyticsRouter - Cross-Module Analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("aggregate endpoint", () => {
    it("should require brand context", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };
      const caller = analyticsRouter.createCaller(contextWithoutBrand);

      await expect(
        caller.aggregate({
          metrics: ["overallHealth"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return overall health metrics", async () => {
      // Mock overall health data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([
              {
                totalCategories: 25,
                totalProducts: 150,
                totalVariants: 300,
                totalPassports: 240,
                categoryUtilization: 80.0,
                productVariantCoverage: 75.0,
                passportCoverage: 80.0,
                overallCompleteness: 78.5,
              },
            ])),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["overallHealth"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.overallHealth).toBeDefined();
      expect(result.metrics.overallHealth.totalCategories).toBe(25);
      expect(result.metrics.overallHealth.totalProducts).toBe(150);
      expect(result.metrics.overallHealth.passportCoverage).toBe(80.0);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
    });

    it("should return category-variant-passport flow", async () => {
      // Mock flow data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => Promise.resolve([
                  {
                    categoryId: "cat-1",
                    categoryName: "Electronics",
                    categoryPath: "Electronics",
                    productsInCategory: 25,
                    variantsInCategory: 45,
                    passportsInCategory: 38,
                    avgVariantsPerProduct: 1.8,
                    passportCoverageInCategory: 84.4,
                  },
                  {
                    categoryId: "cat-2",
                    categoryName: "Clothing",
                    categoryPath: "Fashion > Clothing",
                    productsInCategory: 30,
                    variantsInCategory: 65,
                    passportsInCategory: 52,
                    avgVariantsPerProduct: 2.17,
                    passportCoverageInCategory: 80.0,
                  },
                ])),
              })),
            })),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["categoryVariantPassportFlow"],
      });

      expect(result.metrics.categoryVariantPassportFlow).toBeDefined();
      expect(Array.isArray(result.metrics.categoryVariantPassportFlow)).toBe(true);
      expect(result.metrics.categoryVariantPassportFlow).toHaveLength(2);
      expect(result.metrics.categoryVariantPassportFlow[0].categoryName).toBe("Electronics");
      expect(result.metrics.categoryVariantPassportFlow[1].avgVariantsPerProduct).toBe(2.17);
    });

    it("should return completeness analysis", async () => {
      // Mock completeness data with multiple select calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([
                {
                  stage: "category",
                  totalItems: 25,
                  withNextStage: 22,
                  completionRate: 88.0,
                },
              ])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([
                {
                  stage: "product",
                  totalItems: 150,
                  withNextStage: 120,
                  completionRate: 80.0,
                },
              ])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([
                {
                  stage: "variant",
                  totalItems: 300,
                  withNextStage: 240,
                  completionRate: 80.0,
                },
              ])),
            })),
          })),
        });

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["completenessAnalysis"],
      });

      expect(result.metrics.completenessAnalysis).toBeDefined();
      expect(Array.isArray(result.metrics.completenessAnalysis)).toBe(true);
      expect(result.metrics.completenessAnalysis).toHaveLength(3);
      expect(result.metrics.completenessAnalysis[0].stage).toBe("category");
      expect(result.metrics.completenessAnalysis[1].stage).toBe("product");
      expect(result.metrics.completenessAnalysis[2].stage).toBe("variant");
    });

    it("should return product catalog maturity", async () => {
      // Mock maturity data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([
                {
                  maturityLevel: "basic",
                  description: "Products with basic info only",
                  productCount: 50,
                  percentage: 33.3,
                },
                {
                  maturityLevel: "intermediate",
                  description: "Products with variants but no passports",
                  productCount: 60,
                  percentage: 40.0,
                },
                {
                  maturityLevel: "advanced",
                  description: "Products with variants and passports",
                  productCount: 40,
                  percentage: 26.7,
                },
              ])),
            })),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["productCatalogMaturity"],
      });

      expect(result.metrics.productCatalogMaturity).toBeDefined();
      expect(Array.isArray(result.metrics.productCatalogMaturity)).toBe(true);
      expect(result.metrics.productCatalogMaturity).toHaveLength(3);
      expect(result.metrics.productCatalogMaturity[0].maturityLevel).toBe("basic");
      expect(result.metrics.productCatalogMaturity[2].maturityLevel).toBe("advanced");
    });

    it("should return passport adoption funnel", async () => {
      // Mock funnel data with multiple select calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ count: 300 }])),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([{ count: 240 }])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([{ count: 180 }])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([{ count: 150 }])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([{ count: 120 }])),
            })),
          })),
        });

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportAdoptionFunnel"],
      });

      expect(result.metrics.passportAdoptionFunnel).toBeDefined();
      expect(Array.isArray(result.metrics.passportAdoptionFunnel)).toBe(true);
      expect(result.metrics.passportAdoptionFunnel).toHaveLength(5);
      expect(result.metrics.passportAdoptionFunnel[0].stage).toBe("Total Variants");
      expect(result.metrics.passportAdoptionFunnel[4].stage).toBe("Complete & Public");
    });

    it("should return content gaps", async () => {
      // Mock content gaps data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => Promise.resolve([
                  {
                    categoryId: "cat-1",
                    categoryName: "Electronics",
                    totalProducts: 25,
                    productsWithoutVariants: 5,
                    variantsWithoutPassports: 7,
                    incompletePassports: 10,
                    gapScore: 22,
                  },
                  {
                    categoryId: "cat-2",
                    categoryName: "Clothing",
                    totalProducts: 30,
                    productsWithoutVariants: 3,
                    variantsWithoutPassports: 8,
                    incompletePassports: 12,
                    gapScore: 23,
                  },
                ])),
              })),
            })),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["contentGaps"],
      });

      expect(result.metrics.contentGaps).toBeDefined();
      expect(Array.isArray(result.metrics.contentGaps)).toBe(true);
      expect(result.metrics.contentGaps).toHaveLength(2);
      expect(result.metrics.contentGaps[0].categoryName).toBe("Electronics");
      expect(result.metrics.contentGaps[0].gapScore).toBe(22);
    });

    it("should return top performing categories", async () => {
      // Mock top categories data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve([
                      {
                        categoryId: "cat-1",
                        categoryName: "Electronics",
                        categoryPath: "Electronics",
                        totalProducts: 25,
                        totalVariants: 45,
                        totalPassports: 38,
                        completenessScore: 85.5,
                        variantCoverageRate: 80.0,
                        passportCoverageRate: 84.4,
                        overallScore: 83.3,
                      },
                      {
                        categoryId: "cat-2",
                        categoryName: "Clothing",
                        categoryPath: "Fashion > Clothing",
                        totalProducts: 30,
                        totalVariants: 65,
                        totalPassports: 52,
                        completenessScore: 78.2,
                        variantCoverageRate: 83.3,
                        passportCoverageRate: 80.0,
                        overallScore: 80.5,
                      },
                    ])),
                  })),
                })),
              })),
            })),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["topPerformingCategories"],
      });

      expect(result.metrics.topPerformingCategories).toBeDefined();
      expect(Array.isArray(result.metrics.topPerformingCategories)).toBe(true);
      expect(result.metrics.topPerformingCategories).toHaveLength(2);
      expect(result.metrics.topPerformingCategories[0].overallScore).toBe(83.3);
      expect(result.metrics.topPerformingCategories[1].overallScore).toBe(80.5);
    });

    it("should handle multiple metrics in single request", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["overallHealth", "categoryVariantPassportFlow"],
      });

      expect(result.metrics.overallHealth).toBeDefined();
      expect(result.metrics.categoryVariantPassportFlow).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
    });

    it("should apply filters when provided", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        filter: {
          categoryIds: ["cat-1", "cat-2"],
          dateRange: {
            from: new Date("2023-01-01"),
            to: new Date("2023-12-31"),
          },
        },
        metrics: ["overallHealth"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.overallHealth).toBeDefined();
    });

    it("should handle empty results gracefully", async () => {
      // Mock empty results
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["overallHealth", "categoryVariantPassportFlow"],
      });

      // Each metric should handle empty results appropriately
      expect(result.metrics.overallHealth).toEqual({
        totalCategories: 0,
        totalProducts: 0,
        totalVariants: 0,
        totalPassports: 0,
        categoryUtilization: 0,
        productVariantCoverage: 0,
        passportCoverage: 0,
        overallCompleteness: 0,
      });
      expect(result.metrics.categoryVariantPassportFlow).toEqual([]);
    });

    it("should validate input schema", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

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

    it("should handle unknown metrics gracefully", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

      // @ts-expect-error - Testing unknown metric handling
      const result = await caller.aggregate({
        metrics: ["unknownMetric"],
      });

      expect(result.metrics.unknownMetric).toEqual([]);
    });
  });

  describe("dashboard endpoint", () => {
    it("should require brand context", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };
      const caller = analyticsRouter.createCaller(contextWithoutBrand);

      await expect(caller.dashboard()).rejects.toThrow("Brand context required");
    });

    it("should return comprehensive dashboard metrics", async () => {
      // Mock dashboard data
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => Promise.resolve([
                {
                  totalCategories: 25,
                  totalProducts: 150,
                  totalVariants: 300,
                  totalPassports: 240,
                  categoryUtilization: 80.0,
                  productVariantCoverage: 75.0,
                  passportCoverage: 80.0,
                  overallCompleteness: 78.5,
                },
              ])),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            leftJoin: jest.fn(() => ({
              leftJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  groupBy: jest.fn(() => ({
                    orderBy: jest.fn(() => ({
                      limit: jest.fn(() => Promise.resolve([
                        {
                          categoryId: "cat-1",
                          categoryName: "Electronics",
                          overallScore: 85.0,
                        },
                      ])),
                    })),
                  })),
                })),
              })),
            })),
          })),
        });

      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.dashboard();

      expect(result).toBeDefined();
      expect(result.health).toBeDefined();
      expect(result.health.totalCategories).toBe(25);
      expect(result.health.passportCoverage).toBe(80.0);
      expect(result.topCategories).toBeDefined();
      expect(Array.isArray(result.topCategories)).toBe(true);
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
    });

    it("should include proper meta information", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

      const result = await caller.dashboard();

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("test-brand-id");
      expect(result.meta.cacheKey).toContain("dashboard");
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      mockDb.select = jest.fn(() => {
        throw new Error("Database connection failed");
      });

      const caller = analyticsRouter.createCaller(mockContext);

      await expect(
        caller.aggregate({
          metrics: ["overallHealth"],
        })
      ).rejects.toThrow("Database connection failed");
    });

    it("should validate filter parameters", async () => {
      const caller = analyticsRouter.createCaller(mockContext);

      // Test invalid date range
      await expect(
        caller.aggregate({
          filter: {
            dateRange: {
              from: new Date("2023-12-31"),
              to: new Date("2023-01-01"), // Invalid: from > to
            },
          },
          metrics: ["overallHealth"],
        })
      ).rejects.toThrow();

      // Test invalid category IDs
      await expect(
        caller.aggregate({
          filter: {
            categoryIds: ["invalid-uuid"],
          },
          metrics: ["overallHealth"],
        })
      ).rejects.toThrow();
    });
  });
});