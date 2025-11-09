/**
 * Configuration for Trigger.dev v4.
 *
 * In v4, configuration is handled via trigger.config.ts and environment variables.
 * The SDK automatically reads TRIGGER_SECRET_KEY from the environment.
 *
 * This file is kept for compatibility but no longer performs manual configuration.
 */

// Validate that TRIGGER_SECRET_KEY is set
const accessToken = process.env.TRIGGER_SECRET_KEY?.trim();

if (!accessToken) {
  console.warn(
    "[trigger-config] Warning: TRIGGER_SECRET_KEY is not set. " +
    "Tasks may fail to trigger. Set TRIGGER_SECRET_KEY in your .env file."
  );
} else {
  console.log("[trigger-config] Trigger.dev SDK environment validated", {
    hasTriggerSecret: true,
    apiUrl: process.env.TRIGGER_API_URL || "https://api.trigger.dev",
  });
}
