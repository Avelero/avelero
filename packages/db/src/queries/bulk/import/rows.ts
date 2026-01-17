/**
 * Import row management functions.
 *
 * Handles creation, updates, and retrieval of import rows.
 */

import { and, asc, count, eq } from "drizzle-orm";
import type { Database } from "../../../client";
import { importRows } from "../../../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type {
  CreateImportRowParams,
  FailedRowExport,
  ImportError,
  UpdateImportRowStatusParams,
} from "./types";

type DbOrTx =
  | Database
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof import("../../../schema"),
      any
    >;

/**
 * Creates import row records in batch
 * PERFORMANCE: Automatically batches large inserts to avoid PostgreSQL parameter limits
 * (PostgreSQL has a limit of ~32k parameters, with 5 params per row = ~6400 rows max)
 */
export async function createImportRows(
  db: DbOrTx,
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
 */
export async function updateImportRowStatus(
  db: DbOrTx,
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
 */
export async function batchUpdateImportRowStatus(
  db: DbOrTx,
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
 */
export async function getImportErrors(
  db: DbOrTx,
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
 */
export async function getFailedRowsForExport(
  db: DbOrTx,
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
 */
export async function getImportRowStatusCounts(
  db: DbOrTx,
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

// ============================================================================
// New Architecture: Normalized JSONB functions
// ============================================================================

import { sql, inArray } from "drizzle-orm";
import type { NormalizedRowData, RowStatus } from "./normalized-types";

/**
 * Import row with normalized data for commit processing
 */
export interface ImportRowForCommit {
  id: string;
  rowNumber: number;
  status: string;
  normalized: NormalizedRowData;
}

/**
 * Retrieves a batch of pending rows for commit processing.
 * Returns rows with status PENDING or PENDING_WITH_WARNINGS.
 *
 * @param db Database connection
 * @param jobId Import job ID
 * @param afterRowNumber Cursor for pagination (rows after this number)
 * @param limit Maximum rows to return
 */
export async function getPendingRowsForCommit(
  db: DbOrTx,
  jobId: string,
  afterRowNumber: number,
  limit: number,
): Promise<ImportRowForCommit[]> {
  const rows = await db
    .select({
      id: importRows.id,
      rowNumber: importRows.rowNumber,
      status: importRows.status,
      normalized: importRows.normalized,
    })
    .from(importRows)
    .where(
      and(
        eq(importRows.jobId, jobId),
        inArray(importRows.status, ["PENDING", "PENDING_WITH_WARNINGS"]),
        sql`${importRows.rowNumber} > ${afterRowNumber}`,
      ),
    )
    .orderBy(asc(importRows.rowNumber))
    .limit(limit);

  // Filter out rows without normalized data and type-check
  return rows
    .filter((row) => row.normalized !== null)
    .map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      normalized: row.normalized as NormalizedRowData,
    }));
}

/**
 * Marks import rows as committed in batch.
 *
 * @param db Database connection
 * @param rowIds Array of import row IDs to mark as committed
 */
export async function markRowsAsCommitted(
  db: DbOrTx,
  rowIds: string[],
): Promise<number> {
  if (rowIds.length === 0) return 0;

  await db
    .update(importRows)
    .set({ status: "COMMITTED" })
    .where(inArray(importRows.id, rowIds));

  return rowIds.length;
}

/**
 * Marks import rows as failed in batch.
 *
 * @param db Database connection
 * @param rowIds Array of import row IDs to mark as failed
 * @param errorMessage Error message to store
 */
export async function markRowsAsFailed(
  db: DbOrTx,
  rowIds: string[],
  errorMessage: string,
): Promise<number> {
  if (rowIds.length === 0) return 0;

  await db
    .update(importRows)
    .set({
      status: "FAILED",
      error: errorMessage,
    })
    .where(inArray(importRows.id, rowIds));

  return rowIds.length;
}

/**
 * Deletes committed rows for cleanup after successful import.
 *
 * @param db Database connection
 * @param jobId Import job ID
 */
export async function deleteCommittedRows(
  db: DbOrTx,
  jobId: string,
): Promise<number> {
  const committed = await db
    .select({ id: importRows.id })
    .from(importRows)
    .where(
      and(eq(importRows.jobId, jobId), eq(importRows.status, "COMMITTED")),
    );

  if (committed.length === 0) return 0;

  // Delete in chunks to avoid memory issues
  const CHUNK_SIZE = 500;
  for (let i = 0; i < committed.length; i += CHUNK_SIZE) {
    const chunk = committed.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((r) => r.id);
    await db.delete(importRows).where(inArray(importRows.id, ids));
  }

  return committed.length;
}

/**
 * Deletes ALL import rows for a job.
 * Used for dismiss functionality to clean up all data after a failed import.
 *
 * @param db Database connection
 * @param jobId Import job ID
 */
export async function deleteAllImportRowsForJob(
  db: DbOrTx,
  jobId: string,
): Promise<number> {
  const rows = await db
    .select({ id: importRows.id })
    .from(importRows)
    .where(eq(importRows.jobId, jobId));

  if (rows.length === 0) return 0;

  // Delete in chunks to avoid memory issues
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((r) => r.id);
    await db.delete(importRows).where(inArray(importRows.id, ids));
  }

  return rows.length;
}

/**
 * Gets rows with errors for preview/error report.
 * Returns rows with status BLOCKED or PENDING_WITH_WARNINGS.
 *
 * @param db Database connection
 * @param jobId Import job ID
 * @param limit Maximum rows to return
 * @param offset Offset for pagination
 */
export async function getRowsWithErrors(
  db: DbOrTx,
  jobId: string,
  limit = 100,
  offset = 0,
): Promise<{
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    raw: Record<string, unknown>;
    normalized: NormalizedRowData | null;
  }>;
  total: number;
}> {
  // Get total count
  const countResult = await db
    .select({ value: count() })
    .from(importRows)
    .where(
      and(
        eq(importRows.jobId, jobId),
        inArray(importRows.status, ["BLOCKED", "PENDING_WITH_WARNINGS"]),
      ),
    );

  const total = countResult[0]?.value ?? 0;

  // Get paginated rows
  const rows = await db
    .select({
      id: importRows.id,
      rowNumber: importRows.rowNumber,
      status: importRows.status,
      raw: importRows.raw,
      normalized: importRows.normalized,
    })
    .from(importRows)
    .where(
      and(
        eq(importRows.jobId, jobId),
        inArray(importRows.status, ["BLOCKED", "PENDING_WITH_WARNINGS"]),
      ),
    )
    .orderBy(asc(importRows.rowNumber))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      raw: row.raw as Record<string, unknown>,
      normalized: row.normalized as NormalizedRowData | null,
    })),
    total,
  };
}

/**
 * Gets preview data from import rows for UI display.
 * Used to show users what will be imported.
 *
 * @param db Database connection
 * @param jobId Import job ID
 * @param options Pagination and filter options
 */
export async function getImportRowsPreview(
  db: DbOrTx,
  jobId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: RowStatus;
  } = {},
): Promise<{
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    normalized: NormalizedRowData;
  }>;
  total: number;
  counts: {
    create: number;
    update: number;
    total: number;
  };
}> {
  const { limit = 100, offset = 0, status } = options;

  // Build where conditions
  const whereConditions = [eq(importRows.jobId, jobId)];
  if (status) {
    whereConditions.push(eq(importRows.status, status));
  }

  // Get total count
  const countResult = await db
    .select({ value: count() })
    .from(importRows)
    .where(and(...whereConditions));

  const total = countResult[0]?.value ?? 0;

  // Get paginated rows with normalized data
  const rows = await db
    .select({
      id: importRows.id,
      rowNumber: importRows.rowNumber,
      status: importRows.status,
      normalized: importRows.normalized,
    })
    .from(importRows)
    .where(and(...whereConditions))
    .orderBy(asc(importRows.rowNumber))
    .limit(limit)
    .offset(offset);

  // Filter to only rows with normalized data
  const validRows = rows
    .filter((row) => row.normalized !== null)
    .map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      normalized: row.normalized as NormalizedRowData,
    }));

  // Count by action
  const actionCounts = validRows.reduce(
    (acc, row) => {
      if (row.normalized.action === "CREATE") acc.create++;
      else if (row.normalized.action === "UPDATE") acc.update++;
      acc.total++;
      return acc;
    },
    { create: 0, update: 0, total: 0 },
  );

  return {
    rows: validRows,
    total,
    counts: actionCounts,
  };
}
