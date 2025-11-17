# @v1/jobs

Background job processing using Trigger.dev for the Avelero application.

## Setup

### 1. Environment Variables

Copy the `.env.example` file to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**Important:** Make sure to set both `TRIGGER_SECRET_KEY` and `TRIGGER_ACCESS_TOKEN` to the same value. This is required for the Trigger.dev CLI to authenticate properly during local development.

### 2. Authentication

The Trigger.dev worker requires authentication to connect to the Trigger.dev cloud service. There are two ways to authenticate:

#### Option 1: Using Environment Variables (Recommended for Development)

Set the `TRIGGER_ACCESS_TOKEN` in your `.env` file. This repo ships with a `.env` checked in for local work, but if you regenerate it ensure the value is present (the Turbo dev script automatically passes `.env` to the Trigger.dev CLI).

```env
TRIGGER_ACCESS_TOKEN=tr_dev_your_key_here
```

#### Option 2: Using the CLI Login Command

If you prefer interactive authentication:

```bash
cd packages/jobs
bun run login
```

This will open a browser window to authenticate with Trigger.dev.

### 3. Verify Authentication

To verify your authentication is working:

```bash
cd packages/jobs
bun run whoami
```

This should display your account and project details.

## Development

### Running the Worker Locally

The worker is automatically started when you run the main development server:

```bash
# From the root of the project
bun run dev
```

This will start the Trigger.dev worker in the background, which will process tasks like:
- `validate-and-stage`: CSV validation and staging for bulk imports
- `commit-to-production`: Committing staged data to production

The script invoked here (`scripts/run-trigger.sh`) automatically loads `.env` when present so `TRIGGER_ACCESS_TOKEN` reaches the CLI, keeping `bun run dev` functional without extra manual login steps.

### Testing the Worker

To test if the worker is running and connected:

1. Upload a CSV file through the bulk import UI
2. Check the progress widget - it should move from PENDING to VALIDATING
3. Monitor the terminal output for Trigger.dev logs

If the job stays stuck in PENDING status, check:
- Is the worker running? (Look for Trigger.dev logs in the terminal)
- Is authentication working? (Run `bun run whoami` in packages/jobs)
- Check the `.env` file has `TRIGGER_ACCESS_TOKEN` set

## Deployment

Deployments are handled automatically via GitHub Actions. The workflow uses `TRIGGER_ACCESS_TOKEN` from GitHub secrets to authenticate the deploy command.

```bash
# Manual deployment (if needed)
cd packages/jobs
bun run deploy
```

## Troubleshooting

### "Unable to validate existing personal access token" Error

This means the Trigger.dev CLI cannot authenticate. Solutions:

1. Check that `TRIGGER_ACCESS_TOKEN` is set in `.env`
2. Run `bun run login` to authenticate interactively
3. Verify the token with `bun run whoami`

### Jobs Stuck in PENDING Status

This means the worker is not running or not connected:

1. Check that the dev server is running (`bun run dev` from root)
2. Look for Trigger.dev connection logs in the terminal
3. Verify authentication with `bun run whoami`
4. Check that `TRIGGER_ACCESS_TOKEN` matches your `TRIGGER_SECRET_KEY`

### Worker Not Starting

If the worker process exits immediately:

1. Check `.env` file exists and has all required variables
2. Run `bun run whoami` to verify authentication
3. Check for error messages in the terminal output
4. Ensure no other process is using the same port

## Available Scripts

- `bun run dev` - Start the Trigger.dev worker (called by Turbo)
- `bun run login` - Authenticate with Trigger.dev
- `bun run whoami` - Verify current authentication
- `bun run deploy` - Deploy tasks to Trigger.dev cloud
- `bun run lint` - Lint the codebase
- `bun run format` - Format the codebase
- `bun run typecheck` - Run TypeScript type checking

## Architecture

This package contains background jobs that are triggered from the API layer:

- **validate-and-stage**: Validates CSV uploads and stages them in the database
- **commit-to-production**: Commits staged data to the production tables

Jobs communicate with the API server via WebSocket to emit real-time progress updates to the UI.
