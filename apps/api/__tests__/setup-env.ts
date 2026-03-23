/**
 * Lightweight test setup: loads .env.test into process.env.
 *
 * Use this for unit tests that need environment variables but do NOT
 * require a database connection.  Import it as the first line of your
 * test file so that process.env is populated before any module that
 * reads env vars at the top level (e.g. stripe/config.ts).
 */
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dir, "../.env.test") });
