/**
 * OAuth state query functions.
 * 
 * Handles OAuth flow CSRF protection state management.
 */

import { and, eq, gt, lt } from "drizzle-orm";
import type { Database } from "../../../client";
import { oauthStates } from "../../../schema";

/**
 * Create an OAuth state for CSRF protection.
 */
export async function createOAuthState(
  db: Database,
  input: {
    state: string;
    brandId: string;
    integrationSlug: string;
    shopDomain?: string | null;
    expiresAt: string;
  },
) {
  const [row] = await db
    .insert(oauthStates)
    .values({
      state: input.state,
      brandId: input.brandId,
      integrationSlug: input.integrationSlug,
      shopDomain: input.shopDomain ?? null,
      expiresAt: input.expiresAt,
    })
    .returning({
      id: oauthStates.id,
      state: oauthStates.state,
      brandId: oauthStates.brandId,
      integrationSlug: oauthStates.integrationSlug,
      shopDomain: oauthStates.shopDomain,
      expiresAt: oauthStates.expiresAt,
      createdAt: oauthStates.createdAt,
    });
  return row;
}

/**
 * Find an OAuth state by state token.
 * Only returns if not expired.
 */
export async function findOAuthState(db: Database, state: string) {
  const now = new Date().toISOString();
  const [row] = await db
    .select({
      id: oauthStates.id,
      state: oauthStates.state,
      brandId: oauthStates.brandId,
      integrationSlug: oauthStates.integrationSlug,
      shopDomain: oauthStates.shopDomain,
      expiresAt: oauthStates.expiresAt,
      createdAt: oauthStates.createdAt,
    })
    .from(oauthStates)
    .where(and(eq(oauthStates.state, state), gt(oauthStates.expiresAt, now)))
    .limit(1);
  return row;
}

/**
 * Delete an OAuth state (after successful use).
 */
export async function deleteOAuthState(db: Database, id: string) {
  const [row] = await db
    .delete(oauthStates)
    .where(eq(oauthStates.id, id))
    .returning({ id: oauthStates.id });
  return row;
}

/**
 * Delete expired OAuth states (cleanup).
 */
export async function deleteExpiredOAuthStates(db: Database) {
  const now = new Date().toISOString();
  return db.delete(oauthStates).where(lt(oauthStates.expiresAt, now));
}





