# Production deployments stuck in PENDING_VERSION despite being marked as CURRENT

## Environment
- **SDK Version**: 4.0.6
- **CLI Version**: 4.0.6
- **Node.js**: v22.19.0
- **Plan**: Free tier
- **Project ID**: `proj_mqxiyipljbptdmfeivig`

## Problem
Deployed tasks to production environment multiple times. Dashboard shows the deployment as "CURRENT", but all triggered runs remain stuck in `PENDING_VERSION` status indefinitely.

## Steps to Reproduce
1. Deploy tasks to production:
   ```bash
   TRIGGER_SECRET_KEY=tr_prod_*** npx trigger.dev deploy
   ```
2. Deployment succeeds: `✅ Version 20251109.13 deployed with 2 detected tasks`
3. Dashboard shows version as "CURRENT" in production environment
4. Trigger a task:
   ```typescript
   await tasks.trigger("validate-and-stage", { jobId, brandId, filePath });
   ```
5. Check run status:
   ```typescript
   const run = await runs.retrieve(runId);
   console.log(run.status); // "PENDING_VERSION"
   console.log(run.env);     // undefined
   console.log(run.version); // undefined
   ```

## Expected Behavior
- Runs should execute on cloud workers using the CURRENT deployment version
- Run objects should have `env` set to "PROD" and `version` set to "20251109.13"
- Status should transition from QUEUED → EXECUTING → COMPLETED

## Actual Behavior
- All runs stuck in `PENDING_VERSION` status
- Run objects have `env: undefined` and `version: undefined`
- Runs never execute despite cloud workers being available (free tier includes 10 concurrent runs)

## Additional Context
- Tried deploying multiple versions (20251109.10, .12, .13) - same issue
- Tried manual promotion with `npx trigger.dev promote 20251109.13` - says "already current"
- Dashboard consistently shows deployment as CURRENT
- Project configuration is correct (project ID matches)
- DEV environment with local worker works perfectly

## Diagnosis
Platform appears to have a disconnect where:
- Deployment system marks version as "current" ✅
- Worker allocation system doesn't associate new runs with any version ❌
- Runs remain in PENDING_VERSION waiting for version information that never comes

## Workaround
Switched to DEV environment with local worker as temporary solution.

## Question
Is there a manual step required for free tier production deployments, or is this a platform bug?
