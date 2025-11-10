# Development Setup

## Quick Start

```bash
# Install dependencies
bun install

# Start all services (API, Web, App, DPP, Email, Trigger.dev)
bun run dev
```

That's it! All services will start using Turbo and the trigger.dev worker will be ready to process background jobs.

**Note:** If you prefer a simpler output without Turbo's stream UI, use `bun run dev:simple`

## What Gets Started

When you run `bun run dev`, the following services start:

| Service | Port | Log File |
|---------|------|----------|
| API | 3000 | `/tmp/avelero-api.log` |
| Web | 3001 | `/tmp/avelero-web.log` |
| App | 3000 | `/tmp/avelero-app.log` |
| DPP | 3002 | `/tmp/avelero-dpp.log` |
| Email | 3003 | `/tmp/avelero-email.log` |
| Trigger.dev Worker | - | `/tmp/avelero-trigger.log` |

## Viewing Logs

### Real-time log monitoring:
```bash
# API logs
tail -f /tmp/avelero-api.log

# Trigger.dev worker logs
tail -f /tmp/avelero-trigger.log

# All logs at once (requires multitail or tmux)
multitail /tmp/avelero-*.log
```

### Check if services are running:
```bash
ps aux | grep -E "next dev|bun run|trigger.dev" | grep -v grep
```

## Environment Setup

### Required Environment Variables

Create `.env` in the project root with:

```bash
TRIGGER_SECRET_KEY=tr_dev_your_key_here
```

Get your key from: https://cloud.trigger.dev/orgs/avelero-4caa/projects/avelero-gVix/apikeys

### Package-Specific Environment Files

- `apps/api/.env` - API configuration
- `packages/jobs/.env` - Trigger.dev worker configuration

## Development Workflow

### 1. Starting Development

```bash
bun run dev
```

Press `Ctrl+C` to stop all services gracefully.

### 2. Start Individual Services

```bash
# Just the API
bun run dev:api

# Just the trigger.dev worker
bun run dev:jobs

# Just the web app
bun run dev:web
```

### 3. Testing Background Jobs

1. Start dev environment: `bun run dev`
2. Upload a CSV file through the UI
3. Watch logs: `tail -f /tmp/avelero-trigger.log`
4. Check trigger.dev dashboard: https://cloud.trigger.dev

### 4. Debugging

If jobs are stuck in queue:

```bash
# 1. Check if worker is running
ps aux | grep "trigger.dev" | grep -v grep

# 2. Check worker logs for errors
tail -50 /tmp/avelero-trigger.log

# 3. Verify authentication
cd packages/jobs
npx trigger.dev@4.0.6 whoami

# 4. Test job triggering directly
bun run scripts/test-trigger-job.ts
```

## Troubleshooting

### Services won't start

```bash
# Stop any existing services
bun run dev:stop

# Check for port conflicts
lsof -i :3000
lsof -i :3001
lsof -i :3002
lsof -i :3003

# Start fresh
bun run dev
```

### Trigger.dev worker not picking up jobs

**Check worker is running:**
```bash
tail -f /tmp/avelero-trigger.log
```

Look for:
```
○ Local worker ready [node] -> 20251110.X
```

**Verify authentication:**
```bash
cd packages/jobs
npx trigger.dev@4.0.6 whoami
```

**Check environment variables:**
```bash
./scripts/diagnose-trigger.sh
```

### Port already in use

```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or stop all services and restart
bun run dev:stop
bun run dev
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all services (Turbo) |
| `bun run dev:simple` | Start all services (Bash script with log files) |
| `bun run dev:stop` | Stop all services |
| `bun run dev:api` | Start only API |
| `bun run dev:web` | Start only Web |
| `bun run dev:app` | Start only App |
| `bun run dev:dpp` | Start only DPP |
| `bun run dev:jobs` | Start only Trigger.dev worker |
| `scripts/diagnose-trigger.sh` | Diagnose trigger.dev setup |
| `scripts/test-trigger-job.ts` | Test job triggering |

## Development Options

### Option 1: Turbo (Default - Recommended)

```bash
bun run dev
```

Uses Turbo's stream UI with all services running in parallel. Clean, organized output.

### Option 2: Simple Script (Alternative)

```bash
bun run dev:simple
```

Uses a bash script with separate log files per service. Useful if you prefer traditional log files:
- `/tmp/avelero-api.log`
- `/tmp/avelero-trigger.log`
- etc.

Both options:
- ✅ Start all services correctly
- ✅ Proper environment variable handling
- ✅ Trigger.dev worker guaranteed to start
- ✅ Easy to debug

## Production Deployment

For production, deploy trigger.dev tasks separately:

```bash
cd packages/jobs
TRIGGER_SECRET_KEY=tr_prod_xxx npx trigger.dev@4.0.6 deploy
```

Then update your production API environment with the production `TRIGGER_SECRET_KEY`.

## Additional Resources

- [Trigger.dev Documentation](.docs/trigger-dev-monorepo-setup.md)
- [Bulk Import Implementation](.docs/bulk-import-trigger-fix.md)
- [Trigger.dev Dashboard](https://cloud.trigger.dev)
