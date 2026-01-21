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

import { afterEach, beforeAll, beforeEach } from "bun:test";
import {
  beginTestTransaction,
  cleanupTables,
  initTestDb,
  rollbackTestTransaction,
} from "@v1/db/testing";

// Clean once at start (handles leftover data from crashed runs)
beforeAll(async () => {
  await initTestDb();
  await cleanupTables();
});

// Transaction isolation per test - rollback is instant, no dead tuples
beforeEach(async () => {
  await beginTestTransaction();
});

afterEach(async () => {
  await rollbackTestTransaction();
});
