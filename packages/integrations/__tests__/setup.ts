/**
 * Integration Test Setup
 *
 * Initializes MSW mock server and database cleanup between tests.
 * Uses @v1/testing for shared test utilities.
 */

import { resolve } from "path";
// Load .env.test FIRST before any other imports that depend on DATABASE_URL
import { config } from "dotenv";
config({ path: resolve(import.meta.dir, "../.env.test") });

import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test";
import {
  beginTestTransaction,
  cleanupTables,
  initTestDb,
  rollbackTestTransaction,
} from "@v1/db/testing";
import { mockServer } from "@v1/testing/mocks/shopify";

// Clean once at start (handles leftover data from crashed runs)
beforeAll(async () => {
  await initTestDb();
  await cleanupTables();
  mockServer.listen({ onUnhandledRequest: "error" });
});

// Transaction isolation per test - rollback is instant, no dead tuples
beforeEach(async () => {
  await beginTestTransaction();
});

afterEach(async () => {
  mockServer.resetHandlers();
  await rollbackTestTransaction();
});

// Close mock server after all tests
afterAll(() => {
  mockServer.close();
});
