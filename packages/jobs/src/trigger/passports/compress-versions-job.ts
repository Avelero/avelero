/**
 * Passport Version Compression Job
 *
 * Compresses superseded historical passport versions into zstd-compressed
 * bytea storage while leaving current versions untouched.
 */

import "../configure-trigger";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { batchCompressSupersededVersions } from "@v1/db/queries/products";

const DEFAULT_COMPRESSION_CRON = "0 3 * * *";
const DEFAULT_BATCH_SIZE = 500;

/**
 * Scheduled historical passport version compression task.
 */
export const compressPassportVersions = schedules.task({
  id: "compress-passport-versions",
  // Run daily during a low-traffic window, unless overridden by env.
  cron:
    process.env.PASSPORT_VERSION_COMPRESSION_CRON ?? DEFAULT_COMPRESSION_CRON,
  queue: {
    name: "compress-passport-versions",
    concurrencyLimit: 1,
  },
  run: async () => {
    const limit = Math.max(
      1,
      Number.parseInt(
        process.env.PASSPORT_VERSION_COMPRESSION_BATCH_SIZE ?? "",
        10,
      ) || DEFAULT_BATCH_SIZE,
    );

    logger.info("Starting passport version compression run", { limit });

    let scanned = 0;
    let compressed = 0;
    let skipped = 0;
    let batches = 0;

    while (true) {
      // Continue until the batch query reports there are no superseded versions left.
      const result = await batchCompressSupersededVersions(db, { limit });
      batches++;
      scanned += result.scanned;
      compressed += result.compressed;
      skipped += result.skipped;

      if (result.scanned === 0 || result.compressed === 0) {
        break;
      }
    }

    logger.info("Passport version compression run complete", {
      batches,
      scanned,
      compressed,
      skipped,
    });

    return {
      batches,
      scanned,
      compressed,
      skipped,
    };
  },
});
