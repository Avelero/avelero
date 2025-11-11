/**
 * Cleanup script for orphaned staging data
 *
 * This script removes staging data left behind from:
 * - Failed imports that didn't complete cleanup
 * - Cancelled imports (before the fix)
 * - Development testing
 *
 * Run with: bun run scripts/cleanup-orphaned-staging-data.ts
 */

import { serviceDb as db } from "@v1/db/client";
import {
  importJobs,
  stagingProducts,
  stagingProductVariants,
} from "@v1/db/schema";
import { eq, inArray, or, and, sql, desc } from "@v1/db/queries";
import { deleteStagingDataForJob } from "@v1/db/queries";

async function cleanupOrphanedStagingData() {
  console.log("🔍 Starting cleanup of orphaned staging data...\n");

  try {
    // Step 1: Get all staging data counts
    console.log("📊 Current staging table status:");

    const stagingProductCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(stagingProducts);

    const stagingVariantCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(stagingProductVariants);

    console.log(
      `  - staging_products: ${stagingProductCount[0]?.count || 0} rows`,
    );
    console.log(
      `  - staging_product_variants: ${stagingVariantCount[0]?.count || 0} rows\n`,
    );

    if (stagingProductCount[0]?.count === 0) {
      console.log("✅ No staging data found - database is clean!");
      return;
    }

    // Step 2: Find jobs with staging data
    console.log("🔍 Finding jobs with staging data...");

    const jobsWithStagingData = await db
      .selectDistinct({
        jobId: stagingProducts.jobId,
        status: importJobs.status,
        filename: importJobs.filename,
        startedAt: importJobs.startedAt,
      })
      .from(stagingProducts)
      .leftJoin(importJobs, eq(stagingProducts.jobId, importJobs.id))
      .orderBy(desc(importJobs.startedAt));

    console.log(
      `\nFound ${jobsWithStagingData.length} job(s) with staging data:\n`,
    );

    for (const job of jobsWithStagingData) {
      const stagingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(stagingProducts)
        .where(eq(stagingProducts.jobId, job.jobId));

      console.log(`📦 Job ID: ${job.jobId}`);
      console.log(`   Status: ${job.status || "UNKNOWN (job deleted)"}`);
      console.log(`   Filename: ${job.filename || "N/A"}`);
      console.log(`   Started: ${job.startedAt || "N/A"}`);
      console.log(`   Staging rows: ${stagingCount[0]?.count || 0}\n`);
    }

    // Step 3: Identify jobs that should be cleaned up
    const jobsToClean = jobsWithStagingData.filter(
      (job) =>
        // Clean up if job status is terminal (completed, cancelled, failed)
        // OR if job was deleted (status is null)
        !job.status ||
        job.status === "COMPLETED" ||
        job.status === "CANCELLED" ||
        job.status === "FAILED",
    );

    if (jobsToClean.length === 0) {
      console.log(
        "⚠️  All staging data belongs to active jobs (VALIDATING or COMMITTING)",
      );
      console.log("💡 Not cleaning up - these jobs may still be in progress\n");

      const activeJobs = jobsWithStagingData.filter(
        (job) => job.status === "VALIDATING" || job.status === "COMMITTING",
      );

      if (activeJobs.length > 0) {
        console.log("🔄 Active jobs:");
        for (const job of activeJobs) {
          console.log(`   - ${job.jobId} (${job.status})`);
        }
      }
      return;
    }

    console.log(`🧹 Will clean up ${jobsToClean.length} job(s):\n`);

    // Step 4: Ask for confirmation (or provide --force flag)
    const shouldCleanup =
      process.argv.includes("--force") || process.argv.includes("-f");

    if (!shouldCleanup) {
      console.log("⚠️  DRY RUN MODE - No data will be deleted");
      console.log("💡 Run with --force flag to actually delete data:");
      console.log(
        "   bun run scripts/cleanup-orphaned-staging-data.ts --force\n",
      );

      for (const job of jobsToClean) {
        console.log(
          `   Would delete staging data for job: ${job.jobId} (${job.status || "DELETED"})`,
        );
      }

      return;
    }

    // Step 5: Clean up staging data
    console.log("🗑️  Deleting orphaned staging data...\n");

    let totalDeleted = 0;

    for (const job of jobsToClean) {
      try {
        console.log(`   Cleaning job ${job.jobId}...`);
        const deletedCount = await deleteStagingDataForJob(db, job.jobId);
        totalDeleted += deletedCount;
        console.log(`   ✅ Deleted ${deletedCount} staging records`);
      } catch (error) {
        console.error(`   ❌ Failed to clean job ${job.jobId}:`, error);
      }
    }

    // Step 6: Final counts
    console.log("\n" + "=".repeat(50));
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Total staging records deleted: ${totalDeleted}\n`);

    const finalProductCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(stagingProducts);

    const finalVariantCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(stagingProductVariants);

    console.log("📊 Final staging table status:");
    console.log(
      `  - staging_products: ${finalProductCount[0]?.count || 0} rows`,
    );
    console.log(
      `  - staging_product_variants: ${finalVariantCount[0]?.count || 0} rows\n`,
    );

    if (finalProductCount[0]?.count === 0) {
      console.log("🎉 Database is now clean!\n");
    } else {
      console.log("⚠️  Some staging data remains (likely from active jobs)\n");
    }
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedStagingData()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
