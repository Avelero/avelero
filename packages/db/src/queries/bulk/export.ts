/**
 * Export job management functions.
 *
 * Handles creation, status updates, and retrieval of export jobs.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { exportJobs } from "../../schema";

// ============================================================================
// Types
// ============================================================================

export interface CreateExportJobParams {
  brandId: string;
  userId: string;
  userEmail: string;
  selectionMode: "all" | "explicit";
  includeIds: string[];
  excludeIds: string[];
  filterState: unknown;
  searchQuery: string | null;
  status?: string;
}

export interface ExportJobStatus {
  id: string;
  brandId: string;
  userId: string;
  userEmail: string;
  status: string;
  selectionMode: string;
  includeIds: string[] | null;
  excludeIds: string[] | null;
  filterState: unknown;
  searchQuery: string | null;
  totalProducts: number | null;
  productsProcessed: number | null;
  filePath: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
}

export interface UpdateExportJobStatusParams {
  jobId: string;
  status?: string;
  totalProducts?: number;
  productsProcessed?: number;
  filePath?: string;
  downloadUrl?: string;
  expiresAt?: string;
  finishedAt?: string;
  summary?: Record<string, unknown>;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Creates a new export job record
 */
export async function createExportJob(
  db: Database,
  params: CreateExportJobParams,
): Promise<ExportJobStatus> {
  const results = await db
    .insert(exportJobs)
    .values({
      brandId: params.brandId,
      userId: params.userId,
      userEmail: params.userEmail,
      selectionMode: params.selectionMode,
      includeIds: params.includeIds,
      excludeIds: params.excludeIds,
      filterState: params.filterState ?? null,
      searchQuery: params.searchQuery,
      status: params.status ?? "PENDING",
    })
    .returning();

  const job = results[0];

  if (!job) {
    throw new Error("Failed to create export job");
  }

  return mapJobToStatus(job);
}

/**
 * Updates an export job's status and optional metadata
 */
export async function updateExportJobStatus(
  db: Database,
  params: UpdateExportJobStatusParams,
): Promise<ExportJobStatus> {
  const updateData: Record<string, unknown> = {};

  if (params.status !== undefined) {
    updateData.status = params.status;
  }

  if (params.totalProducts !== undefined) {
    updateData.totalProducts = params.totalProducts;
  }

  if (params.productsProcessed !== undefined) {
    updateData.productsProcessed = params.productsProcessed;
  }

  if (params.filePath !== undefined) {
    updateData.filePath = params.filePath;
  }

  if (params.downloadUrl !== undefined) {
    updateData.downloadUrl = params.downloadUrl;
  }

  if (params.expiresAt !== undefined) {
    updateData.expiresAt = params.expiresAt;
  }

  if (params.finishedAt !== undefined) {
    updateData.finishedAt = params.finishedAt;
  }

  if (params.summary !== undefined) {
    updateData.summary = params.summary;
  }

  const updated = await db
    .update(exportJobs)
    .set(updateData)
    .where(eq(exportJobs.id, params.jobId))
    .returning();

  const job = updated[0];

  if (!job) {
    throw new Error(`Export job not found: ${params.jobId}`);
  }

  return mapJobToStatus(job);
}

/**
 * Retrieves an export job's current status
 */
export async function getExportJobStatus(
  db: Database,
  jobId: string,
): Promise<ExportJobStatus | null> {
  const results = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.id, jobId))
    .limit(1);

  const job = results[0];

  if (!job) {
    return null;
  }

  return mapJobToStatus(job);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps a raw job record to ExportJobStatus type
 */
function mapJobToStatus(job: typeof exportJobs.$inferSelect): ExportJobStatus {
  return {
    id: job.id,
    brandId: job.brandId,
    userId: job.userId,
    userEmail: job.userEmail,
    status: job.status,
    selectionMode: job.selectionMode,
    includeIds: job.includeIds,
    excludeIds: job.excludeIds,
    filterState: job.filterState,
    searchQuery: job.searchQuery,
    totalProducts: job.totalProducts,
    productsProcessed: job.productsProcessed,
    filePath: job.filePath,
    downloadUrl: job.downloadUrl,
    expiresAt: job.expiresAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    summary: job.summary as Record<string, unknown> | null,
  };
}
