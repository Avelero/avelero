import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ebshgnuavsacpplatsqt.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVic2hnbnVhdnNhY3BwbGF0c3F0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc0MjEyNywiZXhwIjoyMDcwMzE4MTI3fQ.p_OXWdCyJfPUhdwHXVHU8q1h6_bLDk1OTqiQLAe70eg";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkLatestImport() {
  try {
    console.log("Fetching latest import job...\n");

    // Get the most recent import job
    const { data: jobs, error: jobsError } = await supabase
      .from("import_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No import jobs found");
      return;
    }

    const latestJob = jobs[0];
    console.log("=== Latest Import Job ===");
    console.log("ID:", latestJob.id);
    console.log("Status:", latestJob.status);
    console.log("Filename:", latestJob.filename);
    console.log("Started At:", latestJob.started_at);
    console.log("Finished At:", latestJob.finished_at);
    console.log("Summary:", JSON.stringify(latestJob.summary, null, 2));
    console.log("Requires Value Approval:", latestJob.requires_value_approval);

    // Get failed rows
    console.log("\n=== Failed Rows ===");
    const { data: failedRows, error: failedError } = await supabase
      .from("import_rows")
      .select("*")
      .eq("job_id", latestJob.id)
      .eq("status", "FAILED")
      .order("row_number", { ascending: true })
      .limit(50);

    if (failedError) {
      console.error("Error fetching failed rows:", failedError);
    } else if (failedRows && failedRows.length > 0) {
      console.log(`Found ${failedRows.length} failed rows:\n`);
      failedRows.forEach((row, index) => {
        console.log(`--- Row ${row.row_number} ---`);
        console.log("Error:", row.error);
        console.log("Raw data:", JSON.stringify(row.raw, null, 2));
        if (index < 5) {
          console.log("");
        }
      });

      if (failedRows.length > 5) {
        console.log(`\n... and ${failedRows.length - 5} more failed rows`);
      }
    } else {
      console.log("No failed rows found");
    }

    // Get staging counts
    console.log("\n=== Staging Data ===");
    const { count: createCount } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true })
      .eq("job_id", latestJob.id)
      .eq("action", "CREATE");

    const { count: updateCount } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true })
      .eq("job_id", latestJob.id)
      .eq("action", "UPDATE");

    console.log("Staging Products (CREATE):", createCount || 0);
    console.log("Staging Products (UPDATE):", updateCount || 0);
    console.log(
      "Total Staging Products:",
      (createCount || 0) + (updateCount || 0),
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

checkLatestImport();
