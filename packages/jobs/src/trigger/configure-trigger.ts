/**
 * Configuration for Trigger.dev v4.
 *
 * In v4, configuration is handled via trigger.config.ts and environment variables.
 * The SDK automatically reads TRIGGER_SECRET_KEY from the environment.
 *
 * This file is kept for compatibility but no longer performs manual configuration.
 */

import { resolve } from "node:path";
// Load environment variables from .env file
import { config } from "dotenv";

// Load .env from the jobs package directory
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath });

console.log("[trigger-config] Loading environment from:", envPath);
console.log("[trigger-config] Environment variables loaded:", {
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
  hasTriggerSecret: !!process.env.TRIGGER_SECRET_KEY,
});

// Validate that TRIGGER_SECRET_KEY is set
const accessToken = process.env.TRIGGER_SECRET_KEY?.trim();

if (!accessToken) {
  console.warn(
    "[trigger-config] Warning: TRIGGER_SECRET_KEY is not set. " +
      "Tasks may fail to trigger. Set TRIGGER_SECRET_KEY in your .env file.",
  );
} else {
  console.log("[trigger-config] Trigger.dev SDK environment validated", {
    hasTriggerSecret: true,
    apiUrl: process.env.TRIGGER_API_URL || "https://api.trigger.dev",
  });
}
