import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { integrations, brandIntegrations } from "../../schema";

// Re-export provider functions
export {
  listAvailableIntegrations,
  getIntegrationBySlug,
  getIntegrationById,
  type IntegrationStatus,
} from "./providers";

// =============================================================================
// TYPES
// =============================================================================

export type BrandIntegrationStatus =
  | "pending"
  | "active"
  | "error"
  | "paused"
  | "disconnected";

// =============================================================================
// BRAND INTEGRATIONS (Brand's connected integrations)
// =============================================================================

/**
 * List all integrations connected to a brand.
 */
export async function listBrandIntegrations(db: Database, brandId: string) {
  return db
    .select({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      status: brandIntegrations.status,
      errorMessage: brandIntegrations.errorMessage,
      createdAt: brandIntegrations.createdAt,
      updatedAt: brandIntegrations.updatedAt,
      // Join integration details
      integration: {
        slug: integrations.slug,
        name: integrations.name,
        authType: integrations.authType,
        iconPath: integrations.iconPath,
      },
    })
    .from(brandIntegrations)
    .innerJoin(integrations, eq(brandIntegrations.integrationId, integrations.id))
    .where(eq(brandIntegrations.brandId, brandId))
    .orderBy(asc(integrations.name));
}

/**
 * Get a specific brand integration by ID.
 */
export async function getBrandIntegration(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .select({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      credentials: brandIntegrations.credentials,
      credentialsIv: brandIntegrations.credentialsIv,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      status: brandIntegrations.status,
      errorMessage: brandIntegrations.errorMessage,
      createdAt: brandIntegrations.createdAt,
      updatedAt: brandIntegrations.updatedAt,
      // Join integration details
      integration: {
        id: integrations.id,
        slug: integrations.slug,
        name: integrations.name,
        authType: integrations.authType,
        iconPath: integrations.iconPath,
      },
    })
    .from(brandIntegrations)
    .innerJoin(integrations, eq(brandIntegrations.integrationId, integrations.id))
    .where(
      and(eq(brandIntegrations.id, id), eq(brandIntegrations.brandId, brandId)),
    )
    .limit(1);
  return row;
}

/**
 * Get a brand integration by integration slug.
 */
export async function getBrandIntegrationBySlug(
  db: Database,
  brandId: string,
  integrationSlug: string,
) {
  const [row] = await db
    .select({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      credentials: brandIntegrations.credentials,
      credentialsIv: brandIntegrations.credentialsIv,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      status: brandIntegrations.status,
      errorMessage: brandIntegrations.errorMessage,
      createdAt: brandIntegrations.createdAt,
      updatedAt: brandIntegrations.updatedAt,
      integration: {
        id: integrations.id,
        slug: integrations.slug,
        name: integrations.name,
        authType: integrations.authType,
        iconPath: integrations.iconPath,
      },
    })
    .from(brandIntegrations)
    .innerJoin(integrations, eq(brandIntegrations.integrationId, integrations.id))
    .where(
      and(
        eq(brandIntegrations.brandId, brandId),
        eq(integrations.slug, integrationSlug),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a new brand integration.
 */
export async function createBrandIntegration(
  db: Database,
  brandId: string,
  input: {
    integrationId: string;
    credentials?: string | null;
    credentialsIv?: string | null;
    shopDomain?: string | null;
    syncInterval?: number;
    status?: BrandIntegrationStatus;
  },
) {
  const [row] = await db
    .insert(brandIntegrations)
    .values({
      brandId,
      integrationId: input.integrationId,
      credentials: input.credentials ?? null,
      credentialsIv: input.credentialsIv ?? null,
      shopDomain: input.shopDomain ?? null,
      syncInterval: input.syncInterval ?? 86400, // Default 24 hours
      status: input.status ?? "pending",
    })
    .returning({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      status: brandIntegrations.status,
      createdAt: brandIntegrations.createdAt,
      updatedAt: brandIntegrations.updatedAt,
    });
  return row;
}

/**
 * Update a brand integration.
 */
export async function updateBrandIntegration(
  db: Database,
  brandId: string,
  id: string,
  input: {
    credentials?: string | null;
    credentialsIv?: string | null;
    shopDomain?: string | null;
    syncInterval?: number;
    lastSyncAt?: string | null;
    status?: BrandIntegrationStatus;
    errorMessage?: string | null;
  },
) {
  const [row] = await db
    .update(brandIntegrations)
    .set({
      credentials: input.credentials,
      credentialsIv: input.credentialsIv,
      shopDomain: input.shopDomain,
      syncInterval: input.syncInterval,
      lastSyncAt: input.lastSyncAt,
      status: input.status,
      errorMessage: input.errorMessage,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(eq(brandIntegrations.id, id), eq(brandIntegrations.brandId, brandId)),
    )
    .returning({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      status: brandIntegrations.status,
      errorMessage: brandIntegrations.errorMessage,
      createdAt: brandIntegrations.createdAt,
      updatedAt: brandIntegrations.updatedAt,
    });
  return row;
}

/**
 * Delete a brand integration.
 * This will cascade delete all related field configs, sync jobs, and links.
 */
export async function deleteBrandIntegration(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandIntegrations)
    .where(
      and(eq(brandIntegrations.id, id), eq(brandIntegrations.brandId, brandId)),
    )
    .returning({ id: brandIntegrations.id });
  return row;
}

/**
 * List all integrations with their connection status for a brand.
 * Returns all available integrations, with connection info if connected.
 */
export async function listIntegrationsWithStatus(db: Database, brandId: string) {
  return db
    .select({
      // Integration details
      id: integrations.id,
      slug: integrations.slug,
      name: integrations.name,
      description: integrations.description,
      authType: integrations.authType,
      iconPath: integrations.iconPath,
      status: integrations.status,
      createdAt: integrations.createdAt,
      updatedAt: integrations.updatedAt,
      // Connection details (null if not connected)
      brandIntegrationId: brandIntegrations.id,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      connectionStatus: brandIntegrations.status,
      errorMessage: brandIntegrations.errorMessage,
    })
    .from(integrations)
    .leftJoin(
      brandIntegrations,
      and(
        eq(brandIntegrations.integrationId, integrations.id),
        eq(brandIntegrations.brandId, brandId),
      ),
    )
    .where(eq(integrations.status, "active"))
    .orderBy(asc(integrations.name));
}

/**
 * List brand integrations that are due for sync.
 * Returns integrations where last_sync_at + sync_interval < now.
 */
export async function listIntegrationsDueForSync(db: Database) {
  const now = new Date().toISOString();
  return db
    .select({
      id: brandIntegrations.id,
      brandId: brandIntegrations.brandId,
      integrationId: brandIntegrations.integrationId,
      credentials: brandIntegrations.credentials,
      credentialsIv: brandIntegrations.credentialsIv,
      shopDomain: brandIntegrations.shopDomain,
      syncInterval: brandIntegrations.syncInterval,
      lastSyncAt: brandIntegrations.lastSyncAt,
      status: brandIntegrations.status,
      integration: {
        slug: integrations.slug,
        name: integrations.name,
      },
    })
    .from(brandIntegrations)
    .innerJoin(integrations, eq(brandIntegrations.integrationId, integrations.id))
    .where(
      and(
        eq(brandIntegrations.status, "active"),
        sql`(${brandIntegrations.lastSyncAt} IS NULL OR 
             ${brandIntegrations.lastSyncAt} + (${brandIntegrations.syncInterval} * interval '1 second') < ${now}::timestamptz)`,
      ),
    );
}

