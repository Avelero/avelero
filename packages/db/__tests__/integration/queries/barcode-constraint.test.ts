/**
 * Integration Tests: Barcode Uniqueness Constraint
 *
 * Tests the database-level unique constraint on barcodes per brand:
 * - idx_unique_barcode_per_brand
 *
 * Note: These tests validate behavior AFTER the migration is applied.
 * Before the migration, duplicate barcodes will be allowed at DB level.
 *
 * Uses real database connections with transaction isolation between tests.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import * as schema from "@v1/db/schema";
import {
  cleanupTables,
  createTestBrand,
  createTestProductForExport,
  testDb,
} from "@v1/db/testing";

describe("Barcode Uniqueness Constraint", () => {
  let brandId: string;
  let productId: string;

  beforeEach(async () => {
    // Clean database between tests to avoid conflicts
    await cleanupTables();

    // Create a test brand and product for each test
    brandId = await createTestBrand("Constraint Test Brand");
    productId = await createTestProductForExport(brandId, {
      name: "Test Product",
      handle: `test-product-${Math.random().toString(36).substring(2, 8)}`,
    });
  });

  /**
   * Helper to generate a unique UPID
   */
  function generateUpid(): string {
    return `UPID-${Math.random().toString(36).substring(2, 10)}`;
  }

  describe("constraint behavior", () => {
    it("prevents inserting duplicate barcode in same brand at DB level", async () => {
      // First insert succeeds
      await testDb.insert(schema.productVariants).values({
        productId,
        barcode: "6666666666666",
        upid: generateUpid(),
      });

      // Second insert with same barcode should fail
      let error: Error | null = null;
      try {
        await testDb.insert(schema.productVariants).values({
          productId,
          barcode: "6666666666666", // Duplicate
          upid: generateUpid(),
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      // Drizzle wraps the PostgresError in cause
      const pgError = (error as any)?.cause;
      expect(pgError?.code).toBe("23505"); // unique_violation
      expect(pgError?.constraint_name).toBe("idx_unique_barcode_per_brand");
    });

    it("prevents duplicate barcode across different products in same brand", async () => {
      // Create another product in the same brand
      const otherProductId = await createTestProductForExport(brandId, {
        name: "Other Product",
        handle: `other-product-${Math.random().toString(36).substring(2, 8)}`,
      });

      // First insert succeeds
      await testDb.insert(schema.productVariants).values({
        productId,
        barcode: "3333333333333",
        upid: generateUpid(),
      });

      // Insert with same barcode in different product should fail
      let error: Error | null = null;
      try {
        await testDb.insert(schema.productVariants).values({
          productId: otherProductId,
          barcode: "3333333333333", // Same barcode
          upid: generateUpid(),
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      const pgError = (error as any)?.cause;
      expect(pgError?.code).toBe("23505");
      expect(pgError?.constraint_name).toBe("idx_unique_barcode_per_brand");
    });

    it("allows same barcode in different brands at DB level", async () => {
      const otherBrandId = await createTestBrand("Other Brand");
      const otherProductId = await createTestProductForExport(otherBrandId, {
        name: "Other Brand Product",
        handle: `other-brand-product-${Math.random().toString(36).substring(2, 8)}`,
      });

      // First brand
      await testDb.insert(schema.productVariants).values({
        productId,
        barcode: "4444444444444",
        upid: generateUpid(),
      });

      // Same barcode in different brand should succeed
      const result = await testDb
        .insert(schema.productVariants)
        .values({
          productId: otherProductId,
          barcode: "4444444444444",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      expect(result).toBeDefined();
      expect(result[0]?.id).toBeDefined();
    });

    it("allows multiple null barcodes in same brand", async () => {
      // First variant with null barcode
      const result1 = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: null,
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Second variant with null barcode should succeed
      const result2 = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: null,
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      expect(result1[0]?.id).toBeDefined();
      expect(result2[0]?.id).toBeDefined();
    });

    it("allows multiple empty string barcodes in same brand", async () => {
      // First variant with empty barcode
      const result1 = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Second variant with empty barcode should succeed
      const result2 = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      expect(result1[0]?.id).toBeDefined();
      expect(result2[0]?.id).toBeDefined();
    });

    it("allows updating variant to keep its own barcode", async () => {
      const [variant] = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "7777777777777",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Update with same barcode should succeed
      const [updated] = await testDb
        .update(schema.productVariants)
        .set({ barcode: "7777777777777" }) // Same barcode
        .where(eq(schema.productVariants.id, variant!.id))
        .returning({
          id: schema.productVariants.id,
          barcode: schema.productVariants.barcode,
        });

      expect(updated?.barcode).toBe("7777777777777");
    });

    it("prevents updating variant to another variant's barcode", async () => {
      // Create first variant with a barcode
      await testDb.insert(schema.productVariants).values({
        productId,
        barcode: "8888888888888",
        upid: generateUpid(),
      });

      // Create second variant with different barcode
      const [secondVariant] = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "9999999999999",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Try to update second variant to use first variant's barcode
      let error: Error | null = null;
      try {
        await testDb
          .update(schema.productVariants)
          .set({ barcode: "8888888888888" }) // First variant's barcode
          .where(eq(schema.productVariants.id, secondVariant!.id));
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      const pgError = (error as any)?.cause;
      expect(pgError?.code).toBe("23505");
      expect(pgError?.constraint_name).toBe("idx_unique_barcode_per_brand");
    });

    it("allows clearing barcode (setting to null)", async () => {
      // Create variant with a barcode
      const [variant] = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "1010101010101",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Clear the barcode
      const [updated] = await testDb
        .update(schema.productVariants)
        .set({ barcode: null })
        .where(eq(schema.productVariants.id, variant!.id))
        .returning({
          id: schema.productVariants.id,
          barcode: schema.productVariants.barcode,
        });

      expect(updated?.barcode).toBeNull();
    });

    it("allows clearing barcode (setting to empty string)", async () => {
      // Create variant with a barcode
      const [variant] = await testDb
        .insert(schema.productVariants)
        .values({
          productId,
          barcode: "2020202020202",
          upid: generateUpid(),
        })
        .returning({ id: schema.productVariants.id });

      // Clear the barcode by setting to empty string
      const [updated] = await testDb
        .update(schema.productVariants)
        .set({ barcode: "" })
        .where(eq(schema.productVariants.id, variant!.id))
        .returning({
          id: schema.productVariants.id,
          barcode: schema.productVariants.barcode,
        });

      expect(updated?.barcode).toBe("");
    });
  });
});
