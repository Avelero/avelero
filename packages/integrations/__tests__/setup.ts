/**
 * Integration Test Setup
 *
 * Initializes MSW mock server and database cleanup between tests.
 */

import { beforeAll, afterAll, afterEach } from "vitest";
import { mockServer } from "./utils/mock-shopify";
import { cleanupTables, closeTestDb } from "./utils/test-db";

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

// Close mock server and database connection after all tests
afterAll(async () => {
    mockServer.close();
    await closeTestDb();
});
