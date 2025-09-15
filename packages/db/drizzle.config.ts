import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Load environment variables from .env.local
config({ path: ".env.local" });

export default {
  schema: "./src/schema/index.ts",
  out: "../../apps/api/supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Supabase-specific configuration
  schemaFilter: ["public"],
  tablesFilter: ["!_*"], // Exclude internal tables that start with underscore
  verbose: true,
  strict: true,
  // Migration configuration
  migrations: {
    prefix: "timestamp", // Use timestamp prefix instead of sequential numbers
  },
} satisfies Config;
