import type { TriggerConfig } from "@trigger.dev/sdk/v3";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

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
        // Sync environment variables from the deployment context
        // This allows preview branches to have dynamic API_URL values
        const envVars = [];

        if (process.env.API_URL) {
          envVars.push({ name: "API_URL", value: process.env.API_URL });
        }

        if (process.env.INTERNAL_API_KEY) {
          envVars.push({ name: "INTERNAL_API_KEY", value: process.env.INTERNAL_API_KEY });
        }

        return envVars;
      }),
    ],
  },
};
