/**
 * Test Database Connection
 *
 * Creates a Drizzle database instance for testing.
 * This is the foundation for all database test utilities.
 *
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
 * This is used to make closeTestDb() idempotent.
 */
let connectionClosed = false;

/**
 * Lazily initialized database connection and client.
 * This allows dotenv to load DATABASE_URL before the connection is created.
 */
let _client: ReturnType<typeof postgres> | undefined;
let _testDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getClient() {
    if (!_client) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL environment variable is required for tests");
        }
        _client = postgres(connectionString);
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
    }
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
    // Only close if a connection was actually created
    if (_client) {
        await _client.end();
    }
}
