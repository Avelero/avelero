# API Server Research Document

> **Purpose:** Comprehensive documentation of the current TRPC API server architecture, file structure, endpoints, schemas, and queries. This serves as the baseline for the API redesign initiative.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [TRPC Server Configuration](#3-trpc-server-configuration)
4. [Router Inventory](#4-router-inventory)
5. [Complete Endpoint Reference](#5-complete-endpoint-reference)
6. [Schema Layer](#6-schema-layer)
7. [Query Layer](#7-query-layer)
8. [Client Integration](#8-client-integration)
9. [Supabase Integration](#9-supabase-integration)
10. [Identified Issues](#10-identified-issues)

---

## 1. Architecture Overview

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Framework | tRPC v11 | Type-safe RPC endpoints |
| HTTP Server | Hono | Lightweight HTTP adapter |
| Database ORM | Drizzle | Type-safe SQL queries |
| Database | PostgreSQL (Supabase) | Primary data store |
| Auth | Supabase Auth | User authentication |
| Storage | Supabase Storage | File uploads (avatars, imports) |
| Background Jobs | Trigger.dev | Async import processing |
| Validation | Zod | Schema validation |
| Serialization | SuperJSON | Complex type serialization |

### Request Flow

```
Client Request
     ↓
Hono HTTP Server (apps/api/src/index.ts)
     ↓
tRPC Adapter (/trpc/*)
     ↓
Context Creation (init.ts → createTRPCContext)
  - Supabase client (user-scoped)
  - Supabase admin client (service role)
  - User authentication
  - Active brand resolution
  - Drizzle database connection
  - DataLoaders initialization
     ↓
Procedure Middleware
  - publicProcedure (no auth)
  - protectedProcedure (requires user)
  - brandRequiredProcedure (requires user + active brand)
     ↓
Router Handler
     ↓
Query Layer (packages/db/src/queries/*)
     ↓
Database
```

### Monorepo Structure

```
avelero-v2/
├── apps/
│   ├── api/           # TRPC API server (Hono)
│   ├── app/           # Next.js dashboard app
│   ├── dpp/           # Next.js public DPP app
│   └── web/           # Next.js marketing site
├── packages/
│   ├── db/            # Drizzle schema + queries
│   ├── supabase/      # Supabase client utilities
│   ├── ui/            # Shared UI components
│   └── ...            # Other shared packages
```

---

## 2. File Structure

### API Server Files (`apps/api/src/`)

```
apps/api/src/
├── index.ts                          # Hono server entry point
├── config/
│   └── roles.ts                      # Role constants (OWNER, MEMBER)
├── lib/
│   ├── csv-parser.ts                 # CSV/Excel parsing utilities
│   ├── dpp-revalidation.ts           # DPP cache revalidation
│   └── websocket-manager.ts          # WebSocket connection management
├── schemas/                          # Zod validation schemas
│   ├── _shared/
│   │   ├── domain.ts                 # Domain schemas (roleSchema)
│   │   ├── patterns.ts               # Reusable patterns (byIdSchema, updateWithNullable)
│   │   └── primitives.ts             # Atomic types (uuidSchema, emailSchema)
│   ├── brand-catalog/
│   │   ├── index.ts                  # Barrel export
│   │   ├── certifications.ts
│   │   ├── colors.ts
│   │   ├── eco-claims.ts
│   │   ├── facilities.ts
│   │   ├── materials.ts
│   │   ├── seasons.ts
│   │   ├── showcase-brands.ts
│   │   ├── sizes.ts
│   │   └── tags.ts
│   ├── index.ts                      # Barrel export
│   ├── brand.ts                      # Brand schemas (⚠️ OVERLAPS with workflow.ts)
│   ├── bulk.ts                       # Bulk import schemas
│   ├── catalog.ts                    # Global catalog schemas
│   ├── products.ts                   # Product + variant schemas
│   ├── summary.ts                    # Summary stats schemas
│   ├── templates.ts                  # Template schemas (⚠️ TO BE REMOVED)
│   ├── user.ts                       # User profile schemas
│   └── workflow.ts                   # Brand lifecycle schemas
├── trpc/
│   ├── init.ts                       # tRPC initialization + context
│   ├── middleware/
│   │   └── auth/
│   │       ├── brand.ts              # Brand context middleware
│   │       └── roles.ts              # Role-based access middleware
│   └── routers/
│       ├── _app.ts                   # Root router composition
│       ├── brand/
│       │   └── index.ts              # Brand catalog router (36 CRUD endpoints)
│       ├── bulk/
│       │   ├── index.ts              # Bulk router composition
│       │   ├── import.ts             # Import lifecycle endpoints
│       │   ├── staging.ts            # Staging data endpoints
│       │   └── values.ts             # Value mapping endpoints
│       ├── composite/
│       │   └── index.ts              # Composite query endpoints
│       ├── dpp-public/
│       │   └── index.ts              # Public DPP endpoints
│       ├── internal/
│       │   └── index.ts              # Server-to-server endpoints
│       ├── products/
│       │   ├── index.ts              # Product CRUD endpoints
│       │   └── variants.ts           # Variant endpoints
│       ├── summary/
│       │   └── index.ts              # Summary stats endpoint
│       ├── templates/
│       │   └── index.ts              # Template endpoints (⚠️ TO BE REMOVED)
│       ├── user/
│       │   └── index.ts              # User profile endpoints
│       └── workflow/
│           ├── index.ts              # Workflow router composition
│           ├── base.ts               # Brand lifecycle endpoints
│           ├── invites.ts            # Invite management
│           ├── members.ts            # Member management
│           └── theme.ts              # Theme configuration
└── utils/
    ├── catalog-transform.ts          # Input transformation helpers
    ├── dataloader.ts                 # DataLoader factory
    ├── errors.ts                     # Error utilities
    └── response.ts                   # Response formatters
```

### Database Query Files (`packages/db/src/queries/`)

```
packages/db/src/queries/
├── index.ts                          # Barrel export + drizzle-orm re-exports
├── brands.ts                         # Brand CRUD, theme, slug utilities
├── brand-members.ts                  # Member management
├── brand-invites.ts                  # Invite management
├── brand-catalog.ts                  # Catalog entity CRUD (colors, sizes, etc.)
├── bulk-import.ts                    # Import job management
├── catalog.ts                        # Global categories
├── dpp-public.ts                     # Public DPP data fetching
├── products.ts                       # Product CRUD + complex queries
├── staging.ts                        # Staging data operations
├── templates.ts                      # Template CRUD (⚠️ TO BE REMOVED)
├── users.ts                          # User CRUD
└── value-mappings.ts                 # Value mapping for imports
```

### File Sizes (Approximate)

| File | Lines | Complexity |
|------|-------|------------|
| `products.ts` (queries) | ~1,470 | High - complex filters, joins, pagination |
| `brand-catalog.ts` (queries) | ~1,420 | Medium - repetitive CRUD patterns |
| `dpp-public.ts` (queries) | ~715 | Medium - complex joins for DPP data |
| `brands.ts` (queries) | ~640 | Medium - theme, slug, membership logic |
| `staging.ts` (queries) | ~1,040 | Medium - staging data operations |
| `bulk/import.ts` (router) | ~660 | Medium - import lifecycle |
| `bulk/values.ts` (router) | ~670 | Medium - value mapping |
| `brand/index.ts` (router) | ~560 | Low - uses factory pattern |
| `composite/index.ts` (router) | ~420 | Medium - composite queries |
| `products.ts` (schema) | ~425 | Medium - FilterState definition |
| `bulk.ts` (schema) | ~430 | Medium - many entity schemas |

---

## 3. TRPC Server Configuration

### Context Creation (`init.ts`)

The tRPC context provides every procedure with:

```typescript
interface TRPCContext {
  supabase: SupabaseClient;           // User-scoped Supabase client
  supabaseAdmin?: SupabaseClient;     // Service role client (privileged ops)
  user: User | null;                  // Authenticated user
  geo: { ip?: string };               // Geographic context
  brandId?: string | null;            // Active brand (from users.brand_id)
  role?: Role | null;                 // User's role in active brand
  db: DrizzleDatabase;                // Drizzle database connection
  loaders: DataLoaders;               // Request-scoped DataLoaders
}
```

### Procedure Types

| Procedure | Auth Required | Brand Required | Use Case |
|-----------|--------------|----------------|----------|
| `publicProcedure` | ❌ | ❌ | Public DPP endpoints |
| `protectedProcedure` | ✅ | ❌ | User profile, invites |
| `brandRequiredProcedure` | ✅ | ✅ | Products, catalog, settings |

### Middleware Chain

```typescript
// Public - no middleware
publicProcedure = t.procedure;

// Protected - requires auth + resolves brand context
protectedProcedure = t.procedure
  .use(withBrandContext)     // Resolves brandId + role
  .use(requireAuth);         // Throws if no user

// Brand required - requires active brand selection
brandRequiredProcedure = protectedProcedure
  .use(requireBrand);        // Throws if no brandId
```

### Role-Based Access

```typescript
// roles.ts
export const ROLES = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

// Usage in routers
.use(hasRole([ROLES.OWNER]))  // Only brand owners can access
```

---

## 4. Router Inventory

### Current Router Structure

```typescript
// _app.ts
export const appRouter = createTRPCRouter({
  user: userRouter,
  workflow: workflowRouter,      // ⚠️ Confusing name - actually brand lifecycle
  brand: brandRouter,            // ⚠️ Confusing name - actually catalog
  products: productsRouter,
  templates: templatesRouter,    // ⚠️ TO BE REMOVED
  bulk: bulkRouter,
  composite: compositeRouter,
  summary: summaryRouter,
  internal: internalRouter,
  dppPublic: dppPublicRouter,
});
```

### Router Descriptions

| Router | Current Name | Purpose | Endpoints |
|--------|-------------|---------|-----------|
| User | `user` | User profile, invites received | 4 |
| Workflow | `workflow` | Brand lifecycle, members, invites sent, theme | 14 |
| Brand | `brand` | Brand catalog (colors, sizes, etc.) | 36 |
| Products | `products` | Product CRUD, variants | 10 |
| Templates | `templates` | Passport templates | 5 (TO REMOVE) |
| Bulk | `bulk` | Import operations | 16 |
| Composite | `composite` | Performance-optimized queries | 3 |
| Summary | `summary` | Aggregated statistics | 1 |
| Internal | `internal` | Server-to-server (Trigger.dev) | 2 |
| DPP Public | `dppPublic` | Public DPP data | 2 |

---

## 5. Complete Endpoint Reference

### user Router (4 endpoints)

| Endpoint | Type | Auth | Input | Purpose |
|----------|------|------|-------|---------|
| `user.get` | Query | ✅ | None | Get current user profile |
| `user.update` | Mutation | ✅ | `userDomainUpdateSchema` | Update profile (name, avatar, email) |
| `user.delete` | Mutation | ✅ | None | Delete account + auth user |
| `user.invites.list` | Query | ✅ | None | List invites sent to user's email |

### workflow Router (14 endpoints)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `workflow.list` | Query | ✅ | ❌ | None | List user's brand memberships |
| `workflow.create` | Mutation | ✅ | ❌ | `workflowCreateSchema` | Create new brand |
| `workflow.update` | Mutation | ✅ | ✅ (owner) | `workflowUpdateSchema` | Update brand details |
| `workflow.setActive` | Mutation | ✅ | ❌ | `workflowBrandIdSchema` | Set active brand |
| `workflow.delete` | Mutation | ✅ | ✅ (owner) | `workflowBrandIdSchema` | Delete brand |
| `workflow.members.list` | Query | ✅ | ✅ | `workflowBrandIdOptionalSchema` | List brand members |
| `workflow.members.update` | Mutation | ✅ | ✅ | `workflowMembersUpdateSchema` | Leave/update/remove member |
| `workflow.invites.list` | Query | ✅ | ✅ (owner) | `workflowInvitesListSchema` | List brand's pending invites |
| `workflow.invites.send` | Mutation | ✅ | ✅ (owner) | `workflowInvitesSendSchema` | Send invite |
| `workflow.invites.respond` | Mutation | ✅ | ❌/✅ | `workflowInvitesRespondSchema` | Accept/decline/revoke |
| `workflow.theme.get` | Query | ✅ | ✅ | None | Get theme styles + config |
| `workflow.theme.updateConfig` | Mutation | ✅ | ✅ | `{ config: Record }` | Update theme config |
| `workflow.theme.listCarouselProducts` | Query | ✅ | ✅ | Filter/sort/pagination | Products for carousel selection |

### brand Router (36 endpoints - 9 entities × 4 CRUD)

Each entity has identical CRUD structure:

| Entity | List | Create | Update | Delete |
|--------|------|--------|--------|--------|
| `brand.colors` | ✅ | ✅ | ✅ | ✅ |
| `brand.sizes` | ✅ | ✅ | ✅ | ✅ |
| `brand.materials` | ✅ | ✅ | ✅ | ✅ |
| `brand.seasons` | ✅ | ✅ | ✅ | ✅ |
| `brand.facilities` | ✅ | ✅ | ✅ | ✅ |
| `brand.showcaseBrands` | ✅ | ✅ | ✅ | ✅ |
| `brand.ecoClaims` | ✅ | ✅ | ✅ | ✅ |
| `brand.certifications` | ✅ | ✅ | ✅ | ✅ |
| `brand.tags` | ✅ | ✅ | ✅ | ✅ |

All use `brandRequiredProcedure` and follow consistent patterns via `createCatalogResourceRouter()` factory.

### products Router (10 endpoints)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `products.list` | Query | ✅ | ✅ | `productsDomainListSchema` | Paginated products with filters |
| `products.get` | Query | ✅ | ✅ | `productsDomainGetSchema` | Single product by ID |
| `products.getByUpid` | Query | ✅ | ✅ | `productsDomainGetByUpidSchema` | Single product by UPID |
| `products.create` | Mutation | ✅ | ✅ | `productsDomainCreateSchema` | Create product |
| `products.update` | Mutation | ✅ | ✅ | `productsDomainUpdateSchema` | Update product |
| `products.delete` | Mutation | ✅ | ✅ | `productsDomainDeleteSchema` | Delete product |
| `products.variants.list` | Query | ✅ | ✅ | `listVariantsSchema` | Paginated variants |
| `products.variants.get` | Query | ✅ | ✅ | `getVariantsSchema` | All variants for product |
| `products.variants.upsert` | Mutation | ✅ | ✅ | `productVariantsUpsertSchema` | Replace variants |
| `products.variants.delete` | Mutation | ✅ | ✅ | `productVariantsDeleteSchema` | Delete variants |

### templates Router (5 endpoints - TO BE REMOVED)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `templates.list` | Query | ✅ | ✅ | `passportTemplatesListSchema` | List templates |
| `templates.get` | Query | ✅ | ✅ | `passportTemplatesGetSchema` | Get template with modules |
| `templates.create` | Mutation | ✅ | ✅ | `passportTemplatesCreateSchema` | Create template |
| `templates.update` | Mutation | ✅ | ✅ | `passportTemplatesUpdateSchema` | Update template |
| `templates.delete` | Mutation | ✅ | ✅ | `passportTemplatesDeleteSchema` | Delete template |

### bulk Router (16 endpoints)

**bulk.import (5 endpoints)**

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `bulk.import.validate` | Mutation | ✅ | ✅ | `validateImportSchema` | ⚠️ DEPRECATED |
| `bulk.import.start` | Mutation | ✅ | ✅ | `startImportSchema` | Start import job |
| `bulk.import.status` | Query | ✅ | ✅ | `getImportStatusSchema` | Job status |
| `bulk.import.approve` | Mutation | ✅ | ✅ | `approveImportSchema` | Approve & commit |
| `bulk.import.cancel` | Mutation | ✅ | ✅ | `cancelImportSchema` | Cancel job |

**bulk.staging (4 endpoints)**

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `bulk.staging.reviewSummary` | Query | ✅ | ✅ | `exportFailedRowsSchema` | All review data |
| `bulk.staging.preview` | Query | ✅ | ✅ | `getStagingPreviewSchema` | Staging preview |
| `bulk.staging.errors` | Query | ✅ | ✅ | `getImportErrorsSchema` | Import errors |
| `bulk.staging.export` | Query | ✅ | ✅ | `exportFailedRowsSchema` | Export failed rows |

**bulk.values (6 endpoints)**

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `bulk.values.unmapped` | Query | ✅ | ✅ | `getUnmappedValuesSchema` | Values needing definition |
| `bulk.values.catalogData` | Query | ✅ | ✅ | `getUnmappedValuesSchema` | Catalog for mapping UI |
| `bulk.values.ensureCategory` | Mutation | ✅ | ✅ | `{ jobId, path[] }` | Create category path |
| `bulk.values.define` | Mutation | ✅ | ✅ | `defineValueSchema` | Define single value |
| `bulk.values.batchDefine` | Mutation | ✅ | ✅ | `batchDefineValuesSchema` | Define multiple values |
| `bulk.values.mapToExisting` | Mutation | ✅ | ✅ | `mapToExistingEntitySchema` | Map to existing entity |

### composite Router (3 endpoints)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `composite.workflowInit` | Query | ✅ | ❌ | None | User + brands + invites |
| `composite.membersWithInvites` | Query | ✅ | ✅ | `workflowBrandIdOptionalSchema` | Members + invites |
| `composite.brandCatalogContent` | Query | ✅ | ✅ | None | All catalog data |

### summary Router (1 endpoint)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `summary.productStatus` | Query | ✅ | ✅ | None (void) | Product count by status |

### dppPublic Router (2 endpoints)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `dppPublic.getByProductUpid` | Query | ❌ | ❌ | `{ brandSlug, productUpid }` | DPP by product |
| `dppPublic.getByVariantUpid` | Query | ❌ | ❌ | `{ brandSlug, productUpid, variantUpid }` | DPP by variant |

### internal Router (2 endpoints)

| Endpoint | Type | Auth | Brand | Input | Purpose |
|----------|------|------|-------|-------|---------|
| `internal.emitProgress` | Mutation | API Key | ❌ | Progress payload | WebSocket updates |
| `internal.cleanupJob` | Mutation | API Key | ❌ | `{ jobId }` | Cleanup connections |

**Total: ~93 endpoints** (excluding 5 template endpoints to be removed)

---

## 6. Schema Layer

### Shared Primitives (`_shared/primitives.ts`)

```typescript
// String primitives
uuidSchema          // UUID v4 format
shortStringSchema   // 1-100 chars (names, titles)
mediumStringSchema  // 1-500 chars (summaries)
longStringSchema    // 1-2000 chars (descriptions)
slugSchema          // 2-50 chars, lowercase alphanumeric + dashes
hexColorSchema      // 6-char hex, normalized uppercase
emailSchema         // Email format
urlSchema           // URL format
datetimeSchema      // ISO 8601 datetime
countryCodeSchema   // 2-letter ISO country code

// Number primitives
intSchema           // Integer
avatarHueSchema     // 1-359 (color hue)
percentageSchema    // 0-100
nonNegativeIntSchema // >= 0
paginationLimitSchema // 1-100

// Array primitives
uuidArraySchema     // Array of UUIDs
```

### Shared Patterns (`_shared/patterns.ts`)

```typescript
// ID patterns
byIdSchema          // { id: uuid }
byParentId(key)     // { [key]: uuid }

// Empty payload
voidSchema          // z.void()

// Update helpers
updateWithNullable(createSchema, nullableFields)
updateFrom(createSchema)

// Field selection
createFieldSelection(allowedFields)
```

### Domain Schema (`_shared/domain.ts`)

```typescript
roleSchema = z.enum(["owner", "member"]);
```

### Key Schema Files

| File | Key Schemas | Used By |
|------|-------------|---------|
| `workflow.ts` | `workflowCreateSchema`, `workflowMembersUpdateSchema`, `workflowInvitesRespondSchema` | workflow router |
| `products.ts` | `productsDomainListSchema`, `filterStateSchema`, `productVariantsUpsertSchema` | products router |
| `bulk.ts` | `bulkSelectionSchema`, `defineValueSchema`, entity data schemas | bulk router |
| `brand-catalog/*` | CRUD schemas for each catalog entity | brand router |

### FilterState Schema (Complex)

```typescript
// products.ts - Used for advanced product filtering
filterStateSchema = z.object({
  groups: z.array(filterGroupSchema),  // AND between groups
});

filterGroupSchema = z.object({
  id: z.string(),
  conditions: z.array(filterConditionSchema),  // OR within group
  asGroup: z.boolean().optional(),
});

filterConditionSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  operator: z.string(),
  value: filterValueSchema,
  nestedConditions: z.array(filterConditionSchema).optional(),
});
```

---

## 7. Query Layer

### Query File Responsibilities

| File | Entities | Key Functions |
|------|----------|---------------|
| `users.ts` | Users | `getUserById`, `updateUser`, `deleteUser`, `isEmailTaken` |
| `brands.ts` | Brands, Theme | `getBrandsByUserId`, `createBrand`, `updateBrand`, `deleteBrand`, `getBrandTheme`, `updateBrandThemeConfig`, `listProductsForCarouselSelection` |
| `brand-members.ts` | Memberships | `leaveBrand`, `deleteMember`, `updateMemberRole`, `getOwnerCountsByBrandIds` |
| `brand-invites.ts` | Invites | `createBrandInvites`, `acceptBrandInvite`, `declineBrandInvite`, `revokeBrandInviteByOwner`, `listPendingInvitesForEmail` |
| `brand-catalog.ts` | All catalog entities | `listColors`, `createColor`, `updateColor`, `deleteColor` (×9 entities) |
| `products.ts` | Products, Variants, Attributes | `listProductsWithIncludes`, `getProductWithIncludes`, `createProduct`, `updateProduct`, `deleteProduct`, `setProductEcoClaims`, `setProductJourneySteps`, `upsertProductMaterials` |
| `templates.ts` | Templates | `listPassportTemplatesForBrand`, `createPassportTemplate`, `updatePassportTemplate`, `deletePassportTemplate` |
| `bulk-import.ts` | Import jobs | `createImportJob`, `updateImportJobStatus`, `getImportJobStatus`, `countStagingProductsByAction` |
| `staging.ts` | Staging data | `getStagingPreview`, `getImportErrors`, `getFailedRowsForExport`, `deleteStagingDataForJob` |
| `value-mappings.ts` | Value mappings | `getUnmappedValuesForJob`, `createValueMapping`, `updateValueMapping`, `validateAndCreateEntity` |
| `dpp-public.ts` | Public DPP | `getDppByProductUpid`, `getDppByVariantUpid`, `transformToDppData` |

### Query Complexity Analysis

**High Complexity:**
- `listProductsWithIncludes` - Handles FilterState → SQL conversion, pagination, sorting, optional includes
- `getDppByProductUpid/ByVariantUpid` - Complex joins across 10+ tables for DPP data assembly

**Medium Complexity:**
- `getBrandsByUserId` - Joins brands + members + owner counts
- `createBrandInvites` - Handles existing user detection, token generation

**Low Complexity:**
- Brand catalog CRUD - Straightforward single-table operations
- User CRUD - Simple profile operations

### Re-exported Drizzle Utilities

```typescript
// packages/db/src/queries/index.ts
export { and, asc, desc, eq, inArray, isNull, sql, SQL } from "drizzle-orm";
```

This allows routers to import query operators alongside query functions.

---

## 8. Client Integration

### Next.js App Client (`apps/app/src/trpc/`)

**Files:**
- `client.tsx` - Browser TRPC client with React Query
- `server.tsx` - Server-side TRPC caller for RSC
- `query-client.ts` - React Query client configuration

**Client Setup:**

```typescript
// client.tsx - Browser client
export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getApiUrl()}/trpc`,
          headers: async () => ({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      ],
    })
  );
  // ...
}
```

**Server Caller:**

```typescript
// server.tsx - RSC server caller
export async function serverClient() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  return createCaller(createTRPCContextFromHeaders({
    authorization: `Bearer ${session?.access_token}`,
  }));
}
```

### Usage Patterns

```typescript
// Client component (React Query)
const { data, isLoading } = trpc.products.list.useQuery({ limit: 50 });
const mutation = trpc.products.create.useMutation();

// Server component (direct call)
const caller = await serverClient();
const products = await caller.products.list({ limit: 50 });
```

---

## 9. Supabase Integration

### Client Types

| Client | Creation | Purpose | RLS |
|--------|----------|---------|-----|
| User-scoped | `createSupabaseForRequest(authHeader)` | User operations | ✅ Enforced |
| Admin | `createSupabaseAdmin()` | Privileged ops | ❌ Bypassed |

### Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `avatars` | User profile images | Private (proxied) |
| `brand-avatars` | Brand logos | Private (proxied) |
| `product-imports` | Import CSV/Excel files | Private |
| `dpp-themes` | Theme stylesheets | Public |

### Obsolete Supabase Queries (`packages/supabase/src/queries/`)

⚠️ **These queries are legacy and should be removed/migrated:**

```typescript
// packages/supabase/src/queries/index.ts
export async function getUser()           // Duplicates auth flow
export async function getPosts()          // Feature removed
export async function getUserProfile()    // Duplicates db query
export async function getMyBrands()       // Duplicates db query
```

These use the Supabase client directly instead of going through TRPC/Drizzle, creating inconsistency.

---

## 10. Identified Issues

### 10.1 Naming Inconsistencies

| Current | Semantic Meaning | Confusion |
|---------|------------------|-----------|
| `workflow` router | Brand lifecycle | "Workflow" implies process/state, not entity |
| `brand` router | Brand catalog | Conflicts with `workflow` being about brands |
| `workflow.theme` | Theme configuration | Misplaced under "workflow" |

### 10.2 Endpoint Placement Issues

| Endpoint | Current Location | Issue |
|----------|-----------------|-------|
| `workflow.setActive` | `workflow` | Should be `user.update` (changes user's brand_id) |
| `workflow.invites.respond` | `workflow` | Mixed concerns - accept/decline is user-level |
| `workflow.theme.listCarouselProducts` | `workflow.theme` | Product-related, not theme |

### 10.3 Schema Duplication

- `brand.ts` and `workflow.ts` both have brand-related schemas
- Invite schemas exist in both files
- No dedicated theme schema file (inline in router)

### 10.4 Deprecated/Unused Code

| Item | Location | Status |
|------|----------|--------|
| `bulk.import.validate` | `bulk/import.ts` | Marked deprecated, still exists |
| Templates router | `templates/index.ts` | Feature removed, still exists |
| Supabase queries | `packages/supabase/src/queries/` | Legacy, duplicates Drizzle |

### 10.5 Missing Endpoints

| Use Case | Missing Endpoint |
|----------|-----------------|
| Public carousel for DPP | No endpoint to fetch carousel products for consumers |

### 10.6 Inconsistent Include Patterns

Products have `includeVariants`/`includeAttributes` but variants don't have similar patterns for fetching by UPID instead of ID.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Routers | 10 |
| Total Endpoints | ~93 (excl. templates) |
| Schema Files | 15 |
| Query Files | 13 |
| LOC (schemas) | ~1,500 |
| LOC (routers) | ~3,500 |
| LOC (queries) | ~7,500 |

---

*Document generated as part of API redesign initiative. Last updated: December 2024*

