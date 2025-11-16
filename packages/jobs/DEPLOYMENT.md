# Trigger.dev Jobs Deployment Guide

This document explains how to deploy Trigger.dev background jobs to production.

## Overview

- **Development:** Tasks run on your local dev server (`bun run dev`)
- **Production:** Tasks are deployed to Trigger.dev cloud and execute there

## Prerequisites

### 1. Trigger.dev Access Token

Get your production access token from the Trigger.dev dashboard:
1. Go to https://cloud.trigger.dev
2. Navigate to your project settings
3. Generate a new access token for production

### 2. GitHub Secrets Configuration

Add the following secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `TRIGGER_ACCESS_TOKEN` | Trigger.dev production access token | `tr_prod_...` |
| `DATABASE_URL` | Production database connection string | `postgresql://...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGci...` |
| `RESEND_API_KEY` | Resend API key for emails | `re_...` |
| `API_URL` | Production API URL | `https://api.yourdomain.com` |
| `INTERNAL_API_KEY` | Internal API authentication key | `prod-internal-key` |

## Deployment Process

### Automatic Deployment (via GitHub Actions)

The workflow `.github/workflows/production-jobs.yaml` automatically deploys when:
- Changes are pushed to `main` branch
- Files in `packages/jobs/**` are modified

### Manual Deployment

From the `packages/jobs` directory:

```bash
# Ensure you have the TRIGGER_ACCESS_TOKEN environment variable set
export TRIGGER_ACCESS_TOKEN=tr_prod_...

# Deploy to production
bun run deploy
```

## Environment Variables in Production

### CRITICAL: Configure in Trigger.dev Dashboard

Environment variables must be configured in the Trigger.dev dashboard for production:

1. Go to https://cloud.trigger.dev
2. Navigate to your project → **Settings** → **Environment Variables**
3. Select **Production** environment
4. Add the following variables:

| Variable Name | Required For | Example Value |
|---------------|--------------|---------------|
| `DATABASE_URL` | All tasks | `postgresql://...` |
| `NEXT_PUBLIC_SUPABASE_URL` | cleanup-expired-invites | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | cleanup-expired-invites, validate-and-stage | `eyJhbGci...` |
| `RESEND_API_KEY` | Email tasks | `re_...` |
| `API_URL` | WebSocket notifications | `https://api.yourdomain.com` |
| `INTERNAL_API_KEY` | API authentication | `prod-internal-key` |

⚠️ **Without these variables, tasks will fail with "Missing configuration" errors**

## Development vs Production

### Development Setup

1. **Start the dev server:**
   ```bash
   cd packages/jobs
   bun run dev
   ```

2. **Environment variables:**
   - Loaded from `packages/jobs/.env`
   - Copied to `.trigger/.env` automatically (you may need to do this manually once)

### Production Setup

1. **No dev server needed** - tasks run on Trigger.dev cloud
2. **Environment variables** - configured via GitHub secrets and Trigger.dev dashboard
3. **Deployment** - handled by GitHub Actions workflow

## Troubleshooting

### Tasks Stuck in Queue (Development)

**Problem:** Tasks show as "QUEUED" and expire after 10 minutes

**Solution:**
1. Ensure dev server is running: `bun run dev`
2. Check `.trigger/.env` file exists:
   ```bash
   cp .env .trigger/.env
   ```
3. Restart dev server

### Tasks Failing in Production

**Problem:** Tasks fail with "CONFIGURED_INCORRECTLY" or missing environment variables

**Solution:**
1. Verify GitHub secrets are set correctly
2. Check Trigger.dev dashboard for environment variable configuration
3. Ensure `TRIGGER_ACCESS_TOKEN` is a **production** token (starts with `tr_prod_`)

### Deployment Fails

**Problem:** GitHub workflow fails during deployment

**Solution:**
1. Check workflow logs in GitHub Actions tab
2. Verify all required secrets are configured
3. Ensure TypeScript and linting pass locally:
   ```bash
   bun run typecheck
   bun run lint
   ```

## Monitoring

### Trigger.dev Dashboard

Monitor task execution in real-time:
- **Production:** https://cloud.trigger.dev/projects/v3/proj_mqxiyipljbptdmfeivig/runs
- **Development:** https://cloud.trigger.dev/projects/v3/proj_mqxiyipljbptdmfeivig/runs?env=dev

### Task Status

Tasks can have the following statuses:
- `QUEUED` - Waiting for worker
- `EXECUTING` - Currently running
- `COMPLETED` - Successfully finished
- `FAILED` - Task failed with error
- `EXPIRED` - Timed out waiting for worker (dev only)
- `SYSTEM_FAILURE` - Infrastructure error

## Additional Resources

- [Trigger.dev Documentation](https://trigger.dev/docs)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Deployment Best Practices](https://trigger.dev/docs/deployment)
