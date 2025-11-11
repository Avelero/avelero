#!/usr/bin/env bun
/**
 * Data migration script for seasons
 *
 * This script migrates existing season text values to the new brand_seasons table
 * and populates the season_id FK columns in products and staging_products.
 *
 * Steps:
 * 1. Extract unique season values per brand from products.season and staging_products.season
 * 2. Create brand_seasons records for each unique season name
 * 3. Update products.season_id based on matching season text
 * 4. Update staging_products.season_id based on matching season text
 * 5. Report statistics and unmigrated records
 *
 * Run with: bun run scripts/migrate-seasons-data.ts
 * Dry run: bun run scripts/migrate-seasons-data.ts --dry-run
 * Force: bun run scripts/migrate-seasons-data.ts --force
 */

import { serviceDb as db } from "@v1/db/client";
import { products, stagingProducts, brandSeasons } from "@v1/db/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { createSeason } from "@v1/db/queries";

interface SeasonStats {
  brandId: string;
  uniqueSeasons: string[];
  productsCount: number;
  stagingCount: number;
}

interface MigrationResult {
  brandId: string;
  seasonName: string;
  seasonId: string;
  productsUpdated: number;
  stagingUpdated: number;
}

async function extractUniqueSeasons(): Promise<SeasonStats[]> {
  console.log("🔍 Extracting unique season values per brand...\n");

  // Get unique seasons from products table
  const productSeasons = await db
    .select({
      brandId: products.brandId,
      season: products.season,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(and(isNotNull(products.season), isNotNull(products.brandId)))
    .groupBy(products.brandId, products.season);

  // Get unique seasons from staging_products table
  const stagingSeasons = await db
    .select({
      brandId: stagingProducts.brandId,
      season: stagingProducts.season,
      count: sql<number>`count(*)::int`,
    })
    .from(stagingProducts)
    .where(and(isNotNull(stagingProducts.season), isNotNull(stagingProducts.brandId)))
    .groupBy(stagingProducts.brandId, stagingProducts.season);

  // Combine and organize by brand
  const seasonsByBrand = new Map<string, SeasonStats>();

  for (const row of productSeasons) {
    if (!row.brandId || !row.season) continue;

    if (!seasonsByBrand.has(row.brandId)) {
      seasonsByBrand.set(row.brandId, {
        brandId: row.brandId,
        uniqueSeasons: [],
        productsCount: 0,
        stagingCount: 0,
      });
    }

    const stats = seasonsByBrand.get(row.brandId)!;
    if (!stats.uniqueSeasons.includes(row.season)) {
      stats.uniqueSeasons.push(row.season);
    }
    stats.productsCount += row.count;
  }

  for (const row of stagingSeasons) {
    if (!row.brandId || !row.season) continue;

    if (!seasonsByBrand.has(row.brandId)) {
      seasonsByBrand.set(row.brandId, {
        brandId: row.brandId,
        uniqueSeasons: [],
        productsCount: 0,
        stagingCount: 0,
      });
    }

    const stats = seasonsByBrand.get(row.brandId)!;
    if (!stats.uniqueSeasons.includes(row.season)) {
      stats.uniqueSeasons.push(row.season);
    }
    stats.stagingCount += row.count;
  }

  return Array.from(seasonsByBrand.values());
}

async function createSeasonRecords(
  stats: SeasonStats[],
  dryRun: boolean,
): Promise<Map<string, Map<string, string>>> {
  console.log("📝 Creating brand_seasons records...\n");

  const seasonIdMap = new Map<string, Map<string, string>>(); // brandId -> (seasonName -> seasonId)

  for (const brandStats of stats) {
    console.log(`\n📦 Brand: ${brandStats.brandId}`);
    console.log(`   Unique seasons: ${brandStats.uniqueSeasons.length}`);
    console.log(`   Products affected: ${brandStats.productsCount}`);
    console.log(`   Staging affected: ${brandStats.stagingCount}`);

    if (!seasonIdMap.has(brandStats.brandId)) {
      seasonIdMap.set(brandStats.brandId, new Map());
    }

    const brandSeasonMap = seasonIdMap.get(brandStats.brandId)!;

    for (const seasonName of brandStats.uniqueSeasons) {
      console.log(`   Creating season: "${seasonName}"`);

      if (dryRun) {
        // In dry run, generate a fake ID
        brandSeasonMap.set(seasonName, `dry-run-${Date.now()}-${Math.random()}`);
        console.log(`     [DRY RUN] Would create season record`);
      } else {
        try {
          // Check if season already exists
          const existing = await db
            .select({ id: brandSeasons.id })
            .from(brandSeasons)
            .where(
              and(
                eq(brandSeasons.brandId, brandStats.brandId),
                eq(brandSeasons.name, seasonName),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            brandSeasonMap.set(seasonName, existing[0]!.id);
            console.log(`     ✓ Season already exists (id: ${existing[0]!.id})`);
          } else {
            // Create new season record
            const newSeason = await createSeason(db, brandStats.brandId, {
              name: seasonName,
              // Leave dates as null since we don't have that data
              startDate: null,
              endDate: null,
              ongoing: false, // Default to false, users can update later
            });

            if (!newSeason) {
              throw new Error(`Failed to create season: ${seasonName}`);
            }

            brandSeasonMap.set(seasonName, newSeason.id);
            console.log(`     ✓ Created (id: ${newSeason.id})`);
          }
        } catch (error) {
          console.error(`     ❌ Failed to create season:`, error);
          throw error;
        }
      }
    }
  }

  return seasonIdMap;
}

async function updateProductSeasonIds(
  seasonIdMap: Map<string, Map<string, string>>,
  dryRun: boolean,
): Promise<number> {
  console.log("\n🔄 Updating products.season_id...\n");

  let totalUpdated = 0;

  for (const [brandId, seasonMap] of seasonIdMap.entries()) {
    for (const [seasonName, seasonId] of seasonMap.entries()) {
      if (dryRun) {
        // Count how many would be updated
        const count = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(
            and(
              eq(products.brandId, brandId),
              eq(products.season, seasonName),
            ),
          );

        const affectedCount = count[0]?.count || 0;
        totalUpdated += affectedCount;
        console.log(
          `   [DRY RUN] Would update ${affectedCount} products with season "${seasonName}"`,
        );
      } else {
        // Update products with matching season text
        const result = await db
          .update(products)
          .set({ seasonId })
          .where(
            and(
              eq(products.brandId, brandId),
              eq(products.season, seasonName),
            ),
          );

        // Get count of affected rows (Drizzle doesn't return this directly)
        const count = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(
            and(
              eq(products.brandId, brandId),
              eq(products.seasonId, seasonId),
            ),
          );

        const affectedCount = count[0]?.count || 0;
        totalUpdated += affectedCount;
        console.log(
          `   ✓ Updated ${affectedCount} products with season "${seasonName}" (id: ${seasonId})`,
        );
      }
    }
  }

  return totalUpdated;
}

async function updateStagingSeasonIds(
  seasonIdMap: Map<string, Map<string, string>>,
  dryRun: boolean,
): Promise<number> {
  console.log("\n🔄 Updating staging_products.season_id...\n");

  let totalUpdated = 0;

  for (const [brandId, seasonMap] of seasonIdMap.entries()) {
    for (const [seasonName, seasonId] of seasonMap.entries()) {
      if (dryRun) {
        // Count how many would be updated
        const count = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stagingProducts)
          .where(
            and(
              eq(stagingProducts.brandId, brandId),
              eq(stagingProducts.season, seasonName),
            ),
          );

        const affectedCount = count[0]?.count || 0;
        totalUpdated += affectedCount;
        console.log(
          `   [DRY RUN] Would update ${affectedCount} staging products with season "${seasonName}"`,
        );
      } else {
        // Update staging products with matching season text
        const result = await db
          .update(stagingProducts)
          .set({ seasonId })
          .where(
            and(
              eq(stagingProducts.brandId, brandId),
              eq(stagingProducts.season, seasonName),
            ),
          );

        // Get count of affected rows
        const count = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stagingProducts)
          .where(
            and(
              eq(stagingProducts.brandId, brandId),
              eq(stagingProducts.seasonId, seasonId),
            ),
          );

        const affectedCount = count[0]?.count || 0;
        totalUpdated += affectedCount;
        console.log(
          `   ✓ Updated ${affectedCount} staging products with season "${seasonName}" (id: ${seasonId})`,
        );
      }
    }
  }

  return totalUpdated;
}

async function verifyMigration() {
  console.log("\n📊 Verifying migration...\n");

  // Count products with season text but no season_id
  const unmigrated = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNotNull(products.season), sql`${products.seasonId} IS NULL`));

  const unmigratedCount = unmigrated[0]?.count || 0;

  // Count staging products with season text but no season_id
  const unmigratedStaging = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stagingProducts)
    .where(
      and(isNotNull(stagingProducts.season), sql`${stagingProducts.seasonId} IS NULL`),
    );

  const unmigratedStagingCount = unmigratedStaging[0]?.count || 0;

  // Count migrated products
  const migrated = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(isNotNull(products.seasonId));

  const migratedCount = migrated[0]?.count || 0;

  // Count migrated staging products
  const migratedStaging = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stagingProducts)
    .where(isNotNull(stagingProducts.seasonId));

  const migratedStagingCount = migratedStaging[0]?.count || 0;

  console.log("✅ Migration verification:");
  console.log(`   Products migrated: ${migratedCount}`);
  console.log(`   Products unmigrated: ${unmigratedCount}`);
  console.log(`   Staging products migrated: ${migratedStagingCount}`);
  console.log(`   Staging products unmigrated: ${unmigratedStagingCount}`);

  if (unmigratedCount > 0 || unmigratedStagingCount > 0) {
    console.log("\n⚠️  Some records were not migrated:");

    if (unmigratedCount > 0) {
      // Show sample unmigrated products
      const samples = await db
        .select({
          id: products.id,
          brandId: products.brandId,
          season: products.season,
        })
        .from(products)
        .where(
          and(isNotNull(products.season), sql`${products.seasonId} IS NULL`),
        )
        .limit(5);

      console.log("\n   Sample unmigrated products:");
      for (const sample of samples) {
        console.log(
          `     - Product ${sample.id}: brand=${sample.brandId}, season="${sample.season}"`,
        );
      }
    }

    if (unmigratedStagingCount > 0) {
      // Show sample unmigrated staging products
      const samples = await db
        .select({
          id: stagingProducts.id,
          brandId: stagingProducts.brandId,
          season: stagingProducts.season,
        })
        .from(stagingProducts)
        .where(
          and(
            isNotNull(stagingProducts.season),
            sql`${stagingProducts.seasonId} IS NULL`,
          ),
        )
        .limit(5);

      console.log("\n   Sample unmigrated staging products:");
      for (const sample of samples) {
        console.log(
          `     - Staging ${sample.id}: brand=${sample.brandId}, season="${sample.season}"`,
        );
      }
    }

    return false;
  }

  console.log("\n🎉 All records with season text have been migrated!");
  return true;
}

async function migrateSeasons() {
  const isDryRun = process.argv.includes("--dry-run");
  const isForce = process.argv.includes("--force");

  console.log("🚀 Season Data Migration Script");
  console.log("=" .repeat(50));

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No data will be modified\n");
  } else if (!isForce) {
    console.log("⚠️  PREVIEW MODE - Run with --force to apply changes");
    console.log("💡 Or use --dry-run to see what would happen\n");
  } else {
    console.log("⚡ FORCE MODE - Changes will be applied\n");
  }

  try {
    // Step 1: Extract unique seasons
    const seasonStats = await extractUniqueSeasons();

    if (seasonStats.length === 0) {
      console.log("\n✅ No season data found - nothing to migrate!");
      return;
    }

    console.log("\n📊 Summary:");
    console.log(`   Total brands with seasons: ${seasonStats.length}`);
    let totalSeasons = 0;
    let totalProducts = 0;
    let totalStaging = 0;

    for (const stats of seasonStats) {
      totalSeasons += stats.uniqueSeasons.length;
      totalProducts += stats.productsCount;
      totalStaging += stats.stagingCount;
    }

    console.log(`   Total unique seasons: ${totalSeasons}`);
    console.log(`   Products to update: ${totalProducts}`);
    console.log(`   Staging products to update: ${totalStaging}`);

    if (!isForce && !isDryRun) {
      console.log("\n💡 Run with --force to proceed with migration:");
      console.log("   bun run scripts/migrate-seasons-data.ts --force\n");
      return;
    }

    // Step 2: Create season records
    const seasonIdMap = await createSeasonRecords(seasonStats, isDryRun);

    // Step 3: Update products table
    const productsUpdated = await updateProductSeasonIds(seasonIdMap, isDryRun);

    // Step 4: Update staging_products table
    const stagingUpdated = await updateStagingSeasonIds(seasonIdMap, isDryRun);

    // Step 5: Verify migration (only in force mode)
    if (isForce && !isDryRun) {
      await verifyMigration();
    }

    // Final summary
    console.log("\n" + "=".repeat(50));
    console.log("\n✅ Migration complete!");
    console.log(`   Brand_seasons created: ${totalSeasons}`);
    console.log(`   Products updated: ${productsUpdated}`);
    console.log(`   Staging products updated: ${stagingUpdated}`);

    if (isDryRun) {
      console.log("\n💡 This was a dry run. Run with --force to apply changes:");
      console.log("   bun run scripts/migrate-seasons-data.ts --force\n");
    } else if (isForce) {
      console.log("\n🎉 Season data migration successful!\n");
      console.log("📝 Next steps:");
      console.log("   1. Verify migrated data in database");
      console.log("   2. Test CSV imports with seasons");
      console.log("   3. Test product creation/updates");
      console.log("   4. Once verified, consider dropping old season columns:\n");
      console.log("      ALTER TABLE products DROP COLUMN season;");
      console.log("      ALTER TABLE staging_products DROP COLUMN season;\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateSeasons()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
