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
  ...(enableTls ? { ssl: 'prefer' } : {}),
});

export const db = drizzle(connection, {
  schema,
});

export type Database = typeof db;
