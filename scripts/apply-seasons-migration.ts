#!/usr/bin/env bun
import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
config({ path: join(__dirname, "../packages/db/.env.local") });

const migrationPath = join(__dirname, "../apps/api/supabase/migrations/20251111202000_add_brand_seasons.sql");
const sql = postgres(process.env.DATABASE_URL!);

async function applyMigration() {
  try {
    console.log("📦 Reading migration file...");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    
    console.log("🚀 Applying migration to database...");
    await sql.unsafe(migrationSQL);
    
    console.log("✅ Migration applied successfully!");
    console.log("\nCreated:");
    console.log("  - brand_seasons table");
    console.log("  - season_id column in products");
    console.log("  - season_id column in staging_products");
    console.log("  - RLS policies for brand_seasons");
    console.log("\nNote: Old 'season' text columns are kept for data migration.");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
