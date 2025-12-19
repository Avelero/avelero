/**
 * Staging commit functions.
 * 
 * Handles committing staging data to production tables.
 */

import { and, asc, eq, gt } from "drizzle-orm";
import type { Database } from "../../../client";
import { stagingProducts, products } from "../../../schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { hydrateStagingProductPreviews } from "./preview.js";
import type { StagingProductPreview } from "./types.js";

type DbOrTx =
  | Database
  | PgTransaction<PostgresJsQueryResultHKT, typeof import("../../../schema"), any>;

/**
 * Bulk creates products for CREATE staging rows using planned IDs.
 *
 * Inserts rows directly into products table using planned IDs.
 */
export async function bulkCreateProductsFromStaging(
  db: Database,
  brandId: string,
  rows: StagingProductPreview[],
): Promise<Map<string, string>> {
  if (rows.length === 0) {
    return new Map();
  }

  const insertValues = rows.map((row) => ({
    id: row.id,
    brandId: row.brandId ?? brandId,
    name: row.name,
    productHandle: row.productHandle,
    upid: row.productUpid ?? null,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    seasonId: row.seasonId ?? null,
    manufacturerId: row.manufacturerId ?? null,
    primaryImagePath: row.primaryImagePath ?? null,
    status: row.status ?? undefined,
  }));

  await db.transaction(async (tx) => {
    await tx.insert(products).values(insertValues).onConflictDoNothing();
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.stagingId, row.id);
  }

  return map;
}

/**
 * Gets all staging products for a job (for commit phase)
 */
export async function getStagingProductsForCommit(
  db: DbOrTx,
  jobId: string,
  limit = 100,
  cursorRowNumber?: number,
): Promise<StagingProductPreview[]> {
  const whereClause =
    typeof cursorRowNumber === "number"
      ? and(
          eq(stagingProducts.jobId, jobId),
          gt(stagingProducts.rowNumber, cursorRowNumber),
        )
      : eq(stagingProducts.jobId, jobId);

  const products = await db
    .select()
    .from(stagingProducts)
    .where(whereClause)
    .orderBy(asc(stagingProducts.rowNumber))
    .limit(limit);
  return hydrateStagingProductPreviews(db, jobId, products);
}





