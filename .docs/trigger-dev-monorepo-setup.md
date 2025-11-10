# Trigger.dev Monorepo Setup

## Overview

This document explains how Trigger.dev is configured to work seamlessly with the monorepo's `bun run dev` command.

## Architecture

```
Root (/)
├── .env                           # Contains TRIGGER_SECRET_KEY for monorepo
├── turbo.json                     # Configures env var passing to tasks
├── packages/jobs/
│   ├── .env                       # Contains all env vars for jobs package
│   ├── trigger.config.ts          # Trigger.dev v4 configuration
│   ├── src/trigger/
│   │   ├── index.ts               # Exports all tasks
│   │   ├── validate-and-stage.ts  # Bulk import validation task
│   │   └── commit-to-production.ts # Bulk import commit task
│   └── package.json               # dev script runs trigger.dev dev
└── apps/api/
    ├── .env                       # Contains TRIGGER_SECRET_KEY + other vars
    └── src/trpc/routers/bulk/
        └── index.ts               # Triggers background jobs
```

## How It Works

### 1. Environment Variables

**Root Level (.env)**
- Contains `TRIGGER_SECRET_KEY` for development
- Turbo reads this and passes it to all dev tasks
- This ensures consistent environment across all services

**Package Level (.env files)**
- Each package can have additional env vars
- Jobs package: Has DATABASE_URL, SUPABASE keys, etc.
- API package: Has auth credentials, API keys, etc.

### 2. Turbo Configuration

In `turbo.json`, the `dev` task is configured to pass environment variables:

```json
{
  "dev": {
    "env": [
      "TRIGGER_SECRET_KEY",
      "TRIGGER_API_URL",
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_KEY"
    ],
    "persistent": true,
    "cache": false
  }
}
```

This ensures that when you run `bun run dev`, all packages receive these env vars.

### 3. Starting Development

**Single Command Start:**
```bash
bun run dev
```

This runs `turbo dev --parallel` which starts:
- ✅ API server (apps/api)
- ✅ Web app (apps/web)
- ✅ App app (apps/app)
- ✅ DPP app (apps/dpp)
- ✅ Email dev (packages/email)
- ✅ **Trigger.dev worker (packages/jobs)** ⬅️ NEW!

**Individual Service Start:**
```bash
# Just the trigger.dev worker
bun run dev:jobs

# Just the API
bun run dev:api
```

### 4. How Jobs Are Triggered

1. **User uploads CSV** → API receives request
2. **API calls** `tasks.trigger("validate-and-stage", { jobId, brandId, filePath })`
3. **Trigger.dev SDK** → Sends job to trigger.dev cloud using `TRIGGER_SECRET_KEY`
4. **Local dev worker** → Picks up job from trigger.dev queue
5. **Worker executes** → Runs validation, populates staging tables
6. **Job completes** → Status updated in database

## Troubleshooting

### Jobs Stuck in Queue

**Symptoms:**
- Jobs show as "QUEUED" in trigger.dev dashboard
- Never execute despite dev worker running

**Causes:**
1. ❌ Dev worker not authenticated
2. ❌ Wrong TRIGGER_SECRET_KEY in API vs jobs
3. ❌ Dev worker not running
4. ❌ Environment mismatch (dev key with prod deployment)

**Solutions:**
1. Ensure `.env` exists at root with `TRIGGER_SECRET_KEY`
2. Restart all services: `Ctrl+C` then `bun run dev`
3. Authenticate CLI if needed: `cd packages/jobs && npx trigger.dev@4.0.6 login`
4. Check dev worker is running: `ps aux | grep trigger.dev`

### Version Mismatch

**Symptoms:**
- Worker starts but jobs don't execute
- "PENDING_VERSION" status

**Solution:**
- Ensure all trigger.dev packages use same version (currently 4.0.6):
  - `@trigger.dev/sdk` in dependencies
  - `trigger.dev` in devDependencies
  - CLI version in scripts: `npx --yes trigger.dev@4.0.6 dev`

### Environment Variables Not Loading

**Symptoms:**
- Worker starts but tasks fail with missing env vars
- Database connection errors
- Supabase auth errors

**Solution:**
1. Check `packages/jobs/.env` has all required vars:
   - DATABASE_URL
   - NEXT_PUBLIC_SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - RESEND_API_KEY
2. Restart dev services after changing env vars
3. Verify turbo.json includes vars in `env` array

## Development Workflow

### Adding a New Background Job

1. Create task file in `packages/jobs/src/trigger/`:
```typescript
import { logger, task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  run: async (payload: MyPayload) => {
    logger.info("Task started", payload);
    // Your logic here
  },
});
```

2. Export task in `packages/jobs/src/trigger/index.ts`:
```typescript
export { myTask } from "./my-task";
```

3. Trigger from API code:
```typescript
import { tasks } from "@trigger.dev/sdk";

await tasks.trigger("my-task", {
  // Your payload
});
```

4. Restart dev worker (Turbo will auto-restart it)

### Testing Background Jobs

1. Start dev environment: `bun run dev`
2. Trigger job through API
3. Watch terminal output from `@v1/jobs:dev` for logs
4. Check trigger.dev dashboard: https://cloud.trigger.dev
5. Check database for updated records

## Production Deployment

**Deploy jobs to trigger.dev cloud:**
```bash
cd packages/jobs
TRIGGER_SECRET_KEY=tr_prod_xxx npx trigger.dev@4.0.6 deploy
```

**Important:**
- Use production secret key (starts with `tr_prod_`)
- Update `TRIGGER_SECRET_KEY` in production API environment
- Deployed tasks run on trigger.dev cloud workers (not local)

## Key Differences from Previous Setup

### Before (Broken):
```typescript
// ❌ Direct import - bypassed trigger.dev
import { validateAndStage } from "@v1/jobs/trigger/validate-and-stage";
await validateAndStage.trigger({ ... });
```

### After (Working):
```typescript
// ✅ Uses SDK - routes through trigger.dev
import { tasks } from "@trigger.dev/sdk";
await tasks.trigger("validate-and-stage", { ... });
```

### Before (Version Issues):
- Mixed versions: SDK 4.0.1, CLI 4.0.6
- Jobs stuck in queue

### After (Fixed):
- Consistent version: 4.0.6 everywhere
- All packages updated together

### Before (Manual Start):
```bash
# Had to run in separate terminals:
cd packages/jobs && bun run jobs  # Terminal 1
cd apps/api && bun run dev        # Terminal 2
# ... (other services)
```

### After (Single Command):
```bash
bun run dev  # Starts everything including trigger.dev worker
```

## References

- [Trigger.dev v4 Documentation](https://trigger.dev/docs)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [Project Issue Tracker](./TRIGGER_DEV_ISSUE.md)
- [Bulk Import Fix](./bulk-import-trigger-fix.md)
