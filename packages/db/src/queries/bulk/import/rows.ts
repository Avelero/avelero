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
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

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









