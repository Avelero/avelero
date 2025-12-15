import { desc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { integrationSyncJobs } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export type SyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type SyncJobTriggerType = "scheduled" | "manual" | "webhook";

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

