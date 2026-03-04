/**
 * Integration Tests: Global UPID Constraints
 *
 * Validates database-level global UPID guarantees across:
 * - product_variants
 * - product_passports
 *
 * @module tests/integration/queries/upid-global-constraint
 */

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

describe("Global UPID Constraints", () => {
  let brandAId: string;
  let brandBId: string;
  let brandAProductId: string;
  let brandBProductId: string;

  beforeEach(async () => {
    // Reset all mutable tables so each test starts with a clean state.
    await cleanupTables();

    brandAId = await createTestBrand("UPID Brand A");
    brandBId = await createTestBrand("UPID Brand B");

    brandAProductId = await createTestProductForExport(brandAId, {
      name: "Brand A Product",
      handle: `brand-a-product-${Math.random().toString(36).slice(2, 8)}`,
    });
    brandBProductId = await createTestProductForExport(brandBId, {
      name: "Brand B Product",
      handle: `brand-b-product-${Math.random().toString(36).slice(2, 8)}`,
    });
  });

  it("prevents duplicate UPID across different brands at variant level", async () => {
    const upid = "GLOBALUPID000000";

    // First brand insert succeeds.
    await testDb.insert(schema.productVariants).values({
      productId: brandAProductId,
      upid,
      sku: "A-SKU-001",
      barcode: "1111111111111",
    });

    // Second brand insert with same UPID must fail globally.
    let error: Error | null = null;
    try {
      await testDb.insert(schema.productVariants).values({
        productId: brandBProductId,
        upid,
        sku: "B-SKU-001",
        barcode: "2222222222222",
      });
    } catch (caughtError) {
      error = caughtError as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23505");
    expect(pgError?.constraint_name).toBe("idx_unique_upid_global");
  });

  it("prevents reusing UPID reserved by an orphaned passport", async () => {
    const upid = "ORPHANUPID000001";

    // Create source variant and matching passport.
    const [sourceVariant] = await testDb
      .insert(schema.productVariants)
      .values({
        productId: brandAProductId,
        upid,
        sku: "A-SKU-ORPHAN",
        barcode: "3333333333333",
      })
      .returning({ id: schema.productVariants.id });

    await testDb.insert(schema.productPassports).values({
      upid,
      brandId: brandAId,
      workingVariantId: sourceVariant!.id,
      status: "active",
      firstPublishedAt: new Date().toISOString(),
    });

    // Delete the source variant. Passport becomes orphaned and should still reserve UPID.
    await testDb
      .delete(schema.productVariants)
      .where(eq(schema.productVariants.id, sourceVariant!.id));

    // Reusing same UPID on another brand must fail.
    let error: Error | null = null;
    try {
      await testDb.insert(schema.productVariants).values({
        productId: brandBProductId,
        upid,
        sku: "B-SKU-COLLISION",
        barcode: "4444444444444",
      });
    } catch (caughtError) {
      error = caughtError as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23505");
    expect(pgError?.constraint_name).toBe("product_variants_upid_global_guard");
  });
});
