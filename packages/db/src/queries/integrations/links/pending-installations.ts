/**
 * Pending installation query functions.
 *
 * Handles storage of Shopify installations that haven't been claimed
 * by an Avelero account yet.
 */

import { eq, gt, lt } from "drizzle-orm";
import type { Database } from "../../../client";
import { pendingInstallations } from "../../../schema";

/**
 * Create or update a pending installation.
 * Uses upsert to handle re-installs of the same shop.
 */
export async function createOrUpdatePendingInstallation(
  db: Database,
  input: {
    shopDomain: string;
    credentials: string;
    credentialsIv: string;
    expiresAt: string;
  },
) {
  const [row] = await db
    .insert(pendingInstallations)
    .values({
      shopDomain: input.shopDomain,
      credentials: input.credentials,
      credentialsIv: input.credentialsIv,
      expiresAt: input.expiresAt,
    })
    .onConflictDoUpdate({
      target: pendingInstallations.shopDomain,
      set: {
        credentials: input.credentials,
        credentialsIv: input.credentialsIv,
        expiresAt: input.expiresAt,
        createdAt: new Date().toISOString(),
      },
    })
    .returning({
      id: pendingInstallations.id,
      shopDomain: pendingInstallations.shopDomain,
      credentials: pendingInstallations.credentials,
      credentialsIv: pendingInstallations.credentialsIv,
      expiresAt: pendingInstallations.expiresAt,
      createdAt: pendingInstallations.createdAt,
    });
  return row;
}

/**
 * Find a pending installation by shop domain.
 * Only returns if not expired.
 */
export async function findPendingInstallation(db: Database, shopDomain: string) {
  const now = new Date().toISOString();
  const [row] = await db
    .select({
      id: pendingInstallations.id,
      shopDomain: pendingInstallations.shopDomain,
      credentials: pendingInstallations.credentials,
      credentialsIv: pendingInstallations.credentialsIv,
      expiresAt: pendingInstallations.expiresAt,
      createdAt: pendingInstallations.createdAt,
    })
    .from(pendingInstallations)
    .where(
      eq(pendingInstallations.shopDomain, shopDomain),
    )
    .limit(1);

  // Check if expired
  if (row && row.expiresAt <= now) {
    return null;
  }

  return row ?? null;
}

/**
 * Delete a pending installation by shop domain (after claiming or on shop/redact).
 */
export async function deletePendingInstallation(db: Database, shopDomain: string) {
  const [row] = await db
    .delete(pendingInstallations)
    .where(eq(pendingInstallations.shopDomain, shopDomain))
    .returning({ id: pendingInstallations.id });
  return row ?? null;
}

/**
 * Delete expired pending installations (cleanup).
 */
export async function deleteExpiredPendingInstallations(db: Database) {
  const now = new Date().toISOString();
  return db.delete(pendingInstallations).where(lt(pendingInstallations.expiresAt, now));
}
