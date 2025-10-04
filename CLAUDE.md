# Avelero - Development Guidelines

Digital product passport SaaS platform built with Next.js, tRPC, Drizzle ORM, and Supabase.

## Tech Stack
- **Frontend**: Next.js 15 + React 19 + TailwindCSS + Shadcn UI
- **Backend**: tRPC + Hono + Drizzle ORM
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Build**: Turborepo + Bun + TypeScript (strict)

## Structure
```
apps/
├── api/           # tRPC API (Hono server)
├── app/           # Main SaaS dashboard (Next.js)
└── web/           # Marketing site (Next.js)
packages/
├── db/            # Drizzle ORM schemas & queries
├── supabase/      # Supabase clients & types
├── ui/            # Shared UI components
└── utils/         # Shared utilities
```

## Database Architecture

**Dual Layer Pattern**:
- **Drizzle ORM** (`@v1/db`): Business logic, complex queries, transactions
- **Supabase Client** (`@v1/supabase`): Auth, RLS, storage, realtime

## Development Patterns

### tRPC API Structure
```typescript
// Router definition
export const postsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.posts.findMany({
        where: eq(posts.brandId, ctx.brandId),
        limit: input.limit,
      });
    }),
});

// Frontend usage
const { data } = trpc.posts.list.useQuery({ limit: 10 });
```

### tRPC Context
- `ctx.db`: Drizzle database client
- `ctx.user`: Authenticated user (in protectedProcedure)
- `ctx.brandId`: Current brand scope
- `ctx.supabase`: Supabase client

### Database Schema Conventions
- **Tables**: `snake_case`, plural (`users`, `products`)
- **Columns**: `snake_case` (`user_id`, `created_at`)
- **IDs**: UUID with `uuid("id").defaultRandom().primaryKey()`
- **Timestamps**: `timestamp("created_at", { mode: "date" }).defaultNow()`
- **Types**: `text()`, `boolean()`, `jsonb()`, `pgEnum()`

```typescript
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id").references(() => brands.id).notNull(),
  name: text("name").notNull(),
  status: productStatusEnum("status").default("draft"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});
```

### Row Level Security (RLS)
RLS policies are defined in Supabase migrations, not Drizzle schema.

```sql
-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Brand-scoped access
CREATE POLICY "Brand members access" ON public.products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.brand_id = products.brand_id
  )
);
```

## Migrations

```bash
# 1. Update schema in packages/db/src/schema/
# 2. Generate migration
cd packages/db && bun db:generate

# 3. Add RLS policies to generated migration file manually
# 4. Apply migration
cd apps/api && bun migrate

# 5. Generate types
bun generate
```

## Essential Patterns

### Supabase Clients
```typescript
// Browser
import { createClient } from "@v1/supabase/clients/client";

// Server
import { createClient } from "@v1/supabase/clients/server";

// Auth check
const { data: { user } } = await supabase.auth.getUser();
```

### Drizzle Database Operations
```typescript
import { db } from "@v1/db/client";
import { products } from "@v1/db/schema";
import { eq, and } from "drizzle-orm";

// Query
const products = await db.query.products.findMany({
  where: eq(products.brandId, brandId),
  with: { variants: true },
});

// Insert
const [product] = await db.insert(products).values({
  brandId,
  name: "Product Name",
}).returning();

// Update
await db.update(products)
  .set({ name: "New Name" })
  .where(eq(products.id, productId));

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(products).values({...});
  await tx.insert(variants).values({...});
});
```

## Development Commands

```bash
# Setup
bun install

# Development
bun dev          # All apps
bun dev:app      # Main app (3000)
bun dev:api      # API (4000)
bun dev:web      # Marketing (3001)

# Database
cd apps/api
bun dev:db       # Start Supabase
bun migrate      # Apply migrations
bun generate     # Generate types

# Build & Deploy
bun build
bun typecheck
bun lint
```

## Environment Variables

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_KEY="..."
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

## Key Rules

1. **Use Drizzle for business logic**, Supabase for auth/RLS/storage
2. **Always enable RLS** on user-facing tables
3. **Use UUIDs for primary keys**
4. **Validate inputs with Zod** in tRPC
5. **Brand-scope all user data**
6. **Generate types after schema changes**
7. **Use protectedProcedure** for authenticated endpoints
8. **Never expose SUPABASE_SERVICE_KEY** to client
9. **Prefer editing existing files** over creating new ones
10. **Follow strict TypeScript** conventions

## Task Master AI Integration
For task management and development workflow, see: `.taskmaster/CLAUDE.md`

