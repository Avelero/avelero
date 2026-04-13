/**
 * Product delete job query helpers.
 *
 * Manages the DB-backed state for large asynchronous product deletions.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "../../client";
import { productDeleteJobItems, productDeleteJobs } from "../../schema";

export type ProductDeleteJobStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ProductDeleteJobStatus {
  id: string;
  brandId: string;
  userId: string;
  userEmail: string | null;
  status: string;
  selectionMode: string;
  includeIds: string[] | null;
  excludeIds: string[] | null;
  filterState: unknown;
  searchQuery: string | null;
  totalProducts: number | null;
  productsProcessed: number | null;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
}

export interface CreateProductDeleteJobParams {
  brandId: string;
  userId: string;
  userEmail?: string | null;
  selectionMode: "all" | "explicit";
  includeIds: string[];
  excludeIds: string[];
  filterState: unknown;
  searchQuery: string | null;
  productIds: string[];
}

export interface UpdateProductDeleteJobParams {
  jobId: string;
  status?: ProductDeleteJobStatusValue;
  productsProcessed?: number;
  finishedAt?: string;
  summary?: Record<string, unknown>;
}

/**
 * Create a delete job and snapshot its exact product ID set.
 */
export async function createProductDeleteJob(
  db: Database,
  params: CreateProductDeleteJobParams,
): Promise<ProductDeleteJobStatus> {
  // Persist the job first, then insert the snapshot item rows.
  const [job] = await db
    .insert(productDeleteJobs)
    .values({
      brandId: params.brandId,
      userId: params.userId,
      userEmail: params.userEmail ?? null,
      selectionMode: params.selectionMode,
      includeIds: params.includeIds,
      excludeIds: params.excludeIds,
      filterState: params.filterState ?? null,
      searchQuery: params.searchQuery,
      totalProducts: params.productIds.length,
      productsProcessed: 0,
      status: "PENDING",
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create product delete job");
  }

  if (params.productIds.length > 0) {
    await db.insert(productDeleteJobItems).values(
      params.productIds.map((productId) => ({
        jobId: job.id,
        productId,
      })),
    );
  }

  return mapProductDeleteJob(job);
}

/**
 * Load the current status for one delete job.
 */
export async function getProductDeleteJobStatus(
  db: Database,
  jobId: string,
): Promise<ProductDeleteJobStatus | null> {
  // Read the current persisted job state for polling.
  const [job] = await db
    .select()
    .from(productDeleteJobs)
    .where(eq(productDeleteJobs.id, jobId))
    .limit(1);

  return job ? mapProductDeleteJob(job) : null;
}

/**
 * Find the most recent active delete job for a brand.
 */
export async function getActiveProductDeleteJob(
  db: Database,
  brandId: string,
): Promise<ProductDeleteJobStatus | null> {
  // Surface the newest job that still blocks new async deletions.
  const [job] = await db
    .select()
    .from(productDeleteJobs)
    .where(
      and(
        eq(productDeleteJobs.brandId, brandId),
        inArray(productDeleteJobs.status, ["PENDING", "PROCESSING"]),
      ),
    )
    .orderBy(desc(productDeleteJobs.startedAt))
    .limit(1);

  return job ? mapProductDeleteJob(job) : null;
}

/**
 * Update persisted job status/progress fields.
 */
export async function updateProductDeleteJobStatus(
  db: DatabaseOrTransaction,
  params: UpdateProductDeleteJobParams,
): Promise<ProductDeleteJobStatus> {
  // Apply only the fields provided by the caller.
  const updateData: Record<string, unknown> = {};

  if (params.status !== undefined) {
    updateData.status = params.status;
  }
  if (params.productsProcessed !== undefined) {
    updateData.productsProcessed = params.productsProcessed;
  }
  if (params.finishedAt !== undefined) {
    updateData.finishedAt = params.finishedAt;
  }
  if (params.summary !== undefined) {
    updateData.summary = params.summary;
  }

  const [job] = await db
    .update(productDeleteJobs)
    .set(updateData)
    .where(eq(productDeleteJobs.id, params.jobId))
    .returning();

  if (!job) {
    throw new Error(`Product delete job not found: ${params.jobId}`);
  }

  return mapProductDeleteJob(job);
}

/**
 * Claim the next pending chunk of item rows for a job.
 */
export async function claimProductDeleteJobChunk(
  db: DatabaseOrTransaction,
  jobId: string,
  limit: number,
): Promise<string[]> {
  // This worker runs single-threaded per job, so a simple claim is sufficient.
  const items = await db
    .select({
      id: productDeleteJobItems.id,
      productId: productDeleteJobItems.productId,
    })
    .from(productDeleteJobItems)
    .where(
      and(
        eq(productDeleteJobItems.jobId, jobId),
        eq(productDeleteJobItems.status, "PENDING"),
      ),
    )
    .orderBy(asc(productDeleteJobItems.id))
    .limit(limit);

  if (items.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  await db
    .update(productDeleteJobItems)
    .set({
      status: "PROCESSING",
      processedAt: now,
    })
    .where(
      inArray(
        productDeleteJobItems.id,
        items.map((item) => item.id),
      ),
    );

  return items.map((item) => item.productId);
}

/**
 * Mark one chunk of items as completed.
 */
export async function completeProductDeleteJobChunk(
  db: DatabaseOrTransaction,
  jobId: string,
  productIds: string[],
): Promise<void> {
  // Mark claimed snapshot rows as completed once the delete chunk finishes.
  if (productIds.length === 0) {
    return;
  }

  await db
    .update(productDeleteJobItems)
    .set({
      status: "COMPLETED",
      processedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(productDeleteJobItems.jobId, jobId),
        inArray(productDeleteJobItems.productId, productIds),
      ),
    );
}

/**
 * Map a raw row into the job status shape used by routers and workers.
 */
function mapProductDeleteJob(
  job: typeof productDeleteJobs.$inferSelect,
): ProductDeleteJobStatus {
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
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    summary: job.summary as Record<string, unknown> | null,
  };
}
