/**
 * Test Database Cleanup
 *
 * Provides table cleanup functions for test isolation.
 * Uses dynamic table discovery to avoid hardcoded lists.
 *
 * @module @v1/db/testing/cleanup
 */

import { sql } from "drizzle-orm";
import { testDb, isConnectionClosed } from "./connection";

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
    await testDb.execute(sql.raw(`TRUNCATE TABLE ${tableList} CASCADE`));
}
