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

import { beforeAll, afterEach } from "bun:test";
import { cleanupTables } from "@v1/db/testing";

// Clean database before all tests to ensure a fresh state
// This handles cases where a previous run failed and left stale data
beforeAll(async () => {
  await cleanupTables();
});

// Clean database after each test
afterEach(async () => {
  await cleanupTables();
});

// NOTE: We intentionally do NOT call closeTestDb() here.
// When multiple test packages share the same testDb connection,
// the first package to finish would close the connection, breaking remaining tests.
// The connection will close automatically when the test process exits.
