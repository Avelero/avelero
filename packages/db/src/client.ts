import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const rawDatabaseUrl = process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

let connectionString = rawDatabaseUrl;
let enableTls = false;
let strictTls =
  /^(true|1|strict)$/i.test(process.env.DATABASE_SSL_STRICT ?? "") || false;

const forceSslEnvValue = process.env.DATABASE_FORCE_SSL ?? "";
const forceSsl =
  /^(true|1|require|verify-full|strict)$/i.test(forceSslEnvValue ?? "");
const forceStrictSsl =
  /^(verify-full|strict)$/i.test(forceSslEnvValue ?? "") ||
  /^(verify-full|strict)$/i.test(process.env.DATABASE_SSL_STRICT ?? "");

try {
  const parsed = new URL(rawDatabaseUrl);
  const host = parsed.hostname.toLowerCase();
  const sslmode = (parsed.searchParams.get("sslmode") ?? "").toLowerCase();
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");

  if (!isLocalHost) {
    if (sslmode === "disable") {
      enableTls = false;
    } else {
      enableTls = true;
      if (sslmode === "verify-full") {
        strictTls = true;
      }
      if (!sslmode) {
        parsed.searchParams.set("sslmode", "require");
        connectionString = parsed.toString();
      }
    }
  }
} catch (error) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Unable to parse DATABASE_URL for SSL detection. Falling back to raw value.",
      error,
    );
  }
}

if (forceSsl) {
  enableTls = true;
  if (forceStrictSsl) {
    strictTls = true;
  }
}

const connection = postgres(connectionString, {
  prepare: false,
  keep_alive: 0,
  fetch_types: false,
  max: 10,
  connect_timeout: 10,
  ...(enableTls 
    ? { ssl: strictTls ? { rejectUnauthorized: true } : 'prefer' } 
    : {}),
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
