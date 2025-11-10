import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// Minimal primary connection. We can extend with replicas later.
const connection = postgres(process.env.DATABASE_URL as string, {
  prepare: false,
});

export const db = drizzle(connection, {
  schema,
});

// Service role connection for background jobs that need to bypass RLS
// Use this for Trigger.dev jobs and other background processes
// This connection sets session-level RLS bypass for superuser connections
const serviceConnection = postgres(process.env.DATABASE_URL as string, {
  prepare: false,
  // @ts-expect-error - onconnect is valid but not in types
  onconnect: async (connection: postgres.ReservedSql) => {
    try {
      // Disable RLS checks for this connection session
      // This works if the connection user is a superuser or has bypassrls privilege
      await connection.unsafe("SET SESSION row_security = off");
    } catch (error) {
      console.warn("[serviceDb] Could not disable RLS for session:", error);
      // Non-fatal - continue with RLS enabled
    }
  },
});

export const serviceDb = drizzle(serviceConnection, {
  schema,
});

export type Database = typeof db;
