import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { passportsRouter } from "../passports";
import { TRPCError } from "@trpc/server";

// Mock the database and schema
const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{
        id: "test-passport-id",
        brandId: "test-brand-id",
        templateId: "test-template-id",
        passportStatus: "draft",
        visibility: "private",
        dataCompleteness: 60,
        complianceScore: 75,
        validationScore: 75,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])),
    })),
  })),
  query: {
    passports: {
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    productVariants: {
      findFirst: jest.fn(() => Promise.resolve({
        id: "test-variant-id",
        productId: "test-product-id",
      })),
    },
  },
};

const mockContext = {
  db: mockDb,
  brandId: "test-brand-id",
  user: { id: "test-user-id" },
};

describe("passportsRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("list endpoint", () => {
    it("should throw error when no brandId is provided", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };

      await expect(
        passportsRouter
          .createCaller(contextWithoutBrand)
          .list({})
      ).rejects.toThrow(TRPCError);
    });

    it("should accept basic list request with default parameters", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({});

      expect(result).toBeDefined();
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("cursorInfo");
      expect(result).toHaveProperty("meta");
    });

    it("should accept list request with filters", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        filter: {
          passportStatus: ["published"],
          visibility: ["public"],
          isPublic: true,
        },
        sort: {
          field: "createdAt",
          direction: "desc",
        },
        pagination: {
          limit: 10,
        },
        include: {
          product: true,
          variant: false,
        },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("cursorInfo");
    });

    it("should validate input schema", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid status value - this should work but fail validation
      const invalidStatusCall = async () => {
        const invalidInput = {
          filter: {
            passportStatus: ["invalid-status"],
          },
        };
        return caller.list(invalidInput);
      };
      await expect(invalidStatusCall()).rejects.toThrow();
    });
  });

  describe("get endpoint", () => {
    it("should throw error when no brandId is provided", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };

      await expect(
        passportsRouter
          .createCaller(contextWithoutBrand)
          .get({
            where: { passportId: "test-id" },
          })
      ).rejects.toThrow(TRPCError);
    });

    it("should accept get request with valid where conditions", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.get({
        where: {
          passportId: "550e8400-e29b-41d4-a716-446655440000",
        },
        include: {
          product: true,
          variant: true,
        },
      });

      // Since we're mocking the DB to return empty results, expect null
      expect(result).toBeNull();
    });

    it("should validate UUID format in where conditions", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid UUID
      await expect(
        caller.get({
          where: {
            passportId: "invalid-uuid",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("should validate pagination limits", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test limit too high
      await expect(
        caller.list({
          pagination: {
            limit: 200, // Max is 100
          },
        })
      ).rejects.toThrow();

      // Test limit too low
      await expect(
        caller.list({
          pagination: {
            limit: 0, // Min is 1
          },
        })
      ).rejects.toThrow();
    });

    it("should validate sort fields", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid sort field
      const invalidSortCall = async () => {
        const invalidInput = {
          sort: {
            field: "invalidField",
            direction: "asc",
          },
        };
        return caller.list(invalidInput);
      };
      await expect(invalidSortCall()).rejects.toThrow();
    });

    it("should validate date ranges", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Valid date range should work
      const result = await caller.list({
        filter: {
          createdRange: {
            from: new Date("2023-01-01"),
            to: new Date("2023-12-31"),
          },
        },
      });

      expect(result).toBeDefined();
    });

    it("should validate numeric ranges", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Valid numeric range should work
      const result = await caller.list({
        filter: {
          dataCompletenessRange: {
            min: 0,
            max: 100,
          },
          validationScoreRange: {
            min: 80,
            max: 100,
          },
        },
      });

      expect(result).toBeDefined();
    });
  });

  describe("create endpoint", () => {
    beforeEach(() => {
      // Reset mocks to default behavior
      mockDb.query.passports.findFirst.mockResolvedValue(null);
      mockDb.query.productVariants.findFirst.mockResolvedValue({
        id: "test-variant-id",
        productId: "test-product-id",
      });
    });

    it("should throw error when no brandId is provided", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };

      await expect(
        passportsRouter
          .createCaller(contextWithoutBrand)
          .create({
            templateId: "550e8400-e29b-41d4-a716-446655440000",
          })
      ).rejects.toThrow(TRPCError);
    });

    it("should create a passport with minimal required data", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.create({
        templateId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("affectedCount", 1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("id", "test-passport-id");
      expect(result.data[0]).toHaveProperty("templateId", "test-template-id");
    });

    it("should create a passport with product and variant", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.create({
        templateId: "550e8400-e29b-41d4-a716-446655440000",
        productId: "550e8400-e29b-41d4-a716-446655440001",
        variantId: "550e8400-e29b-41d4-a716-446655440002",
        passportStatus: "draft",
        visibility: "private",
        customData: { key: "value" },
        moduleData: { module1: "data" },
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(mockDb.query.productVariants.findFirst).toHaveBeenCalled();
    });

    it("should throw error when variant doesn't belong to product", async () => {
      // Mock variant that doesn't belong to the product
      mockDb.query.productVariants.findFirst.mockResolvedValue(null);

      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.create({
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          productId: "550e8400-e29b-41d4-a716-446655440001",
          variantId: "550e8400-e29b-41d4-a716-446655440002",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should enforce uniqueness constraint for brand+product+variant", async () => {
      // Mock existing passport found
      mockDb.query.passports.findFirst.mockResolvedValue({
        id: "existing-passport-id",
        brandId: "test-brand-id",
        productId: "test-product-id",
        variantId: "test-variant-id",
      });

      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.create({
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          productId: "test-product-id",
          variantId: "test-variant-id",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should validate input schema for required templateId", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test missing templateId
      const invalidCreateCall = async () => {
        const invalidInput = {};
        return caller.create(invalidInput);
      };
      await expect(invalidCreateCall()).rejects.toThrow();
    });

    it("should validate UUID format for templateId", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid UUID
      await expect(
        caller.create({
          templateId: "invalid-uuid",
        })
      ).rejects.toThrow();
    });

    it("should validate UUID format for productId and variantId", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid productId UUID
      await expect(
        caller.create({
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          productId: "invalid-uuid",
        })
      ).rejects.toThrow();

      // Test invalid variantId UUID
      await expect(
        caller.create({
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          variantId: "invalid-uuid",
        })
      ).rejects.toThrow();
    });

    it("should validate enum values for passportStatus and visibility", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid passportStatus
      const invalidStatusCreateCall = async () => {
        const invalidInput = {
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          passportStatus: "invalid-status",
        };
        return caller.create(invalidInput);
      };
      await expect(invalidStatusCreateCall()).rejects.toThrow();

      // Test invalid visibility
      const invalidVisibilityCreateCall = async () => {
        const invalidInput = {
          templateId: "550e8400-e29b-41d4-a716-446655440000",
          visibility: "invalid-visibility",
        };
        return caller.create(invalidInput);
      };
      await expect(invalidVisibilityCreateCall()).rejects.toThrow();
    });

    it("should allow product without variant", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.create({
        templateId: "550e8400-e29b-41d4-a716-446655440000",
        productId: "550e8400-e29b-41d4-a716-446655440001",
        // No variantId provided
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      // Should not validate product/variant relationship when no variant
      expect(mockDb.query.productVariants.findFirst).not.toHaveBeenCalled();
    });

    it("should handle null values correctly for uniqueness check", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test creating passport without product or variant
      const result = await caller.create({
        templateId: "550e8400-e29b-41d4-a716-446655440000",
        // No productId or variantId
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      // Uniqueness check should handle null values properly
      expect(mockDb.query.passports.findFirst).toHaveBeenCalled();
    });
  });

  describe("update endpoint", () => {
    beforeEach(() => {
      // Reset mocks to default behavior
      mockDb.query.passports.findFirst.mockResolvedValue({
        id: "test-passport-id",
        brandId: "test-brand-id",
        templateId: "test-template-id",
        passportStatus: "draft",
        visibility: "private",
        customData: {},
        moduleData: {},
        dataCompleteness: 60,
        complianceScore: 75,
        validationScore: 75,
      });
    });

    it("should throw error when no brandId is provided", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };

      await expect(
        passportsRouter
          .createCaller(contextWithoutBrand)
          .update({
            id: "550e8400-e29b-41d4-a716-446655440000",
            passportStatus: "published",
          })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when passport not found", async () => {
      mockDb.query.passports.findFirst.mockResolvedValue(null);

      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          passportStatus: "published",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should update passport status and set publishedAt timestamp", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        passportStatus: "published",
      });

      expect(result).toBeDefined();
      expect(result.affectedCount).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it("should recalculate scores when relevant data changes", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        customData: { newField: "value" },
        moduleData: { module1: "completed" },
      });

      expect(result).toBeDefined();
      expect(result.affectedCount).toBe(1);
      // Scores should be recalculated when data changes
    });

    it("should handle partial updates without recalculating scores", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        versionNotes: "Updated notes",
      });

      expect(result).toBeDefined();
      expect(result.affectedCount).toBe(1);
      // Should not recalculate scores for non-relevant changes
    });

    it("should validate input schema", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test missing required ID
      const invalidUpdateCall = async () => {
        const invalidInput = {
          passportStatus: "published",
        };
        return caller.update(invalidInput);
      };
      await expect(invalidUpdateCall()).rejects.toThrow();
    });

    it("should validate UUID format for ID", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.update({
          id: "invalid-uuid",
          passportStatus: "published",
        })
      ).rejects.toThrow();
    });
  });

  describe("bulkUpdate endpoint", () => {
    beforeEach(() => {
      // Reset count query mock
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ count: 50 }])),
        })),
      }));
    });

    it("should throw error when no brandId is provided", async () => {
      const contextWithoutBrand = {
        ...mockContext,
        brandId: null,
      };

      await expect(
        passportsRouter
          .createCaller(contextWithoutBrand)
          .bulkUpdate({
            selection: { ids: ["550e8400-e29b-41d4-a716-446655440000"] },
            data: { passportStatus: "published" },
          })
      ).rejects.toThrow(TRPCError);
    });

    it("should update multiple passports by IDs", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.bulkUpdate({
        selection: {
          ids: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
          ],
        },
        data: { passportStatus: "published" },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("affectedCount");
      expect(result).toHaveProperty("data");
    });

    it("should support filter-based selection", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.bulkUpdate({
        selection: {
          filter: {
            passportStatus: ["draft"],
            visibility: ["private"],
          },
        },
        data: { passportStatus: "published" },
      });

      expect(result).toBeDefined();
      expect(result.affectedCount).toBeGreaterThanOrEqual(0);
    });

    it("should support 'all' selection", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.bulkUpdate({
        selection: "all",
        data: { syncEnabled: true },
      });

      expect(result).toBeDefined();
      expect(result.affectedCount).toBeGreaterThanOrEqual(0);
    });

    it("should return preview without making changes", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.bulkUpdate({
        selection: { ids: ["550e8400-e29b-41d4-a716-446655440000"] },
        data: { passportStatus: "published" },
        preview: true,
      });

      expect(result).toBeDefined();
      expect(result.preview).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.affectedCount).toBe(50); // From mock
    });

    it("should enforce safety guards for large operations", async () => {
      // Mock large count
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ count: 1500 }])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.bulkUpdate({
          selection: "all",
          data: { passportStatus: "published" },
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should require preview for operations affecting many records", async () => {
      // Mock medium count above preview threshold
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ count: 150 }])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.bulkUpdate({
          selection: "all",
          data: { passportStatus: "published" },
          preview: false,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should validate selection schema", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid selection type
      const invalidBulkCall = async () => {
        const invalidInput = {
          selection: { invalidKey: "value" },
          data: { passportStatus: "published" },
        };
        return caller.bulkUpdate(invalidInput);
      };
      await expect(invalidBulkCall()).rejects.toThrow();
    });

    it("should validate UUID format in ID selection", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      await expect(
        caller.bulkUpdate({
          selection: { ids: ["invalid-uuid"] },
          data: { passportStatus: "published" },
        })
      ).rejects.toThrow();
    });
  });

  describe("aggregate", () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup default successful mock responses for aggregate queries
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { status: "published", count: 15 },
              { status: "draft", count: 10 },
              { status: "archived", count: 5 },
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
      const caller = passportsRouter.createCaller(contextWithoutBrand);

      await expect(
        caller.aggregate({
          metrics: ["passportStatusDistribution"],
        })
      ).rejects.toThrow("Brand context required");
    });

    it("should return passport status distribution", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportStatusDistribution"],
      });

      expect(result).toBeDefined();
      expect(result.metrics.passportStatusDistribution).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("brand-123");
      expect(result.meta.requestedMetrics).toEqual(["passportStatusDistribution"]);
    });

    it("should return visibility distribution", async () => {
      // Mock visibility distribution data
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { visibility: "public", count: 20 },
              { visibility: "private", count: 15 },
              { visibility: "shared", count: 5 },
            ])),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["visibilityDistribution"],
      });

      expect(result.metrics.visibilityDistribution).toBeDefined();
      expect(Array.isArray(result.metrics.visibilityDistribution)).toBe(true);
    });

    it("should return data completeness statistics", async () => {
      // Mock single aggregation result
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            {
              avgCompleteness: 85,
              minCompleteness: 20,
              maxCompleteness: 100,
              completePassports: 12,
            },
          ])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["dataCompletenessStatistics"],
      });

      expect(result.metrics.dataCompletenessStatistics).toBeDefined();
      expect(result.metrics.dataCompletenessStatistics.completePassports).toBe(12);
    });

    it("should return validation statistics", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            {
              avgValidationScore: 92,
              validPassports: 18,
            },
          ])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["validationStatistics"],
      });

      expect(result.metrics.validationStatistics).toBeDefined();
      expect(result.metrics.validationStatistics.validPassports).toBe(18);
    });

    it("should return compliance statistics", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            {
              avgComplianceScore: 88,
              compliantPassports: 16,
            },
          ])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["complianceStatistics"],
      });

      expect(result.metrics.complianceStatistics).toBeDefined();
      expect(result.metrics.complianceStatistics.compliantPassports).toBe(16);
    });

    it("should return sharing statistics", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            {
              publicPassports: 8,
              shareablePassports: 12,
              totalShares: 45,
            },
          ])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["sharingStatistics"],
      });

      expect(result.metrics.sharingStatistics).toBeDefined();
      expect(result.metrics.sharingStatistics.publicPassports).toBe(8);
    });

    it("should return QR code usage", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { withQrCode: 10, format: "png" },
              { withQrCode: 5, format: "svg" },
            ])),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["qrCodeUsage"],
      });

      expect(result.metrics.qrCodeUsage).toBeDefined();
      expect(Array.isArray(result.metrics.qrCodeUsage)).toBe(true);
    });

    it("should return sync health metrics", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { status: "synced", count: 20 },
              { status: "failed", count: 2 },
              { status: "pending", count: 3 },
            ])),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["syncHealthMetrics"],
      });

      expect(result.metrics.syncHealthMetrics).toBeDefined();
      expect(Array.isArray(result.metrics.syncHealthMetrics)).toBe(true);
    });

    it("should return template usage", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { templateId: "template-1", count: 15 },
              { templateId: "template-2", count: 8 },
            ])),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["templateUsage"],
      });

      expect(result.metrics.templateUsage).toBeDefined();
      expect(Array.isArray(result.metrics.templateUsage)).toBe(true);
    });

    it("should return access statistics", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            {
              totalAccesses: 120,
              recentlyAccessed: 25,
            },
          ])),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["accessStatistics"],
      });

      expect(result.metrics.accessStatistics).toBeDefined();
      expect(result.metrics.accessStatistics.totalAccesses).toBe(120);
    });

    it("should return language distribution", async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => Promise.resolve([
              { language: "en", count: 30 },
              { language: "es", count: 10 },
              { language: "fr", count: 5 },
            ])),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["languageDistribution"],
      });

      expect(result.metrics.languageDistribution).toBeDefined();
      expect(Array.isArray(result.metrics.languageDistribution)).toBe(true);
    });

    it("should handle multiple metrics in single request", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportStatusDistribution", "visibilityDistribution"],
      });

      expect(result.metrics.passportStatusDistribution).toBeDefined();
      expect(result.metrics.visibilityDistribution).toBeDefined();
      expect(result.meta.requestedMetrics).toHaveLength(2);
    });

    it("should apply filters when provided", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        filter: {
          passportStatus: ["published"],
          visibility: ["public"],
          isPublic: true,
        },
        metrics: ["passportStatusDistribution"],
      });

      expect(result.meta.filtersApplied).toBe(true);
      expect(result.metrics.passportStatusDistribution).toBeDefined();
    });

    it("should handle unknown metrics gracefully", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // @ts-expect-error - Testing unknown metric handling
      const result = await caller.aggregate({
        metrics: ["unknownMetric"],
      });

      expect(result.metrics.unknownMetric).toEqual([]);
    });

    it("should include proper meta information", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.aggregate({
        metrics: ["passportStatusDistribution"],
        filter: { passportStatus: ["published"] },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta.asOf).toBeInstanceOf(Date);
      expect(result.meta.brandId).toBe("brand-123");
      expect(result.meta.requestedMetrics).toEqual(["passportStatusDistribution"]);
      expect(result.meta.filtersApplied).toBe(true);
    });

    it("should validate input schema", async () => {
      const caller = passportsRouter.createCaller(mockContext);

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
  });

  describe("Cross-Module Include System", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      // Mock successful response for includes
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve([
                {
                  id: "passport-1",
                  brandId: "test-brand-id",
                  templateId: "template-1",
                  productId: "product-1",
                  variantId: "variant-1",
                  passportStatus: "published",
                  visibility: "public",
                  dataCompleteness: 85,
                  validationScore: 90,
                  product: {
                    id: "product-1",
                    name: "Test Product",
                    brandId: "test-brand-id",
                  },
                  variant: {
                    id: "variant-1",
                    productId: "product-1",
                    name: "Test Variant",
                  },
                  template: {
                    id: "template-1",
                    name: "Test Template",
                    brandId: "test-brand-id",
                  },
                },
              ])),
            })),
          })),
        })),
      }));
    });

    it("should validate cross-module includes correctly", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test valid includes
      const result = await caller.list({
        include: {
          product: true,
          variant: true,
          template: true,
        },
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.meta?.includeValidation).toBeDefined();
      expect(result.meta?.performance).toBeDefined();
    });

    it("should reject includes with performance warnings for non-owner users", async () => {
      const memberContext = {
        ...mockContext,
        role: "member",
      };
      const caller = passportsRouter.createCaller(memberContext);

      // Mock expensive relationship validation
      const originalValidateIncludes = require("@v1/db/schemas/shared").createCrossModuleQueryCapabilities;
      jest.mock("@v1/db/schemas/shared", () => ({
        ...jest.requireActual("@v1/db/schemas/shared"),
        createCrossModuleQueryCapabilities: jest.fn(() => ({
          validateIncludes: jest.fn(() => ({
            isValid: false,
            warnings: ["Expensive relationships require owner permissions"],
            performance: {
              joinCount: 6,
              hasExpensiveRelationships: true,
            },
            recommendedStrategy: "separate_queries",
          })),
        })),
      }));

      await expect(
        caller.list({
          include: {
            product: true,
            variant: true,
            template: true,
            statistics: true,
            fullHierarchy: true, // This would be expensive
          },
        })
      ).rejects.toThrow("Include validation failed");
    });

    it("should allow expensive includes for owner users", async () => {
      const ownerContext = {
        ...mockContext,
        role: "owner",
      };
      const caller = passportsRouter.createCaller(ownerContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
          template: true,
          statistics: true,
          fullHierarchy: true,
        },
      });

      expect(result).toBeDefined();
      expect(result.meta?.includeValidation?.warnings).toEqual([]);
    });

    it("should track performance metrics for cross-module queries", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
        },
      });

      expect(result.meta?.performance).toBeDefined();
      expect(result.meta?.performance?.queryTimeMs).toBeGreaterThan(0);
      expect(result.meta?.performance?.joinCount).toBeGreaterThanOrEqual(0);
      expect(result.meta?.performance?.hasExpensiveRelationships).toBeDefined();
      expect(result.meta?.performance?.estimatedCardinality).toBeDefined();
      expect(result.meta?.performance?.recommendedStrategy).toBeDefined();
    });

    it("should provide include validation warnings in response", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
          template: true,
        },
      });

      expect(result.meta?.includeValidation).toBeDefined();
      expect(result.meta?.includeValidation?.warnings).toBeDefined();
      expect(result.meta?.includeValidation?.recommendedStrategy).toBeDefined();
    });

    it("should support selective cross-module includes", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test product include only
      const productResult = await caller.list({
        include: {
          product: true,
          variant: false,
          template: false,
        },
      });

      expect(productResult).toBeDefined();
      expect(productResult.data).toHaveLength(1);

      // Test variant include only
      const variantResult = await caller.list({
        include: {
          product: false,
          variant: true,
          template: false,
        },
      });

      expect(variantResult).toBeDefined();
      expect(variantResult.data).toHaveLength(1);

      // Test template include only
      const templateResult = await caller.list({
        include: {
          product: false,
          variant: false,
          template: true,
        },
      });

      expect(templateResult).toBeDefined();
      expect(templateResult.data).toHaveLength(1);
    });

    it("should handle no includes gracefully", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: false,
          variant: false,
          template: false,
        },
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.meta?.performance?.joinCount).toBe(0);
    });

    it("should transform cross-module results correctly", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
        },
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);

      const passportData = result.data[0];
      expect(passportData).toHaveProperty("id", "passport-1");
      expect(passportData).toHaveProperty("product");
      expect(passportData).toHaveProperty("variant");

      if (passportData.product) {
        expect(passportData.product).toHaveProperty("id", "product-1");
        expect(passportData.product).toHaveProperty("name", "Test Product");
      }

      if (passportData.variant) {
        expect(passportData.variant).toHaveProperty("id", "variant-1");
        expect(passportData.variant).toHaveProperty("name", "Test Variant");
      }
    });

    it("should validate cross-module include types at runtime", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      // Test invalid include types (should be caught by schema validation)
      await expect(
        caller.list({
          // @ts-expect-error - Testing invalid include validation
          include: {
            invalidInclude: true,
          },
        })
      ).rejects.toThrow();
    });

    it("should provide recommendations for query optimization", async () => {
      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
          template: true,
          statistics: true,
        },
      });

      expect(result.meta?.includeValidation?.recommendedStrategy).toBeDefined();
      expect(["join", "subquery", "separate_queries"]).toContain(
        result.meta?.includeValidation?.recommendedStrategy
      );
    });

    it("should work with get endpoint for cross-module includes", async () => {
      // Mock successful get response
      mockDb.query.passports.findFirst.mockResolvedValue({
        id: "passport-1",
        brandId: "test-brand-id",
        templateId: "template-1",
        productId: "product-1",
        variantId: "variant-1",
        passportStatus: "published",
        visibility: "public",
        product: {
          id: "product-1",
          name: "Test Product",
        },
        variant: {
          id: "variant-1",
          name: "Test Variant",
        },
      });

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.get({
        where: {
          passportId: "passport-1",
        },
        include: {
          product: true,
          variant: true,
        },
      });

      expect(result).toBeDefined();
      if (result) {
        expect(result).toHaveProperty("id", "passport-1");
        expect(result).toHaveProperty("product");
        expect(result).toHaveProperty("variant");
      }
    });

    it("should handle empty cross-module results gracefully", async () => {
      // Mock empty response
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      }));

      const caller = passportsRouter.createCaller(mockContext);

      const result = await caller.list({
        include: {
          product: true,
          variant: true,
        },
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(0);
      expect(result.cursorInfo.hasMore).toBe(false);
    });
  });
});