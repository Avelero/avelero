# Integration System Research Document

> **Purpose**: This document provides a comprehensive snapshot of the current Avelero codebase state, focusing on files relevant to the integration management system implementation.
>
> **Last Updated**: December 2024

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Database Schema - Current State](#2-database-schema---current-state)
3. [API Layer - Current State](#3-api-layer---current-state)
4. [Background Jobs - Current State](#4-background-jobs---current-state)
5. [Query Patterns](#5-query-patterns)
6. [Data Model Relationships](#6-data-model-relationships)
7. [Existing Patterns to Follow](#7-existing-patterns-to-follow)

---

## 1. Project Overview

### 1.1 Repository Structure

```
avelero-v2/
├── apps/
│   ├── api/          # tRPC API server (Hono + tRPC)
│   ├── app/          # Next.js management application
│   ├── dpp/          # Digital Product Passport viewer
│   └── web/          # Marketing website
├── packages/
│   ├── db/           # Drizzle ORM schemas & queries
│   ├── jobs/         # Trigger.dev background tasks
│   ├── supabase/     # Supabase client utilities
│   ├── ui/           # Shared UI components
│   └── ...           # Other shared packages
└── tooling/          # TypeScript configurations
```

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL (via Supabase) |
| ORM | Drizzle ORM |
| API | tRPC + Hono |
| Background Jobs | Trigger.dev v4 |
| Frontend | Next.js 14+ (App Router) |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |

---

## 2. Database Schema - Current State

### 2.1 Schema Organization

```
packages/db/src/schema/
├── core/                    # Core system entities
│   ├── users.ts
│   ├── brands.ts
│   ├── brand-members.ts
│   └── brand-invites.ts
├── brands/                  # Brand-scoped lookup tables
│   ├── brand-certifications.ts
│   ├── brand-collections.ts
│   ├── brand-colors.ts
│   ├── brand-eco-claims.ts
│   ├── brand-facilities.ts
│   ├── brand-manufacturers.ts
│   ├── brand-materials.ts
│   ├── brand-seasons.ts
│   ├── brand-sizes.ts
│   ├── brand-tags.ts
│   ├── brand-theme.ts
│   └── categories.ts
├── products/                # Product data
│   ├── products.ts
│   ├── product-variants.ts
│   ├── product-materials.ts
│   ├── product-journey-steps.ts
│   ├── product-environment.ts
│   ├── product-eco-claims.ts
│   └── tags-on-product.ts
├── staging/                 # Bulk import staging
│   ├── staging-products.ts
│   ├── staging-product-variants.ts
│   ├── staging-product-materials.ts
│   ├── staging-product-journey-steps.ts
│   ├── staging-product-environment.ts
│   ├── staging-eco-claims.ts
│   └── value-mappings.ts
├── data/                    # Import/export tracking
│   ├── file-assets.ts
│   ├── import-jobs.ts
│   └── import-rows.ts
└── index.ts                 # Export aggregator
```

### 2.2 Core Tables

#### `brands` (packages/db/src/schema/core/brands.ts)
```typescript
{
  id: uuid().primaryKey(),
  name: text().notNull(),
  slug: text(),                    // For public DPP URLs
  email: text(),
  countryCode: text(),
  logoPath: text(),
  avatarHue: smallint(),           // 1-360 for avatar color
  createdAt: timestamp(),
  updatedAt: timestamp(),
  deletedAt: timestamp(),          // Soft delete
}
```

#### `users_on_brand` (brand_members)
```typescript
{
  id: uuid().primaryKey(),
  userId: uuid().references(users.id),
  brandId: uuid().references(brands.id),
  role: text(),                    // 'owner' | 'member'
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

### 2.3 Product Tables

#### `products` (packages/db/src/schema/products/products.ts)
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  productIdentifier: text().notNull(),    // Brand's internal SKU/code
  ean: text(),                            // EAN barcode
  gtin: text(),                           // GTIN
  upid: text(),                           // Our unique identifier
  description: text(),
  manufacturerId: uuid().references(brand_manufacturers.id),
  primaryImagePath: text(),
  weight: numeric(10, 2),
  weightUnit: text(),
  gender: text(),
  webshopUrl: text(),
  price: numeric(10, 2),
  currency: text(),
  salesStatus: text(),
  categoryId: uuid().references(categories.id),
  seasonId: uuid().references(brand_seasons.id),
  status: text().default('unpublished'),  // published|unpublished|archived|scheduled
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, productIdentifier)
```

#### `product_variants` (packages/db/src/schema/products/product-variants.ts)
```typescript
{
  id: uuid().primaryKey(),
  productId: uuid().references(products.id).notNull(),
  colorId: uuid().references(brand_colors.id),
  sizeId: uuid().references(brand_sizes.id),
  upid: text(),                           // Variant-level unique ID
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

#### `product_materials` (packages/db/src/schema/products/product-materials.ts)
```typescript
{
  id: uuid().primaryKey(),
  productId: uuid().references(products.id).notNull(),
  brandMaterialId: uuid().references(brand_materials.id).notNull(),
  percentage: numeric(6, 2),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (productId, brandMaterialId)
```

#### `product_journey_steps` (packages/db/src/schema/products/product-journey-steps.ts)
```typescript
{
  id: uuid().primaryKey(),
  productId: uuid().references(products.id).notNull(),
  sortIndex: integer().notNull(),
  stepType: text().notNull(),             // e.g., 'spinning', 'weaving', 'dyeing'
  facilityId: uuid().references(brand_facilities.id).notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (productId, sortIndex)
```

#### `product_environment` (packages/db/src/schema/products/product-environment.ts)
```typescript
{
  productId: uuid().primaryKey(),         // 1:1 with products
  carbonKgCo2e: numeric(12, 4),
  waterLiters: numeric(12, 4),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

#### `product_eco_claims` (packages/db/src/schema/products/product-eco-claims.ts)
```typescript
{
  id: uuid().primaryKey(),
  productId: uuid().references(products.id).notNull(),
  ecoClaimId: uuid().references(brand_eco_claims.id).notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (productId, ecoClaimId)
```

#### `tags_on_product` (packages/db/src/schema/products/tags-on-product.ts)
```typescript
{
  id: uuid().primaryKey(),
  tagId: uuid().references(brand_tags.id).notNull(),
  productId: uuid().references(products.id).notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (tagId, productId)
```

### 2.4 Brand Lookup Tables (Catalog)

#### `brand_colors`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  hex: text(),                            // e.g., '#FF5733'
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, name)
```

#### `brand_sizes`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  sortIndex: integer(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, name)
```

#### `brand_materials`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  certificationId: uuid().references(brand_certifications.id),
  recyclable: boolean(),
  countryOfOrigin: text(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

#### `brand_seasons`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),                 // e.g., 'SS25', 'FW24'
  startDate: date(),
  endDate: date(),
  ongoing: boolean().default(false),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, name)
```

#### `brand_facilities`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  displayName: text().notNull(),
  legalName: text(),
  email: text(),
  phone: text(),
  website: text(),
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  state: text(),
  zip: text(),
  countryCode: text(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

#### `brand_manufacturers`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  legalName: text(),
  email: text(),
  phone: text(),
  website: text(),
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  state: text(),
  zip: text(),
  countryCode: text(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, name)
```

#### `brand_eco_claims`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  claim: text().notNull(),                // Max 50 chars
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, claim)
```

#### `brand_tags`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  name: text().notNull(),
  hex: text(),                            // Optional color
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (brandId, name)
```

#### `brand_certifications`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  title: text().notNull(),
  certificationCode: text(),
  instituteName: text(),
  instituteEmail: text(),
  instituteWebsite: text(),
  instituteAddressLine1: text(),
  instituteAddressLine2: text(),
  instituteCity: text(),
  instituteState: text(),
  instituteZip: text(),
  instituteCountryCode: text(),
  issueDate: timestamp(),
  expiryDate: timestamp(),
  filePath: text(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
```

#### `categories` (Global - not brand-scoped)
```typescript
{
  id: uuid().primaryKey(),
  name: text().notNull(),
  parentId: uuid().references(categories.id),  // Hierarchical
  createdAt: timestamp(),
  updatedAt: timestamp(),
}
// Unique constraint: (parentId, name)
```

### 2.5 Import/Staging Tables

#### `import_jobs`
```typescript
{
  id: uuid().primaryKey(),
  brandId: uuid().references(brands.id).notNull(),
  filename: text().notNull(),
  startedAt: timestamp(),
  finishedAt: timestamp(),
  commitStartedAt: timestamp(),
  status: text().default('PENDING'),      // PENDING|VALIDATING|VALIDATED|COMMITTING|COMPLETED|FAILED|CANCELLED
  requiresValueApproval: boolean().default(false),
  summary: jsonb(),                        // Progress tracking, errors, etc.
}
```

---

## 3. API Layer - Current State

### 3.1 Router Structure

```
apps/api/src/trpc/routers/
├── _app.ts                  # Root router aggregation
├── user/
│   └── index.ts             # User profile, invites, brand management
├── brand/
│   ├── index.ts
│   ├── base.ts              # Brand CRUD
│   ├── collections.ts       # Smart collections
│   ├── invites.ts           # Member invitations
│   ├── members.ts           # Member management
│   └── theme.ts             # DPP theming
├── catalog/
│   └── index.ts             # 36 CRUD endpoints for lookup tables
├── products/
│   ├── index.ts             # Product CRUD with relations
│   └── variants.ts          # Variant operations
├── bulk/
│   ├── index.ts
│   ├── import.ts            # Import job lifecycle
│   ├── staging.ts           # Staging data queries
│   └── values.ts            # Value mapping operations
├── composite/
│   └── index.ts             # Performance-optimized endpoints
├── summary/
│   └── index.ts             # Aggregated stats
├── dpp-public/
│   └── index.ts             # Public DPP endpoints (no auth)
└── internal/
    └── index.ts             # Server-to-server (API key auth)
```

### 3.2 Key Router: `appRouter` (apps/api/src/trpc/routers/_app.ts)

```typescript
export const appRouter = createTRPCRouter({
  user: userRouter,
  brand: brandRouter,
  catalog: catalogRouter,
  products: productsRouter,
  bulk: bulkRouter,
  composite: compositeRouter,
  summary: summaryRouter,
  internal: internalRouter,
  dppPublic: dppPublicRouter,
});
```

### 3.3 Authentication Pattern

```typescript
// Brand-required procedure (most common)
export const brandRequiredProcedure = publicProcedure
  .use(authMiddleware)
  .use(brandMiddleware);

// Context includes:
type BrandContext = {
  db: Database;
  userId: string;
  brandId: string;
};
```

---

## 4. Background Jobs - Current State

### 4.1 Trigger.dev Configuration

**File**: `packages/jobs/trigger.config.ts`
```typescript
export const config: TriggerConfig = {
  project: "proj_mqxiyipljbptdmfeivig",
  logLevel: "log",
  maxDuration: 60,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
};
```

### 4.2 Existing Tasks

```
packages/jobs/src/trigger/
├── configure-trigger.ts      # Environment setup
├── index.ts                  # Task exports
├── progress-emitter.ts       # WebSocket-like progress updates
├── validate-and-stage.ts     # Bulk import Phase 1
├── commit-to-production.ts   # Bulk import Phase 2
├── cleanup-expired-invites.ts # Scheduled (cron: 0 2 * * *)
├── capture-theme-screenshot.ts # On-demand
├── delete-brand.ts           # On-demand
└── invite.ts                 # Disabled due to email issues
```

### 4.3 Scheduled Task Pattern

```typescript
// packages/jobs/src/trigger/cleanup-expired-invites.ts
export const cleanupExpiredInvites = schedules.task({
  id: "cleanup-expired-invites",
  cron: "0 2 * * *",  // Every day at 02:00 UTC
  run: async () => {
    // Task implementation
  },
});
```

### 4.4 On-Demand Task Pattern

```typescript
// packages/jobs/src/trigger/validate-and-stage.ts
export const validateAndStage = task({
  id: "validate-and-stage",
  maxDuration: 1800,  // 30 minutes
  queue: { concurrencyLimit: 5 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: ValidateAndStagePayload) => {
    // Task implementation
  },
});
```

### 4.5 Task Triggering Pattern

```typescript
// From API router
import { tasks } from "@trigger.dev/sdk/v3";

const runHandle = await tasks.trigger("validate-and-stage", {
  jobId: job.id,
  brandId,
  filePath: resolvedFile.path,
});
```

---

## 5. Query Patterns

### 5.1 Query File Structure

```
packages/db/src/queries/
├── index.ts                  # Export aggregator
├── users.ts
├── brands.ts
├── brand-members.ts
├── brand-invites.ts
├── brand-collections.ts
├── brand-catalog.ts          # Catalog CRUD operations
├── catalog.ts                # Catalog listing
├── products.ts               # Product CRUD + relations
├── bulk-import.ts            # Import job operations
├── staging.ts                # Staging table operations
├── value-mappings.ts         # CSV value → DB entity mappings
├── dpp-public.ts             # Public DPP queries
└── carousel-products.ts      # Product selection queries
```

### 5.2 Batch Loading Pattern (N+1 Prevention)

```typescript
// packages/db/src/queries/products.ts
async function loadAttributesForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductAttributesBundle>> {
  const map = new Map<string, ProductAttributesBundle>();
  if (productIds.length === 0) return map;

  // Single query for all materials
  const materialRows = await db
    .select({ ... })
    .from(productMaterials)
    .where(inArray(productMaterials.productId, [...productIds]));

  // Group results by productId
  for (const row of materialRows) {
    // Build attribute bundles...
  }

  return map;
}
```

### 5.3 Upsert Pattern

```typescript
// packages/db/src/queries/products.ts
export async function upsertProductEnvironment(
  db: Database,
  productId: string,
  input: { carbonKgCo2e?: string; waterLiters?: string },
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(productEnvironment)
      .values({ productId, ...input })
      .onConflictDoUpdate({
        target: productEnvironment.productId,
        set: { ...input },
      });
  });
}
```

---

## 6. Data Model Relationships

### 6.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BRAND SCOPE                                     │
│  ┌─────────┐                                                                │
│  │  brand  │◄──────────────────────────────────────────────────────────┐    │
│  └────┬────┘                                                           │    │
│       │                                                                │    │
│       │ 1:N                                                            │    │
│       ▼                                                                │    │
│  ┌─────────────────────────────────────────────────────────────────┐  │    │
│  │                    LOOKUP TABLES                                 │  │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐│  │    │
│  │  │  colors   │ │   sizes   │ │ materials │ │   certifications  ││  │    │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────────┬─────────┘│  │    │
│  │        │             │             │                 │          │  │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐│  │    │
│  │  │  seasons  │ │facilities │ │   tags    │ │   eco_claims      ││  │    │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────────┬─────────┘│  │    │
│  │        │             │             │                 │          │  │    │
│  │  ┌───────────────────┴─────────────┴─────────────────┘          │  │    │
│  │  │  manufacturers                                                │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                     │
│       │ FK references                                                       │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         PRODUCTS                                     │   │
│  │  ┌─────────────────┐                                                │   │
│  │  │    products     │◄─────────────────────────────────┐             │   │
│  │  │  - seasonId     │                                  │             │   │
│  │  │  - categoryId   │                                  │             │   │
│  │  │  - manufacturerId                                  │             │   │
│  │  └────────┬────────┘                                  │             │   │
│  │           │                                           │             │   │
│  │           │ 1:N                                       │             │   │
│  │           ▼                                           │             │   │
│  │  ┌────────────────────────────────────────────────────┴──────────┐  │   │
│  │  │  product_variants  │  product_materials  │  product_eco_claims│  │   │
│  │  │  (colorId, sizeId) │  (brandMaterialId)  │  (ecoClaimId)      │  │   │
│  │  └────────────────────┴─────────────────────┴────────────────────┘  │   │
│  │           │                                                         │   │
│  │  ┌────────┴───────────────────────────────────────────────────────┐ │   │
│  │  │  product_journey_steps  │  product_environment  │ tags_on_product│   │
│  │  │  (facilityId)           │  (1:1 with products)  │ (tagId)       │ │   │
│  │  └─────────────────────────┴───────────────────────┴───────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ Global (not brand-scoped)
                                    ▼
                           ┌───────────────┐
                           │  categories   │
                           │  (hierarchical)│
                           └───────────────┘
```

### 6.2 Relationship Types Summary

| Relationship | Type | Tables |
|--------------|------|--------|
| Brand → Products | 1:N | brands → products |
| Product → Variants | 1:N | products → product_variants |
| Product → Materials | N:N | products ↔ brand_materials (via product_materials) |
| Product → Eco Claims | N:N | products ↔ brand_eco_claims (via product_eco_claims) |
| Product → Journey Steps | 1:N | products → product_journey_steps |
| Journey Step → Facility | N:1 | product_journey_steps → brand_facilities |
| Product → Environment | 1:1 | products ↔ product_environment |
| Product → Tags | N:N | products ↔ brand_tags (via tags_on_product) |
| Product → Season | N:1 | products → brand_seasons |
| Product → Category | N:1 | products → categories |
| Product → Manufacturer | N:1 | products → brand_manufacturers |
| Material → Certification | N:1 | brand_materials → brand_certifications |

---

## 7. Existing Patterns to Follow

### 7.1 RLS (Row-Level Security) Pattern

All brand-scoped tables use consistent RLS policies:

```typescript
pgPolicy("table_name_select_for_brand_members", {
  as: "permissive",
  for: "select",
  to: ["authenticated", "service_role"],
  using: sql`is_brand_member(brand_id)`,
}),
pgPolicy("table_name_insert_by_brand_member", {
  as: "permissive",
  for: "insert",
  to: ["authenticated", "service_role"],
  withCheck: sql`is_brand_member(brand_id)`,
}),
// ... update and delete similarly
```

For tables without direct `brand_id`, use EXISTS subqueries:

```typescript
using: sql`EXISTS (
  SELECT 1 FROM products 
  WHERE products.id = product_id 
  AND is_brand_member(products.brand_id)
)`,
```

### 7.2 Schema Definition Pattern

```typescript
import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const tableName = pgTable(
  "table_name",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    // ... fields
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("table_name_brand_field_unq").on(table.brandId, table.field),
    // RLS policies...
  ],
);
```

### 7.3 API Router Pattern (CRUD)

```typescript
export const resourceRouter = createTRPCRouter({
  list: brandRequiredProcedure
    .input(listSchema)
    .query(async ({ ctx, input }) => {
      const results = await listFn(ctx.db, ctx.brandId, input);
      return createListResponse(results);
    }),

  create: brandRequiredProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createFn(ctx.db, ctx.brandId, input);
      return createEntityResponse(result);
    }),

  update: brandRequiredProcedure
    .input(updateSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await updateFn(ctx.db, ctx.brandId, input.id, input);
      if (!result) throw notFound("resource", input.id);
      return createEntityResponse(result);
    }),

  delete: brandRequiredProcedure
    .input(deleteSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await deleteFn(ctx.db, ctx.brandId, input.id);
      if (!result) throw notFound("resource", input.id);
      return createEntityResponse(result);
    }),
});
```

### 7.4 Background Job Triggering Pattern

```typescript
// In API router
import { tasks } from "@trigger.dev/sdk/v3";

try {
  const runHandle = await tasks.trigger("task-id", payload);
  console.log("Job triggered", { runId: runHandle.id });
} catch (error) {
  // Handle trigger failure - update job status, throw error
  await updateJobStatus(db, { jobId, status: "FAILED" });
  throw error;
}
```

---

## Summary

This document captures the current state of the Avelero codebase relevant to implementing the integration management system. Key files and patterns documented include:

- **27 database tables** across 4 schema categories
- **9 API routers** with 50+ endpoints
- **6 background tasks** (4 active, 1 scheduled, 1 disabled)
- **14 query modules** with batch loading patterns
- **Consistent RLS policies** for multi-tenant security

The integration system will build upon these existing patterns and extend the data model with new tables for managing external system connections and field ownership.


