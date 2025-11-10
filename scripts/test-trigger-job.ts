/**
 * Direct test script to trigger a job and monitor its status
 * Run with: bun run scripts/test-trigger-job.ts
 */

import { tasks } from "@trigger.dev/sdk";

async function testTriggerJob() {
  console.log("🔧 Testing Trigger.dev Job Execution");
  console.log("=====================================\n");

  console.log("1. Checking environment...");
  console.log(
    `   TRIGGER_SECRET_KEY: ${process.env.TRIGGER_SECRET_KEY?.substring(0, 20)}...`,
  );
  console.log(
    `   Environment: ${process.env.TRIGGER_SECRET_KEY?.startsWith("tr_dev_") ? "DEV" : "PROD"}\n`,
  );

  console.log("2. Triggering validate-and-stage task...");

  try {
    const handle = await tasks.trigger("validate-and-stage", {
      jobId: "test-job-" + Date.now(),
      brandId: "test-brand",
      filePath: "test/path.csv",
    });

    console.log(`   ✓ Job triggered successfully!`);
    console.log(`   Run ID: ${handle.id}`);
    console.log(
      `   Public Token: ${handle.publicAccessToken?.substring(0, 30)}...\n`,
    );

    console.log("3. Job details:");
    console.log(JSON.stringify(handle, null, 2));
    console.log("\n");

    console.log("=====================================");
    console.log("✅ Test completed");
    console.log("=====================================\n");
    console.log("Check:");
    console.log("1. Worker logs: tail -f /tmp/trigger-worker.log");
    console.log("2. Trigger.dev dashboard: https://cloud.trigger.dev");
    console.log(`3. Check if job ${handle.id} executes or stays in queue\n`);
  } catch (error) {
    console.error("❌ Error triggering job:");
    console.error(error);
    process.exit(1);
  }
}

testTriggerJob();
