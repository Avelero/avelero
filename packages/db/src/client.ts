import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Database connection pool configuration.
 * 
 * IMPORTANT: When using Supabase, ensure your DATABASE_URL uses:
 * - Transaction mode (port 6543) for API servers - handles 1000s of connections
 * - NOT Session mode (port 5432) - limited to ~15-60 connections
 * 
 * Example: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres
 *                                                                      ^^^^
 */
const connection = postgres(process.env.DATABASE_URL as string, {
  // Supabase transaction pooling requires prepare: false
  prepare: false,
  
  // Relaxed connection settings for development
  max: 20, // Maximum number of connections
  idle_timeout: 0, // Don't timeout idle connections
  connect_timeout: 30, // 30 seconds to establish connection
  max_lifetime: 60 * 30, // 30 minute connection lifetime
});

export const db = drizzle(connection, {
  schema,
});

export type Database = typeof db;
