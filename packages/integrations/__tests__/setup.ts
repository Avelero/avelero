/**
 * Integration Test Setup
 *
 * Initializes MSW mock server and database cleanup between tests.
 * Uses @v1/testing for shared test utilities.
 */

// Load .env.test FIRST before any other imports that depend on DATABASE_URL
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dir, "../.env.test") });

import { beforeAll, afterAll, afterEach } from "bun:test";
import { mockServer } from "@v1/testing/mocks/shopify";
import { cleanupTables } from "@v1/db/testing";

// Clean database before all tests to ensure a fresh state
// This handles cases where a previous run failed and left stale data
beforeAll(async () => {
    await cleanupTables();
    mockServer.listen({ onUnhandledRequest: "error" });
});

// Reset handlers and clean database after each test
afterEach(async () => {
    mockServer.resetHandlers();
    await cleanupTables();
});

// Close mock server after all tests
// NOTE: We intentionally do NOT call closeTestDb() here.
// When multiple test packages share the same testDb connection,
// the first package to finish would close the connection, breaking remaining tests.
// The connection will close automatically when the test process exits.
afterAll(async () => {
    mockServer.close();
});
