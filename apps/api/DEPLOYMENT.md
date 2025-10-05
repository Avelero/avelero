# API Deployment Guide

## ⚠️ CRITICAL: Set Secrets BEFORE Deploying

**YOU MUST SET FLY.IO SECRETS BEFORE DEPLOYING OR THE APP WILL CRASH!**

The API validates required environment variables on startup and will exit immediately if they're missing.

## Prerequisites

Before deploying the API, ensure you have the following environment variables set in your Fly.io secrets:

### Required Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# API Configuration
PORT=3000
ALLOWED_API_ORIGINS=https://your-app.com,https://your-staging.com

# Optional
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_SECRET=your-google-secret
RESEND_API_KEY=your-resend-key
TRIGGER_SECRET_KEY=your-trigger-key
```

## Setting Fly.io Secrets

```bash
# Set secrets for staging
flyctl secrets set \
  NEXT_PUBLIC_SUPABASE_URL="your-value" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-value" \
  SUPABASE_SERVICE_KEY="your-value" \
  DATABASE_URL="your-value" \
  --app avelero-api-staging

# Set secrets for production
flyctl secrets set \
  NEXT_PUBLIC_SUPABASE_URL="your-value" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-value" \
  SUPABASE_SERVICE_KEY="your-value" \
  DATABASE_URL="your-value" \
  --app avelero-api-production
```

## Deployment Commands

### Staging Deployment
```bash
flyctl deploy \
  --remote-only \
  --dockerfile apps/api/Dockerfile \
  --config apps/api/fly-preview.yml
```

### Production Deployment
```bash
flyctl deploy \
  --remote-only \
  --dockerfile apps/api/Dockerfile \
  --config apps/api/fly.yml
```

## Troubleshooting

### App Crashes on Startup

If the app crashes immediately after deployment, check the logs:
```bash
flyctl logs --app avelero-api-staging
```

Common causes:
1. **Missing environment variables** - Ensure all required secrets are set
2. **Database connection issues** - Verify DATABASE_URL is correct and accessible
3. **Supabase configuration** - Check SUPABASE_URL and ANON_KEY are valid

### Health Check Failures

The API has a health check endpoint at `/health`. Verify it's accessible:
```bash
curl https://your-api.fly.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### Viewing Deployment Status

```bash
# Check app status
flyctl status --app avelero-api-staging

# View recent logs
flyctl logs --app avelero-api-staging

# SSH into the machine (for debugging)
flyctl ssh console --app avelero-api-staging
```

## Smoke Tests

After deployment, verify the API is working:

```bash
# Health check
curl https://your-api.fly.dev/health

# API info
curl https://your-api.fly.dev/

# tRPC endpoint (should return method not allowed for GET)
curl https://your-api.fly.dev/trpc
```

## Rollback

If deployment fails, rollback to the previous version:

```bash
# List recent releases
flyctl releases --app avelero-api-staging

# Rollback to specific version
flyctl releases rollback <version> --app avelero-api-staging
```
