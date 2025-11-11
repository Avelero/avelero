/**
 * Bulk cleanup script - deletes ALL staging data at once
 *
 * Run with: bun run scripts/cleanup-all-staging.ts [--force]
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupAllStagingData() {
  console.log("🔍 BULK CLEANUP - Deleting ALL staging data...\n");

  try {
    // Step 1: Get current counts
    const { count: beforeProducts } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true });

    const { count: beforeVariants } = await supabase
      .from("staging_product_variants")
      .select("*", { count: "exact", head: true });

    console.log("📊 Current staging data:");
    console.log(`  - staging_products: ${beforeProducts || 0} rows`);
    console.log(`  - staging_product_variants: ${beforeVariants || 0} rows\n`);

    if (beforeProducts === 0) {
      console.log("✅ Database is already clean!");
      return;
    }

    // Step 2: Check for --force flag
    const shouldCleanup =
      process.argv.includes("--force") || process.argv.includes("-f");

    if (!shouldCleanup) {
      console.log("⚠️  DRY RUN MODE");
      console.log(
        `💡 Would delete ${beforeProducts} staging products (and ${beforeVariants} variants)\n`,
      );
      console.log("Run with --force to actually delete:");
      console.log("  bun run scripts/cleanup-all-staging.ts --force\n");
      return;
    }

    // Step 3: Delete ALL staging data (CASCADE handles related tables)
    console.log("🗑️  Deleting ALL staging data...");

    const { error, count } = await supabase
      .from("staging_products")
      .delete()
      .neq("staging_id", "00000000-0000-0000-0000-000000000000"); // Delete all (dummy condition)

    if (error) {
      console.error("❌ Deletion failed:", error.message);
      process.exit(1);
    }

    console.log(`✅ Deleted all staging data!\n`);

    // Step 4: Verify cleanup
    const { count: afterProducts } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true });

    const { count: afterVariants } = await supabase
      .from("staging_product_variants")
      .select("*", { count: "exact", head: true });

    console.log("==================================================");
    console.log("\n📊 Final staging data:");
    console.log(`  - staging_products: ${afterProducts || 0} rows`);
    console.log(`  - staging_product_variants: ${afterVariants || 0} rows\n`);

    if (afterProducts === 0) {
      console.log("🎉 Database is now completely clean!\n");
      console.log(
        `Total deleted: ${beforeProducts} products, ${beforeVariants} variants\n`,
      );
    } else {
      console.log("⚠️  Warning: Some data remains\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

cleanupAllStagingData()
  .then(() => {
    console.log("Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
