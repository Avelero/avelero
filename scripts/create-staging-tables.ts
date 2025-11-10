import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";

const sql = postgres(
  "postgresql://postgres.ebshgnuavsacpplatsqt:NWofA6vgeVsTfTS9@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
  {
    prepare: false,
  },
);

async function createStagingTables() {
  try {
    console.log("Reading SQL file...");
    const sqlFile = readFileSync(
      resolve(__dirname, "create-staging-tables.sql"),
      "utf-8",
    );

    console.log("Executing SQL to create staging tables...");
    await sql.unsafe(sqlFile);

    console.log("✅ Staging tables created successfully!");
  } catch (error) {
    console.error("❌ Error creating staging tables:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createStagingTables();
