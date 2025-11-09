# Bulk Import Trigger.dev Fix

## Problem Summary
The bulk import CSV processing was stuck in "PENDING" status on Trigger.dev dashboard. Jobs were never executing despite the Trigger.dev dev server running.

## Root Cause
The issue was in how the Trigger.dev tasks were being invoked in `apps/api/src/trpc/routers/bulk/index.ts`.

### Incorrect Implementation (Before)
```typescript
// Wrong: Importing and calling task directly
import { validateAndStage } from "@v1/jobs/trigger/validate-and-stage";

// This runs the task in the API server context, not via Trigger.dev
const runHandle = await validateAndStage.trigger({
  jobId: job.id,
  brandId,
  filePath: resolvedFile.path,
});
```

**Why This Failed:**
- Directly importing the task object bypasses the Trigger.dev SDK
- The task runs in the API server's process instead of being queued to Trigger.dev
- Trigger.dev never receives the job request, so it stays PENDING

### Correct Implementation (After)
```typescript
// Correct: Using the tasks SDK to trigger by task ID
import { tasks } from "@trigger.dev/sdk/v3";

// This sends the job to Trigger.dev for execution
const runHandle = await tasks.trigger("validate-and-stage", {
  jobId: job.id,
  brandId,
  filePath: resolvedFile.path,
});
```

**Why This Works:**
- Uses the official Trigger.dev SDK to queue jobs
- The task ID matches the `id` field in the task definition
- Trigger.dev receives the job and executes it in the background worker

## Changes Made

### 1. Fixed startImport mutation
**File:** `apps/api/src/trpc/routers/bulk/index.ts`

Changed from direct task import to SDK-based triggering:
- ❌ Removed: `import { validateAndStage } from "@v1/jobs/trigger/validate-and-stage"`
- ✅ Added: `import { tasks } from "@trigger.dev/sdk/v3"`
- ✅ Changed: `validateAndStage.trigger(...)` → `tasks.trigger("validate-and-stage", ...)`

### 2. Fixed approveImport mutation
**File:** `apps/api/src/trpc/routers/bulk/index.ts`

Uncommented and fixed the commit-to-production trigger:
- ✅ Enabled Phase 2 background job triggering
- ✅ Added error handling with status rollback
- ✅ Used `tasks.trigger("commit-to-production", ...)` pattern

## Task Registration

Both tasks are properly registered in `packages/jobs/src/trigger/index.ts`:

```typescript
export { validateAndStage } from "./validate-and-stage";
export { commitToProduction } from "./commit-to-production";
```

And both define their task IDs correctly:

**validate-and-stage.ts:**
```typescript
export const validateAndStage = task({
  id: "validate-and-stage",  // ← This ID is used in tasks.trigger()
  run: async (payload: ValidateAndStagePayload): Promise<void> => {
    // ...
  },
});
```

**commit-to-production.ts:**
```typescript
export const commitToProduction = task({
  id: "commit-to-production",  // ← This ID is used in tasks.trigger()
  run: async (payload: CommitToProductionPayload): Promise<void> => {
    // ...
  },
});
```

## Verification Steps

To verify the fix works:

1. **Restart the API server** (if running):
   ```bash
   cd apps/api
   bun dev
   ```

2. **Ensure Trigger.dev dev server is running**:
   ```bash
   cd packages/jobs
   bun run jobs
   ```
   
   You should see:
   ```
   [trigger-config] Trigger.dev SDK configured
   ○ Local worker ready [node] -> YYYYMMDD.XX
   ```

3. **Test the bulk import flow**:
   - Upload a CSV file
   - Click "Start Import"
   - Watch the Trigger.dev console for task execution
   - Check import status updates in real-time

4. **Monitor task execution**:
   - Open Trigger.dev dashboard
   - Navigate to the project runs
   - Verify runs show "EXECUTING" or "COMPLETED" instead of "PENDING"

## Key Takeaways

### ✅ Correct Pattern
```typescript
import { tasks } from "@trigger.dev/sdk/v3";

// Trigger by task ID string
await tasks.trigger("task-id", payload);
```

### ❌ Incorrect Pattern
```typescript
import { myTask } from "@v1/jobs/trigger/my-task";

// Don't call .trigger() directly on imported task
await myTask.trigger(payload);
```

## Related Files
- `apps/api/src/trpc/routers/bulk/index.ts` - Fixed task triggering
- `packages/jobs/src/trigger/validate-and-stage.ts` - Phase 1 validation task
- `packages/jobs/src/trigger/commit-to-production.ts` - Phase 2 commit task
- `packages/jobs/src/trigger/index.ts` - Task registration
- `packages/jobs/src/trigger/configure-trigger.ts` - SDK configuration

## Environment Variables Required
- `TRIGGER_SECRET_KEY` - Set in both `apps/api/.env` and `packages/jobs/.env`
- `TRIGGER_API_URL` (optional) - Defaults to `https://api.trigger.dev`

## Additional Notes
- The invite email task uses the correct pattern and has been working
- Both bulk import tasks now follow the same pattern as the working invite task
- Error handling includes rollback of job status if task triggering fails
