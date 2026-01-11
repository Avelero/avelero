/**
 * Integration Test Setup - Jobs Package
 *
 * Initializes database cleanup between tests.
 * Uses @v1/testing for shared test utilities.
 */

import { resolve } from "node:path";
// Load .env.test FIRST before any other imports that depend on DATABASE_URL
import { config } from "dotenv";
config({ path: resolve(import.meta.dir, "../.env.test") });

import { afterEach, beforeAll } from "bun:test";
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
// When multiple test files import this setup, each would register its own afterAll hook.
// The first file to finish would close the shared connection, breaking remaining tests.
// The connection will close automatically when the test process exits.
