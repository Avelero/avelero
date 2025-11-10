import { serviceDb as db } from "@v1/db/client";
import {
  importJobs,
  importRows,
  stagingProducts,
  stagingProductVariants,
} from "@v1/db/schema";
import { eq, desc, and } from "@v1/db/queries";

async function checkImportJob() {
  try {
    console.log("Connected to database");

    // Get recent import jobs
    console.log("\n=== Recent Import Jobs ===");
    const jobs = await db
      .select()
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(5);
    console.log(JSON.stringify(jobs, null, 2));

    // Get failed rows for the most recent job
    if (jobs.length > 0) {
      const latestJob = jobs[0];
      console.log(`\n=== Failed Rows for Job ${latestJob.id} ===`);

      const failedRows = await db
        .select()
        .from(importRows)
        .where(
          and(
            eq(importRows.jobId, latestJob.id),
            eq(importRows.status, "FAILED"),
          ),
        )
        .orderBy(importRows.rowNumber)
        .limit(20);

      console.log(`Found ${failedRows.length} failed rows`);
      console.log(JSON.stringify(failedRows, null, 2));

      // Get staging data count
      console.log(`\n=== Staging Data for Job ${latestJob.id} ===`);
      const stagingProds = await db
        .select()
        .from(stagingProducts)
        .where(eq(stagingProducts.jobId, latestJob.id));
      console.log(`Staging Products: ${stagingProds.length}`);

      const stagingVars = await db
        .select()
        .from(stagingProductVariants)
        .where(eq(stagingProductVariants.jobId, latestJob.id));
      console.log(`Staging Product Variants: ${stagingVars.length}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

checkImportJob();
