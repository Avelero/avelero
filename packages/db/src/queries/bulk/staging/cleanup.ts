/**
 * Staging cleanup functions.
 * 
 * Handles deletion of staging data.
 */

import { eq, inArray } from "drizzle-orm";
import type { Database } from "../../../client";
import { stagingProducts } from "../../../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

/**
 * Deletes all staging data for a specific import job
 */
export async function deleteStagingDataForJob(
  db: DbOrTx,
  jobId: string,
  chunkSize = 500,
): Promise<number> {
  const safeChunkSize = Math.max(chunkSize, 100);
  let totalDeleted = 0;

  while (true) {
    const chunkIds = await db
      .select({ stagingId: stagingProducts.stagingId })
      .from(stagingProducts)
      .where(eq(stagingProducts.jobId, jobId))
      .limit(safeChunkSize);

    if (chunkIds.length === 0) {
      break;
    }

    const deleted = await db
      .delete(stagingProducts)
      .where(
        inArray(
          stagingProducts.stagingId,
          chunkIds.map((row) => row.stagingId),
        ),
      )
      .returning({ stagingId: stagingProducts.stagingId });

    totalDeleted += deleted.length;

    if (deleted.length < safeChunkSize) {
      // Final chunk removed fewer rows than requested; exit early
      break;
    }
  }

  return totalDeleted;
}








