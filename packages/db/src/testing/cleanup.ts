/**
 * Test Database Cleanup
 *
 * Provides table cleanup functions for test isolation.
 * Uses dynamic table discovery to avoid hardcoded lists.
 *
 * @module @v1/db/testing/cleanup
 */

import { sql } from "drizzle-orm";
import { isConnectionClosed, testDb } from "./connection";

/**
 * Tables that should NOT be cleaned between tests.
 * These contain reference data that is seeded once and should persist.
 */
export const protectedTables = new Set([
  // Taxonomy data - seeded by taxonomy sync, required for all tests
  "taxonomy_categories",
  "taxonomy_attributes",
  "taxonomy_values",
  "taxonomy_external_mappings",
  // System tables
  "users",
  // Reference tables
  "integrations",
]);

const CLEANUP_MAX_ATTEMPTS = 5;
const CLEANUP_RETRY_DELAY_MS = 25;
const RETRYABLE_CLEANUP_ERROR_CODES = new Set(["40P01", "40001", "55P03"]);

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean all user tables between tests.
 * Dynamically queries the database for all tables and truncates them,
 * except for protected tables that contain reference data.
 *
 * Uses a single TRUNCATE statement with CASCADE for speed.
 */
export async function cleanupTables(): Promise<void> {
  // Skip cleanup if connection is already closed
  if (isConnectionClosed()) {
    return;
  }

  // Query all user tables from the public schema
  const result = await testDb.execute<{ tablename: string }>(sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'drizzle_%'
        AND tablename NOT LIKE 'pg_%'
    `);

  // Filter out protected tables and sort alphabetically
  // Sorting ensures consistent lock order across parallel test runs,
  // which prevents deadlocks when multiple test processes clean up simultaneously
  const tablesToClean = result
    .map((row) => row.tablename)
    .filter((table) => !protectedTables.has(table))
    .sort();

  if (tablesToClean.length === 0) {
    return;
  }

  // Build a single TRUNCATE statement for all tables
  // This is faster than truncating one by one and handles FK dependencies with CASCADE
  const tableList = tablesToClean.map((t) => `"${t}"`).join(", ");
  const truncateSql = sql.raw(`TRUNCATE TABLE ${tableList} CASCADE`);

  for (let attempt = 1; attempt <= CLEANUP_MAX_ATTEMPTS; attempt++) {
    try {
      await testDb.execute(truncateSql);
      return;
    } catch (error) {
      const code = getErrorCode(error);
      const isRetryable = code && RETRYABLE_CLEANUP_ERROR_CODES.has(code);
      const canRetry = isRetryable && attempt < CLEANUP_MAX_ATTEMPTS;

      if (!canRetry) {
        throw error;
      }

      await delay(attempt * CLEANUP_RETRY_DELAY_MS);
    }
  }
}
