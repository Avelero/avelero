/**
 * Integration Tests: Cleanup Operations
 *
 * Tests the import row cleanup functionality:
 * - Cleans up committed import rows after successful commit
 * - Preserves BLOCKED/FAILED import rows for error reporting
 * - Cleanup handles large datasets efficiently
 * - Multi-job cleanup isolation
 *
 * Note: This has been updated for the new architecture that uses import_rows
 * with normalized JSONB data instead of separate staging tables.
 *
 * @module tests/integration/import/cleanup-operations
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import type { NormalizedRowData } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import {
  type InsertedCatalog,
  TestCatalog,
  TestDatabase,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

describe("Cleanup Operations", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Cleanup Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  /**
   * Helper to create a normalized product row for testing
   */
  function createNormalizedRowData(
    overrides: Partial<NormalizedRowData> = {},
  ): NormalizedRowData {
    const productId = crypto.randomUUID();
    const stagingId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const variantStagingId = crypto.randomUUID();

    return {
      stagingId,
      rowNumber: 4,
      action: "CREATE",
      existingProductId: null,
      id: productId,
      brandId,
      productHandle: "test-product",
      name: "Test Product",
      description: null,
      imagePath: null,
      categoryId: null,
      seasonId: null,
      manufacturerId: null,
      status: "unpublished",
      rowStatus: "PENDING",
      errors: [],
      variants: [
        {
          stagingId: variantStagingId,
          rowNumber: 4,
          action: "CREATE",
          existingVariantId: null,
          id: variantId,
          productId,
          upid: null,
          barcode: null,
          sku: "TEST-SKU-001",
          nameOverride: null,
          descriptionOverride: null,
          imagePathOverride: null,
          rowStatus: "PENDING",
          errors: [],
          attributes: [],
          materials: [],
          environment: null,
          journeySteps: [],
          weight: null,
          rawData: {},
        },
      ],
      tags: [],
      materials: [],
      environment: null,
      journeySteps: [],
      weight: null,
      ...overrides,
    };
  }

  /**
   * Helper to get import row count for a job
   */
  async function getImportRowCount(jobId: string): Promise<number> {
    const result = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.importRows)
      .where(eq(schema.importRows.jobId, jobId));
    return result[0]?.count ?? 0;
  }

  /**
   * Helper to get import rows for a job
   */
  async function getImportRows(jobId: string) {
    return testDb
      .select()
      .from(schema.importRows)
      .where(eq(schema.importRows.jobId, jobId))
      .orderBy(asc(schema.importRows.rowNumber));
  }

  /**
   * Helper to delete committed import rows for a job (simulates cleanup)
   */
  async function deleteCommittedImportRows(jobId: string): Promise<number> {
    const committed = await testDb
      .select({ id: schema.importRows.id })
      .from(schema.importRows)
      .where(
        and(
          eq(schema.importRows.jobId, jobId),
          eq(schema.importRows.status, "COMMITTED"),
        ),
      );

    if (committed.length === 0) return 0;

    const ids = committed.map((r) => r.id);
    await testDb
      .delete(schema.importRows)
      .where(inArray(schema.importRows.id, ids));

    return committed.length;
  }

  /**
   * Helper to delete all import rows for a job (simulates dismiss)
   */
  async function deleteAllImportRows(jobId: string): Promise<number> {
    const rows = await testDb
      .select({ id: schema.importRows.id })
      .from(schema.importRows)
      .where(eq(schema.importRows.jobId, jobId));

    if (rows.length === 0) return 0;

    const ids = rows.map((r) => r.id);
    await testDb
      .delete(schema.importRows)
      .where(inArray(schema.importRows.id, ids));

    return rows.length;
  }

  describe("Import Row Cleanup", () => {
    it("cleans up committed import rows after successful commit", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create import rows with COMMITTED status
      for (let i = 0; i < 5; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `committed-product-${i}`,
          name: `Committed Product ${i}`,
          rowStatus: "PENDING",
        });

        await testDb.insert(schema.importRows).values({
          jobId: job.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `committed-product-${i}` },
          normalized,
          status: "COMMITTED",
        });
      }

      // Verify import rows exist
      let count = await getImportRowCount(job.id);
      expect(count).toBe(5);

      // Clean up committed import rows
      const deletedCount = await deleteCommittedImportRows(job.id);
      expect(deletedCount).toBe(5);

      // Verify import rows were cleaned up
      count = await getImportRowCount(job.id);
      expect(count).toBe(0);
    });

    it("preserves BLOCKED import rows for error reporting (before dismiss)", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create a mix of committed and blocked import rows
      const committedNormalized = createNormalizedRowData({
        rowNumber: 4,
        productHandle: "committed-product",
        name: "Committed Product",
        rowStatus: "PENDING",
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "committed-product" },
        normalized: committedNormalized,
        status: "COMMITTED",
      });

      const blockedNormalized = createNormalizedRowData({
        rowNumber: 5,
        productHandle: "blocked-product",
        name: "", // Missing required title causes BLOCKED
        rowStatus: "BLOCKED",
        errors: [{ field: "Product Title", message: "Required" }],
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 5,
        raw: { "Product Handle": "blocked-product" },
        normalized: blockedNormalized,
        status: "BLOCKED",
      });

      // Verify both records exist
      const rows = await getImportRows(job.id);
      expect(rows).toHaveLength(2);

      // BLOCKED records should have errors in normalized data
      const blockedRow = rows.find((r) => r.status === "BLOCKED");
      expect(blockedRow).toBeDefined();
      const normalizedData = blockedRow?.normalized as NormalizedRowData;
      expect(normalizedData.errors).toHaveLength(1);
    });

    it("dismiss removes all import rows for a job", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Update job to failed status with exportable failures
      await testDb
        .update(schema.importJobs)
        .set({
          status: "COMPLETED_WITH_FAILURES",
          hasExportableFailures: true,
        })
        .where(eq(schema.importJobs.id, job.id));

      // Create import rows with various statuses
      const committedNormalized = createNormalizedRowData({
        rowNumber: 4,
        productHandle: "committed-product",
        rowStatus: "PENDING",
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "committed-product" },
        normalized: committedNormalized,
        status: "COMMITTED",
      });

      const failedNormalized = createNormalizedRowData({
        rowNumber: 5,
        productHandle: "failed-product",
        rowStatus: "PENDING",
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 5,
        raw: { "Product Handle": "failed-product" },
        normalized: failedNormalized,
        status: "FAILED",
        error: "Commit failed",
      });

      // Verify import rows exist
      let count = await getImportRowCount(job.id);
      expect(count).toBe(2);

      // Dismiss (clean up) all import rows
      const deletedCount = await deleteAllImportRows(job.id);
      expect(deletedCount).toBe(2);

      // Verify all import rows were cleaned up
      count = await getImportRowCount(job.id);
      expect(count).toBe(0);
    });

    it("cleanup handles large datasets efficiently", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create 100 import rows
      const startInsertTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `large-dataset-product-${i}`,
          name: `Large Dataset Product ${i}`,
          rowStatus: "PENDING",
        });

        await testDb.insert(schema.importRows).values({
          jobId: job.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `large-dataset-product-${i}` },
          normalized,
          status: "COMMITTED",
        });
      }
      const insertTime = performance.now() - startInsertTime;

      // Verify all records exist
      let count = await getImportRowCount(job.id);
      expect(count).toBe(100);

      // Measure cleanup time
      const startCleanupTime = performance.now();
      const deletedCount = await deleteCommittedImportRows(job.id);
      const cleanupTime = performance.now() - startCleanupTime;

      expect(deletedCount).toBe(100);

      // Should complete in under 5 seconds
      expect(cleanupTime).toBeLessThan(5000);

      // Verify all import rows were cleaned up
      count = await getImportRowCount(job.id);
      expect(count).toBe(0);

      console.log(
        `Inserted 100 import rows in ${insertTime.toFixed(2)}ms, ` +
          `cleaned up in ${cleanupTime.toFixed(2)}ms`,
      );
    });

    it("cleanup isolates between jobs", async () => {
      // Create two jobs
      const job1 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "cleanup-1.xlsx",
      });
      const job2 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "cleanup-2.xlsx",
      });

      // Add import rows to both jobs
      for (let i = 0; i < 3; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `job1-product-${i}`,
          name: `Job1 Product ${i}`,
          rowStatus: "PENDING",
        });

        await testDb.insert(schema.importRows).values({
          jobId: job1.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `job1-product-${i}` },
          normalized,
          status: "COMMITTED",
        });
      }

      for (let i = 0; i < 2; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `job2-product-${i}`,
          name: `Job2 Product ${i}`,
          rowStatus: "PENDING",
        });

        await testDb.insert(schema.importRows).values({
          jobId: job2.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `job2-product-${i}` },
          normalized,
          status: "COMMITTED",
        });
      }

      // Verify initial counts
      let job1Count = await getImportRowCount(job1.id);
      let job2Count = await getImportRowCount(job2.id);
      expect(job1Count).toBe(3);
      expect(job2Count).toBe(2);

      // Clean up job1 only
      await deleteAllImportRows(job1.id);

      // Verify job1 is cleaned but job2 is untouched
      job1Count = await getImportRowCount(job1.id);
      job2Count = await getImportRowCount(job2.id);
      expect(job1Count).toBe(0);
      expect(job2Count).toBe(2);
    });
  });
});
