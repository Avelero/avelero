![hero](image.png)


<p align="center">
	<h1 align="center"><b>Create v1</b></h1>
<p align="center">
    An open-source starter kit based on <a href="https://midday.ai">Midday</a>.
    <br />
    <br />
    <a href="https://v1.run"><strong>Website</strong></a> · 
    <a href="https://github.com/midday-ai/v1/issues"><strong>Issues</strong></a> · 
    <a href="#whats-included"><strong>What's included</strong></a> ·
    <a href="#prerequisites"><strong>Prerequisites</strong></a> ·
    <a href="#getting-started"><strong>Getting Started</strong></a> ·
    <a href="#how-to-use"><strong>How to use</strong></a>
  </p>
</p>

Everything you need to build a production ready SaaS, it's a opinionated stack based on learnings from building Midday using the latest Next.js framework, it's a monorepo with a focus on code reuse and best practices that will grow with your business.

## What's included

[Next.js](https://nextjs.org/) - Framework<br>
[Turborepo](https://turbo.build) - Build system<br>
[Biome](https://biomejs.dev) - Linter, formatter<br>
[TailwindCSS](https://tailwindcss.com/) - Styling<br>
[Shadcn](https://ui.shadcn.com/) - UI components<br>
[TypeScript](https://www.typescriptlang.org/) - Type safety<br>
[Supabase](https://supabase.com/) - Authentication, database, storage<br>
[Upstash](https://upstash.com/) - Cache and rate limiting<br>
[React Email](https://react.email/) - Email templates<br>
[Resend](https://resend.com/) - Email delivery<br>
[i18n](https://next-international.vercel.app/) - Internationalization<br>
<!-- Sentry removed from this repo -->
[Dub](https://dub.sh/) - Sharable links<br>
[Trigger.dev](https://trigger.dev/) - Background jobs<br>
[OpenPanel](https://openpanel.dev/) - Analytics<br>
[Polar](https://polar.sh) - Billing (coming soon)<br>
[react-safe-action](https://next-safe-action.dev) - Validated Server Actions<br>
[nuqs](https://nuqs.47ng.com/) - Type-safe search params state manager<br>
[next-themes](https://next-themes-example.vercel.app/) - Theme manager<br>

## Directory Structure

```
.
├── apps                         # App workspace
│    ├── api                     # Supabase (API, Auth, Storage, Realtime, Edge Functions)
│    ├── app                     # App - your product
│    ├── web                     # Marketing site
│    └── ...
├── packages                     # Shared packages between apps
│    ├── analytics               # OpenPanel analytics
│    ├── email                   # React email library
│    ├── jobs                    # Trigger.dev background jobs
│    ├── kv                      # Upstash rate-limited key-value storage
│    ├── logger                  # Logger library
│    ├── supabase                # Supabase - Queries, Mutations, Clients
│    └── ui                      # Shared UI components (Shadcn)
├── tooling                      # are the shared configuration that are used by the apps and packages
│    └── typescript              # Shared TypeScript configuration
├── .cursorrules                 # Cursor rules specific to this project
├── biome.json                   # Biome configuration
├── turbo.json                   # Turbo configuration
├── LICENSE
└── README.md
```

## Prerequisites

Bun<br>
Docker<br>
Upstash<br>
Dub<br>
Trigger.dev<br>
Resend<br>
Supabase<br>
<!-- Sentry removed from this repo -->
OpenPanel<br>

## Getting Started

Clone this repo locally with the following command:

```bash
bunx degit midday-ai/v1 v1
```

1. Install dependencies using bun:

```sh
bun i
```

2. Copy `.env.example` to `.env` and update the variables.

```sh
# Copy .env.example to .env for each app
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
cp apps/web/.env.example apps/web/.env
```

4. Start the development server from either bun or turbo:

```ts
bun dev // starts everything in development mode (web, app, api, email)
bun dev:web // starts the web app in development mode
bun dev:app // starts the app in development mode
bun dev:api // starts the api in development mode
bun dev:email // starts the email app in development mode

// Database
bun migrate // run migrations
bun seed // run seed
```

## How to use
This boilerplate is inspired by our work on Midday, and it's designed to serve as a reference for real-world apps. Feel free to dive into the code and see how we've tackled various features. Whether you're looking to understand authentication flows, database interactions, or UI components, you'll find practical, battle-tested implementations throughout the codebase. It's not just a starting point; it's a learning resource that can help you build your own applications.

With this, you have a great starting point for your own project.

## Deploy to Vercel

Vercel deployment will guide you through creating a Supabase account and project.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmidday-ai%2Fv1&env=RESEND_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,SENTRY_AUTH_TOKEN,NEXT_PUBLIC_SENTRY_DSN,SENTRY_ORG,SENTRY_PROJECT,DUB_API_KEY,NEXT_PUBLIC_OPENPANEL_CLIENT_ID,OPENPANEL_SECRET_KEY&project-name=create-v1&repository-name=create-v1&redirect-url=https%3A%2F%2Fv1.run&demo-title=Create%20v1&demo-description=An%20open-source%20starter%20kit%20based%20on%20Midday.&demo-url=https%3A%2F%2Fv1.run&demo-image=https%3A%2F%2Fv1.run%2Fopengraph-image.png&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6)

## Recognition

<a href="https://news.ycombinator.com/item?id=41408929">
  <img
    style="width: 250px; height: 54px;" width="250" height="54"
    alt="Featured on Hacker News"
    src="https://hackernews-badge.vercel.app/api?id=41408929"
  />
</a>
<!-- TASKMASTER_EXPORT_START -->
> 🎯 **Taskmaster Export** - 2025-11-07 13:19:42 UTC
> 📋 Export: with subtasks • Status filter: none
> 🔗 Powered by [Task Master](https://task-master.dev?utm_source=github-readme&utm_medium=readme-export&utm_campaign=avelero&utm_content=task-export-link)

| Project Dashboard |  |
| :-                |:-|
| Task Progress     | ░░░░░░░░░░░░░░░░░░░░ 0% |
| Done | 0 |
| In Progress | 0 |
| Pending | 15 |
| Deferred | 0 |
| Cancelled | 0 |
|-|-|
| Subtask Progress | ░░░░░░░░░░░░░░░░░░░░ 0% |
| Completed | 0 |
| In Progress | 0 |
| Pending | 62 |


| ID | Title | Status | Priority | Dependencies | Complexity |
| :- | :-    | :-     | :-       | :-           | :-         |
| 1 | Create staging table schemas and database migrations | ○&nbsp;pending | high | None | ● 7 |
| 1.1 | Define Drizzle schemas for staging tables | ○&nbsp;pending | -            | None | N/A |
| 1.2 | Create Supabase migration files for staging tables | ○&nbsp;pending | -            | 1 | N/A |
| 1.3 | Implement RLS policies for staging tables | ○&nbsp;pending | -            | 2 | N/A |
| 1.4 | Add proper indexes for staging table performance | ○&nbsp;pending | -            | 2 | N/A |
| 1.5 | Create junction tables for materials, care codes, and eco claims | ○&nbsp;pending | -            | 1 | N/A |
| 2 | Update import_jobs status enum and enhance schema | ○&nbsp;pending | high | 1 | ● 4 |
| 3 | Create Supabase storage bucket for product imports | ○&nbsp;pending | medium | None | ● 5 |
| 3.1 | Create storage bucket migration | ○&nbsp;pending | -            | None | N/A |
| 3.2 | Implement RLS policies for brand isolation | ○&nbsp;pending | -            | 1 | N/A |
| 3.3 | Create helper functions for file operations | ○&nbsp;pending | -            | 2 | N/A |
| 3.4 | Add file size and cleanup configurations | ○&nbsp;pending | -            | 3 | N/A |
| 4 | Implement CSV/XLSX parser library | ○&nbsp;pending | high | None | ● 8 |
| 4.1 | Implement CSV parsing with RFC 4180 compliance | ○&nbsp;pending | -            | None | N/A |
| 4.2 | Add XLSX parsing functionality | ○&nbsp;pending | -            | None | N/A |
| 4.3 | Create encoding detection functionality | ○&nbsp;pending | -            | None | N/A |
| 4.4 | Build header validation and normalization | ○&nbsp;pending | -            | None | N/A |
| 4.5 | Add comprehensive error handling for edge cases | ○&nbsp;pending | -            | 1, 2, 3, 4 | N/A |
| 4.6 | Implement CSV generation for exports | ○&nbsp;pending | -            | 1, 4 | N/A |
| 5 | Implement value mapping system for catalog lookups | ○&nbsp;pending | medium | 1 | ● 7 |
| 5.1 | Create mapping functions for each entity type | ○&nbsp;pending | -            | None | N/A |
| 5.2 | Implement fuzzy matching logic | ○&nbsp;pending | -            | 1 | N/A |
| 5.3 | Add caching layer for performance | ○&nbsp;pending | -            | 1 | N/A |
| 5.4 | Build auto-creation logic for simple entities | ○&nbsp;pending | -            | 1, 2 | N/A |
| 5.5 | Create unmapped value detection system | ○&nbsp;pending | -            | 1, 2, 4 | N/A |
| 6 | Create database query functions for bulk import operations | ○&nbsp;pending | high | 1, 2 | ● 8 |
| 6.1 | Implement import job management queries | ○&nbsp;pending | -            | None | N/A |
| 6.2 | Create staging data insertion functions | ○&nbsp;pending | -            | 1 | N/A |
| 6.3 | Add staging preview and deletion queries | ○&nbsp;pending | -            | 2 | N/A |
| 6.4 | Implement error tracking functions | ○&nbsp;pending | -            | 1 | N/A |
| 6.5 | Add progress tracking queries | ○&nbsp;pending | -            | 4 | N/A |
| 6.6 | Create failed rows export functionality | ○&nbsp;pending | -            | 4 | N/A |
| 6.7 | Ensure proper transaction handling and brand scoping | ○&nbsp;pending | -            | 1, 2, 3, 4, 5, 6 | N/A |
| 7 | Create value mapping and brand catalog query functions | ○&nbsp;pending | medium | 1 | ● 6 |
| 7.1 | Implement value mapping CRUD operations | ○&nbsp;pending | -            | None | N/A |
| 7.2 | Create brand catalog entity creation functions | ○&nbsp;pending | -            | 1 | N/A |
| 7.3 | Add duplicate detection logic | ○&nbsp;pending | -            | 2 | N/A |
| 7.4 | Implement validation for required fields | ○&nbsp;pending | -            | 3 | N/A |
| 8 | Implement Phase 1 background job (validate-and-stage) | ○&nbsp;pending | high | 4, 5, 6, 7 | ● 9 |
| 8.1 | Set up Trigger.dev job structure | ○&nbsp;pending | -            | None | N/A |
| 8.2 | Implement row-by-row validation logic | ○&nbsp;pending | -            | 1 | N/A |
| 8.3 | Add UPID/SKU matching for CREATE/UPDATE detection | ○&nbsp;pending | -            | 2 | N/A |
| 8.4 | Implement batch processing | ○&nbsp;pending | -            | 3 | N/A |
| 8.5 | Add auto-creation for simple entities | ○&nbsp;pending | -            | 4 | N/A |
| 8.6 | Create detailed error logging | ○&nbsp;pending | -            | 5 | N/A |
| 8.7 | Implement WebSocket progress updates | ○&nbsp;pending | -            | 6 | N/A |
| 8.8 | Add comprehensive error handling and timeouts | ○&nbsp;pending | -            | 7 | N/A |
| 9 | Implement Phase 2 background job (commit-to-production) | ○&nbsp;pending | high | 6, 8 | ● 8 |
| 9.1 | Set up Trigger.dev job structure and configuration | ○&nbsp;pending | -            | None | N/A |
| 9.2 | Implement staging to production data migration logic | ○&nbsp;pending | -            | 1 | N/A |
| 9.3 | Add transaction handling and batch processing | ○&nbsp;pending | -            | 2 | N/A |
| 9.4 | Create staging data cleanup logic | ○&nbsp;pending | -            | 3 | N/A |
| 9.5 | Implement comprehensive error handling with partial success support | ○&nbsp;pending | -            | 4 | N/A |
| 9.6 | Add WebSocket progress updates and completion notifications | ○&nbsp;pending | -            | 5 | N/A |
| 10 | Implement WebSocket infrastructure for real-time progress updates | ○&nbsp;pending | medium | 8, 9 | ● 7 |
| 10.1 | Create WebSocket connection manager | ○&nbsp;pending | -            | None | N/A |
| 10.2 | Implement JWT authentication for WebSocket | ○&nbsp;pending | -            | 1 | N/A |
| 10.3 | Add progress event handling | ○&nbsp;pending | -            | 2 | N/A |
| 10.4 | Create fallback polling mechanism | ○&nbsp;pending | -            | 3 | N/A |
| 10.5 | Implement connection cleanup and multi-tab support | ○&nbsp;pending | -            | 4 | N/A |
| 11 | Create new bulk import API endpoints (Phase 1) | ○&nbsp;pending | high | 3, 4, 6 | ● 6 |
| 11.1 | Implement validateImport and startImport mutations | ○&nbsp;pending | -            | None | N/A |
| 11.2 | Add getImportStatus and getImportErrors queries | ○&nbsp;pending | -            | 1 | N/A |
| 11.3 | Create Zod schema validation | ○&nbsp;pending | -            | None | N/A |
| 11.4 | Integrate file upload with Supabase Storage | ○&nbsp;pending | -            | 1, 3 | N/A |
| 12 | Create staging preview and value definition API endpoints | ○&nbsp;pending | medium | 6, 7, 8 | ● 7 |
| 12.1 | Implement staging preview with pagination | ○&nbsp;pending | -            | 6, 7 | N/A |
| 12.2 | Create unmapped values detection endpoint | ○&nbsp;pending | -            | 6, 7 | N/A |
| 12.3 | Add single and batch value definition mutations | ○&nbsp;pending | -            | 2, 7 | N/A |
| 12.4 | Implement failed rows export functionality | ○&nbsp;pending | -            | 6 | N/A |
| 12.5 | Support complex entity creation with validation | ○&nbsp;pending | -            | 3 | N/A |
| 13 | Create import approval and cancellation API endpoints | ○&nbsp;pending | medium | 9, 12 | ● 5 |
| 13.1 | Implement approveImport mutation with validation | ○&nbsp;pending | -            | None | N/A |
| 13.2 | Create cancelImport mutation with cleanup | ○&nbsp;pending | -            | None | N/A |
| 13.3 | Add status transition validation and unmapped value checking | ○&nbsp;pending | -            | 1, 2 | N/A |
| 14 | Update bulk import schema definitions | ○&nbsp;pending | medium | 11, 12, 13 | ● 4 |
| 15 | Create product import template and test data generator | ○&nbsp;pending | low | None | ● 3 |

> 📋 **End of Taskmaster Export** - Tasks are synced from your project using the `sync-readme` command.
<!-- TASKMASTER_EXPORT_END -->
