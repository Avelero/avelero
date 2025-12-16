/**
 * Import job management functions.
 * 
 * Handles creation, status updates, and retrieval of import jobs.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../../../client";
import { importJobs } from "../../../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type {
  CreateImportJobParams,
  ImportJobStatus,
  UpdateImportJobProgressParams,
  UpdateImportJobStatusParams,
} from "./types.js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

/**
 * Creates a new import job record
 */
export async function createImportJob(
  db: DbOrTx,
  params: CreateImportJobParams,
): Promise<ImportJobStatus> {
  const results = await db
    .insert(importJobs)
    .values({
      brandId: params.brandId,
      filename: params.filename,
      status: params.status ?? "PENDING",
    })
    .returning();

  const job = results[0];

  if (!job) {
    throw new Error("Failed to create import job");
  }

  return {
    id: job.id,
    brandId: job.brandId,
    filename: job.filename,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    commitStartedAt: job.commitStartedAt,
    status: job.status,
    requiresValueApproval: job.requiresValueApproval,
    summary: job.summary as Record<string, unknown> | null,
  };
}

/**
 * Updates an import job's status and optional metadata
 */
export async function updateImportJobStatus(
  db: DbOrTx,
  params: UpdateImportJobStatusParams,
): Promise<ImportJobStatus> {
  const updateData: Record<string, unknown> = {
    status: params.status,
  };

  if (params.finishedAt !== undefined) {
    updateData.finishedAt = params.finishedAt;
  }

  if (params.commitStartedAt !== undefined) {
    updateData.commitStartedAt = params.commitStartedAt;
  }

  if (params.summary !== undefined) {
    updateData.summary = params.summary;
  }

  const updated = await db
    .update(importJobs)
    .set(updateData)
    .where(eq(importJobs.id, params.jobId))
    .returning();

  const job = updated[0];

  if (!job) {
    throw new Error(`Import job not found: ${params.jobId}`);
  }

  return {
    id: job.id,
    brandId: job.brandId,
    filename: job.filename,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    commitStartedAt: job.commitStartedAt,
    status: job.status,
    requiresValueApproval: job.requiresValueApproval,
    summary: job.summary as Record<string, unknown> | null,
  };
}

/**
 * Updates an import job's progress summary
 */
export async function updateImportJobProgress(
  db: DbOrTx,
  params: UpdateImportJobProgressParams,
): Promise<ImportJobStatus> {
  const updated = await db
    .update(importJobs)
    .set({ summary: params.summary })
    .where(eq(importJobs.id, params.jobId))
    .returning();

  const job = updated[0];

  if (!job) {
    throw new Error(`Import job not found: ${params.jobId}`);
  }

  return {
    id: job.id,
    brandId: job.brandId,
    filename: job.filename,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    commitStartedAt: job.commitStartedAt,
    status: job.status,
    requiresValueApproval: job.requiresValueApproval,
    summary: job.summary as Record<string, unknown> | null,
  };
}

/**
 * Retrieves an import job's current status
 */
export async function getImportJobStatus(
  db: DbOrTx,
  jobId: string,
): Promise<ImportJobStatus | null> {
  const results = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, jobId))
    .limit(1);

  const job = results[0];

  if (!job) {
    return null;
  }

  return {
    id: job.id,
    brandId: job.brandId,
    filename: job.filename,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    commitStartedAt: job.commitStartedAt,
    status: job.status,
    requiresValueApproval: job.requiresValueApproval,
    summary: job.summary as Record<string, unknown> | null,
  };
}

