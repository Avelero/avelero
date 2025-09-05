export function getApiUrl() {
  // Preview/staging environment - check first
  if (process.env.VERCEL_ENV === "preview") {
    return "https://avelero-api-staging.fly.dev";
  }

  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://avelero-api.fly.dev";
  }

  // Local development - use localhost API server
  return "http://localhost:4000";
}

export function getAppUrl() {
  // Preview/staging environment - check first
  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://app.avelero.com";
  }

  // Local development
  return "http://localhost:3000";
}

export function getWebsiteUrl() {
  // Preview/staging environment - check first
  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://avelero.com";
  }

  // Local development - use localhost
  return "http://localhost:3000";
}
