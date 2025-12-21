/**
 * Unmapped values query functions.
 * 
 * Handles retrieval of unmapped values that need user approval.
 */

import type { Database } from "../../../client";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { getImportJobStatus } from "./jobs.js";
import type {
  UnmappedValue,
  UnmappedValuesResponse,
} from "./types.js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

/**
 * Gets unmapped values for a job that need definition
 *
 * This extracts unique values from failed/pending rows that couldn't
 * be mapped to existing entities and need user approval.
 */
export async function getUnmappedValuesForJob(
  db: DbOrTx,
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








