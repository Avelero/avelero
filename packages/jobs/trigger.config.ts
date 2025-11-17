import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import type { TriggerConfig } from "@trigger.dev/sdk/v3";

export const config: TriggerConfig = {
  project: "proj_mqxiyipljbptdmfeivig",
  logLevel: "log",
  maxDuration: 60,
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
  build: {
    extensions: [
      syncEnvVars(async (ctx) => {
        // Sync environment variables from the deployment context to Trigger.dev
        //
        // Environment mapping:
        // - dev: Local development (http://localhost:4100)
        // - staging: All feature branches and PRs (pr-X-avelero-api.fly.dev)
        // - prod: Production main branch (avelero-api.fly.dev)
        //
        // This extension reads API_URL and INTERNAL_API_KEY from GitHub Actions
        // environment and syncs them to Trigger.dev for runtime access
        const envVars = [];

        if (process.env.API_URL) {
          envVars.push({ name: "API_URL", value: process.env.API_URL });
        }

        if (process.env.INTERNAL_API_KEY) {
          envVars.push({
            name: "INTERNAL_API_KEY",
            value: process.env.INTERNAL_API_KEY,
          });
        }

        console.log(`[syncEnvVars] Environment: ${ctx.environment}`);
        console.log(
          `[syncEnvVars] Syncing ${envVars.length} environment variables`,
        );
        console.log(
          `[syncEnvVars] API_URL: ${process.env.API_URL ? "SET" : "NOT SET"}`,
        );
        console.log(
          `[syncEnvVars] INTERNAL_API_KEY: ${process.env.INTERNAL_API_KEY ? "SET" : "NOT SET"}`,
        );

        return envVars;
      }),
    ],
  },
};
