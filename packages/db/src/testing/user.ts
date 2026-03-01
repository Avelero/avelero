/**
 * Test Data Helpers - User
 *
 * Provides helper functions for creating test users.
 *
 * @module @v1/db/testing/user
 */

import { sql } from "drizzle-orm";
import { testDb } from "./connection";

/**
 * Creates a test user for testing.
 * First creates in auth.users (using raw SQL since it's not in our schema).
 * Then upserts into public.users to support both trigger and non-trigger test DBs.
 * Returns the user ID.
 *
 * Note: The email is modified to be unique for the auth.users table
 * by adding a random suffix to prevent conflicts with existing users.
 */
export async function createTestUser(email: string): Promise<string> {
  // Generate a UUID for the user
  const userId = crypto.randomUUID();

  // Create a unique email for auth.users to prevent conflicts
  const parts = email.split("@");
  const localPart = parts[0];
  const domain = parts[1];
  const uniqueSuffix = Math.random().toString(36).substring(2, 8);
  const authEmail = `${localPart}+test${uniqueSuffix}@${domain}`;

  // First insert into auth.users (required due to FK constraint)
  // Using raw SQL since auth schema isn't in our Drizzle schema
  await testDb.execute(sql`
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
        VALUES (${userId}, '00000000-0000-0000-0000-000000000000', ${authEmail}, '', now(), now(), now(), 'authenticated', 'authenticated')
    `);

  // Ensure public.users has the expected test email.
  // Newer DBs insert via auth trigger; older DBs may still need explicit insert.
  await testDb.execute(sql`
    INSERT INTO public.users (id, email)
    VALUES (${userId}, ${email})
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
  `);

  return userId;
}
