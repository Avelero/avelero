# Avelero Quick Setup Guide

## Prerequisites
- Bun (package manager)
- Docker (for Supabase)
- Git

## One-Command Setup
```bash
./setup.sh
```

## Manual Setup Steps

### 1. Install Dependencies
```bash
bun install
```

### 2. Setup Environment Files
```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
cp apps/web/.env.example apps/web/.env

# Edit the .env files with your actual credentials:
# - Supabase URL and keys
# - Upstash Redis credentials
# - Resend API key
# - Other service credentials
```

### 3. Development Commands

#### Start All Services
```bash
bun dev
```

#### Start Individual Services
```bash
bun dev:app      # Main application (port 3000)
bun dev:api      # API/Supabase (port 54321)
bun dev:web      # Marketing website
bun dev:jobs     # Background jobs (Trigger.dev)
```

#### Database Commands
```bash
bun migrate      # Run database migrations
bun seed         # Seed database with test data
```

#### Code Quality
```bash
bun run lint     # Run linting
bun run format   # Format code with Biome
bun run test     # Run tests
bun run typecheck # Type checking
```

#### Build Commands
```bash
bun run build        # Build all apps
bun run build:app    # Build main app only
```

## Services Setup

### Supabase (Database & Auth)
1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key to `.env` files
3. Run migrations: `bun migrate`

### Upstash (Redis & Rate Limiting)
1. Create an Upstash account at https://upstash.com
2. Get Redis REST URL and token
3. Add to `.env` files

### Resend (Email)
1. Create a Resend account at https://resend.com
2. Get API key and add to `.env`

### Trigger.dev (Background Jobs)
1. Create a Trigger.dev account at https://trigger.dev
2. Connect your repository
3. Deploy jobs: `bun run deploy` (from packages/jobs)

### OpenPanel (Analytics)
1. Create an OpenPanel account at https://openpanel.dev
2. Get client ID and secret key
3. Add to `.env`

## MCP Configuration
The setup script creates basic MCP configuration files:
- `.cursorrules` - Cursor/VS Code rules
- `mcp.json` - Model Context Protocol servers

## Taskmaster
Basic Taskmaster configuration is created for project management.

## Troubleshooting

### Port Conflicts
If ports are already in use:
- App: Change port in `apps/app/package.json` or use `PORT=3001 bun dev:app`
- API: Check Supabase dashboard for port configuration

### Database Connection Issues
- Ensure Supabase is running: `docker ps`
- Check `.env` file has correct Supabase credentials
- Run migrations: `bun migrate`

### Permission Issues
- Ensure all scripts are executable: `chmod +x setup.sh`
- Check file permissions on `.env` files

## Need Help?
Check the main README.md for detailed documentation or ask in the team chat.