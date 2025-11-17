import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { importJobs, importRows } from "../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/**
 * Import job creation parameters
 */
export interface CreateImportJobParams {
  brandId: string;
  filename: string;
  status?: string;
}

/**
 * Import job status update parameters
 */
export interface UpdateImportJobStatusParams {
  jobId: string;
  status: string;
  finishedAt?: string;
  commitStartedAt?: string;
  summary?: Record<string, unknown>;
}

/**
 * Import job progress update parameters
 */
export interface UpdateImportJobProgressParams {
  jobId: string;
  summary: Record<string, unknown>;
}

/**
 * Import job status response
 */
export interface ImportJobStatus {
  id: string;
  brandId: string;
  filename: string;
  startedAt: string;
  finishedAt: string | null;
  commitStartedAt: string | null;
  status: string;
  requiresValueApproval: boolean;
  summary: Record<string, unknown> | null;
}

/**
 * Import row creation parameters
 */
export interface CreateImportRowParams {
  jobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized?: Record<string, unknown> | null;
  status?: string;
}

/**
 * Import row status update parameters
 */
export interface UpdateImportRowStatusParams {
  id: string;
  status: string;
  normalized?: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Import error record
 */
export interface ImportError {
  id: string;
  jobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown> | null;
  error: string | null;
  status: string;
  createdAt: string;
}

/**
 * Failed row export data
 */
export interface FailedRowExport {
  rowNumber: number;
  raw: Record<string, unknown>;
  error: string | null;
}

/**
 * Creates a new import job record
 *
 * @param db - Database instance or transaction
 * @param params - Import job creation parameters
 * @returns Created import job
 */
export async function createImportJob(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
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
 *
 * @param db - Database instance or transaction
 * @param params - Status update parameters
 * @returns Updated import job
 */
export async function updateImportJobStatus(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
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
 *
 * @param db - Database instance or transaction
 * @param params - Progress update parameters
 * @returns Updated import job
 */
export async function updateImportJobProgress(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
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
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Import job status or null if not found
 */
export async function getImportJobStatus(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
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

/**
 * Creates import row records in batch
 * PERFORMANCE: Automatically batches large inserts to avoid PostgreSQL parameter limits
 * (PostgreSQL has a limit of ~32k parameters, with 5 params per row = ~6400 rows max)
 *
 * @param db - Database instance or transaction
 * @param rows - Array of import row parameters
 * @returns Array of created import rows
 */
export async function createImportRows(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  rows: CreateImportRowParams[],
): Promise<ImportError[]> {
  if (rows.length === 0) {
    return [];
  }

  const CHUNK_SIZE = 500; // Safe batch size to avoid parameter limit
  const allCreated: ImportError[] = [];

  // Process in chunks to avoid PostgreSQL parameter limit
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const values = chunk.map((row) => ({
      jobId: row.jobId,
      rowNumber: row.rowNumber,
      raw: row.raw,
      normalized: row.normalized ?? null,
      status: row.status ?? "PENDING",
    }));

    const created = await db.insert(importRows).values(values).returning();

    allCreated.push(
      ...created.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        rowNumber: row.rowNumber,
        raw: row.raw as Record<string, unknown>,
        normalized: row.normalized as Record<string, unknown> | null,
        error: row.error,
        status: row.status,
        createdAt: row.createdAt,
      })),
    );
  }

  return allCreated;
}

/**
 * Updates an import row's status and optional data
 *
 * @param db - Database instance or transaction
 * @param params - Row status update parameters
 * @returns Updated import row
 */
export async function updateImportRowStatus(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  params: UpdateImportRowStatusParams,
): Promise<ImportError> {
  const updateData: Record<string, unknown> = {
    status: params.status,
  };

  if (params.normalized !== undefined) {
    updateData.normalized = params.normalized;
  }

  if (params.error !== undefined) {
    updateData.error = params.error;
  }

  const [row] = await db
    .update(importRows)
    .set(updateData)
    .where(eq(importRows.id, params.id))
    .returning();

  if (!row) {
    throw new Error(`Import row not found: ${params.id}`);
  }

  return {
    id: row.id,
    jobId: row.jobId,
    rowNumber: row.rowNumber,
    raw: row.raw as Record<string, unknown>,
    normalized: row.normalized as Record<string, unknown> | null,
    error: row.error,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/**
 * Updates multiple import rows in batch
 *
 * @param db - Database instance or transaction
 * @param updates - Array of row update parameters
 * @returns Number of updated rows
 */
export async function batchUpdateImportRowStatus(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  updates: UpdateImportRowStatusParams[],
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  // PERFORMANCE OPTIMIZATION: Batch updates in chunks to balance performance vs query size
  // Process up to 100 updates per query instead of individual queries
  const CHUNK_SIZE = 100;
  let totalUpdated = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);

    // Use Promise.all to execute updates in parallel for this chunk
    await Promise.all(
      chunk.map((update) =>
        db
          .update(importRows)
          .set({
            status: update.status,
            normalized: update.normalized,
            error: update.error,
          })
          .where(eq(importRows.id, update.id)),
      ),
    );

    totalUpdated += chunk.length;
  }

  return totalUpdated;
}

/**
 * Retrieves import errors for a job with pagination
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @param limit - Maximum number of errors to return
 * @param offset - Number of errors to skip
 * @returns Paginated import errors
 */
export async function getImportErrors(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
  limit = 100,
  offset = 0,
): Promise<{ errors: ImportError[]; total: number }> {
  // Get total count
  const countResult = await db
    .select({ value: count() })
    .from(importRows)
    .where(and(eq(importRows.jobId, jobId), eq(importRows.status, "FAILED")));

  const total = countResult[0]?.value ?? 0;

  // Get paginated errors
  const errors = await db
    .select()
    .from(importRows)
    .where(and(eq(importRows.jobId, jobId), eq(importRows.status, "FAILED")))
    .orderBy(asc(importRows.rowNumber))
    .limit(limit)
    .offset(offset);

  return {
    errors: errors.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      rowNumber: row.rowNumber,
      raw: row.raw as Record<string, unknown>,
      normalized: row.normalized as Record<string, unknown> | null,
      error: row.error,
      status: row.status,
      createdAt: row.createdAt,
    })),
    total,
  };
}

/**
 * Retrieves all failed rows for export to CSV
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Array of failed row data for CSV export
 */
export async function getFailedRowsForExport(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
): Promise<FailedRowExport[]> {
  const failedRows = await db
    .select({
      rowNumber: importRows.rowNumber,
      raw: importRows.raw,
      error: importRows.error,
    })
    .from(importRows)
    .where(and(eq(importRows.jobId, jobId), eq(importRows.status, "FAILED")))
    .orderBy(asc(importRows.rowNumber));

  return failedRows.map((row) => ({
    rowNumber: row.rowNumber,
    raw: row.raw as Record<string, unknown>,
    error: row.error,
  }));
}

/**
 * Gets count of rows by status for a job
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Status counts
 */
export async function getImportRowStatusCounts(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
): Promise<Record<string, number>> {
  const results = await db
    .select({
      status: importRows.status,
      count: count(),
    })
    .from(importRows)
    .where(eq(importRows.jobId, jobId))
    .groupBy(importRows.status);

  return results.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});
}

/**
 * Unmapped value information
 */
export interface UnmappedValue {
  rawValue: string;
  sourceColumn: string;
  affectedRows: number;
  isDefined: boolean;
}

/**
 * Unmapped values grouped by entity type
 */
export interface UnmappedValuesResponse {
  entityType: string;
  values: UnmappedValue[];
}

/**
 * Gets unmapped values for a job that need definition
 *
 * This extracts unique values from failed/pending rows that couldn't
 * be mapped to existing entities and need user approval.
 *
 * @param db - Database instance or transaction
 * @param jobId - Import job ID
 * @returns Unmapped values grouped by entity type
 */
export async function getUnmappedValuesForJob(
  db:
    | Database
    | PgTransaction<PostgresJsQueryResultHKT, typeof import("../schema"), any>,
  jobId: string,
): Promise<{
  unmappedValues: UnmappedValuesResponse[];
  totalUnmapped: number;
  totalDefined: number;
}> {
  // Get the job summary which contains unmapped values info
  const job = await getImportJobStatus(db, jobId);

  if (!job || !job.summary) {
    return {
      unmappedValues: [],
      totalUnmapped: 0,
      totalDefined: 0,
    };
  }

  const summary = job.summary as Record<string, unknown>;
  const pendingApproval = (summary.pending_approval as unknown[]) ?? [];

  // Group unmapped values by entity type
  const grouped = new Map<string, UnmappedValue[]>();

  for (const item of pendingApproval) {
    const value = item as {
      type: string;
      name: string;
      affected_rows: number;
      source_column?: string;
    };
    const entityType = value.type;
    const sourceColumn = value.source_column ?? "unknown";

    if (!grouped.has(entityType)) {
      grouped.set(entityType, []);
    }

    grouped.get(entityType)!.push({
      rawValue: value.name,
      sourceColumn,
      affectedRows: value.affected_rows,
      isDefined: false,
    });
  }

  const unmappedValues: UnmappedValuesResponse[] = [];
  for (const [entityType, values] of grouped.entries()) {
    unmappedValues.push({
      entityType,
      values,
    });
  }

  const totalUnmapped = pendingApproval.length;
  const approvedValues = (summary.approved_values as unknown[]) ?? [];
  const totalDefined = approvedValues.length;

  return {
    unmappedValues,
    totalUnmapped,
    totalDefined,
  };
}
