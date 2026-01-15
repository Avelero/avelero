/**
 * Import Data Cleanup Scheduled Job
 *
 * Cleans up old import data to prevent storage buildup.
 * Runs as a daily cron job.
 *
 * Cleanup rules:
 * - Delete import_rows for jobs older than 30 days
 * - Immediately delete import_rows for dismissed jobs
 * - Delete import_rows for completed jobs after 7 days
 *
 * @module staging-cleanup
 */

import "../configure-trigger";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { eq, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";

const { importJobs, importRows } = schema;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Days to keep import data for completed jobs (no failures)
 */
const COMPLETED_RETENTION_DAYS = 7;

/**
 * Days to keep import data for jobs with failures
 */
const FAILED_RETENTION_DAYS = 30;

/**
 * Batch size for delete operations
 */
const DELETE_BATCH_SIZE = 100;

// ============================================================================
// Types
// ============================================================================

interface CleanupStats {
  jobsCleaned: number;
  errors: string[];
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Delete all import_rows for a specific job
 */
async function cleanupImportDataForJob(
  database: Database,
  jobId: string,
): Promise<void> {
  await database.delete(importRows).where(eq(importRows.jobId, jobId));
}

/**
 * Find jobs that are eligible for cleanup
 */
async function findJobsToCleanup(database: Database): Promise<string[]> {
  const now = new Date();

  // Calculate cutoff dates
  const completedCutoff = new Date(now);
  completedCutoff.setDate(completedCutoff.getDate() - COMPLETED_RETENTION_DAYS);

  const failedCutoff = new Date(now);
  failedCutoff.setDate(failedCutoff.getDate() - FAILED_RETENTION_DAYS);

  // Find jobs to cleanup:
  // 1. COMPLETED jobs older than 7 days
  // 2. COMPLETED_WITH_FAILURES jobs older than 30 days
  // 3. FAILED jobs older than 30 days
  // 4. DISMISSED jobs (immediately)
  const jobs = await database
    .select({ id: importJobs.id, status: importJobs.status })
    .from(importJobs)
    .where(
      sql`(
        (${importJobs.status} = 'COMPLETED' AND ${importJobs.finishedAt} < ${completedCutoff.toISOString()})
        OR (${importJobs.status} = 'COMPLETED_WITH_FAILURES' AND ${importJobs.finishedAt} < ${failedCutoff.toISOString()})
        OR (${importJobs.status} = 'FAILED' AND ${importJobs.finishedAt} < ${failedCutoff.toISOString()})
        OR ${importJobs.status} = 'DISMISSED'
      )`,
    );

  return jobs.map((j) => j.id);
}

// ============================================================================
// Scheduled Task
// ============================================================================

/**
 * Import data cleanup scheduled task
 *
 * Runs daily at 3 AM UTC to clean up old import data
 */
export const stagingCleanupTask = schedules.task({
  id: "staging-cleanup",
  cron: "0 3 * * *", // Run daily at 3 AM UTC
  run: async () => {
    const startTime = Date.now();
    const stats: CleanupStats = {
      jobsCleaned: 0,
      errors: [],
    };

    logger.info("Starting import data cleanup job");

    try {
      // Find jobs eligible for cleanup
      const jobIds = await findJobsToCleanup(db);

      logger.info("Found jobs to cleanup", { count: jobIds.length });

      if (jobIds.length === 0) {
        logger.info("No jobs to cleanup");
        return { stats, duration: Date.now() - startTime };
      }

      // Process jobs in batches
      for (let i = 0; i < jobIds.length; i += DELETE_BATCH_SIZE) {
        const batch = jobIds.slice(i, i + DELETE_BATCH_SIZE);

        for (const jobId of batch) {
          try {
            await cleanupImportDataForJob(db, jobId);
            stats.jobsCleaned++;

            logger.debug("Cleaned up job", { jobId });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            stats.errors.push(`Job ${jobId}: ${errorMessage}`);

            logger.error("Failed to cleanup job", {
              jobId,
              error: errorMessage,
            });
          }
        }

        // Log progress for large batches
        if (jobIds.length > DELETE_BATCH_SIZE) {
          logger.info("Cleanup progress", {
            processed: Math.min(i + DELETE_BATCH_SIZE, jobIds.length),
            total: jobIds.length,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info("Import data cleanup completed", {
        stats,
        duration: `${duration}ms`,
      });

      return { stats, duration };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Import data cleanup failed", { error: errorMessage });

      stats.errors.push(`Fatal: ${errorMessage}`);
      return { stats, duration: Date.now() - startTime };
    }
  },
});

/**
 * Manual cleanup function that can be called from API
 * Useful for immediately cleaning up a specific job
 */
export async function cleanupJobImportData(
  database: Database,
  jobId: string,
): Promise<void> {
  await cleanupImportDataForJob(database, jobId);
}

/**
 * Cleanup import data for dismissed jobs
 * Can be called when a job is dismissed via API
 */
export async function cleanupDismissedJob(
  database: Database,
  jobId: string,
): Promise<void> {
  // First verify the job is in a dismissable state
  const job = await database.query.importJobs.findFirst({
    where: eq(importJobs.id, jobId),
    columns: { status: true },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status !== "COMPLETED_WITH_FAILURES" && job.status !== "FAILED") {
    throw new Error(
      `Cannot dismiss job with status ${job.status}. Only COMPLETED_WITH_FAILURES and FAILED jobs can be dismissed.`,
    );
  }

  // Cleanup import data
  await cleanupImportDataForJob(database, jobId);

  // Update job status to DISMISSED
  await database
    .update(importJobs)
    .set({ status: "DISMISSED" })
    .where(eq(importJobs.id, jobId));
}
