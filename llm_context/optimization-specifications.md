### To-do list of core optimization techniques (with the files that implement them)
- Server-side data prefetch with a request-scoped QueryClient and hydration
  - Warm data on the server, then hydrate on the client via a stable, per-request QueryClient and a small hydration boundary.
  - Files:
    - `midday/apps/dashboard/src/trpc/server.tsx`
    - `midday/apps/dashboard/src/trpc/query-client.ts`

- Central prefetch and batch prefetch utilities
  - Provide `prefetch`/`batchPrefetch` helpers to warm cache for single and adjacent queries, including infinite variants.
  - Files:
    - `midday/apps/dashboard/src/trpc/server.tsx`

- TRPC HTTP batching and superjson serialization
  - Reduce round trips and preserve complex data via `httpBatchLink` and `superjson` on both server and client TRPC setups.
  - Files:
    - `midday/apps/dashboard/src/trpc/server.tsx`
    - `midday/apps/dashboard/src/trpc/client.tsx`
    - `midday/apps/api/src/trpc/init.ts`

- Propagate auth, timezone, locale, and country headers to the API
  - Attach headers per request from Supabase session and user locale context to improve backend personalization and caching behavior.
  - Files:
    - `midday/apps/dashboard/src/trpc/server.tsx`

- React Query de/rehydration tuned for Suspense and fast warm loads
  - Configure `staleTime` and superjson de/serialization; dehydrate pending queries to enable Suspense-first rendering.
  - Files:
    - `midday/apps/dashboard/src/trpc/query-client.ts`

- Regional DB replicas for fast reads
  - Route reads to the closest replica and writes to the primary using a database wrapper with region-aware selection.
  - Files:
    - `midday/apps/api/src/db/replicas.ts`
    - `midday/apps/api/src/db/index.ts`

- Primary-read-after-write consistency window
  - Force reads to primary for a short TTL after a team mutation to avoid replica lag.
  - Files:
    - `midday/apps/api/src/trpc/middleware/primary-read-after-write.ts`
    - `midday/apps/api/src/rest/middleware/primary-read-after-write.ts`

- Rate limiting on protected endpoints
  - Cap request rates to stabilize p95/p99 under load and prevent abuse.
  - Files:
    - `midday/apps/api/src/rest/middleware/index.ts`

- Hot-path LRU caches for auth and user lookups
  - Cache API key and user fetches to avoid repeated DB queries on protected routes.
  - Files:
    - `midday/apps/api/src/utils/cache/api-key-cache.ts`
    - `midday/apps/api/src/utils/cache/user-cache.ts`
    - `midday/apps/api/src/rest/middleware/auth.ts`

- Request-scoped session cache for RSC
  - Cache Supabase session retrieval within a single request to avoid duplicate calls in RSC.
  - Files:
    - `midday/packages/supabase/src/queries/cached-queries.ts`

- API server wiring (Hono + TRPC)
  - Centralize cross-cutting concerns: CORS for `/trpc/*`, mount router, create context with DB and Supabase, and enable superjson.
  - Files:
    - `midday/apps/api/src/index.ts`
    - `midday/apps/api/src/trpc/init.ts`
    - `midday/apps/api/src/trpc/routers/_app.ts`

- Authorized storage proxy for fast, authenticated file downloads
  - Proxy storage reads with the user’s session to speed up and simplify client access.
  - Files:
    - `midday/apps/dashboard/src/app/api/proxy/route.ts`

- Background jobs: concurrency, scheduling with dedupe, batching
  - Use concurrency limits, deduplicated schedules, fan-out with delays, and batch processing to maximize throughput without spikes.
  - Files:
    - `midday/packages/jobs/src/tasks/bank/sync/connection.ts`
    - `midday/packages/jobs/src/tasks/inbox/provider/initial-setup.ts`
    - `midday/packages/jobs/src/tasks/transactions/enrich.ts`
    - `midday/packages/jobs/src/utils/process-batch.ts`

- KV-backed caching for LLM enrichment
  - Cache expensive enrichment results to avoid recomputation and cut latency.
  - Files:
    - `midday/apps/engine/src/utils/enrich.ts`

- Optimistic navigation (route prefetch)
  - Leverage Next.js `Link prefetch` to warm routes/bundles on hover/focus. No infra file implements this (built-in), but prefetch helpers live in the server-side TRPC layer.
  - Files for helpers:
    - `midday/apps/dashboard/src/trpc/server.tsx`

- Type-safe API contract export for TRPC clients
  - Export a single root router type for clients to consume and get strong types end-to-end.
  - Files:
    - `midday/apps/api/src/trpc/routers/_app.ts`

### Completed

- Keep components as RSC by default
  - Keep files server by default (omit "use client") and only opt in to client where truly necessary. No infra files implement this; it’s a code-style constraint across the app.