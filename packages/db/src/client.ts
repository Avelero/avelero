import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Minimal primary connection. We can extend with replicas later.
const connection = postgres(process.env.DATABASE_URL as string, {
  prepare: false,
});

export const db = drizzle(connection, {
  // schema added after we create it; for now keep minimal to unblock wiring
});

export type Database = typeof db;
