/**
 * Integration Test Setup - DB Package
 *
 * Initializes database cleanup between tests.
 * Uses @v1/testing for shared test utilities.
 */

// Load .env.test FIRST before any other imports that depend on DATABASE_URL
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dir, "../.env.test") });

import { beforeAll, afterAll, afterEach } from "bun:test";
import { cleanupTables, closeTestDb } from "@v1/testing/db";

// Clean database before all tests to ensure a fresh state
// This handles cases where a previous run failed and left stale data
beforeAll(async () => {
    await cleanupTables();
});

// Clean database after each test
afterEach(async () => {
    await cleanupTables();
});

// Close database connection after all tests
afterAll(async () => {
    await closeTestDb();
});
