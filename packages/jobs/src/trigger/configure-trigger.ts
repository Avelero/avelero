import { configure } from "@trigger.dev/sdk/v3";

let isConfigured = false;

/**
 * Ensures the Trigger.dev SDK always points at the expected cloud API and
 * credentials before any task definitions are registered.
 */
export function ensureTriggerSdkConfigured(): void {
  if (isConfigured) {
    return;
  }

  const accessToken = process.env.TRIGGER_SECRET_KEY?.trim();

  if (!accessToken) {
    throw new Error(
      "TRIGGER_SECRET_KEY is not set. Provide a Trigger.dev secret key in apps/api/.env and packages/jobs/.env.",
    );
  }

  const apiUrl = process.env.TRIGGER_API_URL?.trim();
  const baseURL = apiUrl && apiUrl.length > 0 ? apiUrl : "https://api.trigger.dev";

  configure({
    accessToken,
    baseURL,
  });

  console.log("[trigger-config] Trigger.dev SDK configured", {
    baseURL,
    hasCustomApiUrl: Boolean(apiUrl),
    hasTriggerSecret: Boolean(accessToken),
  });

  isConfigured = true;
}

ensureTriggerSdkConfigured();
