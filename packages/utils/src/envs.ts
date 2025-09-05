export function getApiUrl() {
  // Production environment
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://avelero-api.fly.dev";
  }

  // Preview/staging environment
  if (process.env.VERCEL_ENV === "preview") {
    return "https://avelero-api-staging.fly.dev";
  }

  // Local development - use localhost API server
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
