# Base image with Bun
FROM oven/bun:1.2.21 AS base

# Install turbo CLI globally using Bun
FROM base AS turbo-cli
RUN bun add -g turbo

# Builder stage
FROM turbo-cli AS builder
WORKDIR /app
# Copy all files
COPY . .
# Use turbo CLI from Bun global install to prune workspaces
RUN turbo prune @v1/api --docker

# Installer stage
FROM base AS installer
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
# Don't copy the lockfile, allow Bun to generate a fresh one
RUN bun install

# Copy the full source code
COPY --from=builder /app/out/full/ .

# Runner stage (same as installer to avoid another copy)
FROM installer AS runner

# Set the API directory as working directory
WORKDIR /app/apps/api

# Set environment variables
ENV NODE_ENV=production

# Expose the port the API runs on
EXPOSE 3000

# Run the API directly with Bun
CMD ["bun", "run", "src/index.ts"]

</apps/api/Dockerfile>

<apps/api/fly-preview.yml>
app = "avelero-api-pr-preview"
primary_region = 'ams'

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = '3000'
  ALLOWED_API_ORIGINS = 'https://*.vercel.app,http://localhost:3000'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'suspend'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

  [[http_service.checks]]
    grace_period = "10s"
    interval = "45s"
    method = "GET"
    timeout = "10s"
    path = "/health"

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
