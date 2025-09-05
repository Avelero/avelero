/**
 * Dynamic environment utilities for Avelero
 * Automatically detects the environment and returns appropriate URLs
 */

export function getApiUrl() {
  // Temporary debugging - remove after fixing
  if (typeof window === "undefined") {
    console.log("🔍 DEBUG getApiUrl:");
    console.log("  VERCEL_ENV =", process.env.VERCEL_ENV);
    console.log("  NODE_ENV =", process.env.NODE_ENV);
    console.log("  VERCEL_URL =", process.env.VERCEL_URL);
  }

  // Production environment
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    console.log("🚀 Using PRODUCTION API");
    return "https://avelero-api.fly.dev";
  }

  // Preview/staging environment
  if (process.env.VERCEL_ENV === "preview") {
    console.log("🔧 Using STAGING API");
    return "https://avelero-api-staging.fly.dev";
  }

  // Local development - use localhost API server
  console.log("🏠 Using LOCALHOST API");
  return "http://localhost:4000";
}

export function getAppUrl() {
  // Production environment
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://app.avelero.com";
  }

  // Preview/staging environment
  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development
  return "http://localhost:3000";
}

export function getWebsiteUrl() {
  // Production environment
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://avelero.com";
  }

  // Preview/staging environment
  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development - use localhost
  return "http://localhost:3000";
}
