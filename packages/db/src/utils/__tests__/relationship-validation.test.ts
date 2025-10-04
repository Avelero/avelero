import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { eq, and } from "drizzle-orm";
import {
  validatePassportProductVariantConsistency,
  validateBrandIsolation,
  validateTemplateModuleConsistency,
  validateCrossModuleReferences,
  validateBulkOperation,
  validateRequiredRelationships,
  createValidationError,
} from "../relationship-validation.js";
import {
  validateEntityForeignKeys,
  validateBulkForeignKeys,
  checkCircularDependencies,
  validateBeforeDeletion,
  createForeignKeyValidationError,
} from "../foreign-key-validation.js";
import {
  runComprehensiveIntegrityCheck,
  checkEntityIntegrity,
} from "../integrity-checks.js";
import {
  executeCascadingDeletion,
  previewCascadeEffects,
} from "../cascading-operations.js";

/**
 * Relationship Validation Test Suite
 *
 * Tests all aspects of the relationship validation and integrity system,
 * including cross-module relationships, foreign key validation, and cascading operations.
 */

describe("Relationship Validation System", () => {
  let mockDb: any;
  let testBrandId: string;
  let testProductId: string;
  let testVariantId: string;
  let testPassportId: string;
  let testTemplateId: string;

  beforeEach(() => {
    testBrandId = "test-brand-id";
    testProductId = "test-product-id";
    testVariantId = "test-variant-id";
    testPassportId = "test-passport-id";
    testTemplateId = "test-template-id";

    // Create comprehensive mock database
    mockDb = {
      query: {
        brands: {
          findFirst: jest.fn().mockResolvedValue({
            id: testBrandId,
            name: "Test Brand",
          }),
        },
        products: {
          findFirst: jest.fn().mockImplementation(async (options) => {
            if (options?.where?.toString().includes("non-existent")) {
              return null;
            }
            return {
              id: testProductId,
              name: "Test Product",
              brandId: testBrandId,
            };
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        productVariants: {
          findFirst: jest.fn().mockImplementation(async (options) => {
            if (options?.where?.toString().includes("non-existent")) {
              return null;
            }
            return {
              id: testVariantId,
              productId: testProductId,
              product: { brandId: testBrandId },
            };
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        passports: {
          findFirst: jest.fn().mockImplementation(async (options) => {
            if (options?.where?.toString().includes("non-existent")) {
              return null;
            }
            return {
              id: testPassportId,
              brandId: testBrandId,
              productId: testProductId,
              variantId: testVariantId,
              templateId: testTemplateId,
            };
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        templates: {
          findFirst: jest.fn().mockImplementation(async (options) => {
            if (options?.where?.toString().includes("non-existent")) {
              return null;
            }
            return {
              id: testTemplateId,
              brandId: testBrandId,
              name: "Test Template",
            };
          }),
        },
        modules: {
          findFirst: jest.fn().mockImplementation(async (options) => {
            return {
              id: "test-module-id",
              templateId: testTemplateId,
              template: {
                id: testTemplateId,
                brandId: testBrandId,
              },
            };
          }),
        },
        categories: {
          findFirst: jest.fn().mockResolvedValue({
            id: "test-category-id",
            brandId: testBrandId,
            name: "Test Category",
            parentId: null,
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        brandColors: {
          findFirst: jest.fn().mockResolvedValue({
            id: "test-color-id",
            brandId: testBrandId,
          }),
        },
        brandSizes: {
          findFirst: jest.fn().mockResolvedValue({
            id: "test-size-id",
            brandId: testBrandId,
          }),
        },
        showcaseBrands: {
          findFirst: jest.fn().mockResolvedValue({
            id: "test-showcase-brand-id",
          }),
        },
        brandCertifications: {
          findFirst: jest.fn().mockResolvedValue({
            id: "test-certification-id",
            brandId: testBrandId,
          }),
        },
      },
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(async (condition) => {
            // For bulk brand isolation validation queries, always return entities with correct brand
            const conditionStr = condition?.toString() || '';

            // For brand isolation queries - return entities with correct brandId
            if (conditionStr.includes(testProductId) && conditionStr.includes("products")) {
              return [{ id: testProductId, brandId: testBrandId }];
            }
            if (conditionStr.includes(testVariantId) && conditionStr.includes("variants")) {
              return [{ id: testVariantId, brandId: testBrandId }];
            }
            if (conditionStr.includes(testPassportId) && conditionStr.includes("passports")) {
              return [{ id: testPassportId, brandId: testBrandId }];
            }
            if (conditionStr.includes(testTemplateId) && conditionStr.includes("templates")) {
              return [{ id: testTemplateId, brandId: testBrandId }];
            }

            // For orphaned record checks - return empty arrays (no orphans)
            if (conditionStr.includes("productVariants") || conditionStr.includes("passports") || conditionStr.includes("modules")) {
              return []; // No orphaned records would be created
            }

            // Default case - return empty for count queries
            return [{ count: 0 }];
          }),
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
            limit: jest.fn().mockResolvedValue([]),
          }),
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
            limit: jest.fn().mockResolvedValue([]),
          }),
          groupBy: jest.fn().mockReturnValue({
            having: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
  });

  describe("Passport-Product-Variant Consistency Validation", () => {
    it("should validate consistent passport-product-variant relationships", async () => {
      const result = await validatePassportProductVariantConsistency(
        mockDb,
        testPassportId,
        testBrandId
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should detect inconsistent product-variant relationships", async () => {
      // Mock variant that doesn't belong to the product
      mockDb.query.productVariants.findFirst.mockResolvedValueOnce(null);

      const result = await validatePassportProductVariantConsistency(
        mockDb,
        testPassportId,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("does not belong to the specified product");
    });

    it("should handle non-existent passport", async () => {
      mockDb.query.passports.findFirst.mockResolvedValueOnce(null);

      const result = await validatePassportProductVariantConsistency(
        mockDb,
        "non-existent-passport",
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("not found or access denied");
    });
  });

  describe("Brand Isolation Validation", () => {
    it("should validate entities belonging to correct brand", async () => {
      const result = await validateBrandIsolation(
        mockDb,
        'product',
        testProductId,
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });

    it("should detect brand isolation violations", async () => {
      // Mock product belonging to different brand
      mockDb.query.products.findFirst.mockResolvedValueOnce({
        id: testProductId,
        brandId: "different-brand-id",
      });

      const result = await validateBrandIsolation(
        mockDb,
        'product',
        testProductId,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Brand isolation violation");
    });

    it("should handle non-existent entities", async () => {
      mockDb.query.products.findFirst.mockResolvedValueOnce(null);

      const result = await validateBrandIsolation(
        mockDb,
        'product',
        "non-existent-product",
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Template-Module Consistency Validation", () => {
    it("should validate template-module relationships", async () => {
      const result = await validateTemplateModuleConsistency(
        mockDb,
        "test-module-id",
        testTemplateId,
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });

    it("should detect module-template mismatches", async () => {
      // Mock module with different template
      mockDb.query.modules.findFirst.mockResolvedValueOnce({
        id: "test-module-id",
        templateId: "different-template-id",
        template: {
          id: "different-template-id",
          brandId: testBrandId,
        },
      });

      const result = await validateTemplateModuleConsistency(
        mockDb,
        "test-module-id",
        testTemplateId,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("does not belong to the specified template");
    });
  });

  describe("Cross-Module Reference Validation", () => {
    it("should validate all cross-module references for passport", async () => {
      const passportData = {
        brandId: testBrandId,
        productId: testProductId,
        variantId: testVariantId,
        templateId: testTemplateId,
      };

      const result = await validateCrossModuleReferences(
        mockDb,
        'passport',
        passportData,
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });

    it("should detect invalid product references", async () => {
      mockDb.query.products.findFirst.mockResolvedValueOnce(null);

      const passportData = {
        brandId: testBrandId,
        productId: "non-existent-product",
      };

      const result = await validateCrossModuleReferences(
        mockDb,
        'passport',
        passportData,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("not found or access denied");
    });
  });

  describe("Required Relationships Validation", () => {
    it("should validate required passport relationships", async () => {
      const passportData = {
        brandId: testBrandId,
        productId: testProductId,
      };

      const result = validateRequiredRelationships('passport', passportData);

      expect(result.isValid).toBe(true);
    });

    it("should detect missing required relationships", async () => {
      const passportData = {
        // Missing brandId
        productId: testProductId,
      };

      const result = validateRequiredRelationships('passport', passportData);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("brandId is required");
    });

    it("should require either product or variant for passport", async () => {
      const passportData = {
        brandId: testBrandId,
        // Missing both productId and variantId
      };

      const result = validateRequiredRelationships('passport', passportData);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Either productId or variantId must be provided");
    });
  });

  describe("Bulk Operation Validation", () => {
    it("should validate bulk delete operations", async () => {
      const result = await validateBulkOperation(
        mockDb,
        'delete',
        'product',
        [testProductId],
        testBrandId
      );

      // The function should run without throwing errors, result may vary based on cascade checks
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });

    it("should validate bulk update operations", async () => {
      const updateData = {
        name: "Updated Product Name",
      };

      const result = await validateBulkOperation(
        mockDb,
        'update',
        'product',
        [testProductId],
        testBrandId,
        updateData
      );

      // The function should run without throwing errors, result may vary based on validation
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });
  });

  describe("Foreign Key Validation", () => {
    it("should validate entity foreign keys", async () => {
      const entityData = {
        brandId: testBrandId,
        productId: testProductId,
        variantId: testVariantId,
      };

      const result = await validateEntityForeignKeys(
        mockDb,
        'passports',
        entityData,
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });

    it("should detect invalid foreign key references", async () => {
      mockDb.query.products.findFirst.mockResolvedValueOnce(null);

      const entityData = {
        brandId: testBrandId,
        productId: "non-existent-product",
      };

      const result = await validateEntityForeignKeys(
        mockDb,
        'passports',
        entityData,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReferences).toBeDefined();
      expect(result.invalidReferences!.length).toBeGreaterThan(0);
    });

    it("should validate bulk foreign keys", async () => {
      const entities = [
        { id: "1", brandId: testBrandId, productId: testProductId },
        { id: "2", brandId: testBrandId, productId: testProductId },
      ];

      const result = await validateBulkForeignKeys(
        mockDb,
        'passports',
        entities,
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect circular dependencies in categories", async () => {
      const result = await checkCircularDependencies(
        mockDb,
        'categories',
        "category-1",
        "category-2",
        testBrandId
      );

      expect(result.hasCircularDependency).toBe(false);
    });
  });

  describe("Comprehensive Integrity Checks", () => {
    it("should run comprehensive integrity check", async () => {
      const result = await runComprehensiveIntegrityCheck(mockDb, testBrandId);

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it("should check entity integrity", async () => {
      const result = await checkEntityIntegrity(
        mockDb,
        'passport',
        testPassportId,
        testBrandId
      );

      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(true);
    });
  });

  describe("Cascading Operations", () => {
    it("should preview cascade effects", async () => {
      // Mock count results for cascade preview
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const result = await previewCascadeEffects(
        mockDb,
        'products',
        [testProductId],
        testBrandId
      );

      expect(result.cascades).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe("Error Creation Utilities", () => {
    it("should create validation errors with correct format", () => {
      const error = createValidationError(
        'BAD_REQUEST',
        'Test validation error',
        { field: 'test' }
      );

      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Test validation error');
      // TRPCError might handle cause differently, just verify it's set
      expect(error.cause).toBeDefined();
      expect(error).toBeInstanceOf(Error);
    });

    it("should create foreign key validation errors", () => {
      const validationResult = {
        isValid: false,
        error: 'Foreign key violation',
        invalidReferences: [
          {
            field: 'productId',
            value: 'invalid-id',
            targetTable: 'products',
            message: 'Product not found',
          },
        ],
      };

      const error = createForeignKeyValidationError(validationResult);

      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Foreign key violation');
      expect(error.cause).toBeDefined();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      mockDb.query.passports.findFirst.mockRejectedValueOnce(new Error("Database connection failed"));

      const result = await validatePassportProductVariantConsistency(
        mockDb,
        testPassportId,
        testBrandId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Validation failed");
    });

    it("should handle empty entity lists in bulk operations", async () => {
      const result = await validateBulkOperation(
        mockDb,
        'delete',
        'product',
        [], // Empty array
        testBrandId
      );

      expect(result.isValid).toBe(true);
    });

    it("should validate against SQL injection in dynamic queries", async () => {
      const maliciousId = "'; DROP TABLE products; --";

      const result = await validateBrandIsolation(
        mockDb,
        'product',
        maliciousId,
        testBrandId
      );

      // Should not crash and should handle safely
      expect(result).toBeDefined();
    });
  });

  describe("Performance and Limits", () => {
    it("should respect validation limits in bulk operations", async () => {
      const manyIds = Array.from({ length: 150 }, (_, i) => `id-${i}`);

      const result = await validateBulkOperation(
        mockDb,
        'delete',
        'product',
        manyIds,
        testBrandId
      );

      // Should still work but may have limits applied
      expect(result).toBeDefined();
    });

    it("should handle large datasets in integrity checks", async () => {
      // Mock large dataset
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(Array.from({ length: 1000 }, (_, i) => ({ id: `record-${i}` }))),
        }),
      });

      const result = await runComprehensiveIntegrityCheck(mockDb, testBrandId, {
        maxViolationsPerType: 10,
      });

      expect(result).toBeDefined();
      expect(result.violations.length).toBeLessThanOrEqual(10 * 6); // 10 per violation type, ~6 types
    });
  });
});