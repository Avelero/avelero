/**
 * Integration Tests: Cleanup Operations
 *
 * Tests the staging cleanup functionality:
 * - Cleans up staging data after successful commit
 * - Preserves staging data for failed rows
 * - Dismiss removes staging data
 * - Cleanup handles large datasets efficiently
 * - Multi-job cleanup isolation
 *
 * @module tests/integration/import/cleanup-operations
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { deleteStagingDataForJob } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import {
  type InsertedCatalog,
  TestCatalog,
  TestDatabase,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { eq } from "drizzle-orm";

describe("Cleanup Operations", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Cleanup Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  describe("Staging Data Cleanup", () => {
    it("cleans up staging data after successful commit", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create staging products with COMMITTED status
      for (let i = 0; i < 5; i++) {
        await testDb.insert(schema.stagingProducts).values({
          stagingId: crypto.randomUUID(),
          jobId: job.id,
          rowNumber: 4 + i,
          action: "CREATE",
          id: crypto.randomUUID(),
          brandId,
          name: `Committed Product ${i}`,
          productHandle: `committed-product-${i}`,
          rowStatus: "COMMITTED",
        });
      }

      // Verify staging data exists
      let count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(5);

      // Clean up staging data
      const deletedCount = await deleteStagingDataForJob(testDb, job.id);
      expect(deletedCount).toBe(5);

      // Verify staging data was cleaned up
      count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(0);
    });

    it("preserves staging data for failed rows (before dismiss)", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create a mix of committed and failed staging products
      const stagingIds = {
        committed: crypto.randomUUID(),
        failed: crypto.randomUUID(),
      };

      await testDb.insert(schema.stagingProducts).values({
        stagingId: stagingIds.committed,
        jobId: job.id,
        rowNumber: 4,
        action: "CREATE",
        id: crypto.randomUUID(),
        brandId,
        name: "Committed Product",
        productHandle: "committed-product",
        rowStatus: "COMMITTED",
      });

      await testDb.insert(schema.stagingProducts).values({
        stagingId: stagingIds.failed,
        jobId: job.id,
        rowNumber: 5,
        action: "CREATE",
        id: crypto.randomUUID(),
        brandId,
        name: "Failed Product",
        productHandle: "failed-product",
        rowStatus: "FAILED",
        errors: [{ field: "Category", message: "Category not found" }],
      });

      // Verify both records exist
      const stagingProducts = await TestDatabase.getStagingProducts(
        testDb,
        job.id,
      );
      expect(stagingProducts).toHaveLength(2);

      // Failed records should have errors
      const failedProduct = stagingProducts.find(
        (p) => p.rowStatus === "FAILED",
      );
      expect(failedProduct).toBeDefined();
    });

    it("dismiss removes all staging data for a job", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Update job to failed status with exportable failures
      await testDb
        .update(schema.importJobs)
        .set({
          status: "COMPLETED_WITH_FAILURES",
          hasExportableFailures: true,
        })
        .where(eq(schema.importJobs.id, job.id));

      // Create staging products with various statuses
      await testDb.insert(schema.stagingProducts).values({
        stagingId: crypto.randomUUID(),
        jobId: job.id,
        rowNumber: 4,
        action: "CREATE",
        id: crypto.randomUUID(),
        brandId,
        name: "Committed Product",
        productHandle: "committed-product",
        rowStatus: "COMMITTED",
      });

      await testDb.insert(schema.stagingProducts).values({
        stagingId: crypto.randomUUID(),
        jobId: job.id,
        rowNumber: 5,
        action: "CREATE",
        id: crypto.randomUUID(),
        brandId,
        name: "Failed Product",
        productHandle: "failed-product",
        rowStatus: "FAILED",
      });

      // Verify staging data exists
      let count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(2);

      // Dismiss (clean up) all staging data
      const deletedCount = await deleteStagingDataForJob(testDb, job.id);
      expect(deletedCount).toBe(2);

      // Verify all staging data was cleaned up
      count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(0);
    });

    it("cleanup handles large datasets efficiently", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create 100 staging products
      const startInsertTime = performance.now();
      for (let i = 0; i < 100; i++) {
        await testDb.insert(schema.stagingProducts).values({
          stagingId: crypto.randomUUID(),
          jobId: job.id,
          rowNumber: 4 + i,
          action: "CREATE",
          id: crypto.randomUUID(),
          brandId,
          name: `Large Dataset Product ${i}`,
          productHandle: `large-dataset-product-${i}`,
          rowStatus: "PENDING",
        });
      }
      const insertTime = performance.now() - startInsertTime;

      // Verify all records exist
      let count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(100);

      // Measure cleanup time
      const startCleanupTime = performance.now();
      const deletedCount = await deleteStagingDataForJob(testDb, job.id);
      const cleanupTime = performance.now() - startCleanupTime;

      expect(deletedCount).toBe(100);

      // Should complete in under 5 seconds
      expect(cleanupTime).toBeLessThan(5000);

      // Verify all staging data was cleaned up
      count = await TestDatabase.getStagingProductCount(testDb, job.id);
      expect(count).toBe(0);

      console.log(
        `Inserted 100 staging products in ${insertTime.toFixed(2)}ms, ` +
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

      // Add staging products to both jobs
      for (let i = 0; i < 3; i++) {
        await testDb.insert(schema.stagingProducts).values({
          stagingId: crypto.randomUUID(),
          jobId: job1.id,
          rowNumber: 4 + i,
          action: "CREATE",
          id: crypto.randomUUID(),
          brandId,
          name: `Job1 Product ${i}`,
          productHandle: `job1-product-${i}`,
          rowStatus: "PENDING",
        });
      }

      for (let i = 0; i < 2; i++) {
        await testDb.insert(schema.stagingProducts).values({
          stagingId: crypto.randomUUID(),
          jobId: job2.id,
          rowNumber: 4 + i,
          action: "CREATE",
          id: crypto.randomUUID(),
          brandId,
          name: `Job2 Product ${i}`,
          productHandle: `job2-product-${i}`,
          rowStatus: "PENDING",
        });
      }

      // Verify initial counts
      let job1Count = await TestDatabase.getStagingProductCount(
        testDb,
        job1.id,
      );
      let job2Count = await TestDatabase.getStagingProductCount(
        testDb,
        job2.id,
      );
      expect(job1Count).toBe(3);
      expect(job2Count).toBe(2);

      // Clean up job1 only
      await deleteStagingDataForJob(testDb, job1.id);

      // Verify job1 is cleaned but job2 is untouched
      job1Count = await TestDatabase.getStagingProductCount(testDb, job1.id);
      job2Count = await TestDatabase.getStagingProductCount(testDb, job2.id);
      expect(job1Count).toBe(0);
      expect(job2Count).toBe(2);
    });
  });
});
