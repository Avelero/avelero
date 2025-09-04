# Environment Variables Setup Guide

## Service Configuration Overview

### PRODUCTION Environment
```bash
# Vercel (Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_KEY=your-prod-service-key
NEXT_PUBLIC_API_URL=https://avelero-api.fly.dev
TRIGGER_SECRET_KEY=your-prod-trigger-secret
APP_URL=https://yourdomain.com

# Fly.io (API)
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_KEY=your-prod-service-key
ALLOWED_API_ORIGINS=https://yourdomain.com
APP_URL=https://avelero-api.fly.dev
PORT=3000
```

### STAGING Environment
```bash
# Vercel (Frontend - Preview)
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_KEY=your-staging-service-key
NEXT_PUBLIC_API_URL=https://avelero-api-staging.fly.dev
TRIGGER_SECRET_KEY=your-staging-trigger-secret
APP_URL=https://staging-xyz.vercel.app

# Fly.io (API Staging)
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_KEY=your-staging-service-key
ALLOWED_API_ORIGINS=https://staging-xyz.vercel.app
APP_URL=https://avelero-api-staging.fly.dev
PORT=3000
```

## Setup Commands

### Fly.io Secrets (Production)
```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://your-prod-project.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-prod-anon-key" \
  SUPABASE_SERVICE_KEY="your-prod-service-key" \
  APP_URL="https://avelero-api.fly.dev" \
  ALLOWED_API_ORIGINS="https://yourdomain.com" \
  --app avelero-api
```

### Fly.io Secrets (Staging)
```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://your-staging-project.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-staging-anon-key" \
  SUPABASE_SERVICE_KEY="your-staging-service-key" \
  APP_URL="https://avelero-api-staging.fly.dev" \
  ALLOWED_API_ORIGINS="https://staging-xyz.vercel.app" \
  --app avelero-api-staging
```

## Deployment Workflow

1. **Develop locally** with `.env.local`
2. **Push to staging branch** → Auto-deploys Vercel preview + manual Fly staging deploy
3. **Test staging environment** 
4. **Merge to main** → Auto-deploys Vercel production + manual Fly production deploy
