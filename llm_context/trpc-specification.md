## tRPC specification

This document describes how tRPC is structured in this repository, how requests flow, how to extend the API, and how to use it from components, utilities, hooks, and actions.

### Overview

- **Client app (Next.js)**
  - tRPC client setup lives under `apps/app/src/trpc/`:
    - `client.tsx`: React-side client and provider
    - `server.tsx`: Server-side helpers for prefetch and hydration
    - `query-client.ts`: TanStack Query client configuration
  - The app talks to the API at `${process.env.NEXT_PUBLIC_API_URL}/trpc`.

- **API service (Hono)**
  - tRPC server lives under `apps/api/src/trpc/`:
    - `init.ts`: context, middlewares, procedure helpers
    - `middleware/*.ts`: reusable middleware units
    - `routers/*.ts`: domain routers
    - `routers/_app.ts`: root `appRouter`
  - HTTP handler: `apps/api/src/index.ts` exposes `/trpc` via Hono.

- **Transport & serialization**
  - HTTP batch link via `@trpc/client/httpBatchLink`
  - Serialization via `superjson`
  - Query caching via `@tanstack/react-query`

### Environment variables

- App (`apps/app`)
  - `NEXT_PUBLIC_API_URL` – base URL of the API server (e.g., `http://localhost:4000`)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- API (`apps/api`)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` – end-user auth
  - `SUPABASE_SERVICE_KEY` – required for admin-only operations (e.g., auth user delete)
  - Optional CORS: `ALLOWED_API_ORIGINS`

### Server: structure and request flow

Files of interest:
- `apps/api/src/index.ts` – Hono server mounting `/trpc/*`
- `apps/api/src/trpc/init.ts` – context, procedures, middlewares
- `apps/api/src/trpc/routers/_app.ts` – aggregate router
- `apps/api/src/trpc/routers/{brand,user,...}.ts` – domain routers

Request flow:
1) Hono receives an HTTP request at `/trpc` and forwards it to tRPC.
2) `createTRPCContext` builds the per-request context:
   - Creates a Supabase client bound to the Authorization header
   - Resolves `user` via `supabase.auth.getUser()`
   - Loads `brandId` (active brand) from the `users` row
   - Attaches `geo` (best-effort IP) from headers
3) Middlewares run:
   - `protectedProcedure` ensures a logged-in `user`
   - A lightweight team/brand middleware attaches `brandId` (may be null)
4) Router procedure executes and returns a JSON result via superjson.

Context shape (see `TRPCContext` in `init.ts`):
- `supabase`: authenticated `SupabaseClient`
- `supabaseAdmin`: admin client (optional; present if service key is configured)
- `user`: the authenticated `User` or `null`
- `brandId`: current active brand id or `null`/`undefined`
- `geo`: `{ ip?: string | null }`

Procedures:
- `publicProcedure` – available to unauthenticated clients
- `protectedProcedure` – requires `user`, attaches `brandId`

Routers shipped:
- `brand` – list/create/delete brands, set active brand
- `user` – get/update/delete current user
- `api-keys`, `oauth-applications` – placeholders

Authorization & data access:
- Supabase RLS enforces membership and ownership on tables (`brands`, `users_on_brand`, `users`).
- Router logic should still validate invariants (e.g., membership existence before setting active brand).
- Use `TRPCError` for explicit, user-facing error semantics where appropriate (e.g., `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`).

### Client: structure and usage

Files of interest:
- `apps/app/src/trpc/query-client.ts` – shared TanStack Query defaults (e.g., `staleTime`, superjson de/serialization)
- `apps/app/src/trpc/client.tsx` – React provider wrapper that:
  - Creates a `QueryClient`
  - Creates a tRPC client with auth header populated from Supabase session
  - Exposes `{ TRPCProvider, useTRPC }` via `createTRPCContext<AppRouter>()`
- `apps/app/src/trpc/server.tsx` – server utilities:
  - `trpc` options proxy for generating `queryOptions`/`mutationOptions`
  - `getQueryClient`, `HydrateClient`, `prefetch`, `batchPrefetch`

Provider setup (App side):
1) Wrap your app with `TRPCReactProvider` once near the root layout to provide clients.
2) Optionally wrap subtrees with `HydrateClient` when doing RSC data prefetch + hydration.

Minimal usage in a Client Component:
```tsx
import { useTRPC } from "@/src/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function BrandList() {
  const trpc = useTRPC();
  const brands = useQuery(trpc.brand.list.queryOptions());
  const createBrand = useMutation(trpc.brand.create.mutationOptions());

  return (
    <div>
      {(brands.data?.data ?? []).map((b) => (
        <div key={b.id}>{b.name}</div>
      ))}
      <button
        onClick={() =>
          createBrand.mutate({ name: "New Brand", country_code: null })
        }
      >
        Create brand
      </button>
    </div>
  );
}
```

Server Components (RSC) with prefetch + hydrate:
```tsx
// apps/app/src/app/[locale]/(dashboard)/page.tsx (example)
import { HydrateClient, prefetch, trpc } from "@/src/trpc/server";

export default async function Page() {
  await prefetch(trpc.brand.list.queryOptions());
  return (
    <HydrateClient>
      {/* Child components now read from pre-hydrated cache */}
      {/* <BrandList /> */}
    </HydrateClient>
  );
}
```

Server Actions / Utilities:
- For server mutations or reads you want to perform from a Server Action, you have two options:
  1) Call the database directly (preferred for intra-app operations that already live server-side).
  2) Call the tRPC API using a per-request `createTRPCClient` with the same headers as in `apps/app/src/trpc/server.tsx`.

Example (Server utility using direct tRPC call):
```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";

export async function createServerTrpcClient() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
        transformer: superjson,
        headers: async () => ({
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        }),
      }),
    ],
  });
}
```

### Adding new API endpoints

1) Create a router file under `apps/api/src/trpc/routers/` (use Zod for inputs):
```ts
// apps/api/src/trpc/routers/project.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init.js";

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw error;
    return { data } as const;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("projects")
        .insert({ name: input.name });
      if (error) throw error;
      return { success: true } as const;
    }),
});
```

2) Register the router in `apps/api/src/trpc/routers/_app.ts`:
```ts
import { projectRouter } from "./project.js";

export const appRouter = createTRPCRouter({
  // ...existing routers
  project: projectRouter,
});
```

3) Use from the app
   - Client component:
```ts
const trpc = useTRPC();
const projects = useQuery(trpc.project.list.queryOptions());
const create = useMutation(trpc.project.create.mutationOptions());
```
   - RSC prefetch:
```ts
await prefetch(trpc.project.list.queryOptions());
```

### Query keys, cache, and hydration

- Query client defaults live in `apps/app/src/trpc/query-client.ts`.
- Superjson de/serialization is configured for consistent hydration between server and client.
- Prefer `queryOptions`/`mutationOptions` from the tRPC options proxy for type-safe keys.
- For RSC, batch multiple `prefetch` calls via `batchPrefetch` before rendering `HydrateClient`.

### Error handling

- Validation: use `zod` in routers for input schemas.
- Auth: `protectedProcedure` rejects when `user` is missing.
- Authorization: rely on Supabase RLS and complement with explicit checks where needed; throw `TRPCError` when denying access.
- Client: handle errors via React Query’s `onError` callbacks; show user-friendly messages.

### Conventions and guidelines

- Follow repository TypeScript and React conventions:
  - Functional components, no classes; descriptive names; early returns.
  - Prefer `interfaces` over `types` for data shapes.
  - Avoid `use client` except for leaf components that require Web APIs.
  - Keep routers small and cohesive per domain; extract helpers when logic grows.

- Composition patterns:
  - Prefer re-usable `hooks` that wrap `useQuery`/`useMutation` and hide options.
  - For RSC, centralize prefetch sequences close to the route module.
  - For stateful flows (wizards), co-locate mutations and invalidations inside feature modules.

### Testing and diagnostics

- You can call procedures directly via a tRPC caller in tests:
```ts
import { appRouter } from "@v1/api/src/trpc/routers/_app";
import { createTRPCContextFromHeaders } from "@v1/api/src/trpc/init";

const caller = appRouter.createCaller(
  await createTRPCContextFromHeaders({ Authorization: `Bearer ${token}` })
);
const result = await caller.brand.list();
```

### Extending middlewares later

- `withPrimaryReadAfterWrite` can be expanded if you introduce replicas.
- Team/brand middleware can be upgraded to perform membership lookups and caching; keep business checks in routers for clarity.

### Migration safety

- Keep router procedures aligned with Supabase RLS policies.
- When adding tables, define RLS first, then add procedures that rely on them.

---

This setup gives you a minimal, type-safe foundation you can grow:
1) Add new routers under `apps/api/src/trpc/routers/`
2) Register them in `_app.ts`
3) Consume with `useTRPC()` and/or `trpc.*.queryOptions` in the app
4) Use RSC prefetch + hydration for fast initial loads


