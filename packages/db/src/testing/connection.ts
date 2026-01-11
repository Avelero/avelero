/**
 * Test Database Connection
 *
 * Creates a Drizzle database instance for testing.
 * This is the foundation for all database test utilities.
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

// Use test database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for tests");
}

const client = postgres(connectionString);

/**
 * Drizzle database instance for tests.
 * Uses the schema from @v1/db for full type safety.
 */
export const testDb = drizzle(client, { schema });

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
    await client.end();
}
