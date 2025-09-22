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

export type Database = typeof db;
