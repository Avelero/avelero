/**
 * Passport Projector Job
 *
 * Runs on a schedule to materialize dirty passports in the background and
 * revalidate the public cache for any affected identifiers.
 */

import "../configure-trigger";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { projectDirtyPassportsAllBrands } from "@v1/db/queries/products";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../../lib/dpp-revalidation";

const DEFAULT_PROJECTOR_CRON = "0 * * * *";

/**
 * Scheduled passport projector task.
 */
export const passportProjector = schedules.task({
  id: "passport-projector",
  // Allow teams to override the schedule without code changes.
  cron: process.env.PASSPORT_PROJECTOR_CRON ?? DEFAULT_PROJECTOR_CRON,
  queue: {
    name: "passport-projector",
    concurrencyLimit: 1,
  },
  run: async () => {
    logger.info("Starting passport projector run");

    const result = await projectDirtyPassportsAllBrands(db);

    for (const brandResult of result.brands) {
      // Revalidate the public pages for every brand that materialized passports.
      await Promise.allSettled([
        revalidatePassports(brandResult.upids),
        revalidateBarcodes(brandResult.brandId, brandResult.barcodes),
      ]);
    }

    logger.info("Passport projector run complete", {
      brandsProcessed: result.brandsProcessed,
      totalProductsProjected: result.totalProductsProjected,
      totalDirtyPassportsRequested: result.totalDirtyPassportsRequested,
      totalPassportsProjected: result.totalPassportsProjected,
      versionsCreated: result.versionsCreated,
      versionsSkippedUnchanged: result.versionsSkippedUnchanged,
      dirtyFlagsCleared: result.dirtyFlagsCleared,
      firstPublishedSet: result.firstPublishedSet,
    });

    return result;
  },
});
