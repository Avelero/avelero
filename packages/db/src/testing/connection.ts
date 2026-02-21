/**
 * Test Database Connection
 *
 * Creates a Drizzle database instance for testing.
 * Uses lazy initialization to allow dotenv to load before
 * the database connection is created.
 *
 * @module @v1/db/testing/connection
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema/index";

/**
 * Track whether the connection has been closed.
 */
let connectionClosed = false;

/**
 * Lazily initialized database connection and client.
 */
let _client: ReturnType<typeof postgres> | undefined;
let _testDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

const LOCAL_DEV_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function isTruthyEnv(value?: string): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

function isLocalDevDatabaseUrl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    return (
      LOCAL_DEV_DB_HOSTS.has(parsed.hostname.toLowerCase()) &&
      parsed.port === "54322" &&
      parsed.pathname === "/postgres"
    );
  } catch {
    return (
      connectionString ===
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    );
  }
}

function assertSafeTestDatabase(connectionString: string): void {
  const runningInCi = isTruthyEnv(process.env.CI);
  const allowDevDbTests = isTruthyEnv(process.env.ALLOW_DEV_DB_TESTS);

  if (!runningInCi && !allowDevDbTests && isLocalDevDatabaseUrl(connectionString)) {
    throw new Error(
      "Refusing to run tests against local development DB (127.0.0.1:54322/postgres). Run `bun run test` or `bun run test:isolated` for an isolated disposable DB. Set ALLOW_DEV_DB_TESTS=true only if you intentionally want to target dev DB.",
    );
  }
}

function getClient() {
  if (!_client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required for tests",
      );
    }
    assertSafeTestDatabase(connectionString);
    // IMPORTANT: max: 1 ensures all queries use the same connection,
    // which is required for transaction-based test isolation (BEGIN/ROLLBACK)
    _client = postgres(connectionString, {
      max: 1,
      // Suppress transaction-related warnings that occur when production code
      // uses db.transaction() inside our test transactions
      onnotice: (notice) => {
        // Suppress "there is already a transaction in progress" (25001)
        // and "there is no transaction in progress" (25P01)
        if (notice.code === "25001" || notice.code === "25P01") {
          return;
        }
        // Log other notices
        console.log(notice);
      },
    });
  }
  return _client;
}

function getTestDb() {
  if (!_testDb) {
    _testDb = drizzle(getClient(), { schema });
  }
  return _testDb;
}

/**
 * Drizzle database instance for tests.
 * Uses the schema from @v1/db for full type safety.
 * Connection is created lazily on first access.
 */
export const testDb: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop) {
      return (getTestDb() as any)[prop];
    },
  },
) as ReturnType<typeof drizzle<typeof schema>>;

/**
 * Type alias for the test database connection.
 */
export type TestDatabaseConnection = typeof testDb;

/**
 * Check if connection is closed (for cleanup.ts to check).
 */
export function isConnectionClosed(): boolean {
  return connectionClosed;
}

/**
 * Close database connection. Called after all tests complete.
 * This function is idempotent - calling it multiple times is safe.
 */
export async function closeTestDb(): Promise<void> {
  if (connectionClosed) {
    return;
  }
  connectionClosed = true;
  if (_client) {
    await _client.end();
  }
}

/**
 * Initialize the test database connection.
 * Call this in beforeAll() to ensure connection is ready.
 */
export async function initTestDb(): Promise<void> {
  // Force connection initialization
  getClient();
}

/**
 * Get the raw postgres client for direct SQL operations.
 */
export function getTestClient(): ReturnType<typeof postgres> {
  return getClient();
}

/**
 * Track if we're in a test transaction.
 * Production code may commit our transaction, so we track state ourselves.
 */
let inTestTransaction = false;

/**
 * Begin a test transaction. Call in beforeEach().
 * All database operations will be wrapped in this transaction
 * until rollbackTestTransaction() is called.
 *
 * Note: If production code calls db.transaction(), it may commit our
 * outer transaction. We track state to avoid warnings on rollback.
 */
export async function beginTestTransaction(): Promise<void> {
  if (inTestTransaction) {
    // Already in a transaction (previous test's commit may have failed to clean up)
    // Try to rollback any existing transaction first
    const client = getClient();
    try {
      await client.unsafe("ROLLBACK");
    } catch {
      // Ignore - may not be in a transaction
    }
  }
  const client = getClient();
  await client.unsafe("BEGIN");
  inTestTransaction = true;
}

/**
 * Rollback the test transaction. Call in afterEach().
 * This instantly undoes all database changes made during the test,
 * without creating dead tuples or touching disk.
 *
 * Note: If production code committed the transaction, this will
 * issue a warning but is otherwise harmless.
 */
export async function rollbackTestTransaction(): Promise<void> {
  if (!inTestTransaction) {
    return; // Nothing to rollback
  }
  const client = getClient();
  try {
    await client.unsafe("ROLLBACK");
  } catch {
    // Transaction may have been committed by production code
  }
  inTestTransaction = false;
}
