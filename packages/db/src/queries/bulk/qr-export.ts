/**
 * QR export job management functions.
 *
 * Handles creation, status updates, and retrieval of QR export jobs.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { qrExportJobs } from "../../schema";

// ============================================================================
// Types
// ============================================================================

export interface CreateQrExportJobParams {
  brandId: string;
  userId: string;
  userEmail: string;
  selectionMode: "all" | "explicit";
  includeIds: string[];
  excludeIds: string[];
  filterState: unknown;
  searchQuery: string | null;
  customDomain: string;
  totalProducts?: number;
  totalVariants?: number;
  eligibleVariants?: number;
  status?: string;
}

export interface QrExportJobStatus {
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
  customDomain: string;
  totalProducts: number | null;
  totalVariants: number | null;
  eligibleVariants: number | null;
  variantsProcessed: number | null;
  filePath: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
}

export interface UpdateQrExportJobStatusParams {
  jobId: string;
  status?: string;
  totalProducts?: number;
  totalVariants?: number;
  eligibleVariants?: number;
  variantsProcessed?: number;
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
 * Creates a new QR export job record.
 */
export async function createQrExportJob(
  db: Database,
  params: CreateQrExportJobParams,
): Promise<QrExportJobStatus> {
  const results = await db
    .insert(qrExportJobs)
    .values({
      brandId: params.brandId,
      userId: params.userId,
      userEmail: params.userEmail,
      selectionMode: params.selectionMode,
      includeIds: params.includeIds,
      excludeIds: params.excludeIds,
      filterState: params.filterState ?? null,
      searchQuery: params.searchQuery,
      customDomain: params.customDomain,
      totalProducts: params.totalProducts ?? 0,
      totalVariants: params.totalVariants ?? 0,
      eligibleVariants: params.eligibleVariants ?? 0,
      status: params.status ?? "PENDING",
    })
    .returning();

  const job = results[0];

  if (!job) {
    throw new Error("Failed to create QR export job");
  }

  return mapJobToStatus(job);
}

/**
 * Updates a QR export job's status and optional metadata.
 */
export async function updateQrExportJobStatus(
  db: Database,
  params: UpdateQrExportJobStatusParams,
): Promise<QrExportJobStatus> {
  const updateData: Record<string, unknown> = {};

  if (params.status !== undefined) {
    updateData.status = params.status;
  }

  if (params.totalProducts !== undefined) {
    updateData.totalProducts = params.totalProducts;
  }

  if (params.totalVariants !== undefined) {
    updateData.totalVariants = params.totalVariants;
  }

  if (params.eligibleVariants !== undefined) {
    updateData.eligibleVariants = params.eligibleVariants;
  }

  if (params.variantsProcessed !== undefined) {
    updateData.variantsProcessed = params.variantsProcessed;
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

  if (Object.keys(updateData).length === 0) {
    throw new Error(`No update fields provided for QR export job: ${params.jobId}`);
  }

  const updated = await db
    .update(qrExportJobs)
    .set(updateData)
    .where(eq(qrExportJobs.id, params.jobId))
    .returning();

  const job = updated[0];

  if (!job) {
    throw new Error(`QR export job not found: ${params.jobId}`);
  }

  return mapJobToStatus(job);
}

/**
 * Retrieves a QR export job's current status.
 */
export async function getQrExportJobStatus(
  db: Database,
  jobId: string,
): Promise<QrExportJobStatus | null> {
  const results = await db
    .select()
    .from(qrExportJobs)
    .where(eq(qrExportJobs.id, jobId))
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
 * Maps a raw job record to QrExportJobStatus type.
 */
function mapJobToStatus(job: typeof qrExportJobs.$inferSelect): QrExportJobStatus {
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
    customDomain: job.customDomain,
    totalProducts: job.totalProducts,
    totalVariants: job.totalVariants,
    eligibleVariants: job.eligibleVariants,
    variantsProcessed: job.variantsProcessed,
    filePath: job.filePath,
    downloadUrl: job.downloadUrl,
    expiresAt: job.expiresAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    summary: job.summary as Record<string, unknown> | null,
  };
}
