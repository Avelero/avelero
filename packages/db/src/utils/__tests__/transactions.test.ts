import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { eq } from "drizzle-orm";
import {
  executeTransaction,
  createOperation,
  createValidationOperation,
  createDataOperation,
} from "../transactions.js";
import {
  createPassportTransaction,
  createProductWithVariantsTransaction,
  bulkStatusUpdateTransaction,
} from "../cross-module-transactions.js";
import { passports, brands } from "../../schema/index.js";

/**
 * Transaction Management Tests
 *
 * Tests the transaction utilities for multi-module operations,
 * ensuring proper rollback and consistency mechanisms.
 */

describe("Transaction Management", () => {
  let mockDb: any;
  let testBrandId: string;
  let testProductId: string;

  beforeEach(() => {
    testBrandId = "test-brand-id";
    testProductId = "test-product-id";

    // Create a comprehensive mock database
    mockDb = {
      transaction: jest.fn().mockImplementation(async (callback: any) => {
        // Mock transaction context
        const mockTx = {
          query: {
            brands: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({ id: testBrandId, name: "Test Brand" }),
            },
            products: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({
                  id: testProductId,
                  name: "Test Product",
                  brandId: testBrandId,
                }),
              findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
            },
            productVariants: {
              findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
            },
            templates: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({
                  id: "test-template-id",
                  brandId: testBrandId,
                }),
            },
            categories: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({
                  id: "test-category-id",
                  name: "Test Category",
                }),
            },
            passports: {
              findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null), // Default to no passport found
            },
          },
          insert: jest.fn<() => any>().mockReturnValue({
            values: jest.fn<() => any>().mockReturnValue({
              returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([
                {
                  id: "new-record-id",
                  brandId: testBrandId,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ]),
            }),
          }),
          update: jest.fn<() => any>().mockReturnValue({
            set: jest.fn<() => any>().mockReturnValue({
              where: jest.fn<() => any>().mockReturnValue({
                returning: jest
                  .fn<() => Promise<any[]>>()
                  .mockResolvedValue([{ id: "updated-record-id" }]),
              }),
            }),
          }),
          delete: jest.fn<() => any>().mockReturnValue({
            where: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
          }),
          select: jest.fn<() => any>().mockReturnValue({
            from: jest.fn<() => any>().mockReturnValue({
              where: jest.fn<() => Promise<any[]>>().mockResolvedValue([{ count: 0 }]),
            }),
          }),
          execute: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
        };

        try {
          return await callback(mockTx);
        } catch (error) {
          throw error;
        }
      }),

      // Add query interface for direct database calls
      query: {
        brands: {
          findFirst: jest
            .fn<() => Promise<any>>()
            .mockResolvedValue({ id: testBrandId, name: "Test Brand" }),
        },
        products: {
          findFirst: jest
            .fn<() => Promise<any>>()
            .mockResolvedValue({
              id: testProductId,
              name: "Test Product",
              brandId: testBrandId,
            }),
          findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
        },
        productVariants: {
          findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
        },
        templates: {
          findFirst: jest
            .fn<() => Promise<any>>()
            .mockResolvedValue({
              id: "test-template-id",
              brandId: testBrandId,
            }),
        },
        categories: {
          findFirst: jest
            .fn<() => Promise<any>>()
            .mockResolvedValue({
              id: "test-category-id",
              name: "Test Category",
            }),
        },
        passports: {
          findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null), // Default to no passport found
        },
      },

      // Add insert interface for direct database calls
      insert: jest.fn<() => any>().mockReturnValue({
        values: jest.fn<() => any>().mockReturnValue({
          returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([
            {
              id: "new-passport-id",
              brandId: testBrandId,
              productId: testProductId,
              status: "draft",
              visibility: "private",
              dataCompleteness: 50,
              complianceScore: 60,
              validationScore: 75,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        }),
      }),
    };
  });

  describe("Basic Transaction Operations", () => {
    it("should execute multiple operations in a transaction", async () => {
      const operations = [
        createValidationOperation("validate-brand", async (tx) => {
          const brand = await tx.query.brands.findFirst({
            where: eq(brands.id, testBrandId),
          });
          expect(brand).toBeTruthy();
          return brand;
        }),
        createDataOperation("create-passport", async (tx) => {
          const [passport] = await tx
            .insert(passports)
            .values({
              brandId: testBrandId,
              productId: testProductId,
              variantId: "test-variant-id",
              templateId: "test-template-id",
              status: "draft",
              slug: "test-passport-slug",
            })
            .returning();
          return passport;
        }),
      ];

      const result = await executeTransaction(mockDb, operations);

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(2);
      expect(result.operations).toContain("validate-brand");
      expect(result.operations).toContain("create-passport");

      // Verify transaction was called
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should rollback on operation failure", async () => {
      const operations: any[] = [
        createDataOperation("create-passport", async (tx) => {
          const [passport] = await tx
            .insert(passports)
            .values({
              brandId: testBrandId,
              productId: testProductId,
              variantId: "test-variant-id",
              templateId: "test-template-id",
              status: "draft",
              slug: "test-passport-slug",
            })
            .returning();
          return passport;
        }),
        createOperation("failing-operation", async () => {
          throw new Error("Intentional test failure");
        }),
      ];

      const result = await executeTransaction(mockDb, operations);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Intentional test failure");

      // Verify transaction was called but failed
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe("Cross-Module Passport Transaction", () => {
    it("should create passport with full validation", async () => {
      // Configure mocks for successful creation
      mockDb.query.passports.findFirst.mockResolvedValueOnce(null); // No existing passport

      const transactionInput = {
        brandId: testBrandId,
        productId: testProductId,
        passportData: {
          status: "draft" as const,
          visibility: "private" as const,
          dataCompleteness: 75,
          complianceScore: 80,
          validationScore: 85,
          versionNotes: "Initial creation",
        },
        validateProductVariantRelation: false, // No variant in this test
        validateTemplateAccess: false, // No template in this test
        enforceUniquePassport: true,
      };

      const result = await createPassportTransaction(mockDb, transactionInput);

      expect(result.success).toBe(true);
      expect(result.operations).toContain(
        "validate-comprehensive-requirements",
      );
      expect(result.operations).toContain("validate-brand-access");
      expect(result.operations).toContain("create-passport");
      expect(result.operations.length).toBeGreaterThan(3);

      // Mock verification - in real test we'd check database state
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should fail on duplicate passport creation", async () => {
      // Update the transaction mock to simulate duplicate passport
      mockDb.transaction.mockImplementationOnce(async (callback: any) => {
        const mockTx = {
          query: {
            brands: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({ id: testBrandId, name: "Test Brand" }),
            },
            products: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({
                  id: testProductId,
                  name: "Test Product",
                  brandId: testBrandId,
                }),
            },
            passports: {
              findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({
                id: "existing-passport-id",
                brandId: testBrandId,
                productId: testProductId,
                status: "draft",
                visibility: "private",
              }),
            },
          },
          insert: jest.fn<() => any>().mockReturnValue({
            values: jest.fn<() => any>().mockReturnValue({
              returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
            }),
          }),
          execute: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
        };

        try {
          return await callback(mockTx);
        } catch (error) {
          throw error;
        }
      });

      const transactionInput = {
        brandId: testBrandId,
        productId: testProductId,
        passportData: {
          status: "draft" as const,
          visibility: "private" as const,
        },
        enforceUniquePassport: true,
      };

      const result = await createPassportTransaction(mockDb, transactionInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain("passport already exists");
    });

    it("should fail on invalid product", async () => {
      // Update the transaction mock to simulate invalid product
      mockDb.transaction.mockImplementationOnce(async (callback: any) => {
        const mockTx = {
          query: {
            brands: {
              findFirst: jest
                .fn<() => Promise<any>>()
                .mockResolvedValue({ id: testBrandId, name: "Test Brand" }),
            },
            products: {
              findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null), // No product found
            },
            passports: {
              findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
            },
          },
          insert: jest.fn<() => any>().mockReturnValue({
            values: jest.fn<() => any>().mockReturnValue({
              returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
            }),
          }),
          execute: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
        };

        try {
          return await callback(mockTx);
        } catch (error) {
          throw error;
        }
      });

      const transactionInput = {
        brandId: testBrandId,
        productId: "non-existent-product-id",
        passportData: {
          status: "draft" as const,
          visibility: "private" as const,
        },
        enforceUniquePassport: true,
      };

      const result = await createPassportTransaction(mockDb, transactionInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Product not found");
    });
  });

  describe("Transaction Configuration", () => {
    it("should handle custom timeout configuration", async () => {
      const operations = [
        createOperation("quick-operation", async () => {
          return { completed: true };
        }),
      ];

      const result = await executeTransaction(mockDb, operations, {
        timeout: 5000, // 5 second timeout
        isolation: "read committed",
        maxRetries: 1,
      });

      expect(result.success).toBe(true);
    });

    it("should handle serialization retry logic", async () => {
      // This test is more complex and would require actual serialization conflicts
      // For now, just test that the retry configuration is accepted
      const operations = [
        createOperation("test-operation", async () => {
          return { completed: true };
        }),
      ];

      const result = await executeTransaction(mockDb, operations, {
        maxRetries: 2,
        retryDelay: 50,
      });

      expect(result.success).toBe(true);
    });
  });
});
