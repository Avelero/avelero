/**
 * Cleanup script for orphaned staging data using Supabase client
 *
 * Run with: bun run scripts/cleanup-staging-supabase.ts [--force]
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupOrphanedStagingData() {
  console.log("🔍 Starting cleanup of orphaned staging data...\n");

  try {
    // Step 1: Get current staging data counts
    console.log("📊 Current staging table status:");

    const { count: productCount } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true });

    const { count: variantCount } = await supabase
      .from("staging_product_variants")
      .select("*", { count: "exact", head: true });

    console.log(`  - staging_products: ${productCount || 0} rows`);
    console.log(`  - staging_product_variants: ${variantCount || 0} rows\n`);

    if (productCount === 0) {
      console.log("✅ No staging data found - database is clean!");
      return;
    }

    // Step 2: Find jobs with staging data
    console.log("🔍 Finding jobs with staging data...");

    const { data: stagingData } = await supabase
      .from("staging_products")
      .select("job_id")
      .order("created_at", { ascending: false });

    if (!stagingData || stagingData.length === 0) {
      console.log("No staging data found");
      return;
    }

    const uniqueJobIds = [...new Set(stagingData.map((s) => s.job_id))];

    console.log(
      `\nFound ${uniqueJobIds.length} unique job(s) with staging data:\n`,
    );

    // Get job details
    const { data: jobs } = await supabase
      .from("import_jobs")
      .select("id, status, filename, started_at")
      .in("id", uniqueJobIds);

    const jobsMap = new Map(jobs?.map((j) => [j.id, j]) || []);

    for (const jobId of uniqueJobIds) {
      const job = jobsMap.get(jobId);

      const { count } = await supabase
        .from("staging_products")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId);

      console.log(`📦 Job ID: ${jobId}`);
      console.log(`   Status: ${job?.status || "UNKNOWN (job deleted)"}`);
      console.log(`   Filename: ${job?.filename || "N/A"}`);
      console.log(`   Started: ${job?.started_at || "N/A"}`);
      console.log(`   Staging rows: ${count || 0}\n`);
    }

    // Step 3: Identify jobs to clean (ALL jobs since we're cleaning up from buggy implementation)
    const jobsToClean = uniqueJobIds;

    console.log(
      "⚠️  Cleaning up ALL staging data (including VALIDATING/COMMITTING jobs)",
    );
    console.log(
      "💡 This is safe because these are from buggy implementation attempts\n",
    );

    console.log(`🧹 Will clean up ${jobsToClean.length} job(s):\n`);

    // Step 4: Check for --force flag
    const shouldCleanup =
      process.argv.includes("--force") || process.argv.includes("-f");

    if (!shouldCleanup) {
      console.log("⚠️  DRY RUN MODE - No data will be deleted");
      console.log("💡 Run with --force flag to actually delete data:");
      console.log("   bun run scripts/cleanup-staging-supabase.ts --force\n");

      for (const jobId of jobsToClean) {
        const job = jobsMap.get(jobId);
        console.log(
          `   Would delete staging data for job: ${jobId} (${job?.status || "DELETED"})`,
        );
      }

      return;
    }

    // Step 5: Clean up staging data
    console.log("🗑️  Deleting orphaned staging data...\n");

    let totalDeleted = 0;

    for (const jobId of jobsToClean) {
      const job = jobsMap.get(jobId);
      console.log(`   Cleaning job ${jobId} (${job?.status || "DELETED"})...`);

      const { count: beforeCount } = await supabase
        .from("staging_products")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId);

      // Delete staging products (CASCADE will delete variants, materials, etc.)
      const { error } = await supabase
        .from("staging_products")
        .delete()
        .eq("job_id", jobId);

      if (error) {
        console.error(`   ❌ Failed to clean job ${jobId}:`, error.message);
      } else {
        totalDeleted += beforeCount || 0;
        console.log(`   ✅ Deleted ${beforeCount || 0} staging records`);
      }
    }

    // Step 6: Final counts
    console.log("\n" + "=".repeat(50));
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Total staging records deleted: ${totalDeleted}\n`);

    const { count: finalProductCount } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true });

    const { count: finalVariantCount } = await supabase
      .from("staging_product_variants")
      .select("*", { count: "exact", head: true });

    console.log("📊 Final staging table status:");
    console.log(`  - staging_products: ${finalProductCount || 0} rows`);
    console.log(
      `  - staging_product_variants: ${finalVariantCount || 0} rows\n`,
    );

    if (finalProductCount === 0) {
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
