import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

/**
 * Parse DATABASE_URL and determine SSL configuration
 * Returns connection string and SSL options
 */
function getDatabaseConfig() {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }

  let connectionString = rawDatabaseUrl;
  let enableTls = false;
  let strictTls =
    /^(true|1|strict)$/i.test(process.env.DATABASE_SSL_STRICT ?? "") || false;

  const forceSslEnvValue = process.env.DATABASE_FORCE_SSL ?? "";
  const forceSsl = /^(true|1|require|verify-full|strict)$/i.test(
    forceSslEnvValue ?? "",
  );
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

  return {
    connectionString,
    enableTls,
    strictTls,
  };
}

/**
 * Create a postgres connection with the given options
 */
function createConnection(
  options: {
    onconnect?: (connection: postgres.ReservedSql) => Promise<void>;
    maxConnections?: number;
  } = {},
) {
  const { connectionString, enableTls, strictTls } = getDatabaseConfig();

  const config: any = {
    keep_alive: 30,
    fetch_types: false,
    max: options.maxConnections || 12,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // Custom backoff with minimum 100ms delay to prevent race condition in postgres.js
    // that causes TimeoutNegativeWarning when reconnect() is called after delay has elapsed
    backoff: (retries: number) =>
      Math.max(
        0.1,
        (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20),
      ),
    ...(enableTls
      ? { ssl: strictTls ? { rejectUnauthorized: true } : "prefer" }
      : {}),
  };

  if (options.onconnect) {
    config.onconnect = options.onconnect;
  }

  return postgres(connectionString, config);
}

// Lazy initialization: connections are only created when first accessed
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _serviceDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Main database connection (with RLS enabled)
 * Connection is created lazily on first access
 */
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      if (!_db) {
        const connection = createConnection({ maxConnections: 8 });
        _db = drizzle(connection, { schema });
      }
      return (_db as any)[prop];
    },
  },
) as ReturnType<typeof drizzle<typeof schema>>;

/**
 * Service database connection (with RLS bypass for background jobs)
 * Use this for Trigger.dev jobs and other background processes
 * Connection is created lazily on first accesss
 */
export const serviceDb: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      if (!_serviceDb) {
        const serviceConnection = createConnection({
          maxConnections: 2,
          onconnect: async (connection: postgres.ReservedSql) => {
            try {
              // Disable RLS checks for this connection session
              // This works if the connection user is a superuser or has bypassrls privilege
              await connection.unsafe("SET SESSION row_security = off");
            } catch (error) {
              console.warn(
                "[serviceDb] Could not disable RLS for session:",
                error,
              );
              // Non-fatal - continue with RLS enabled
            }
          },
        });
        _serviceDb = drizzle(serviceConnection, { schema });
      }
      return (_serviceDb as any)[prop];
    },
  },
) as ReturnType<typeof drizzle<typeof schema>>;

export type Database = typeof db;

/**
 * Type that accepts both a full database instance and a transaction.
 * Use this for functions that need to work inside transactions.
 */
export type DatabaseOrTransaction = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "execute" | "query"
>;
