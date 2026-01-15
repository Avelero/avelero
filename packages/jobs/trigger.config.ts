import {
  additionalFiles,
  syncEnvVars,
} from "@trigger.dev/build/extensions/core";
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
  // Note: Feature branch environments are created dynamically by Trigger.dev
  // when using the --env flag with a branch name. No need to pre-define them here.
  // The environments array is optional and only needed for explicitly defined environments.
  // Trigger.dev v4 automatically creates and manages feature branch environments.
  build: {
    extensions: [
      // Bundle the Excel export template for deployment
      additionalFiles({ files: ["./src/templates/**"] }),
      syncEnvVars(async (ctx) => {
        // Sync environment variables from the deployment context to Trigger.dev
        //
        // Environment mapping:
        // - dev: Local development (http://localhost:4100)
        // - staging: PRs targeting main (pr-X-avelero-api.fly.dev)
        // - feature branches: Dynamic per-branch environments (feature-specific API URLs)
        // - prod: Production main branch only (api.avelero.com)
        //
        // This extension reads environment variables from GitHub Actions
        // and syncs them to Trigger.dev for runtime access
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

        if (process.env.BRANCH_NAME) {
          envVars.push({
            name: "BRANCH_NAME",
            value: process.env.BRANCH_NAME,
          });
        }

        // Database and Supabase environment variables
        // These are extracted from the Supabase preview branch and passed from the workflow
        if (process.env.DATABASE_URL) {
          envVars.push({
            name: "DATABASE_URL",
            value: process.env.DATABASE_URL,
          });
        }

        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          envVars.push({
            name: "NEXT_PUBLIC_SUPABASE_URL",
            value: process.env.NEXT_PUBLIC_SUPABASE_URL,
          });
        }

        if (process.env.SUPABASE_SERVICE_KEY) {
          envVars.push({
            name: "SUPABASE_SERVICE_KEY",
            value: process.env.SUPABASE_SERVICE_KEY,
          });
        }

        if (process.env.RESEND_API_KEY) {
          envVars.push({
            name: "RESEND_API_KEY",
            value: process.env.RESEND_API_KEY,
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
        console.log(
          `[syncEnvVars] BRANCH_NAME: ${process.env.BRANCH_NAME ? "SET" : "NOT SET"}`,
        );
        console.log(
          `[syncEnvVars] DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`,
        );
        console.log(
          `[syncEnvVars] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET"}`,
        );
        console.log(
          `[syncEnvVars] SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? "SET" : "NOT SET"}`,
        );
        console.log(
          `[syncEnvVars] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "SET" : "NOT SET"}`,
        );

        return envVars;
      }),
    ],
  },
};
