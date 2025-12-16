/**
 * Integration provider query functions.
 * 
 * Handles queries for system-level integration types (providers).
 */

import { asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { integrations } from "../../schema";

/**
 * Integration status type.
 */
export type IntegrationStatus = "active" | "beta" | "deprecated" | "disabled";

/**
 * List all available integration types.
 * These are the integration providers (Shopify, It's Perfect, etc.)
 */
export async function listAvailableIntegrations(db: Database) {
  return db
    .select({
      id: integrations.id,
      slug: integrations.slug,
      name: integrations.name,
      description: integrations.description,
      authType: integrations.authType,
      iconPath: integrations.iconPath,
      status: integrations.status,
      createdAt: integrations.createdAt,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(eq(integrations.status, "active"))
    .orderBy(asc(integrations.name));
}

/**
 * Get an integration by its slug.
 */
export async function getIntegrationBySlug(db: Database, slug: string) {
  const [row] = await db
    .select({
      id: integrations.id,
      slug: integrations.slug,
      name: integrations.name,
      description: integrations.description,
      authType: integrations.authType,
      iconPath: integrations.iconPath,
      status: integrations.status,
      createdAt: integrations.createdAt,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(eq(integrations.slug, slug))
    .limit(1);
  return row;
}

/**
 * Get an integration by its ID.
 */
export async function getIntegrationById(db: Database, id: string) {
  const [row] = await db
    .select({
      id: integrations.id,
      slug: integrations.slug,
      name: integrations.name,
      description: integrations.description,
      authType: integrations.authType,
      iconPath: integrations.iconPath,
      status: integrations.status,
      createdAt: integrations.createdAt,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(eq(integrations.id, id))
    .limit(1);
  return row;
}


