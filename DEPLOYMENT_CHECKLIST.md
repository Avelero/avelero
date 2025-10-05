# 🚀 Deployment Checklist - FIX DEPLOYMENT CRASH

## ⚠️ THE PROBLEM

Your deployment is crashing because:

1. **Missing Environment Variables** - Fly.io secrets are NOT set
2. **App wasn't listening on 0.0.0.0** - Fixed in latest commit

## ✅ THE SOLUTION (Follow These Steps)

### Step 1: Set Fly.io Secrets (CRITICAL!)

Run this command to set ALL required secrets at once:

```bash
flyctl secrets set \
  NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_KEY="your-service-key" \
  DATABASE_URL="your-database-url" \
  ALLOWED_API_ORIGINS="https://your-app-domain.com" \
  --app avelero-api-staging
```

**Replace the values above with your actual credentials!**

Where to find these values:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., https://xxxxx.supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase Project Settings → API → anon public key
- `SUPABASE_SERVICE_KEY` - From Supabase Project Settings → API → service_role key (keep secret!)
- `DATABASE_URL` - From Supabase Project Settings → Database → Connection string (Transaction mode)
- `ALLOWED_API_ORIGINS` - Your app's domain (comma-separated if multiple)

### Step 2: Verify Secrets Are Set

```bash
flyctl secrets list --app avelero-api-staging
```

You should see:
```
NAME                            DIGEST          CREATED AT
ALLOWED_API_ORIGINS            xxxxx           1m ago
DATABASE_URL                   xxxxx           1m ago
NEXT_PUBLIC_SUPABASE_ANON_KEY  xxxxx           1m ago
NEXT_PUBLIC_SUPABASE_URL       xxxxx           1m ago
SUPABASE_SERVICE_KEY           xxxxx           1m ago
```

### Step 3: Deploy (After Secrets Are Set!)

```bash
flyctl deploy \
  --remote-only \
  --dockerfile apps/api/Dockerfile \
  --config apps/api/fly-preview.yml
```

### Step 4: Monitor Deployment

```bash
# Watch logs in real-time
flyctl logs --app avelero-api-staging

# You should see:
# ✅ Environment variables validated
# 🚀 Starting API server on port 3000...
# ✅ API server initialized successfully
# Started server: http://0.0.0.0:3000
```

### Step 5: Verify Deployment

```bash
# Check health endpoint
curl https://avelero-api-staging.fly.dev/health

# Expected response:
# {"status":"ok","timestamp":"2024-10-05T...","environment":"production"}

# Check API info
curl https://avelero-api-staging.fly.dev/

# Expected response:
# {"name":"Avelero API","version":"1.0.0","status":"running","endpoints":{"health":"/health","trpc":"/trpc"}}
```

## 🔧 What Was Fixed in the Code

### 1. Network Binding (apps/api/src/index.ts)
```typescript
// Before (wrong - only localhost)
export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4000,
  fetch: app.fetch,
};

// After (correct - all interfaces)
export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4000,
  hostname: "0.0.0.0", // ✅ Listen on all interfaces for Docker/Fly.io
  fetch: app.fetch,
};
```

### 2. Environment Variable Validation (apps/api/src/index.ts)
Added startup validation that:
- ✅ Checks for required environment variables
- ✅ Exits immediately with clear error if missing
- ✅ Lists exactly which variables are needed

### 3. Better Error Handling (apps/api/src/trpc/init.ts)
- ✅ Explicit error messages for missing Supabase config
- ✅ Warning for optional admin client
- ✅ No more cryptic "undefined" errors

## 🚨 Common Errors & Solutions

### Error: "Missing required environment variables"

**Solution:** Set Fly.io secrets (see Step 1 above)

### Error: "app appears to be crashing"

**Cause:** Missing secrets or wrong configuration

**Solution:** 
1. Check logs: `flyctl logs --app avelero-api-staging`
2. Verify secrets: `flyctl secrets list --app avelero-api-staging`
3. Set any missing secrets

### Error: "not listening on expected address"

**Solution:** Already fixed! The latest code listens on `0.0.0.0`

### Error: "smoke checks failed"

**Cause:** App crashed during startup (usually missing secrets)

**Solution:**
1. Set all required secrets
2. Redeploy
3. Monitor logs immediately

## 📋 Quick Reference

### Essential Commands

```bash
# Set secrets
flyctl secrets set KEY=value --app avelero-api-staging

# List secrets
flyctl secrets list --app avelero-api-staging

# Deploy
flyctl deploy --remote-only --dockerfile apps/api/Dockerfile --config apps/api/fly-preview.yml

# View logs
flyctl logs --app avelero-api-staging

# Check status
flyctl status --app avelero-api-staging

# SSH into machine (for debugging)
flyctl ssh console --app avelero-api-staging
```

### Health Check Endpoints

```bash
# Health check
curl https://avelero-api-staging.fly.dev/health

# API info
curl https://avelero-api-staging.fly.dev/

# tRPC endpoint (should return 404 for GET)
curl https://avelero-api-staging.fly.dev/trpc
```

## ✅ Success Indicators

When deployment is successful, you'll see:

1. ✅ No "app appears to be crashing" errors
2. ✅ Health checks passing
3. ✅ Logs show: "Started server: http://0.0.0.0:3000"
4. ✅ Can access health endpoint via curl
5. ✅ Status shows machines running

## 🔄 If Deployment Still Fails

1. **Double-check secrets are set correctly**
   ```bash
   flyctl secrets list --app avelero-api-staging
   ```

2. **Check logs immediately after deployment**
   ```bash
   flyctl logs --app avelero-api-staging
   ```

3. **Verify Supabase credentials are correct**
   - Test them locally with the .env file
   - Make sure DATABASE_URL is accessible from Fly.io

4. **Try deploying to a fresh app**
   ```bash
   flyctl apps create avelero-api-staging-new
   flyctl secrets set ... --app avelero-api-staging-new
   flyctl deploy ... --config apps/api/fly-preview.yml --app avelero-api-staging-new
   ```

## 📚 Additional Resources

- **Full Deployment Guide:** See `apps/api/DEPLOYMENT.md`
- **Deployment Fix Details:** See `DEPLOYMENT_FIX.md`
- **Fly.io Secrets Docs:** https://fly.io/docs/reference/secrets/
- **Fly.io Health Checks:** https://fly.io/docs/reference/configuration/#services-http_checks

---

**Remember:** Always set secrets BEFORE deploying! 🔑
