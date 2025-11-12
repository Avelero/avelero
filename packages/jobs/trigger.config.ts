import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_mqxiyipljbptdmfeivig",
  runtime: "node",
  logLevel: "debug",
  maxDuration: 1800, // 30 minutes for bulk import validation
  dirs: ["./src/trigger"], // Explicitly tell Trigger.dev where to find tasks
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
