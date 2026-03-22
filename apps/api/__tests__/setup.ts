/**
 * Integration Test Setup - API App
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

// Live billing tests use committed writes (no transaction wrapping) so the
// separate API server process can observe webhook-driven changes.  Skip the
// transaction isolation hooks when the live suite is active.
const isLiveBillingSuite = process.env.STRIPE_LIVE_TESTS === "true";

// Clean once at start (handles leftover data from crashed runs)
beforeAll(async () => {
  await initTestDb();
  if (!isLiveBillingSuite) {
    await cleanupTables();
  }
});

// Transaction isolation per test - rollback is instant, no dead tuples
beforeEach(async () => {
  if (!isLiveBillingSuite) {
    await beginTestTransaction();
  }
});

afterEach(async () => {
  if (!isLiveBillingSuite) {
    await rollbackTestTransaction();
  }
});
