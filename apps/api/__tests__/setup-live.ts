/**
 * Live Stripe billing test setup.
 *
 * This preload keeps tests on committed database writes so the separate API
 * server process can observe the same rows when Stripe webhooks arrive.
 */
import { resolve } from "node:path";
import { config } from "dotenv";

// Load the shared Stripe price IDs before any app modules read them.
config({ path: resolve(import.meta.dir, "../.env.test") });

import { beforeAll, beforeEach, afterAll } from "bun:test";
import { cleanupTables, closeTestDb, initTestDb } from "@v1/db/testing";
import { resetStripeClient } from "../src/lib/stripe/client";

/**
 * Validates the live billing suite environment before any test runs.
 */
function assertLiveSuiteEnvironment(): void {
  if (process.env.STRIPE_LIVE_TESTS !== "true") {
    throw new Error(
      "Live Stripe billing tests require STRIPE_LIVE_TESTS=true. Run them through `bun run test:billing:live`.",
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required for live Stripe billing tests");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required for live Stripe billing tests",
    );
  }
}

beforeAll(async () => {
  // Ensure the disposable test DB is ready before the live suite starts.
  assertLiveSuiteEnvironment();
  resetStripeClient();
  await initTestDb();
  await cleanupTables();
});

beforeEach(async () => {
  // Start each test from a committed empty state so webhook-driven updates are visible.
  resetStripeClient();
  await cleanupTables();
});

afterAll(async () => {
  // Leave the shared database and Stripe client in a clean state for later suites.
  resetStripeClient();
  await cleanupTables();
  await closeTestDb();
});
