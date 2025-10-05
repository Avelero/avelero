# Deployment Crash Fix - Summary

## Problem
The API was crashing immediately after deployment to Fly.io with the error:
```
smoke checks for 2876924f045608 failed: the app appears to be crashing
```

## Root Cause
The application was failing to start because:

1. **Missing Environment Variables** - The Docker container didn't have required environment variables set (DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
2. **No Startup Validation** - The app tried to connect to services without checking if configuration was available
3. **Silent Failures** - No clear error messages were logged, making debugging difficult

## Solution Implemented

### 1. Added Environment Variable Validation (`apps/api/src/index.ts`)

```typescript
// Validate required environment variables at startup
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  for (const varName of missingEnvVars) {
    console.error(`   - ${varName}`);
  }
  console.error("\nPlease set these environment variables and restart the server.");
  process.exit(1);
}
```

**Benefits:**
- ✅ App exits immediately with clear error message if config is missing
- ✅ Lists exactly which environment variables need to be set
- ✅ Prevents silent failures and unclear crash logs

### 2. Enhanced Health Check Endpoint

```typescript
app.get("/health", (c) => {
  return c.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
    200,
  );
});
```

**Benefits:**
- ✅ Fly.io smoke tests can verify the app is responding
- ✅ Provides deployment timestamp for debugging
- ✅ Shows which environment the app is running in

### 3. Added Root Endpoint for API Info

```typescript
app.get("/", (c) => {
  return c.json(
    {
      name: "Avelero API",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        trpc: "/trpc",
      },
    },
    200,
  );
});
```

**Benefits:**
- ✅ Easy way to verify the API is accessible
- ✅ Documents available endpoints
- ✅ Helpful for developers and DevOps

### 4. Improved Error Handling in `init.ts`

```typescript
function createSupabaseForRequest(
  authHeader?: string | null,
): SupabaseClient<SupabaseDatabase> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  // ...
}
```

**Benefits:**
- ✅ Explicit error messages when Supabase config is missing
- ✅ Prevents cryptic "undefined" errors
- ✅ Makes debugging much easier

### 5. Added Startup Logging

```typescript
console.log("✅ Environment variables validated");
console.log(`🚀 Starting API server on port ${process.env.PORT || 4000}...`);
// ...
console.log("✅ API server initialized successfully");
```

**Benefits:**
- ✅ Clear visibility into startup process
- ✅ Easy to identify where startup fails
- ✅ Confirms successful initialization

### 6. Created Deployment Documentation (`apps/api/DEPLOYMENT.md`)

Complete guide covering:
- Required environment variables
- How to set Fly.io secrets
- Deployment commands
- Troubleshooting steps
- Rollback procedures

## How to Fix Your Deployment

### Step 1: Set Required Fly.io Secrets

```bash
flyctl secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here" \
  SUPABASE_SERVICE_KEY="your-service-key-here" \
  DATABASE_URL="postgresql://user:pass@host:port/db" \
  ALLOWED_API_ORIGINS="https://your-app.com" \
  --app avelero-api-staging
```

### Step 2: Deploy with the Fixed Code

```bash
flyctl deploy \
  --remote-only \
  --dockerfile apps/api/Dockerfile \
  --config apps/api/fly-preview.yml
```

### Step 3: Verify Deployment

```bash
# Check health endpoint
curl https://avelero-api-staging.fly.dev/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-10-05T...",
#   "environment": "production"
# }

# Check API info
curl https://avelero-api-staging.fly.dev/

# View logs
flyctl logs --app avelero-api-staging
```

## Testing Locally

The API now provides clear feedback when starting:

```bash
cd apps/api
bun run src/index.ts

# Output:
# ✅ Environment variables validated
# 🚀 Starting API server on port 4000...
# ✅ API server initialized successfully
# Started server: http://localhost:4000
```

## Additional Improvements Made

1. **Better error messages** - Clear indication of what's wrong
2. **Graceful degradation** - Admin client is optional (with warning)
3. **Environment awareness** - Logs show which environment is running
4. **Health check improvements** - More informative health endpoint
5. **API documentation** - Root endpoint documents available routes

## Files Changed

1. `apps/api/src/index.ts` - Added validation, logging, and endpoints
2. `apps/api/src/trpc/init.ts` - Improved error handling
3. `apps/api/DEPLOYMENT.md` - New deployment documentation

## Prevention for Future Deployments

1. **Always set secrets before deploying** - Use the secrets checklist
2. **Test locally first** - Verify env vars are working
3. **Check logs immediately** - Use `flyctl logs` after deployment
4. **Use health checks** - Monitor `/health` endpoint
5. **Document requirements** - Keep DEPLOYMENT.md updated

## Related Documentation

- See `apps/api/DEPLOYMENT.md` for full deployment guide
- Fly.io secrets: https://fly.io/docs/reference/secrets/
- Health checks: https://fly.io/docs/reference/configuration/#services-http_checks

---

**Status:** ✅ Fixed and Ready for Deployment

**Next Steps:**
1. Set the required Fly.io secrets
2. Deploy with the updated code
3. Verify health endpoint responds
4. Monitor logs for any issues
