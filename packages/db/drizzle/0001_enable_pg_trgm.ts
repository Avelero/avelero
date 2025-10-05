import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  text,
  boolean,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export async function up(pgm: any) {
  pgm.sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
}

export async function down(pgm: any) {
  pgm.sql`DROP EXTENSION IF EXISTS pg_trgm;`;
}
