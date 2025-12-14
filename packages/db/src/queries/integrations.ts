import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  integrations,
  brandIntegrations,
  integrationFieldConfigs,
  integrationSyncJobs,
  integrationProductLinks,
  integrationVariantLinks,
  integrationMaterialLinks,
  integrationFacilityLinks,
  integrationManufacturerLinks,
  integrationSeasonLinks,
  integrationColorLinks,
  integrationSizeLinks,
  integrationTagLinks,
  integrationEcoClaimLinks,
  integrationCertificationLinks,
  oauthStates,
  brandMaterials,
  brandFacilities,
  brandManufacturers,
  brandSeasons,
  brandColors,
  brandSizes,
  brandTags,
  brandEcoClaims,
  brandCertifications,
  products,
} from "../schema";

// =============================================================================
// TYPES
// =============================================================================

export type IntegrationStatus = "active" | "beta" | "deprecated" | "disabled";
export type BrandIntegrationStatus =
  | "pending"
  | "active"
  | "error"
  | "paused"
  | "disconnected";
export type SyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type SyncJobTriggerType = "scheduled" | "manual" | "webhook";

export type EntityLinkType =
  | "material"
  | "facility"
  | "manufacturer"
  | "season"
  | "color"
  | "size"
  | "tag"
  | "eco_claim"
  | "certification";

// =============================================================================
// INTEGRATIONS (System-level integration types)
// =============================================================================

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
      syncInterval: input.syncInterval ?? 21600, // Default 6 hours
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

// =============================================================================
// FIELD CONFIGS (Field ownership settings)
// =============================================================================

/**
 * List all field configs for a brand integration.
 */
export async function listFieldConfigs(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    })
    .from(integrationFieldConfigs)
    .where(eq(integrationFieldConfigs.brandIntegrationId, brandIntegrationId))
    .orderBy(asc(integrationFieldConfigs.fieldKey));
}

/**
 * Get a specific field config.
 */
export async function getFieldConfig(
  db: Database,
  brandIntegrationId: string,
  fieldKey: string,
) {
  const [row] = await db
    .select({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    })
    .from(integrationFieldConfigs)
    .where(
      and(
        eq(integrationFieldConfigs.brandIntegrationId, brandIntegrationId),
        eq(integrationFieldConfigs.fieldKey, fieldKey),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create or update a field config.
 */
export async function upsertFieldConfig(
  db: Database,
  brandIntegrationId: string,
  fieldKey: string,
  input: {
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationFieldConfigs)
    .values({
      brandIntegrationId,
      fieldKey,
      ownershipEnabled: input.ownershipEnabled ?? true,
      sourceOptionKey: input.sourceOptionKey ?? null,
    })
    .onConflictDoUpdate({
      target: [
        integrationFieldConfigs.brandIntegrationId,
        integrationFieldConfigs.fieldKey,
      ],
      set: {
        ownershipEnabled: input.ownershipEnabled,
        sourceOptionKey: input.sourceOptionKey,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    });
  return row;
}

/**
 * Update a field config by ID.
 */
export async function updateFieldConfig(
  db: Database,
  id: string,
  input: {
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  },
) {
  const [row] = await db
    .update(integrationFieldConfigs)
    .set({
      ownershipEnabled: input.ownershipEnabled,
      sourceOptionKey: input.sourceOptionKey,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationFieldConfigs.id, id))
    .returning({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    });
  return row;
}

/**
 * Batch create field configs for a new integration.
 */
export async function createFieldConfigsBatch(
  db: Database,
  brandIntegrationId: string,
  configs: Array<{
    fieldKey: string;
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  }>,
) {
  if (configs.length === 0) return [];

  return db
    .insert(integrationFieldConfigs)
    .values(
      configs.map((config) => ({
        brandIntegrationId,
        fieldKey: config.fieldKey,
        ownershipEnabled: config.ownershipEnabled ?? true,
        sourceOptionKey: config.sourceOptionKey ?? null,
      })),
    )
    .returning({
      id: integrationFieldConfigs.id,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
    });
}

/**
 * Get all owned fields across all integrations for a brand.
 * Useful for showing field ownership conflicts.
 */
export async function listAllOwnedFields(db: Database, brandId: string) {
  return db
    .select({
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      integrationSlug: integrations.slug,
      integrationName: integrations.name,
    })
    .from(integrationFieldConfigs)
    .innerJoin(
      brandIntegrations,
      eq(integrationFieldConfigs.brandIntegrationId, brandIntegrations.id),
    )
    .innerJoin(integrations, eq(brandIntegrations.integrationId, integrations.id))
    .where(
      and(
        eq(brandIntegrations.brandId, brandId),
        eq(integrationFieldConfigs.ownershipEnabled, true),
      ),
    )
    .orderBy(asc(integrationFieldConfigs.fieldKey));
}

// =============================================================================
// SYNC JOBS (Sync history)
// =============================================================================

/**
 * List sync jobs for a brand integration.
 */
export async function listSyncJobs(
  db: Database,
  brandIntegrationId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
) {
  const query = db
    .select({
      id: integrationSyncJobs.id,
      brandIntegrationId: integrationSyncJobs.brandIntegrationId,
      status: integrationSyncJobs.status,
      triggerType: integrationSyncJobs.triggerType,
      startedAt: integrationSyncJobs.startedAt,
      finishedAt: integrationSyncJobs.finishedAt,
      productsProcessed: integrationSyncJobs.productsProcessed,
      productsCreated: integrationSyncJobs.productsCreated,
      productsUpdated: integrationSyncJobs.productsUpdated,
      productsFailed: integrationSyncJobs.productsFailed,
      productsSkipped: integrationSyncJobs.productsSkipped,
      entitiesCreated: integrationSyncJobs.entitiesCreated,
      errorSummary: integrationSyncJobs.errorSummary,
      createdAt: integrationSyncJobs.createdAt,
      updatedAt: integrationSyncJobs.updatedAt,
    })
    .from(integrationSyncJobs)
    .where(eq(integrationSyncJobs.brandIntegrationId, brandIntegrationId))
    .orderBy(desc(integrationSyncJobs.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return query;
}

/**
 * Get a specific sync job.
 */
export async function getSyncJob(db: Database, id: string) {
  const [row] = await db
    .select({
      id: integrationSyncJobs.id,
      brandIntegrationId: integrationSyncJobs.brandIntegrationId,
      status: integrationSyncJobs.status,
      triggerType: integrationSyncJobs.triggerType,
      startedAt: integrationSyncJobs.startedAt,
      finishedAt: integrationSyncJobs.finishedAt,
      productsProcessed: integrationSyncJobs.productsProcessed,
      productsCreated: integrationSyncJobs.productsCreated,
      productsUpdated: integrationSyncJobs.productsUpdated,
      productsFailed: integrationSyncJobs.productsFailed,
      productsSkipped: integrationSyncJobs.productsSkipped,
      entitiesCreated: integrationSyncJobs.entitiesCreated,
      errorSummary: integrationSyncJobs.errorSummary,
      errorLog: integrationSyncJobs.errorLog,
      createdAt: integrationSyncJobs.createdAt,
      updatedAt: integrationSyncJobs.updatedAt,
    })
    .from(integrationSyncJobs)
    .where(eq(integrationSyncJobs.id, id))
    .limit(1);
  return row;
}

/**
 * Create a new sync job.
 */
export async function createSyncJob(
  db: Database,
  input: {
    brandIntegrationId: string;
    triggerType?: SyncJobTriggerType;
    status?: SyncJobStatus;
  },
) {
  const [row] = await db
    .insert(integrationSyncJobs)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      triggerType: input.triggerType ?? "manual",
      status: input.status ?? "pending",
    })
    .returning({
      id: integrationSyncJobs.id,
      brandIntegrationId: integrationSyncJobs.brandIntegrationId,
      status: integrationSyncJobs.status,
      triggerType: integrationSyncJobs.triggerType,
      createdAt: integrationSyncJobs.createdAt,
    });
  return row;
}

/**
 * Update a sync job.
 */
export async function updateSyncJob(
  db: Database,
  id: string,
  input: {
    status?: SyncJobStatus;
    startedAt?: string | null;
    finishedAt?: string | null;
    productsProcessed?: number;
    productsCreated?: number;
    productsUpdated?: number;
    productsFailed?: number;
    productsSkipped?: number;
    entitiesCreated?: number;
    errorSummary?: string | null;
    errorLog?: unknown;
  },
) {
  const [row] = await db
    .update(integrationSyncJobs)
    .set({
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      productsProcessed: input.productsProcessed,
      productsCreated: input.productsCreated,
      productsUpdated: input.productsUpdated,
      productsFailed: input.productsFailed,
      productsSkipped: input.productsSkipped,
      entitiesCreated: input.entitiesCreated,
      errorSummary: input.errorSummary,
      errorLog: input.errorLog,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationSyncJobs.id, id))
    .returning({
      id: integrationSyncJobs.id,
      status: integrationSyncJobs.status,
      startedAt: integrationSyncJobs.startedAt,
      finishedAt: integrationSyncJobs.finishedAt,
      productsProcessed: integrationSyncJobs.productsProcessed,
      productsCreated: integrationSyncJobs.productsCreated,
      productsUpdated: integrationSyncJobs.productsUpdated,
      productsFailed: integrationSyncJobs.productsFailed,
      productsSkipped: integrationSyncJobs.productsSkipped,
      entitiesCreated: integrationSyncJobs.entitiesCreated,
      errorSummary: integrationSyncJobs.errorSummary,
      updatedAt: integrationSyncJobs.updatedAt,
    });
  return row;
}

/**
 * Get the latest sync job for a brand integration.
 */
export async function getLatestSyncJob(
  db: Database,
  brandIntegrationId: string,
) {
  const [row] = await db
    .select({
      id: integrationSyncJobs.id,
      status: integrationSyncJobs.status,
      triggerType: integrationSyncJobs.triggerType,
      startedAt: integrationSyncJobs.startedAt,
      finishedAt: integrationSyncJobs.finishedAt,
      productsProcessed: integrationSyncJobs.productsProcessed,
      productsCreated: integrationSyncJobs.productsCreated,
      productsUpdated: integrationSyncJobs.productsUpdated,
      productsFailed: integrationSyncJobs.productsFailed,
      productsSkipped: integrationSyncJobs.productsSkipped,
      entitiesCreated: integrationSyncJobs.entitiesCreated,
      errorSummary: integrationSyncJobs.errorSummary,
      createdAt: integrationSyncJobs.createdAt,
    })
    .from(integrationSyncJobs)
    .where(eq(integrationSyncJobs.brandIntegrationId, brandIntegrationId))
    .orderBy(desc(integrationSyncJobs.createdAt))
    .limit(1);
  return row;
}

// =============================================================================
// PRODUCT LINKS (Mapping external products to internal)
// =============================================================================

/**
 * Find a product link by external ID.
 */
export async function findProductLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a product link by product ID.
 */
export async function findProductLinkByProductId(
  db: Database,
  brandIntegrationId: string,
  productId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.productId, productId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a product link.
 */
export async function createProductLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    productId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationProductLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      productId: input.productId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
    });
  return row;
}

/**
 * Update a product link.
 */
export async function updateProductLink(
  db: Database,
  id: string,
  input: {
    externalName?: string | null;
    lastSyncedAt?: string;
  },
) {
  const [row] = await db
    .update(integrationProductLinks)
    .set({
      externalName: input.externalName,
      lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationProductLinks.id, id))
    .returning({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      updatedAt: integrationProductLinks.updatedAt,
    });
  return row;
}

/**
 * List all product links for a brand integration.
 */
export async function listProductLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
    })
    .from(integrationProductLinks)
    .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
}

// =============================================================================
// VARIANT LINKS (Primary matching table - SKU, EAN, GTIN, barcode are variant-level)
// =============================================================================

/**
 * Find a variant link by external ID.
 * This is the primary lookup during sync - variants are matched by SKU/barcode.
 */
export async function findVariantLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a variant link by variant ID.
 * Useful for checking if a variant is already linked to an external system.
 */
export async function findVariantLinkByVariantId(
  db: Database,
  brandIntegrationId: string,
  variantId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.variantId, variantId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a variant link.
 * Called when a variant is first synced from an external system.
 */
export async function createVariantLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    variantId: string;
    externalId: string;
    externalProductId?: string | null;
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(integrationVariantLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      variantId: input.variantId,
      externalId: input.externalId,
      externalProductId: input.externalProductId ?? null,
      externalSku: input.externalSku ?? null,
      externalBarcode: input.externalBarcode ?? null,
      lastSyncedAt: now,
      lastSyncedHash: input.lastSyncedHash ?? null,
    })
    .returning({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
    });
  return row;
}

/**
 * Update a variant link.
 * Called after subsequent syncs to update sync metadata.
 */
export async function updateVariantLink(
  db: Database,
  id: string,
  input: {
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .update(integrationVariantLinks)
    .set({
      ...input,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(integrationVariantLinks.id, id))
    .returning({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      updatedAt: integrationVariantLinks.updatedAt,
    });
  return row;
}

/**
 * List all variant links for a brand integration.
 */
export async function listVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
    })
    .from(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Delete a variant link.
 * Called when unlinking a variant from an external system.
 */
export async function deleteVariantLink(db: Database, id: string) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.id, id));
}

/**
 * Delete all variant links for a brand integration.
 * Called when disconnecting an integration.
 */
export async function deleteAllVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

// =============================================================================
// ENTITY LINKS (Generic functions for all 9 entity types)
// =============================================================================

// Entity link table mapping
const entityLinkTables = {
  material: {
    table: integrationMaterialLinks,
    entityIdColumn: "materialId" as const,
    entityTable: brandMaterials,
    nameColumn: "name" as const,
  },
  facility: {
    table: integrationFacilityLinks,
    entityIdColumn: "facilityId" as const,
    entityTable: brandFacilities,
    nameColumn: "displayName" as const,
  },
  manufacturer: {
    table: integrationManufacturerLinks,
    entityIdColumn: "manufacturerId" as const,
    entityTable: brandManufacturers,
    nameColumn: "name" as const,
  },
  season: {
    table: integrationSeasonLinks,
    entityIdColumn: "seasonId" as const,
    entityTable: brandSeasons,
    nameColumn: "name" as const,
  },
  color: {
    table: integrationColorLinks,
    entityIdColumn: "colorId" as const,
    entityTable: brandColors,
    nameColumn: "name" as const,
  },
  size: {
    table: integrationSizeLinks,
    entityIdColumn: "sizeId" as const,
    entityTable: brandSizes,
    nameColumn: "name" as const,
  },
  tag: {
    table: integrationTagLinks,
    entityIdColumn: "tagId" as const,
    entityTable: brandTags,
    nameColumn: "name" as const,
  },
  eco_claim: {
    table: integrationEcoClaimLinks,
    entityIdColumn: "ecoClaimId" as const,
    entityTable: brandEcoClaims,
    nameColumn: "claim" as const,
  },
  certification: {
    table: integrationCertificationLinks,
    entityIdColumn: "certificationId" as const,
    entityTable: brandCertifications,
    nameColumn: "title" as const,
  },
} as const;

/**
 * Find an entity link by external ID.
 * Uses link-first, name-fallback strategy.
 */
export async function findMaterialLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationMaterialLinks.id,
      brandIntegrationId: integrationMaterialLinks.brandIntegrationId,
      materialId: integrationMaterialLinks.materialId,
      externalId: integrationMaterialLinks.externalId,
      externalName: integrationMaterialLinks.externalName,
      lastSyncedAt: integrationMaterialLinks.lastSyncedAt,
    })
    .from(integrationMaterialLinks)
    .where(
      and(
        eq(integrationMaterialLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationMaterialLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createMaterialLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    materialId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationMaterialLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      materialId: input.materialId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationMaterialLinks.id,
      materialId: integrationMaterialLinks.materialId,
      externalId: integrationMaterialLinks.externalId,
    });
  return row;
}

export async function findFacilityLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationFacilityLinks.id,
      brandIntegrationId: integrationFacilityLinks.brandIntegrationId,
      facilityId: integrationFacilityLinks.facilityId,
      externalId: integrationFacilityLinks.externalId,
      externalName: integrationFacilityLinks.externalName,
      lastSyncedAt: integrationFacilityLinks.lastSyncedAt,
    })
    .from(integrationFacilityLinks)
    .where(
      and(
        eq(integrationFacilityLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationFacilityLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createFacilityLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    facilityId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationFacilityLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      facilityId: input.facilityId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationFacilityLinks.id,
      facilityId: integrationFacilityLinks.facilityId,
      externalId: integrationFacilityLinks.externalId,
    });
  return row;
}

export async function findManufacturerLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationManufacturerLinks.id,
      brandIntegrationId: integrationManufacturerLinks.brandIntegrationId,
      manufacturerId: integrationManufacturerLinks.manufacturerId,
      externalId: integrationManufacturerLinks.externalId,
      externalName: integrationManufacturerLinks.externalName,
      lastSyncedAt: integrationManufacturerLinks.lastSyncedAt,
    })
    .from(integrationManufacturerLinks)
    .where(
      and(
        eq(integrationManufacturerLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationManufacturerLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createManufacturerLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    manufacturerId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationManufacturerLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      manufacturerId: input.manufacturerId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationManufacturerLinks.id,
      manufacturerId: integrationManufacturerLinks.manufacturerId,
      externalId: integrationManufacturerLinks.externalId,
    });
  return row;
}

export async function findSeasonLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationSeasonLinks.id,
      brandIntegrationId: integrationSeasonLinks.brandIntegrationId,
      seasonId: integrationSeasonLinks.seasonId,
      externalId: integrationSeasonLinks.externalId,
      externalName: integrationSeasonLinks.externalName,
      lastSyncedAt: integrationSeasonLinks.lastSyncedAt,
    })
    .from(integrationSeasonLinks)
    .where(
      and(
        eq(integrationSeasonLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationSeasonLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createSeasonLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    seasonId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationSeasonLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      seasonId: input.seasonId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationSeasonLinks.id,
      seasonId: integrationSeasonLinks.seasonId,
      externalId: integrationSeasonLinks.externalId,
    });
  return row;
}

export async function findColorLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationColorLinks.id,
      brandIntegrationId: integrationColorLinks.brandIntegrationId,
      colorId: integrationColorLinks.colorId,
      externalId: integrationColorLinks.externalId,
      externalName: integrationColorLinks.externalName,
      lastSyncedAt: integrationColorLinks.lastSyncedAt,
    })
    .from(integrationColorLinks)
    .where(
      and(
        eq(integrationColorLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationColorLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createColorLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    colorId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationColorLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      colorId: input.colorId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationColorLinks.id,
      colorId: integrationColorLinks.colorId,
      externalId: integrationColorLinks.externalId,
    });
  return row;
}

export async function findSizeLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationSizeLinks.id,
      brandIntegrationId: integrationSizeLinks.brandIntegrationId,
      sizeId: integrationSizeLinks.sizeId,
      externalId: integrationSizeLinks.externalId,
      externalName: integrationSizeLinks.externalName,
      lastSyncedAt: integrationSizeLinks.lastSyncedAt,
    })
    .from(integrationSizeLinks)
    .where(
      and(
        eq(integrationSizeLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationSizeLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createSizeLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    sizeId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationSizeLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      sizeId: input.sizeId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationSizeLinks.id,
      sizeId: integrationSizeLinks.sizeId,
      externalId: integrationSizeLinks.externalId,
    });
  return row;
}

export async function findTagLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationTagLinks.id,
      brandIntegrationId: integrationTagLinks.brandIntegrationId,
      tagId: integrationTagLinks.tagId,
      externalId: integrationTagLinks.externalId,
      externalName: integrationTagLinks.externalName,
      lastSyncedAt: integrationTagLinks.lastSyncedAt,
    })
    .from(integrationTagLinks)
    .where(
      and(
        eq(integrationTagLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationTagLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createTagLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    tagId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationTagLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      tagId: input.tagId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationTagLinks.id,
      tagId: integrationTagLinks.tagId,
      externalId: integrationTagLinks.externalId,
    });
  return row;
}

export async function findEcoClaimLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationEcoClaimLinks.id,
      brandIntegrationId: integrationEcoClaimLinks.brandIntegrationId,
      ecoClaimId: integrationEcoClaimLinks.ecoClaimId,
      externalId: integrationEcoClaimLinks.externalId,
      externalName: integrationEcoClaimLinks.externalName,
      lastSyncedAt: integrationEcoClaimLinks.lastSyncedAt,
    })
    .from(integrationEcoClaimLinks)
    .where(
      and(
        eq(integrationEcoClaimLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationEcoClaimLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createEcoClaimLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    ecoClaimId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationEcoClaimLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      ecoClaimId: input.ecoClaimId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationEcoClaimLinks.id,
      ecoClaimId: integrationEcoClaimLinks.ecoClaimId,
      externalId: integrationEcoClaimLinks.externalId,
    });
  return row;
}

export async function findCertificationLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationCertificationLinks.id,
      brandIntegrationId: integrationCertificationLinks.brandIntegrationId,
      certificationId: integrationCertificationLinks.certificationId,
      externalId: integrationCertificationLinks.externalId,
      externalName: integrationCertificationLinks.externalName,
      lastSyncedAt: integrationCertificationLinks.lastSyncedAt,
    })
    .from(integrationCertificationLinks)
    .where(
      and(
        eq(integrationCertificationLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationCertificationLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createCertificationLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    certificationId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationCertificationLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      certificationId: input.certificationId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationCertificationLinks.id,
      certificationId: integrationCertificationLinks.certificationId,
      externalId: integrationCertificationLinks.externalId,
    });
  return row;
}

// =============================================================================
// ENTITY LOOKUP (Find entities by name for name-fallback matching)
// =============================================================================

/**
 * Find a material by name (case-insensitive).
 */
export async function findMaterialByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandMaterials.id,
      name: brandMaterials.name,
    })
    .from(brandMaterials)
    .where(
      and(
        eq(brandMaterials.brandId, brandId),
        sql`LOWER(${brandMaterials.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a facility by display name (case-insensitive).
 */
export async function findFacilityByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandFacilities.id,
      displayName: brandFacilities.displayName,
    })
    .from(brandFacilities)
    .where(
      and(
        eq(brandFacilities.brandId, brandId),
        sql`LOWER(${brandFacilities.displayName}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a manufacturer by name (case-insensitive).
 */
export async function findManufacturerByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandManufacturers.id,
      name: brandManufacturers.name,
    })
    .from(brandManufacturers)
    .where(
      and(
        eq(brandManufacturers.brandId, brandId),
        sql`LOWER(${brandManufacturers.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a season by name (case-insensitive).
 */
export async function findSeasonByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
    })
    .from(brandSeasons)
    .where(
      and(
        eq(brandSeasons.brandId, brandId),
        sql`LOWER(${brandSeasons.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a color by name (case-insensitive).
 */
export async function findColorByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandColors.id,
      name: brandColors.name,
    })
    .from(brandColors)
    .where(
      and(
        eq(brandColors.brandId, brandId),
        sql`LOWER(${brandColors.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a size by name (case-insensitive).
 */
export async function findSizeByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
    })
    .from(brandSizes)
    .where(
      and(
        eq(brandSizes.brandId, brandId),
        sql`LOWER(${brandSizes.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a tag by name (case-insensitive).
 */
export async function findTagByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandTags.id,
      name: brandTags.name,
    })
    .from(brandTags)
    .where(
      and(
        eq(brandTags.brandId, brandId),
        sql`LOWER(${brandTags.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find an eco claim by claim text (case-insensitive).
 */
export async function findEcoClaimByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandEcoClaims.id,
      claim: brandEcoClaims.claim,
    })
    .from(brandEcoClaims)
    .where(
      and(
        eq(brandEcoClaims.brandId, brandId),
        sql`LOWER(${brandEcoClaims.claim}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a certification by title (case-insensitive).
 */
export async function findCertificationByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandCertifications.id,
      title: brandCertifications.title,
    })
    .from(brandCertifications)
    .where(
      and(
        eq(brandCertifications.brandId, brandId),
        sql`LOWER(${brandCertifications.title}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a product by product handle.
 */
export async function findProductByHandle(
  db: Database,
  brandId: string,
  productHandle: string,
) {
  const [row] = await db
    .select({
      id: products.id,
      productHandle: products.productHandle,
      name: products.name,
    })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.productHandle, productHandle),
      ),
    )
    .limit(1);
  return row;
}

// =============================================================================
// OAUTH STATES (For OAuth flow CSRF protection)
// =============================================================================

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
